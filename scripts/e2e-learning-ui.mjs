import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('Set CHROME_PATH to a Chromium executable.');
const mode = process.argv[2] || 'offline';
assert.ok(['offline', 'miniapp'].includes(mode));
const port = Number(process.env.CDP_PORT || 19237);
const base = mode === 'offline'
  ? pathToFileURL(resolve('tools/offline/AEL_OFFLINE.html')).href
  : (process.env.BASE_URL || 'http://127.0.0.1:8787');
const profile = await mkdtemp(join(tmpdir(), 'ael-learning-e2e-'));
const browser = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu',
  '--no-first-run', '--no-default-browser-check', '--window-size=390,850',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let page;
  for (let i = 0; i < 80; i++) {
    try {
      const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      page = targets.find(item => item.type === 'page');
      if (page) break;
    } catch {}
    await delay(125);
  }
  assert.ok(page, 'Chromium DevTools endpoint did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    socket.addEventListener('open', res, { once: true });
    socket.addEventListener('error', rej, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  const network = [];
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Network.requestWillBeSent' && /^https?:/.test(msg.params.request.url)) network.push(msg.params.request.url);
    const callback = pending.get(msg.id);
    if (callback) {
      pending.delete(msg.id);
      if (msg.error) callback.reject(new Error(msg.error.message));
      else callback.resolve(msg.result);
    }
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await cdp('Runtime.evaluate', { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || 'Browser evaluation failed');
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 75; i++) {
      try { if (await evaluate(expression)) return; } catch {}
      await delay(100);
    }
    throw new Error('Browser condition was not reached: ' + expression);
  }
  async function click(action) {
    const sel = JSON.stringify('[data-action="' + action + '"]');
    await waitFor('document.querySelector(' + sel + ') && !document.querySelector(' + sel + ').disabled');
    await evaluate('document.querySelector(' + sel + ').click(); true');
  }
  async function enter() {
    if (mode === 'miniapp') {
      await waitFor("document.querySelector('#btn-start-today') && !document.querySelector('#view-app').hidden || !document.querySelector('#view-tracks').hidden");
      if (await evaluate("!document.querySelector('#view-tracks').hidden")) {
        await evaluate("document.querySelector('[data-track=business]').click(); document.querySelector('#btn-tracks-save').click(); true");
      }
      await waitFor("!document.querySelector('#view-app').hidden");
      await evaluate("document.querySelector('.nav-btn[data-tab=lessons]').click(); true");
    }
    await click('open-course');
    await evaluate('window.confirm = () => true; true');
  }

  await cdp('Network.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  if (mode === 'offline') await cdp('Network.setBlockedURLs', { urls: ['https://*', 'http://*'] });
  else await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
  await cdp('Page.navigate', { url: base });
  await enter();
  assert.equal(await evaluate("document.documentElement.dir === 'rtl' && document.querySelectorAll('.learn-topic').length === 8"), true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  console.log('PASS RTL mobile course, eight lessons, no horizontal overflow');

  await click('next-lesson');
  if (process.env.AEL_LEARNING_SCREENSHOT) {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.AEL_LEARNING_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  await click('practice');
  await waitFor("document.querySelector('.learn-question-title') && !document.querySelector('.learn-feedback')");
  assert.equal(await evaluate("document.querySelector('[data-action=submit-answer]').disabled"), true);
  await click('pick-1');
  await click('submit-answer');
  await waitFor("document.querySelector('.learn-feedback h3')");
  assert.equal(await evaluate("document.querySelector('.learn-feedback ol').children.length === 4 && document.querySelector('.learn-feedback .learn-source-list').children.length === 1"), true);
  console.log('PASS tutorial requires confirmation and shows answer, four rationales, and reference');

  await click('bookmark');
  await evaluate("document.querySelector('[data-action^=issue-]').click(); true");
  await evaluate("document.querySelector('.learn-issue textarea').value = 'نمونهٔ آزمون مرورگر'; document.querySelector('.learn-issue').requestSubmit(); true");
  await waitFor("document.querySelector('.learn-issue').innerText.includes('گزارش روی دستگاه ثبت شد')");
  await cdp('Page.reload');
  await enter();
  await click('resume');
  await waitFor("document.querySelector('.learn-feedback h3')");
  console.log('PASS bookmarks, local issue report and session resume after reload');
  if (mode === 'offline') {
    await evaluate("window.savedBackup = JSON.stringify({ format: 'ael-offline-backup', version: 1, state: JSON.parse(localStorage.getItem('ael.learning.v1.offline-demo')) }); true");
    await click('course');
    await click('hub');
    await click('backup');
    await evaluate("{ const t = new DataTransfer(); t.items.add(new File(['{}'], 'invalid.json', {type:'application/json'})); document.querySelector('input[type=file]').files = t.files; } true");
    await click('backup-import');
    await waitFor("document.querySelector('[role=alert]')");
    assert.equal(await evaluate("localStorage.getItem('ael.learning.v1.offline-demo') === JSON.stringify(JSON.parse(window.savedBackup).state)"), true);
    await evaluate("{ const t = new DataTransfer(); t.items.add(new File([window.savedBackup], 'backup.json', {type:'application/json'})); document.querySelector('input[type=file]').files = t.files; } true");
    await click('backup-import');
    await waitFor("document.querySelector('[data-action=open-course]')");
    await click('open-course');
    await click('resume');
    await waitFor("document.querySelector('.learn-feedback h3')");
    console.log('PASS offline backup restores active session');
  }
  await click('course');
  await click('hub');
  await click('issues');
  await waitFor("document.querySelector('[data-action=export]')");
  console.log('PASS issue export is available');

  await click('hub');
  {
    assert.equal(await evaluate("document.querySelectorAll('[data-action=open-course]').length >= 2"), true);
    await evaluate("document.querySelectorAll('[data-action=open-course]')[1].click(); true");
    await waitFor("document.querySelector('.learn-app h2')?.textContent.includes('آمار')");
    await click('topic-stat.center');
    await click('practice');
    await waitFor("document.querySelector('.learn-question-title')");
    if (await evaluate("!!document.querySelector('[data-action=essay-answer]')")) {
      await evaluate("{ const t = document.querySelector('[data-action=essay-answer]'); t.value = 'پاسخ آزمایشی'; t.dispatchEvent(new Event('input')); } true");
    } else await click('pick-0');
    await click('submit-answer');
    await waitFor("document.querySelector('.learn-feedback')");
    await click('course');
    await click('custom-exam');
    await evaluate("{ const k = document.querySelector('[data-action=question-kind]'); k.value = 'essay'; k.dispatchEvent(new Event('change')); document.querySelector('input[type=number]').value = '1'; } true");
    await click('start-custom');
    await waitFor("document.querySelector('[data-action=essay-answer]')");
    assert.equal(await evaluate("!document.querySelector('.learn-app').textContent.includes('معیارهای بررسی پاسخ')"), true);
    await evaluate("{ const t = document.querySelector('[data-action=essay-answer]'); t.value = 'میانگین ۵ و میانه ۳ است'; t.dispatchEvent(new Event('input')); } true");
    await click('submit-answer');
    await waitFor("document.querySelector('.learn-feedback')?.textContent.includes('در انتظار ارزیابی')");
    await click('self-assess-review');
    await waitFor("document.querySelector('.learn-feedback')?.textContent.includes('ارزیابی شخصی')");
    await click('next-question');
    await waitFor("document.querySelector('.learn-score')?.textContent.includes('در انتظار ارزیابی')");
    await click('course');
    await click('hub');
    console.log('PASS second course and pending written answer via data registry');
  }
  await click('recurrence');
  await waitFor("document.querySelector('.learn-app').textContent.includes('ماتریس BCG')");
  assert.equal(await evaluate("document.querySelectorAll('.learn-app details').length === 1"), true);
  console.log('PASS recurring evidence with separate referenced groups');

  await click('hub');
  await click('question-index');
  await waitFor("document.querySelector('.learn-app').textContent.includes('شناسنامه پیدا شد')");
  assert.equal(await evaluate("document.querySelectorAll('.learn-card li').length"), 30);
  await click('index-more');
  assert.equal(await evaluate("document.querySelectorAll('.learn-card li').length"), 60);
  await evaluate("{ const s = document.querySelector('input[type=search]'); s.value = '۱۴۰۵'; s.dispatchEvent(new Event('input')); } true");
  assert.equal(await evaluate("document.querySelectorAll('.learn-card li').length > 0"), true);
  await evaluate("{ const s = document.querySelector('input[type=search]'); s.value = 'q.k1396.99'; s.dispatchEvent(new Event('input')); } true");
  assert.equal(await evaluate("document.querySelector('.learn-card li')?.textContent.includes('تعارض با تصویر')"), true);
  console.log('PASS metadata-only index search with Persian digits');
  await click('hub');
  await click('open-course');
  await click('custom-exam');
  await evaluate("document.querySelectorAll('fieldset input[type=checkbox]').forEach((box, i) => { if (i > 1) box.click(); }); true");
  await click('quota-toggle');
  await evaluate("{ const a = document.querySelector('[data-action=\"quota-fm.ratios\"]'); a.value = '4'; a.dispatchEvent(new Event('input')); } true");
  await click('start-custom');
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('فقط')");
  assert.equal(await evaluate("document.querySelector('[data-action=\"quota-fm.ratios\"]').value"), '4');
  await evaluate("{ const a = document.querySelector('[data-action=\"quota-fm.ratios\"]'); const b = document.querySelector('[data-action=\"quota-fm.tvm\"]'); a.value = '۱'; b.value = '۲'; a.dispatchEvent(new Event('input')); b.dispatchEvent(new Event('input')); } true");
  await click('start-custom');
  await waitFor("document.querySelector('.learn-question-title')");
  assert.equal(await evaluate("{ const key = Object.keys(localStorage).find(k => k.startsWith('ael.learning.v1.')); const qs = JSON.parse(localStorage.getItem(key)).active.questions; qs.filter(q => q.topicId === 'fm.ratios').length === 1 && qs.filter(q => q.topicId === 'fm.tvm').length === 2; }"), true);
  console.log('PASS per-topic quotas, shortage and preserved settings');
  await click('course');
  await evaluate("{ const f = document.querySelector('[data-action=filter-learning-source]'); f.value = 'os.finance.tvm'; f.dispatchEvent(new Event('change')); } true");
  assert.equal(await evaluate("{ const visible = [...document.querySelectorAll('.learn-topic')].filter(x => !x.hidden); visible.length === 1 && visible[0].dataset.action === 'topic-fm.tvm'; }"), true);
  await evaluate("{ const s = document.querySelector('input[type=search]'); s.value = 'ناموجود'; s.dispatchEvent(new Event('input')); } true");
  assert.equal(await evaluate("[...document.querySelectorAll('.learn-topic')].every(x => x.hidden) && [...document.querySelectorAll('.learn-muted')].some(x => !x.hidden && x.textContent.includes('مبحثی با این جست'))"), true);
  await evaluate("{ const f = document.querySelector('[data-action=filter-learning-source]'); f.value = ''; f.dispatchEvent(new Event('change')); } true");
  await evaluate("const s = document.querySelector('input[type=search]'); s.value = 'نسبت'; s.dispatchEvent(new Event('input')); true");
  assert.equal(await evaluate("[...document.querySelectorAll('.learn-topic')].filter(x => !x.hidden).length > 0 && [...document.querySelectorAll('.learn-topic')].some(x => x.hidden && getComputedStyle(x).display === 'none')"), true);
  await click('custom-exam');
  await evaluate("document.querySelectorAll('fieldset input[type=checkbox]').forEach((box, i) => { if (i > 0) box.click(); }); document.querySelector('input[type=number]').value = '4'; true");
  await click('start-custom');
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('۳') || document.querySelector('[role=alert]')?.textContent.includes('3')");
  await evaluate("document.querySelector('input[type=number]').value = '3'; true");
  await click('start-custom');
  await waitFor("document.querySelector('.learn-question-title')");
  assert.equal(await evaluate("document.querySelector('.learn-heading').textContent.includes('۳')"), true);
  if (mode === 'offline') {
    const course = JSON.parse(await readFile('content/learning-courses/financial-management.json', 'utf8'));
    const prompt = await evaluate("document.querySelector('.learn-question-title').textContent");
    const item = course.questions.find(question => question.prompt === prompt);
    assert.ok(item);
    await click('pick-' + ((item.answerIndex + 1) % item.choices.length));
    await click('submit-answer');
    await click('read-related');
    const targetBlock = item.readingBlock.type === 'concept'
      ? 'concept:' + item.readingBlock.index : item.readingBlock.type;
    assert.equal(await evaluate("document.activeElement?.dataset.learningBlock"), targetBlock);
    await click('mark-studied');
    await click('return-result');
    await waitFor("document.querySelector('.learn-feedback')");
    await click('course');
    await evaluate("{ const key = 'ael.learning.v1.offline-demo'; const state = JSON.parse(localStorage.getItem(key)); delete state.reviews[" + JSON.stringify(item.id) + "].topicId; localStorage.setItem(key, JSON.stringify(state)); } true");
    await cdp('Page.reload');
    await enter();
    const topicAction = JSON.stringify('[data-action="topic-' + item.topicId + '"]');
    assert.equal(await evaluate('document.querySelector(' + topicAction + ').textContent.includes("پاسخ نادرست برای مرور")'), true);
    await click('topic-' + item.topicId);
    await click('practice-topic-errors');
    await waitFor("document.querySelector('.learn-question-title')");
    assert.equal(await evaluate("{ const state = JSON.parse(localStorage.getItem('ael.learning.v1.offline-demo')); state.active.questions.every(q => state.reviews[q.id]?.status === 'incorrect'); }"), true);
    const reviewPrompt = await evaluate("document.querySelector('.learn-question-title').textContent");
    const reviewItem = course.questions.find(question => question.prompt === reviewPrompt);
    assert.ok(reviewItem);
    await click('pick-' + reviewItem.answerIndex);
    await click('submit-answer');
    await waitFor("document.querySelector('.learn-feedback h3')?.textContent === 'درست'");
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('ael.learning.v1.offline-demo')).reviews[" + JSON.stringify(reviewItem.id) + "].status"), 'correct');
    console.log('PASS topic-level mistake count and practice from incorrect answers');
    console.log('PASS wrong answer to lesson and back, independent study completion');
  }
  console.log('PASS custom topic selection and explicit shortage');
  await click('course');
  await click('timed');
  await waitFor("document.querySelector('[role=timer]')");
  await click('pick-0');
  await click('mark');
  await click('jump-1');
  assert.equal(await evaluate("!document.querySelector('.learn-feedback') && document.querySelector('[data-action=jump-0]').textContent.includes('⚑')"), true);
  await click('finish');
  await waitFor("document.querySelector('.learn-score')");
  assert.equal(await evaluate("document.querySelectorAll('[data-question]').length === 6"), true);
  console.log('PASS timed exam, flag and navigation, withheld feedback, score and complete review');
  if (mode === 'offline') {
    await click('course');
    await click('timed');
    await waitFor("document.querySelector('[role=timer]')");
    await evaluate("const afterDeadline = Date.now() + 600001; Date.now = () => afterDeadline; true");
    await waitFor("document.querySelector('.learn-score')");
    assert.equal(await evaluate("document.querySelector('.learn-score').textContent.includes('۶ نزده')"), true);
    console.log('PASS timer expiry closes the offline exam and counts unanswered items');
    assert.deepEqual(network, []);
    console.log('PASS direct file URL with HTTP and HTTPS blocked and zero external requests');
  } else {
    assert.ok(network.some(url => url.endsWith('/api/learning-quiz/finish')));
    console.log('PASS Mini App submits to authenticated Worker');
  }
} finally {
  socket?.close();
  if (browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([exited, delay(2000)]);
  }
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
