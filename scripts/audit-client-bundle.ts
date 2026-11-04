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
  if (resolve(root) === resolve(process.cwd(), 'apps/miniapp')) {
    await assertWorkerAssetsConfiguration(undefined, root);
    const files = await readdir(root, { withFileTypes: true });
    if (files.length !== 4 || files.some((entry) =>
      !entry.isFile() || !['index.html', 'app.js', 'styles.css', 'learning.js'].includes(entry.name)
    )) {
      throw new Error('Worker asset directory must contain only the four audited Mini App files.');
    }
  }
  const findings = await auditClientBundle(root);
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
  if (resolve(root) === resolve(process.cwd(), 'dist')) {
    await assertPublicPagesAssets(root);
  }
  process.stdout.write('Client bundle security audit: PASS (no embedded answer-key literals).\n');
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
