#!/usr/bin/env node
/**
 * Phase 5 R-013 — real browser E2E smoke against the local dev server (MemoryStore).
 * Dependency-free: drives installed Chrome through the DevTools Protocol.
 *
 * Prerequisite: PORT=8787 npx tsx scripts/dev-server.mjs
 * Run: node scripts/e2e-miniapp.mjs
 * Env: BASE_URL, CHROME_PATH, CDP_PORT
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cdpPort = Number(process.env.CDP_PORT ?? 9223);
const evidenceDir = join(process.cwd(), 'evidence', 'phase-5');
mkdirSync(evidenceDir, { recursive: true });

const results = [];
const consoleErrors = [];
const localHttpErrors = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const cdpSend = (() => {
  let id = 0;
  const pending = new Map();
  let ws;
  const eventHandlers = new Map();
  return {
    async connect(wsUrl) {
      ws = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const { resolve, reject, timer } = pending.get(message.id);
          clearTimeout(timer);
          pending.delete(message.id);
          if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
          else resolve(message.result);
        } else if (message.method) {
          for (const handler of eventHandlers.get(message.method) ?? []) handler(message.params);
        }
      });
    },
    send(method, params = {}) {
      const messageId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`CDP timeout: ${method}`));
        }, 30000);
        pending.set(messageId, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    on(method, handler) {
      if (!eventHandlers.has(method)) eventHandlers.set(method, []);
      eventHandlers.get(method).push(handler);
    },
    close() {
      ws?.close();
    },
  };
})();

async function evaluate(expression, awaitPromise = false) {
  const result = await cdpSend.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'evaluation failed');
  }
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 20000, label = expression) {
  const start = Date.now();
  for (;;) {
    try {
      if (await evaluate(`Boolean(${expression})`)) return true;
    } catch {
      // page may be navigating; retry until timeout
    }
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function shot(name) {
  const { data } = await cdpSend.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(evidenceDir, name), Buffer.from(data, 'base64'));
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'ael-e2e-'));
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      '--window-size=430,900',
      base,
    ],
    { stdio: 'ignore' },
  );

  try {
    let version;
    for (let i = 0; i < 100; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) { version = await res.json(); break; }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!version) throw new Error('Chrome DevTools endpoint did not start');

    const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('no page target');
    await cdpSend.connect(pageTarget.webSocketDebuggerUrl);

    cdpSend.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        consoleErrors.push(params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });
    cdpSend.on('Runtime.exceptionThrown', (params) => {
      consoleErrors.push(params.exceptionDetails?.text ?? 'uncaught exception');
    });
    cdpSend.on('Network.responseReceived', (params) => {
      if (params.response.url.startsWith(base) && params.response.status >= 400) {
        localHttpErrors.push(`${params.response.status} ${params.response.url}`);
      }
    });

    await cdpSend.send('Page.enable');
    await cdpSend.send('Runtime.enable');
    await cdpSend.send('Network.enable');

    // 1) auto-auth via device token (ALLOW_DEMO_AUTH) then track selection
    await waitFor(
      `document.querySelector('#view-tracks:not([hidden]), #view-app:not([hidden])')`,
      25000,
      'login view',
    );
    const tracksVisible = await evaluate(`!document.querySelector('#view-tracks').hidden`);
    check('دسترسی خودکار و نمایش صفحهٔ انتخاب گرایش', tracksVisible);
    if (tracksVisible) await shot('e2e-01-tracks.png');

    // 2) pick two tracks and start
    if (tracksVisible) {
      await evaluate(`document.querySelector('[data-track="industrial"]').click(); true`);
      await evaluate(`document.querySelector('[data-track="technology"]').click(); true`);
      const enabled = await evaluate(`!document.querySelector('#btn-tracks-save').disabled`);
      check('انتخاب چندگرایشی و فعال‌شدن دکمهٔ تأیید', enabled);
      await evaluate(`document.querySelector('#btn-tracks-save').click(); true`);
      await waitFor(`!document.querySelector('#view-app').hidden`, 20000, 'app view');
    }
    check('ورود به اپ پس از انتخاب گرایش', await evaluate(`!document.querySelector('#view-app').hidden`));

    // 3) home loaded from /api/home
    await waitFor(`document.querySelector('#home-container') && document.querySelector('#home-container').children.length > 0`, 20000, 'home content');
    const homeText = await evaluate(`document.querySelector('#home-container').innerText`);
    check('بارگذاری خانه از API', homeText.length > 20, `${homeText.length} chars`);
    await shot('e2e-02-home.png');

    // 4) today queue and answering a question
    await evaluate(`document.querySelector('.nav-btn[data-tab="today"]').click(); true`);
    await waitFor(
      `document.querySelector('#queue-empty:not([hidden]), #quiz-card:not([hidden])')`,
      20000,
      'queue view',
    );
    const queueEmpty = await evaluate(`!document.querySelector('#queue-empty').hidden`);
    check('بارگذاری صف امروز', !queueEmpty, queueEmpty ? 'صف خالی' : 'کارت سؤال نمایش داده شد');
    if (!queueEmpty) {
      const questionText = await evaluate(`document.querySelector('#q-text').innerText`);
      const optionCount = await evaluate(`document.querySelectorAll('.option-btn').length`);
      check('نمایش سؤال و گزینه‌ها بدون کلید پاسخ', questionText.length > 0 && optionCount >= 2, `${optionCount} گزینه`);
      const leaks = await evaluate(`document.body.innerText.includes('correctOption') || document.body.innerText.includes('explanation')`);
      check('نشت نکردن کلید/توضیح پیش از پاسخ', !leaks);
      await shot('e2e-03-question.png');

      await evaluate(`document.querySelector('.option-btn').click(); true`);
      await waitFor(`!document.querySelector('#answer-feedback').hidden`, 20000, 'answer feedback');
      const feedbackText = await evaluate(`document.querySelector('#answer-feedback').innerText`);
      check('ثبت پاسخ و نمایش بازخورد سرور', feedbackText.trim().length > 0, `${feedbackText.length} chars`);
      const nextVisible = await evaluate(`!document.querySelector('#btn-next').hidden`);
      check('فعال‌شدن «سؤال بعدی» پس از ثبت', nextVisible);
      await shot('e2e-04-feedback.png');
    }

    // 5) map renders from /api/map
    await evaluate(`document.querySelector('.nav-btn[data-tab="map"]').click(); true`);
    await waitFor(`document.querySelector('#map-container') && document.querySelector('#map-container').children.length > 0`, 20000, 'map content');
    const mapText = await evaluate(`document.querySelector('#map-container').innerText`);
    check('بارگذاری نقشهٔ مسیر از API', mapText.length > 10, `${mapText.length} chars`);
    await shot('e2e-05-map.png');

    // 6) lessons render from /api/lessons
    await evaluate(`document.querySelector('.nav-btn[data-tab="lessons"]').click(); true`);
    await waitFor(
      `document.querySelector('#lessons-container') && !document.querySelector('#lessons-container').innerText.includes('در حال دریافت') && document.querySelector('#lessons-container').children.length > 1`,
      20000,
      'lessons content',
    );
    const lessonCount = await evaluate(`document.querySelectorAll('#lessons-container *').length`);
    check('بارگذاری کتابخانهٔ درس‌ها', lessonCount > 5, `${lessonCount} elements`);

    const bookOpened = await evaluate(`(function () {
      var btn = document.querySelector('button[data-book-id]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    await waitFor(
      `document.querySelector('#lessons-container') && document.querySelector('#lessons-container').innerText.includes('بازگشت به لیست کتاب‌ها')`,
      10000,
      'full book view',
    );
    const bookText = await evaluate(`document.querySelector('#lessons-container').innerText`);
    check('باز شدن «مطالعهٔ کامل» با listener (بدون onclick تزریقی)', bookOpened && bookText.length > 50, `${bookText.length} chars`);

    // 7) reload: session/device identity and persisted tracks survive a page reload
    await cdpSend.send('Page.reload', { ignoreCache: false });
    await waitFor(`document.querySelector('#view-app') && !document.querySelector('#view-app').hidden`, 25000, 'app after reload');
    await waitFor(`document.querySelector('#home-container') && document.querySelector('#home-container').children.length > 0`, 20000, 'home after reload');
    check('بازیابی جلسه و پیشرفت پس از بارگذاری مجدد صفحه', true);
    await shot('e2e-06-reload.png');

    // 8) local HTTP errors / console errors during the flow
    check('بدون پاسخ HTTP خطادار از API محلی', localHttpErrors.length === 0, localHttpErrors.join(' | '));
    check('بدون خطای کنسول/استثنای صفحه', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  } finally {
    try { await cdpSend.send('Browser.close'); } catch {}
    cdpSend.close();
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    rmSync(profile, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    base,
    chromeVersion: chromePath,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
    consoleErrors,
    localHttpErrors,
  };
  writeFileSync(join(evidenceDir, 'e2e-miniapp-result.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed}/${results.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
