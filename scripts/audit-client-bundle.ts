import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ClientBundleFinding {
  asset: string;
  field: 'correctOption' | 'correctIndex';
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

export async function auditClientBundle(
  root = resolve(process.cwd(), 'dist'),
): Promise<ClientBundleFinding[]> {
  const assets = await collectAssets(root);
  if (Object.keys(assets).length === 0) {
    throw new Error(`No public JS/JSON/HTML assets found under ${root}; refusing to treat an empty build as safe.`);
  }
  return findClientAnswerKeyLeaks(assets);
}

async function runAudit(root: string): Promise<void> {
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
