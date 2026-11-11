/**
 * ساخت Contact Sheets + Gallery + گزارش overflow برای ممیزی UI (§8)
 * اجرا: node tools/ui-audit/build-deliverables.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DATE_STR = '2026-11-12';
const ROOT = path.resolve('artifacts/ui-audit/2026-11-11');
const SHOTS = path.join(ROOT, 'screenshots');
const BASE = 'http://127.0.0.1:3000/';

// ---------- ۱) خواندن MANIFEST ----------
const csv = fs.readFileSync(path.join(ROOT, 'MANIFEST.csv'), 'utf8');
const lines = csv.trim().split('\n');
const header = lines[0];
const rows = lines.slice(1).map((line) => {
  const cells = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  const r = {};
  header.split(',').forEach((h, i) => { r[h] = cells[i] ?? ''; });
  return r;
});

const GROUPS = {}; // viewport → pageId → rows[]
for (const r of rows) {
  (GROUPS[r.viewport] = GROUPS[r.viewport] ?? {})[r.page_id] = (GROUPS[r.viewport][r.page_id] ?? []).concat(r);
}

const PAGE_NAMES = {
  onboarding: 'ورود اولیه', dashboard: 'داشبورد', placement: 'آزمون تعیین سطح',
  'telegram-simulator': 'شبیه‌ساز ربات تلگرام', 'study-session': 'جلسه مطالعه و تست',
  'yearly-exams': 'آرشیو کنکورهای سالانه', 'skill-tree': 'درخت مهارت',
  lessons: 'کتابخانه درسنامه‌ها', 'subject-hub': 'مطالعه درس‌به‌درس',
  'mistake-notebook': 'دفتر خطا', 'code-patches': 'Code Patches',
};

function esc(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;'); }

// ---------- ۲) Contact Sheet per page per viewport ----------
const sheetsDir = path.join(ROOT, 'contact-sheets');
fs.mkdirSync(sheetsDir, { recursive: true });
const sheetIndex = {};

for (const [vp, pages] of Object.entries(GROUPS)) {
  for (const [pid, prows] of Object.entries(pages)) {
    const items = prows.map((r, i) => {
      const img = path.relative(sheetsDir, path.join(ROOT, r.filename)).replaceAll('\\\\', '/');
      return `<figure><a href="${img}" target="_blank" title="نسخهٔ اصلی"><img loading="lazy" src="${img}" alt="${esc(r.filename)}"></a><figcaption>#${i + 1} · scrollY=${r.scroll_y}${r.is_bottom === 'yes' ? ' · ⏬ انتها' : ''}${r.interaction ? ' · ' + esc(r.interaction) : ''}<br><code>${esc(r.filename)}</code></figcaption></figure>`;
    }).join('\n');
    const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>Contact Sheet — ${esc(PAGE_NAMES[pid] ?? pid)} (${vp})</title><style>body{font-family:Tahoma,sans-serif;background:#14120f;color:#eee;margin:0;padding:24px}h1{font-size:20px}p{color:#aaa;font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}figure{margin:0;background:#1e1c19;border:1px solid #333;border-radius:10px;padding:8px}img{width:100%;height:auto;border-radius:6px}figcaption{font-size:10.5px;color:#bbb;margin-top:6px;line-height:1.7;word-break:break-all}a{color:#36c4bd}</style></head><body><h1>Contact Sheet — ${esc(PAGE_NAMES[pid] ?? pid)} · ${vp} · ${prows.length} تصویر</h1><p>SHA main مبنا: 97a1f2a · تاریخ: ${DATE_STR}</p><div class="grid">${items}</div></body></html>`;
    const file = path.join(sheetsDir, vp, pid + '.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
    sheetIndex[vp] = sheetIndex[vp] ?? [];
    sheetIndex[vp].push({ pid, count: prows.length, file: path.relative(ROOT, file).replaceAll('\\\\', '/') });
  }
}

// ---------- ۳) Gallery اصلی ----------
const galleryRows = Object.entries(sheetIndex).map(([vp, sheets]) => `
  <h2>Viewport: ${vp} — مجموع ${sheets.reduce((a, s) => a + s.count, 0)} تصویر در ${sheets.length} صفحه</h2>
  <table><tr><th>صفحه</th><th>تعداد تصاویر</th><th>Contact Sheet</th></tr>
  ${sheets.map((s) => `<tr><td>${esc(PAGE_NAMES[s.pid] ?? s.pid)}</td><td>${s.count}</td><td><a href="${s.file}">مشاهده</a></td></tr>`).join('\n')}
  </table>`).join('\n');

const gallery = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>AEL UI Audit Gallery — ${DATE_STR}</title><style>body{font-family:Tahoma,sans-serif;background:#14120f;color:#eee;margin:0;padding:24px}h1{font-size:22px}h2{font-size:17px;margin-top:32px;color:#36c4bd}table{border-collapse:collapse;width:100%;max-width:720px}td,th{border:1px solid #333;padding:8px 12px;font-size:13px;text-align:right}a{color:#36c4bd}p{color:#aaa;font-size:12px}</style></head><body><h1>گالری ممیزی UI سامانه AEL</h1><p>SHA مبنا: 97a1f2a0e12c342ad5a7b23ac2d26ce1274eb07e · تاریخ تصویربرداری: ${DATE_STR} · مجموع ${rows.length} تصویر PNG · تم پیش‌فرض: dark · جهت: RTL</p><p>برای هر صفحه یک Contact Sheet ساخته شده؛ کلیک روی هر تصویر داخل آن، نسخهٔ اصلی PNG را باز می‌کند.</p>${galleryRows}</body></html>`;
fs.mkdirSync(path.join(ROOT, 'gallery'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'gallery', 'index.html'), gallery, 'utf8');
console.log('gallery + contact sheets written');

// ---------- ۴) چک overflow افقی واقعی (FINDINGS evidence) ----------
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const TABS = ['home', 'study', 'exams', 'map', 'lessons', 'subject_hub', 'notebook'];
const overflowResults = [];
for (const [vpName, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 }, telegram: { width: 430, height: 932 } })) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'fa-IR' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  const go = async (tabId, label) => {
    try { await page.click((vpName === 'desktop' ? 'a:has-text("' : 'button:has-text("') + label + '")', { timeout: 2000 }); await page.waitForTimeout(700); } catch { /* skip */ }
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    overflowResults.push({ viewport: vpName, tab: tabId, scrollWidth: m.sw, innerWidth: m.iw, overflowX: m.sw > m.iw ? 'YES ⚠️' : 'no' });
  };
  await go('home', 'میز کار');
  await go('study', 'جلسه تست');
  await go('exams', 'کنکورهای ۱۳۹۱ تا ۱۴۰۵');
  await go('map', 'درخت مهارت');
  await go('lessons', 'درسنامه‌ها و منابع');
  await go('subject_hub', 'مطالعه درس‌به‌درس');
  await go('notebook', 'دفتر خطا');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(ROOT, 'OVERFLOW-REPORT.json'), JSON.stringify(overflowResults, null, 1), 'utf8');
console.log('overflow check done:', overflowResults.filter((r) => r.overflowX !== 'no').length, 'overflow cases');

