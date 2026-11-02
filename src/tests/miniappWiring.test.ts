import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * R-043 — هیچ کنترل تعاملی مینی‌اپ بی‌عملکرد نماند.
 * نقص واقعی که این تست را ساخت: دکمهٔ «قفل روز پیوسته» در HTML بود، تابع
 * freezeStreak هم نوشته شده بود، ولی هیچ‌وقت به دکمه وصل نشد — کاربر کلیک
 * می‌کرد و هیچ اتفاقی نمی‌افتاد. این تست همان طبقهٔ نقص را می‌گیرد.
 */
const root = process.cwd();
const html = readFileSync(join(root, 'apps/miniapp/index.html'), 'utf8');
const js = readFileSync(join(root, 'apps/miniapp/app.js'), 'utf8');

function idsOf(tagPattern: RegExp): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(tagPattern)) {
    const id = /id="([^"]+)"/.exec(match[0])?.[1];
    if (id) found.add(id);
  }
  return [...found].sort();
}

const interactiveIds = [
  ...idsOf(/<button\b[^>]*>/g),
  ...idsOf(/<input\b[^>]*>/g),
  ...idsOf(/<select\b[^>]*>/g),
];

describe('R-043 — سیم‌کشی کنترل‌های مینی‌اپ', () => {
  it('هر کنترل تعاملی در index.html در app.js معرفی (و وصل) شده است', () => {
    expect(interactiveIds.length).toBeGreaterThan(0);
    const unbound = interactiveIds.filter((id) => !js.includes(`'${id}'`));
    expect(unbound, `کنترل‌های بی‌سیم‌کشی: ${unbound.join(', ')}`).toEqual([]);
  });

  it('هیچ هندلر درون‌خطی پویا با داده ساخته نمی‌شود (sink XSS)', () => {
    const inline = [...js.matchAll(/on(?:click|error|load|input|change)="([^"]*)"/g)].map((m) => m[1]!);
    // هندلر درون‌خطی فقط وقتی مجاز است که کاملاً ثابت باشد (بدون رشته‌سازی با داده)
    for (const handler of inline) {
      expect(handler, `هندلر درون‌خطی پویا: ${handler}`).not.toMatch(/'\s*\+/);
      expect(handler, `هندلر درون‌خطی با کوئری‌استرینگ: ${handler}`).not.toMatch(/\\'/);
    }
  });

  it('کلاس‌های گزینهٔ پاسخ با CSS هم‌نام هستند (درگوشی نبودن رنگ‌ها)', () => {
    const css = readFileSync(join(root, 'apps/miniapp/styles.css'), 'utf8');
    // JS کلاس‌هایی می‌سازد که باید در CSS تعریف شده باشند، وگرنه تأیید/رد گزینه دیده نمی‌شود
    for (const cls of ['option', 'key', 'correct', 'wrong']) {
      expect(css, `کلاس .${cls} در CSS وجود ندارد`).toContain(`.${cls}`);
    }
    expect(js).not.toContain("className = 'option-btn'");
  });

  it('قاعدهٔ [hidden] با display های CSS پوشانده نمی‌شود', () => {
    const css = readFileSync(join(root, 'apps/miniapp/styles.css'), 'utf8');
    for (const sel of ['.stat-chip', '.self-report-box']) {
      const block = new RegExp(`${sel}\\s*\\{[^}]*display:`).test(css);
      const guard = new RegExp(`${sel}\\[hidden\\][^{]*\\{[^}]*display:\\s*none`).test(css);
      if (block) expect(guard, `${sel} display دارد ولی [hidden] را ندارد`).toBe(true);
    }
  });
});
