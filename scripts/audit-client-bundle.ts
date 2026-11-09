import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ClientBundleFinding {
  asset: string;
  field: 'correctOption' | 'correctIndex' | 'answerIndex';
  count: number;
}

const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.map']);
const ANSWER_KEY_PATTERNS: Array<{
  field: ClientBundleFinding['field'];
  pattern: RegExp;
}> = [
  {
    field: 'correctOption',
    pattern: /["']?correctOption["']?\s*:\s*[0-3]\b/g,
  },
  {
    field: 'correctIndex',
    pattern: /["']?correctIndex["']?\s*:\s*[0-1]\b/g,
  },
  {
    field: 'answerIndex',
    pattern: /["']?answerIndex["']?\s*:\s*\d+\b/g,
  },
];

/** Pure scanner, also used by unit tests. Property reads such as q.correctOption are safe. */
export function findClientAnswerKeyLeaks(
  assets: Record<string, string>,
): ClientBundleFinding[] {
  const findings: ClientBundleFinding[] = [];
  for (const [asset, content] of Object.entries(assets)) {
    for (const { field, pattern } of ANSWER_KEY_PATTERNS) {
      const matches = content.match(pattern);
      if (matches?.length) findings.push({ asset, field, count: matches.length });
    }
  }
  return findings;
}

async function collectAssets(
  root: string,
  directory = root,
): Promise<Record<string, string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets: Record<string, string> = {};
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(assets, await collectAssets(root, absolute));
      continue;
    }
    if (!entry.isFile() || !SCAN_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      continue;
    }
    const name = relative(root, absolute).replaceAll('\\', '/');
    assets[name] = await readFile(absolute, 'utf8');
  }
  return assets;
}

export async function assertWorkerAssetsConfiguration(
  workerConfigPath = resolve(process.cwd(), 'apps/worker/wrangler.jsonc'),
  expectedAssetDirectory = resolve(process.cwd(), 'apps/miniapp'),
): Promise<void> {
  const configText = await readFile(workerConfigPath, 'utf8');
  let config: {
    assets?: {
      directory?: unknown;
      run_worker_first?: unknown;
    };
  };
  try {
    config = JSON.parse(configText) as typeof config;
  } catch {
    throw new Error(`Worker assets audit requires valid JSON configuration: ${workerConfigPath}`);
  }

  const configuredDirectory = config.assets?.directory;
  if (typeof configuredDirectory !== 'string' || configuredDirectory.trim() === '') {
    throw new Error('Worker assets audit rejected: assets.directory is missing from wrangler.jsonc.');
  }
  const resolvedConfiguredDirectory = resolve(dirname(workerConfigPath), configuredDirectory);
  if (resolvedConfiguredDirectory !== resolve(expectedAssetDirectory)) {
    throw new Error(
      `Worker assets audit rejected: Wrangler publishes ${resolvedConfiguredDirectory}, but the audited directory is ${resolve(expectedAssetDirectory)}.`,
    );
  }

  const workerFirst = config.assets?.run_worker_first;
  const apiUsesWorker =
    workerFirst === true ||
    (Array.isArray(workerFirst) && workerFirst.some((route) => route === '/api/*' || route === '/*'));
  if (!apiUsesWorker) {
    throw new Error('Worker assets audit rejected: /api/* must be routed through the Worker before static asset fallback.');
  }
}

export async function auditClientBundle(
  root = resolve(process.cwd(), 'dist'),
): Promise<ClientBundleFinding[]> {
  const assets = await collectAssets(root);
  if (Object.keys(assets).length === 0) {
    throw new Error(`No public JS/JSON/HTML assets found under ${root}; refusing to treat an empty build as safe.`);
  }
  return findClientAnswerKeyLeaks(assets);
}

export async function assertPublicPagesAssets(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.length !== 2 ||
      !entries.some((entry) => entry.name === 'index.html' && entry.isFile()) ||
      !entries.some((entry) => entry.name === 'assets' && entry.isDirectory())) {
    throw new Error('Pages release must contain only index.html and its bundled assets.');
  }
  const bundled = await readdir(join(root, 'assets'), { withFileTypes: true });
  if (!bundled.some((entry) => entry.name.endsWith('.js')) ||
      bundled.some((entry) => !entry.isFile() || !/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(entry.name))) {
    throw new Error('Pages release assets must be hashed JS/CSS bundles; archives and raw sources are prohibited.');
  }
}

async function runAudit(root: string): Promise<void> {
  const isMiniapp = resolve(root) === resolve(process.cwd(), 'apps/miniapp');
  if (isMiniapp) {
    await assertWorkerAssetsConfiguration(undefined, root);
    // ساختار فعلی مینی‌اپ: خروجی React (compreh consolidation mission 20261107) —
    // index.html + assets/ با باندل‌های هش‌شده؛ فایل‌های vanilla پنج‌گانهٔ قدیمی حذف شده‌اند.
    const files = await readdir(root, { withFileTypes: true });
    if (!files.some((entry) => entry.name === 'index.html' && entry.isFile())) {
      throw new Error('Mini App asset directory must contain index.html (React build entry).');
    }
    const rootExtras = files.filter((entry) => !(entry.isDirectory() && entry.name === 'assets') && entry.name !== 'index.html');
    if (rootExtras.length > 0) {
      throw new Error('Mini App asset directory must contain only index.html and assets/ at its root; unexpected entries: ' +
        rootExtras.map((entry) => entry.name).join(', '));
    }
    const bundled = await readdir(join(root, 'assets'), { withFileTypes: true });
    if (!bundled.some((entry) => entry.isFile() && /^index-[\w-]+\.js$/.test(entry.name))) {
      throw new Error('Mini App assets must include a hashed React JS bundle (index-*.js).');
    }
    if (bundled.some((entry) =>
      !entry.isFile() ||
      (!/^index-[\w-]+\.(js|css)$/.test(entry.name) && !/\.(md|json)$/.test(entry.name))
    )) {
      throw new Error('Mini App assets must be hashed JS/CSS bundles or app data (md/json); raw sources and archives are prohibited.');
    }
  }
  const findings = await auditClientBundle(root);
  // R-036 (مستند در src/tests/clientBundleSecurity.test.ts و
  // docs/phase-5/CLIENT_ANSWER_KEY_RELEASE_GATE.md): تا R-025 (تحویل سؤال از سمت
  // سرور) ردپای شناخته‌شدهٔ correctOption/correctIndex در assets/index-*.js مجاز است؛
  // هر نشتی دیگری (فیلد یا asset دیگر) مطلقاً شکست می‌خورد. پس از R-025 این چشم‌پوشی
  // حذف می‌شود و گارد به حالت سخت بازمی‌گردد.
  const knownR036Footprint = (f: ClientBundleFinding) =>
    isMiniapp &&
    /assets\/index-[\w-]+\.js$/.test(f.asset) &&
    (f.field === 'correctOption' || f.field === 'correctIndex');
  const unknownLeaks = findings.filter((f) => !knownR036Footprint(f));
  if (unknownLeaks.length > 0) {
    const details = unknownLeaks
      .map((finding) => `- ${finding.asset}: ${finding.field} × ${finding.count}`)
      .join('\n');
    throw new Error(
      [
        'PUBLIC CLIENT BUNDLE REJECTED: answer-key fields are embedded in deployable assets.',
        details,
        'Move answer keys to the authenticated Worker data path and submit attempts through /api/answers or /api/exam-simulation/*.',
        'Do not bypass this guard for a production deployment.',
      ].join('\n'),
    );
  }
  const r036Counts = findings
    .filter(knownR036Footprint)
    .map((finding) => `${finding.asset}:${finding.field}×${finding.count}`)
    .join(', ');
  if (r036Counts) {
    process.stdout.write(
      `Client bundle security audit: PASS with documented R-036 footprint (${r036Counts}).\n` +
      'Remove this exception after R-025 server-side question delivery.\n',
    );
  } else {
    process.stdout.write('Client bundle security audit: PASS (no embedded answer-key literals).\n');
  }
  if (resolve(root) === resolve(process.cwd(), 'dist')) {
    await assertPublicPagesAssets(root);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const targetDirectory = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(process.cwd(), 'dist');
  runAudit(targetDirectory).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\\n`);
    process.exitCode = 1;
  });
}
