// دیباگ مودال onboarding — اسکوپ z-120 و کلیک شروع کنیم
import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true, channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fa-IR' })).newPage();
await p.goto('http://127.0.0.1:3000/');
await p.waitForTimeout(1200);

const S = 'div.z-\\[120\\] ';
const click = async (t) => {
  try { await p.click(S + 'button:has-text("' + t + '")', { timeout: 2500 }); return 'ok'; }
  catch (e) { return 'FAIL: ' + e.message.split('\n')[0].slice(0, 80); }
};

console.log('arshad:', await click('کارشناسی ارشد'));
await p.waitForTimeout(300);
console.log('bazargani:', await click('بازرگانی'));
await p.waitForTimeout(300);
console.log('edame:', await click('ادامه'));
await p.waitForTimeout(400);
console.log('step3 visible:', await p.evaluate(() => document.body.innerText.includes('تاریخ آزمون')));
console.log('shoroo-konim:', await click('شروع کنیم'));
await p.waitForTimeout(900);
console.log('modal still:', await p.evaluate(() => document.body.innerText.includes('مقطع هدف شما چیست')));
await b.close();
