import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ClientBundleFinding {
  asset: string;
  field:
    | 'correctOption'
    | 'correctIndex'
    | 'answerIndex'
    | 'solutionIndex'
    | 'isCorrectLiteral'
    | 'canaryValue'
    | 'serverRegistryReference';
  count: number;
}

const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.map']);
/** Vite emits an entry chunk and dynamic chunks, each with an eight-character hash. */
const HASHED_BUNDLE = /^(?:index-[A-Za-z0-9_-]+|[A-Za-z0-9][\w.-]*-[A-Za-z0-9_-]{8})\.(?:js|css)$/;
/**
 * R-036 گارد سخت — بدون هیچ استثنا (مأموریت v4 §3.2):
 *  - الگوی فیلد+مقدار: کلید پاسخ داده‌شده (نه خواندن خصوصیت مثل q.correctOption).
 *  - مقدارهای حساس شناخته‌شده: متن/مقدار canary رجیستری سرور.
 *  - ارجاع به رجیستری سرور کلیدها: هرگز نباید به Bundle عمومی برسد.
 */
const ANSWER_KEY_PATTERNS: Array<{
  field: ClientBundleFinding['field'];
  pattern: RegExp;
}> = [
  {
    field: 'correctOption',
    pattern: /["']?correctOption["']?\s*:\s*[0-3]\b/g,
  },
  {
    // semantics (v5 §4.2): «correctIndex» طبق قرارداد فعلی دودویی است — فقط در
    // conceptCheck درسنامه‌ها با «دقیقاً ۲ گزینه» (validator: src/engine/aelEngine.ts).
    // الگوی اسکن ۰ تا ۳ پوشش می‌دهد تا اگر قرارداد آینده گسترش یابد یا کلیدِ
    // چندگزینه‌ای با همین نام نشت کند، باز هم شناسایی شود؛ مقدار خارج از قرارداد
    // (۲/۳) نیز به‌عنوان دادهٔ مشکوک یافته می‌شود. خواندن خصوصیت (q.correctIndex)
    // match نمی‌شود — فقط literal «کلید: مقدار».
    field: 'correctIndex',
    pattern: /["']?correctIndex["']?\s*:\s*[0-3]\b/g,
  },
  {
    field: 'answerIndex',
    pattern: /["']?answerIndex["']?\s*:\s*\d+\b/g,
  },
  {
    field: 'solutionIndex',
    pattern: /["']?solutionIndex["']?\s*:\s*\d+\b/g,
  },
  {
    field: 'isCorrectLiteral',
    pattern: /["']?isCorrect["']?\s*:\s*(true|false)\b/g,
  },
  {
    field: 'canaryValue',
    pattern: /CANARY-(EXPLANATION|TRAPNOTE|CORRECT)-R036-[0-9a-f]{16}/g,
  },
  {
    field: 'serverRegistryReference',
    pattern: /client-bank-keys/g,
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
      (!HASHED_BUNDLE.test(entry.name) && !/\.(md|json)$/.test(entry.name))
    )) {
      throw new Error('Mini App assets must be hashed JS/CSS bundles or app data (md/json); raw sources and archives are prohibited.');
    }
  }
  const findings = await auditClientBundle(root);
  // R-036 گارد سخت (بدون استثنا) — مأموریت v4 §3.2: هر یافته‌ای در هر asset
  // عمومی مطلقاً شکست می‌خورد. هیچ Allowlist یا چشم‌پوشی مجاز نیست.
  if (findings.length > 0) {
    const details = findings
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
  process.stdout.write('Client bundle security audit: PASS (no embedded answer-key literals).\n');
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
