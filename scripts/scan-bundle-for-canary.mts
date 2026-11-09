/**
 * SEC-010 — اسکن Canary باندل کلاینت.
 *
 * رجیستری کلید سمت سرور (client-bank-keys.server.ts) مقادیر Canary یکتا دارد.
 * حضور هر Canary در Assetهای خروجی Build = نشت رجیستری سرور به کلاینت.
 * این اسکن به نام فیلد وابسته نیست — رشتهٔ Canary هرگز نباید در کلاینت ظاهر شود.
 *
 * اجرا: node --import tsx scripts/scan-bundle-for-canary.mts [dir]
 * (پیش‌فرض apps/miniapp؛ برای dist هم می‌توان اجرا کرد)
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const SCAN_EXT = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.map', '.css']);

async function collect(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(abs)));
    else if (entry.isFile() && SCAN_EXT.has(extname(entry.name).toLowerCase())) files.push(abs);
  }
  return files;
}

async function main(): Promise<void> {
  const root = resolve(process.argv[2] ?? 'apps/miniapp');
  const manifest = JSON.parse(await readFile(resolve('apps/worker/src/data/client-bank-keys.manifest.json'), 'utf8')) as {
    canaryIds: string[];
  };
  const canaryIds = manifest.canaryIds as string[];
  const canaryMarkers = canaryIds.map((id) => id.replace('sec.canary.', 'CANARY-'));
  const needles = [...canaryIds, ...canaryMarkers];

  const files = await collect(root);
  const hits: string[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const needle of needles) {
      if (content.includes(needle)) hits.push(`${file}: contains canary "${needle}"`);
    }
  }

  if (hits.length > 0) {
    process.stderr.write(`SEC-010 FAIL: server canary leaked into client bundle:\n${hits.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`SEC-010 PASS: no server canary in ${files.length} scanned assets under ${root}.\n`);
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exit(1);
});
