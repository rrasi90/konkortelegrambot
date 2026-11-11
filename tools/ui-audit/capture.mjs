/**
 * UI Audit Capture Harness — مأموریت تصویربرداری کامل AEL (§4-§6)
 * جدا از کد محصول. اجرا: node tools/ui-audit/capture.mjs [--viewport desktop|mobile|telegram] [--only name]
 * خروجی: artifacts/ui-audit/2026-11-11/screenshots/<viewport>/<page>/*.png + MANIFEST
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000/';
const DATE = '2026-11-11';
const ROOT = path.resolve('artifacts/ui-audit/' + DATE);
const SHOTS = path.join(ROOT, 'screenshots');

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
  telegram: { width: 430, height: 932 },
};

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const onlyViewport = argVal('viewport', null);
const onlyScenario = argVal('only', null);

const manifest = [];
let shotSeq = 0;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

/** ثبت یک اسکرین‌شات با نام استاندارد PAGE__STATE__VIEWPORT__SCROLL-XXXX.png */
async function shot(page, ctx) {
  const { pageId, state, viewport, interaction = '', notes = '' } = ctx;
  const scrollY = await page.evaluate(() => Math.round(window.scrollY));
  const isBottom = await page.evaluate(
    () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 4,
  );
  const dir = path.join(SHOTS, viewport, pageId);
  ensureDir(dir);
  const seq = String(Math.round(scrollY / 10)).padStart(4, '0');
  const file = `${pageId}__${state}__${viewport.toUpperCase()}__SCROLL-${seq}.png`;
  await page.screenshot({ path: path.join(dir, file), type: 'png' });
  const vp = page.viewportSize();
  const theme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  shotSeq += 1;
  manifest.push({
    screenshot_id: 'S' + String(shotSeq).padStart(4, '0'),
    page_id: pageId,
    page_name: ctx.pageName ?? pageId,
    subsection: ctx.subsection ?? '',
    state,
    viewport,
    width: vp.width,
    height: vp.height,
    scroll_y: scrollY,
    is_bottom: isBottom ? 'yes' : 'no',
    interaction,
    filename: `${viewport}/${pageId}/${file}`,
    capture_status: 'OK',
    notes: (notes + (notes ? ' | ' : '') + 'theme:' + theme).trim(),
  });
  return { scrollY, isBottom };
}

/** اسکرول گام‌به‌گام واقعی تا انتهای صفحه (§5) — هر گام ~۷۵٪ viewport */
async function captureScroll(page, ctx, opts = {}) {
  const stepRatio = opts.stepRatio ?? 0.75;
  const maxSteps = opts.maxSteps ?? 40;
  const waitMs = opts.waitMs ?? 380;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  let first = await shot(page, { ...ctx, state: ctx.state ?? 'TOP', interaction: 'initial' });
  if (first.isBottom) {
    await shot(page, { ...ctx, state: (ctx.state ?? 'TOP') + '-BOTTOM', interaction: 'bottom-check' });
    return 2;
  }
  let count = 1;
  let lastY = -1;
  for (let i = 0; i < maxSteps; i++) {
    await page.evaluate((r) => window.scrollBy(0, Math.round(window.innerHeight * r)), stepRatio);
    await page.waitForTimeout(waitMs);
    const pos = await page.evaluate(() => Math.round(window.scrollY));
    if (pos === lastY) break;
    lastY = pos;
    count += 1;
    const res = await shot(page, { ...ctx, state: ctx.state ?? 'SCROLL', interaction: 'scroll' });
    if (res.isBottom) break;
  }
  await shot(page, { ...ctx, state: (ctx.state ?? 'SCROLL') + '-BOTTOM', interaction: 'bottom-final' });
  return count + 1;
}

/** کلیک مقاوم: چند انتخابگر را امتحان می‌کند؛ شکست را برمی‌گرداند نه crash */
async function clickAny(page, selectors, timeout = 2500) {
  for (const sel of selectors) {
    try {
      const loc = typeof sel === 'string'
        ? page.locator(sel).first()
        : sel;
      await loc.click({ timeout, force: false });
      await page.waitForTimeout(350);
      return { ok: true, sel: String(sel) };
    } catch (e) {
      if (process.env.DEBUG_UI) {
        console.log('  clickAny fail [' + String(sel).slice(0, 70) + ']:', String(e.message).split('\n')[0].slice(0, 110));
      }
    }
  }
  return { ok: false };
}

async function goTabDesktop(page, tabId) {
  const map = {
    home: 'میز کار', study: 'جلسه تست', exams: 'کنکورهای ۱۳۹۱ تا ۱۴۰۵',
    map: 'درخت مهارت', lessons: 'درسنامه‌ها و منابع', notebook: 'دفتر خطا',
    subject_hub: 'مطالعه درس‌به‌درس', patches: 'پچ‌ها', flashcards: 'فلش‌کارت',
  };
  return clickAny(page, [`a:has-text("${map[tabId]}")`, `button:has-text("${map[tabId]}")`]);
}

async function goTabMobile(page, tabId) {
  const direct = { home: 'میز کار', study: 'جلسه تست', exams: 'کنکورها', lessons: 'درسنامه' };
  if (direct[tabId]) {
    const r = await clickAny(page, [`button:has-text("${direct[tabId]}")`]);
    if (r.ok) return r;
  }
  // منوی بیشتر (۴ دکمه اول + دکمه بیشتر)
  const more = await clickAny(page, ['button[aria-haspopup="menu"]']);
  if (!more.ok) return { ok: false };
  const labels = { subject_hub: 'مطالعه تفکیکی', map: 'درخت مهارت', notebook: 'دفتر خطا' };
  const r = await clickAny(page, [`button:has-text("${labels[tabId]}")`]);
  return r;
}

const goTab = (page, tabId, viewport) => (viewport === 'desktop' ? goTabDesktop(page, tabId) : goTabMobile(page, tabId));

/* ---------------- سناریوها ---------------- */

async function scenarioOnboarding(page, viewport, V) {
  const P = 'onboarding';
  const S = 'div.z-\\[120\\] '; // مودال onboarding همیشه در بالاترین لایه (z-120) رندر می‌شود — escape: \\[ برای CSS
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  await shot(page, { pageId: P, state: 'STEP1-LEVEL', viewport, interaction: 'initial', pageName: 'ورود اولیه' });
  const arshad = await clickAny(page, [S + 'button:has-text("کارشناسی ارشد")']);
  await page.waitForTimeout(400);
  await shot(page, { pageId: P, state: 'STEP2-TRACK', viewport, interaction: arshad.ok ? 'click:arshad' : 'click-failed', pageName: 'ورود اولیه' });
  const track = await clickAny(page, [S + 'button:has-text("بازرگانی")', S + 'button:has-text("گرایش")']);
  await page.waitForTimeout(300);
  const next = await clickAny(page, [S + 'button:has-text("ادامه")', S + 'button:has-text("بعدی")']);
  await page.waitForTimeout(400);
  await shot(page, { pageId: P, state: 'STEP3-EXAMDATE', viewport, interaction: 'next', pageName: 'ورود اولیه' });
  const finish = await clickAny(page, [S + 'button:has-text("شروع کنیم")', S + 'button:has-text("شروع")']);
  console.log('DBG finish:', JSON.stringify(finish), '| modalGone:', await page.evaluate(() => !document.body.innerText.includes('مقطع هدف شما چیست')));
  await page.waitForTimeout(900);
  const modalGone = await page.evaluate(() => !document.body.innerText.includes('مقطع هدف شما چیست'));
  if (!modalGone) {
    await clickAny(page, [S + 'button:has-text("تاریخ نشدم")']);
    await page.waitForTimeout(600);
    await clickAny(page, [S + 'button:has-text("شروع کنیم")']);
    await page.waitForTimeout(700);
  }
  await shot(page, { pageId: P, state: 'COMPLETED-DASHBOARD', viewport, interaction: finish.ok ? 'finish' : 'finish-attempted', pageName: 'ورود اولیه' });
  return { onboardingDone: true };
}

async function scenarioDashboard(page, viewport) {
  const P = 'dashboard';
  await goTab(page, 'home', viewport);
  await page.waitForTimeout(700);
  const subtabs = [
    ['today', 'برنامهٔ امروز'], ['simulator', 'پیشرفت مباحث'], ['velocity', 'روند و سرعت'],
    ['priorities', 'اولویت‌ها'], ['settings', 'تنظیمات'],
  ];
  for (const [id, label] of subtabs) {
    const r = await clickAny(page, [`[role="tab"]:has-text("${label}")`]);
    await page.waitForTimeout(600);
    await captureScroll(page, { pageId: P, state: 'SUBTAB-' + id.toUpperCase(), viewport, pageName: 'داشبورد', subsection: label, interaction: r.ok ? 'tab-click' : 'tab-click-failed:' + label });
  }
  await clickAny(page, ['[role="tab"]:has-text("برنامهٔ امروز")']);
  await page.waitForTimeout(400);
}

async function scenarioPlacement(page, viewport) {
  const P = 'placement';
  await goTab(page, 'home', viewport);
  await clickAny(page, ['[role="tab"]:has-text("برنامهٔ امروز")']);
  await page.waitForTimeout(500);
  const open = await clickAny(page, ['button:has-text("تعیین سطح")']);
  await page.waitForTimeout(600);
  if (!open.ok) {
    await shot(page, { pageId: P, state: 'OPEN-FAILED', viewport, interaction: 'open-failed', pageName: 'آزمون تعیین سطح', notes: 'دکمه پیدا نشد' });
    return;
  }
  await captureScroll(page, { pageId: P, state: 'Q1', viewport, pageName: 'آزمون تعیین سطح', interaction: 'modal-open' });
  // پاسخ به ۵ سؤال: اولین گزینه داخل مودال (دادهٔ آزمایشی demo)
  for (let i = 0; i < 5; i++) {
    const opt = await page.evaluate(() => {
      const modal = document.querySelector('div.z-\\[50\\]');
      if (!modal) return 'NO-MODAL';
      const btns = [...modal.querySelectorAll('div.space-y-2 > button')];
      if (!btns.length) return 'NO-OPTIONS';
      btns[0].click();
      return 'CLICKED';
    });
    await page.waitForTimeout(500);
    if (i === 0) await shot(page, { pageId: P, state: 'ANSWER-SELECTED', viewport, interaction: String(opt), pageName: 'آزمون تعیین سطح' });
    if (opt !== 'CLICKED') break;
  }
  await page.waitForTimeout(600);
  await captureScroll(page, { pageId: P, state: 'RESULT', viewport, pageName: 'آزمون تعیین سطح', interaction: 'after-5-answers' });
  await clickAny(page, ['button:has-text("مشاهده برنامه")', 'button:has-text("بستن")', 'button:has-text("X")']);
  await page.waitForTimeout(300);
}

async function scenarioTelegramSimulator(page, viewport) {
  const P = 'telegram-simulator';
  await goTab(page, 'home', viewport);
  await clickAny(page, ['[role="tab"]:has-text("تنظیمات")']);
  await page.waitForTimeout(500);
  const open = await clickAny(page, ['button:has-text("شبیه‌ساز ربات تلگرام")']);
  await page.waitForTimeout(700);
  if (!open.ok) {
    await shot(page, { pageId: P, state: 'OPEN-FAILED', viewport, interaction: 'open-failed', pageName: 'شبیه‌ساز ربات', notes: 'دکمه پیدا نشد' });
    return;
  }
  await captureScroll(page, { pageId: P, state: 'INITIAL', viewport, pageName: 'شبیه‌ساز ربات تلگرام', interaction: 'modal-open' });
  // شیشه‌ای‌ها/دکمه‌های داخل شبیه‌ساز
  for (const label of ['شروع', '/start', 'دروس', 'امروز']) {
    const r = await clickAny(page, [`button:has-text("${label}")`]);
    if (r.ok) {
      await page.waitForTimeout(500);
      await shot(page, { pageId: P, state: 'INTERACT-' + label, viewport, interaction: 'click:' + label, pageName: 'شبیه‌ساز ربات تلگرام' });
    }
  }
  await clickAny(page, ['button[aria-label*="بستن"]', 'button:has-text("بستن")']);
}

async function scenarioStudySession(page, viewport) {
  const P = 'study-session';
  await goTab(page, 'home', viewport);
  const start = await clickAny(page, ['button:has-text("شروع مرور امروز")', 'button:has-text("مرور امروز")']);
  await page.waitForTimeout(1000);
  if (!start.ok) {
    await shot(page, { pageId: P, state: 'START-FAILED', viewport, interaction: 'start-failed', pageName: 'جلسه مطالعه', notes: 'دکمه شروع پیدا نشد' });
    return;
  }
  await captureScroll(page, { pageId: P, state: 'SESSION-START', viewport, pageName: 'جلسه مطالعه', interaction: 'daily-start' });

  // کلیک گزینهٔ سؤال: دکمه‌هایی که اسپن badge تک‌رقمی فارسی دارند (گزینه‌های کارت سؤال)
  const clickQuestionOption = async () => page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => {
      if (b.disabled || b.offsetParent === null) return false;
      const spans = [...b.querySelectorAll(':scope > div > span, :scope > span')];
      const first = spans[0];
      return first && /^[۱۲۳۴]$/.test(first.textContent.trim()) &&
        spans[1] && spans[1].textContent.trim().length > 5;
    });
    if (btns.length < 2) return 0;
    btns[btns.length - 1].click();
    return btns.length;
  });

  const PROGRESS = ['مطالعه شد — کارت بعدی', 'متوجه شدم — گام بعدی', 'ادامه به گام بعدی', 'فعالیت بعدی', 'کارت بعدی', 'سؤال بعدی'];
  let answeredQuestions = 0;
  for (let card = 0; card < 16; card++) {
    const optCount = await clickQuestionOption();
    if (optCount >= 2) {
      await page.waitForTimeout(400);
      await shot(page, { pageId: P, state: 'Q' + (answeredQuestions + 1) + '-ANSWERED', viewport, interaction: 'select-last-option', pageName: 'جلسه مطالعه' });
      const submit = await clickAny(page, ['button:has-text("ثبت پاسخ")', 'button:has-text("ارسال")', 'button:has-text("بررسی")']);
      await page.waitForTimeout(1100);
      await shot(page, { pageId: P, state: 'Q' + (answeredQuestions + 1) + '-REVEALED', viewport, interaction: submit.ok ? 'submit' : 'auto-reveal', pageName: 'جلسه مطالعه' });
      answeredQuestions += 1;
      const nxt = await clickAny(page, ['button:has-text("سؤال بعدی")', 'button:has-text("کارت بعدی")', 'button:has-text("فعالیت بعدی")']);
      await page.waitForTimeout(700);
      if (answeredQuestions >= 2) {
        const exit = await clickAny(page, ['button:has-text("پایان جلسه")']);
        await page.waitForTimeout(900);
        await captureScroll(page, { pageId: P, state: 'SESSION-END', viewport, pageName: 'جلسه مطالعه', interaction: exit.ok ? 'exit-early' : 'end-of-queue' });
        break;
      }
      if (!nxt.ok) {
        await captureScroll(page, { pageId: P, state: 'SESSION-END', viewport, pageName: 'جلسه مطالعه', interaction: 'end-of-queue' });
        break;
      }
    } else {
      let moved = false;
      for (const label of PROGRESS) {
        const r = await clickAny(page, ['button:has-text("' + label + '")']);
        if (r.ok) { moved = true; break; }
      }
      await page.waitForTimeout(500);
      if (card % 3 === 0) {
        await shot(page, { pageId: P, state: 'CARD-' + card, viewport, interaction: moved ? 'progress' : 'no-progress', pageName: 'جلسه مطالعه' });
      }
      if (!moved) {
        await captureScroll(page, { pageId: P, state: 'SESSION-END', viewport, pageName: 'جلسه مطالعه', interaction: 'no-progress-end' });
        break;
      }
    }
  }
}

async function scenarioYearlyExams(page, viewport) {
  const P = 'yearly-exams';
  await goTab(page, 'exams', viewport);
  await page.waitForTimeout(800);
  await captureScroll(page, { pageId: P, state: 'SELECTOR', viewport, pageName: 'آرشیو کنکورهای سالانه', interaction: 'tab-open' });
  // انتخاب سال (اگر کنترل سال وجود دارد)
  await clickAny(page, ['select >> nth=0']).catch(() => {});
  // جدول بودجه‌بندی
  const budget = await clickAny(page, ['button:has-text("جدول بودجه‌بندی")']);
  if (budget.ok) {
    await page.waitForTimeout(500);
    await shot(page, { pageId: P, state: 'BUDGET-TABLE', viewport, interaction: 'open-budget', pageName: 'آرشیو کنکورهای سالانه' });
  }
  // حالت تشریحی
  const desc = await clickAny(page, ['button:has-text("کلید و پاسخ تشریحی")', 'button:has-text("تشریحی")']);
  if (desc.ok) {
    await page.waitForTimeout(600);
    await captureScroll(page, { pageId: P, state: 'DESCRIPTIVE', viewport, pageName: 'آرشیو کنکورهای سالانه', interaction: 'mode-descriptive' });
  }
  // بازگشت به سؤالات/شبیه‌ساز
  await clickAny(page, ['button:has-text("بازگشت به سوالات")']);
  await page.waitForTimeout(400);
  // پاسخ به یک سؤال در شبیه‌ساز
  const q = await clickAny(page, ['button >> text=/^[۱۲۳۴]\\)/']);
  if (q.ok) {
    await page.waitForTimeout(400);
    await shot(page, { pageId: P, state: 'QUESTION-ANSWERED', viewport, interaction: 'select-option', pageName: 'آرشیو کنکورهای سالانه' });
  }
  await clickAny(page, ['button:has-text("دفترچه رسمی")']).catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, { pageId: P, state: 'PDF-SPLIT-ATTEMPT', viewport, interaction: 'pdf-split', pageName: 'آرشیو کنکورهای سالانه', notes: 'PDFها در checkout موجود نیستند (GAP-014)' });
}

async function scenarioSkillTree(page, viewport) {
  const P = 'skill-tree';
  await goTab(page, 'map', viewport);
  await page.waitForTimeout(900);
  await captureScroll(page, { pageId: P, state: 'OVERVIEW', viewport, pageName: 'درخت مهارت', interaction: 'tab-open' });
  const node = await clickAny(page, ['svg g >> nth=3', 'svg circle >> nth=2', '[class*="node"] >> nth=2']);
  if (node.ok) {
    await page.waitForTimeout(600);
    await shot(page, { pageId: P, state: 'NODE-DETAIL', viewport, interaction: 'click-node', pageName: 'درخت مهارت' });
  }
}

async function scenarioLessons(page, viewport) {
  const P = 'lessons';
  await goTab(page, 'lessons', viewport);
  await page.waitForTimeout(800);
  await captureScroll(page, { pageId: P, state: 'LIST', viewport, pageName: 'کتابخانه درسنامه‌ها', interaction: 'tab-open' });
  // انتخاب درس (اولین درسنامه تعاملی)
  const lesson = await clickAny(page, ['button:has-text("درسنامه") >> nth=0', '[class*="lesson"] >> nth=0']);
  await page.waitForTimeout(700);
  // انتخاب یک نود از فهرست مباحث
  const nodeBtn = await clickAny(page, ['button >> nth=6']);
  if (nodeBtn.ok) {
    await page.waitForTimeout(800);
    await captureScroll(page, { pageId: P, state: 'LESSON-CONTENT', viewport, pageName: 'کتابخانه درسنامه‌ها', interaction: 'open-lesson' });
  }
}

async function scenarioSubjectHub(page, viewport) {
  const P = 'subject-hub';
  await goTab(page, 'subject_hub', viewport);
  await page.waitForTimeout(800);
  await captureScroll(page, { pageId: P, state: 'BOOKS-TAB', viewport, pageName: 'مطالعه درس‌به‌درس', interaction: 'tab-open' });
  // ساب‌تب‌ها
  for (const [id, label] of [['lessons', 'درسنامه'], ['concepts_diagrams', 'مفاهیم'], ['questions', 'بانک تست']]) {
    const r = await clickAny(page, [`button:has-text("${label}")`]);
    if (r.ok) {
      await page.waitForTimeout(600);
      await captureScroll(page, { pageId: P, state: 'TAB-' + id.toUpperCase(), viewport, pageName: 'مطالعه درس‌به‌درس', interaction: 'subtab:' + label });
    }
  }
  // انتخاب درس دیگر (dropdown)
  await clickAny(page, ['select >> nth=0']).catch(() => {});
  await page.waitForTimeout(400);
}

async function scenarioNotebook(page, viewport) {
  const P = 'mistake-notebook';
  await goTab(page, 'notebook', viewport);
  await page.waitForTimeout(800);
  await captureScroll(page, { pageId: P, state: 'VIEW', viewport, pageName: 'دفتر خطا', interaction: 'tab-open' });
}

async function scenarioPatches(page, viewport) {
  const P = 'code-patches';
  await goTab(page, 'patches', viewport);
  await page.waitForTimeout(600);
  const url = page.url();
  const reachable = await page.evaluate(() => document.body.innerText.includes('پچ') || document.body.innerText.includes('Code'));
  await captureScroll(page, { pageId: P, state: reachable ? 'VIEW' : 'NOT-REACHED', viewport, pageName: 'Code Patches', interaction: 'tab-attempt', notes: reachable ? '' : 'UNROUTED: مسیر UI برای این تب یافت نشد' });
}

const SCENARIOS = [
  ['onboarding', scenarioOnboarding],
  ['dashboard', scenarioDashboard],
  ['placement', scenarioPlacement],
  ['telegram-simulator', scenarioTelegramSimulator],
  ['study-session', scenarioStudySession],
  ['yearly-exams', scenarioYearlyExams],
  ['skill-tree', scenarioSkillTree],
  ['lessons', scenarioLessons],
  ['subject-hub', scenarioSubjectHub],
  ['notebook', scenarioNotebook],
  ['patches', scenarioPatches],
];

/* ---------------- main ---------------- */

async function runViewport(browser, viewportName) {
  const V = VIEWPORTS[viewportName];
  const ctx = await browser.newContext({
    viewport: { width: V.width, height: V.height },
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 120)));
  for (const [name, fn] of SCENARIOS) {
    if (onlyScenario && name !== onlyScenario) continue;
    try {
      await fn(page, viewportName, V);
    } catch (e) {
      manifest.push({
        screenshot_id: 'ERR-' + name, page_id: name, page_name: name, subsection: '', state: 'ERROR',
        viewport: viewportName, width: V.width, height: V.height, scroll_y: '', is_bottom: 'no',
        interaction: '', filename: '', capture_status: 'BLOCKED', notes: String(e).slice(0, 200),
      });
      console.error('SCENARIO FAILED:', name, e.message);
    }
  }
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
  await ctx.close();
}

async function main() {
  ensureDir(SHOTS);
  // ادغام با MANIFEST موجود: ردیف‌های قبلی حفظ و شماره‌گذاری ادامه می‌یابد
  const manifestPath = path.join(ROOT, 'MANIFEST.csv');
  if (fs.existsSync(manifestPath)) {
    const csvText = fs.readFileSync(manifestPath, 'utf8');
    const lines = csvText.trim().split('\n');
    for (const line of lines.slice(1)) {
      const cells = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
        else cur += ch;
      }
      cells.push(cur);
      const r = {};
      lines[0].split(',').forEach((h, i) => { r[h] = cells[i] ?? ''; });
      manifest.push(r);
    }
    console.log('merged existing manifest rows:', manifest.length);
  }
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const viewports = onlyViewport ? [onlyViewport] : ['desktop', 'mobile', 'telegram'];
  for (const vp of viewports) {
    console.log('=== viewport:', vp);
    await runViewport(browser, vp);
  }
  await browser.close();

  // MANIFEST.csv
  ensureDir(ROOT);
  const cols = ['screenshot_id', 'page_id', 'page_name', 'subsection', 'state', 'viewport', 'width', 'height', 'scroll_y', 'is_bottom', 'interaction', 'filename', 'capture_status', 'notes'];
  const esc = (v) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  const csv = [cols.join(',')].concat(manifest.map((r) => cols.map((c) => esc(r[c])).join(','))).join('\n');
  fs.writeFileSync(path.join(ROOT, 'MANIFEST.csv'), '\ufeff' + csv, 'utf8');
  const ok = manifest.filter((r) => r.capture_status === 'OK').length;
  const blocked = manifest.filter((r) => r.capture_status !== 'OK').length;
  console.log(`DONE: ${ok} screenshots OK, ${blocked} blocked/failed. Manifest: ${manifest.length} rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
