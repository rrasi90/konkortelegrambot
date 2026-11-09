import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A-10 — سیم‌کشی مینی‌اپ.
 * نسخهٔ قدیمی این تست، کنترل‌های تعاملی HTML دست‌نویس (app.js) را با JS تطبیق
 * می‌داد. مینی‌اپ اکنون بیلد React است (Vite): سیم‌کشی کنترل‌ها داخل خود
 * کامپوننت‌ها انجام می‌شود و «کنترل بی‌عملکرد» دیگر از نوع HTML/JS جدا به وجود
 * نمی‌آید. این نسخه همان پوشش‌های هنوز معتبر را روی بیلد React اعمال می‌کند:
 *   ۱) index.html به باندل و CSS ساخته‌شده اشاره می‌کند و آن فایل‌ها وجود دارند
 *   ۲) نقطهٔ اتصال React (#root) و SDK رسمی تلگرام حاضرند
 *   ۳) هیچ هندلر درون‌خطی پویا (sink XSS) در index.html نیست
 */
const root = process.cwd();
const html = readFileSync(join(root, 'apps/miniapp/index.html'), 'utf8');

const referenced = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]!);

describe('A-10 — سیم‌کشی مینی‌اپ React', () => {
  it('index.html به باندل و CSS ساخته‌شده اشاره می‌کند و هر دو وجود دارند', () => {
    const js = referenced.filter((p) => p.endsWith('.js'));
    const css = referenced.filter((p) => p.endsWith('.css'));
    expect(js.length).toBeGreaterThan(0);
    expect(css.length).toBeGreaterThan(0);
    for (const ref of referenced) {
      expect(existsSync(join(root, 'apps/miniapp', ref)), `فایل ارجاع‌شده یافت نشد: ${ref}`).toBe(true);
    }
  });

  it('نقطهٔ اتصال React و SDK رسمی تلگرام حاضرند', () => {
    expect(html).toContain('id="root"');
    expect(html).toContain('telegram-web-app.js');
  });

  it('هیچ هندلر درون‌خطی پویا با داده ساخته نمی‌شود (sink XSS)', () => {
    const inline = [...html.matchAll(/on(?:click|error|load|input|change)="([^"]*)"/g)].map((m) => m[1]!);
    // هندلر درون‌خطی فقط وقتی مجاز است که کاملاً ثابت باشد (بدون رشته‌سازی با داده)
    for (const handler of inline) {
      expect(handler, `هندلر درون‌خطی پویا: ${handler}`).not.toMatch(/'\s*\+/);
      expect(handler, `هندلر درون‌خطی با کوئری‌استرینگ: ${handler}`).not.toMatch(/\\'/);
    }
  });
});
