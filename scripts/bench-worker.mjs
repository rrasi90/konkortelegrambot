#!/usr/bin/env node
/**
 * Phase 5 §R-014 — local HTTP benchmark for the worker API.
 * No external load tool: uses Node's global fetch with a bounded worker pool.
 *
 * Usage:
 *   PORT=8787 npx tsx scripts/dev-server.mjs        # terminal 1
 *   node scripts/bench-worker.mjs                   # terminal 2
 * Env: BASE_URL, USERS, REQUESTS, CONCURRENCY
 */
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const users = Number(process.env.USERS ?? 20);
const requestsPerScenario = Number(process.env.REQUESTS ?? 200);
const concurrency = Number(process.env.CONCURRENCY ?? 20);

async function call(path, init) {
  const t0 = performance.now();
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  return { status: res.status, ms: performance.now() - t0, text, headers: res.headers };
}

function authInit(token, method = 'GET', body) {
  return {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function login(i) {
  const res = await call('/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: `perf-user-${i}` }),
  });
  if (res.status !== 200) throw new Error(`login ${i} failed: ${res.status} ${res.text}`);
  return JSON.parse(res.text).token;
}

async function runScenario(name, total, fn) {
  const latencies = [];
  const statuses = {};
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= total) return;
      let result;
      try {
        result = await fn(index);
      } catch (error) {
        statuses.network_error = (statuses.network_error ?? 0) + 1;
        latencies.push(Number.NaN);
        continue;
      }
      latencies.push(result.ms);
      statuses[result.status] = (statuses[result.status] ?? 0) + 1;
    }
  }
  const start = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  const elapsed = performance.now() - start;
  const finite = latencies.filter(Number.isFinite).sort((a, b) => a - b);
  const pct = (p) => finite.length === 0 ? null : finite[Math.min(finite.length - 1, Math.floor((p / 100) * finite.length))];
  const errors = Object.entries(statuses)
    .filter(([code]) => code === 'network_error' || Number(code) >= 400)
    .reduce((sum, [, count]) => sum + count, 0);
  return {
    scenario: name,
    requests: total,
    concurrency: Math.min(concurrency, total),
    errorCount: errors,
    statuses,
    rps: Math.round((total / (elapsed / 1000)) * 10) / 10,
    p50ms: pct(50) === null ? null : Math.round(pct(50) * 10) / 10,
    p90ms: pct(90) === null ? null : Math.round(pct(90) * 10) / 10,
    p99ms: pct(99) === null ? null : Math.round(pct(99) * 10) / 10,
    maxMs: finite.length ? Math.round(finite[finite.length - 1] * 10) / 10 : null,
    meanMs: finite.length ? Math.round((finite.reduce((s, v) => s + v, 0) / finite.length) * 10) / 10 : null,
  };
}

const main = async () => {
  console.log(`base=${base} users=${users} requests/scenario=${requestsPerScenario} concurrency=${concurrency}`);
  const tokens = [];
  for (let i = 0; i < users; i++) tokens.push(await login(i));

  const queues = [];
  for (const token of tokens) {
    const res = await call('/api/queue?limit=10', authInit(token));
    if (res.status !== 200) continue;
    const items = JSON.parse(res.text).items ?? [];
    for (const item of items) {
      const questionId = item.question?.id ?? item.card?.questionId;
      if (item.attemptId && questionId) queues.push({ token, questionId, attemptId: item.attemptId });
    }
  }

  const report = [];
  report.push(await runScenario('GET /api/health', requestsPerScenario, () => call('/api/health')));
  report.push(await runScenario('GET /api/analytics/learning', requestsPerScenario, () => call('/api/analytics/learning', authInit(tokens[0]))));
  report.push(await runScenario('GET /api/queue?limit=10', requestsPerScenario, (i) => call('/api/queue?limit=10', authInit(tokens[i % tokens.length]))));
  report.push(await runScenario('GET /api/map', requestsPerScenario, (i) => call('/api/map', authInit(tokens[i % tokens.length]))));
  report.push(await runScenario('GET /api/exam-structure', requestsPerScenario, (i) => call('/api/exam-structure?level=doctorate&year=1405', authInit(tokens[i % tokens.length]))));

  const answerTotal = Math.min(requestsPerScenario, queues.length);
  report.push(await runScenario('POST /api/answers', answerTotal, (i) => {
    const item = queues[i];
    return call('/api/answers', authInit(item.token, 'POST', {
      attemptId: item.attemptId,
      questionId: item.questionId,
      selectedOption: i % 4,
      responseTimeMs: 45000,
      confidenceRating: 3,
    }));
  }));

  report.push(await runScenario('POST /api/exam-simulation/start', Math.min(requestsPerScenario, tokens.length), (i) =>
    call('/api/exam-simulation/start', authInit(tokens[i], 'POST', {
      level: 'doctorate',
      examYear: 1405,
      subGroupId: 'industrial',
    })),
  ));

  console.table(report);
  console.log('\nJSON');
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), base, users, requestsPerScenario, concurrency, results: report }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
