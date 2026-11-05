/**
 * AEL-107 — CLI Import رجیستری آموزشی.
 *
 *   npx tsx scripts/import-registry.mts content/registry/ael-p1-seed.json          # Dry-run (پیش‌فرض)
 *   npx tsx scripts/import-registry.mts bundle.json --sql > bundle.sql             # خروجی SQL
 *   npx tsx scripts/import-registry.mts bundle.json --write                        # نوشتن مستقیم (فقط محیط غیر Production)
 *
 * هیچ حالتی به‌صورت پیش‌فرض می‌نویسد؛ `--write` فقط با پذیرش سیاست import-policy مجاز است.
 */
import { readFileSync } from 'node:fs';
import { RegistryValidationError } from '@ael/contracts';
import { assertDirectWriteAllowed } from '../src/import/import-policy.mjs';
import { buildUpsertSql, loadRegistryBundle } from '../src/lib/registry-import';

function main(): number {
  const args = process.argv.slice(2);
  const path = args.find(arg => !arg.startsWith('--'));
  if (!path) {
    console.error('استفاده: npx tsx scripts/import-registry.mts <bundle.json> [--sql | --write]');
    return 2;
  }
  const wantSql = args.includes('--sql');
  const wantWrite = args.includes('--write');

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`خواندن بسته ناموفق بود: ${(error as Error).message}`);
    return 2;
  }

  try {
    const { bundle, report } = loadRegistryBundle(raw, path);
    const out = wantSql ? console.error : console.log;
    out('== گزارش Import رجیستری (Dry-run) ==');
    out(`schemaVersion: ${report.schemaVersion}`);
    out(`contentHash: sha256:${report.contentHash}`);
    out('تعداد به تفکیک موجودیت:');
    for (const [entity, count] of Object.entries(report.totals)) out(`  ${entity}: ${count}`);
    out(`accepted=${report.accepted} rejected=${report.rejected} duplicates=${report.duplicates}`);
    if (report.missingReferences.length) {
      for (const line of report.missingReferences) console.error(`MISSING_REF: ${line}`);
    }
    if (report.prerequisiteCycles.length) {
      for (const line of report.prerequisiteCycles) console.error(`PREREQ_CYCLE: ${line}`);
    }
    if (report.rejected > 0) {
      console.error('نتیجه: بسته رد شد — موارد بالا را اصلاح کنید.');
      return 1;
    }
    if (wantWrite) {
      assertDirectWriteAllowed({ environment: process.env.ENVIRONMENT ?? 'local', writeFlag: true });
      console.error('--write در این محیط مجاز نیست (سیاست import-policy).');
      return 3;
    }
    if (wantSql) {
      process.stdout.write(buildUpsertSql(bundle) + '\n');
    } else {
      console.log('نتیجه: بسته معتبر است (Dry-run). برای خروجی SQL از --sql استفاده کنید.');
    }
    return 0;
  } catch (error) {
    if (error instanceof RegistryValidationError) {
      for (const item of error.errors) {
        console.error(`REJECTED: ${item.entity}[${item.index}]${item.field ? '.' + item.field : ''} ${item.code}: ${item.message}`);
      }
      console.error('نتیجه: بسته رد شد.');
      return 1;
    }
    throw error;
  }
}

process.exit(main());
