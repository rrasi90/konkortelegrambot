/**
 * سرویس پس‌زمینه ربات تلگرام — آموزش کنکور
 * Long-polling مقاوم در برابر قطعی و بدون نیاز به وب‌هوک
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error(
    'CRITICAL: TELEGRAM_BOT_TOKEN environment variable is required. ' +
      'Set it in your shell or .env file before starting the bot service.',
  );
  process.exit(1);
}
// مینی‌اپ باید از دامنهٔ Worker سرو شود: تصحیح سمت سرور (R-036) از مسیرهای نسبی
// /api استفاده می‌کند و فقط هم‌مبأ با Worker کار می‌کند. Pages تعطیل است (پلن ریپو).
const APP_URL = process.env.APP_URL || 'https://adaptive-exam-worker.ael-worker.workers.dev';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg(method, body = {}) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function startPolling() {
  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'شروع / بازکردن سامانه' },
      { command: 'reminder', description: 'یادآور روزانهٔ مرور' },
    ],
  });
  console.log('[Telegram Service] Starting long polling for آموزش کنکور...');

  // Ensure webhook is deleted so getUpdates works
  await tg('deleteWebhook');
  console.log('[Telegram Service] Webhook removed, listening for updates...');

  let offset = 0;

  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=25`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = Math.max(offset, update.update_id + 1);

          const msg = update.message || update.edited_message;
          if (!msg || !msg.chat) continue;

          // پاسخ به دکمهٔ «یادآور روزانه» در پیام خوش‌آمد
          if (update.callback_query?.data === 'reminder_info') {
            await tg('answerCallbackQuery', { callback_query_id: update.callback_query.id });
            await tg('sendMessage', {
              chat_id: update.callback_query.message?.chat?.id ?? chatId,
              text:
                '⏰ یادآور روزانه\n\n' +
                'از داخل مینی‌اپ: تب «تنظیمات» → ساعت مطالعه روزانه را مشخص کنید و یک زمان ثابت برای مرور بگذارید.',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⚙️ باز کردن تنظیمات', web_app: { url: APP_URL } }],
                ],
              },
            });
            continue;
          }

          const chatId = msg.chat.id;
          const userFirstName = msg.from?.first_name || 'داوطلب';
          const text = (msg.text || '').trim();

          console.log(`[Telegram Service] Message from ${userFirstName} (${chatId}): ${text}`);

          if (text.startsWith('/reminder')) {
            // یادآور روزانه: راهنمای فعال‌سازی؛ زمان‌بندی سروری به نوبت بعدی (worker cron) واگذار می‌شود
            await tg('sendMessage', {
              chat_id: chatId,
              text: '⏰ یادآور روزانه\n\nبرای اینکه مرور امروز یادتان نرود، از داخل مینی‌اپ: تب «تنظیمات» → ساعت مطالعه روزانه را انتخاب کنید.\nپیشنهاد: یک زمان ثابت انتخاب کنید (مثلاً ۲۱:۰۰) — عادت‌سازی روی زمان ثابت مؤثرتر است.',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⚙️ تنظیم ساعت مطالعه', web_app: { url: APP_URL } }],
                ],
              },
            });
          } else if (text.startsWith('/start')) {
            // بهترین شیوهٔ onboarding: پیام کوتاه + دکمه؛ نه نسخهٔ محصول، نه اصطلاح فنی
            await tg('sendMessage', {
              chat_id: chatId,
              text: `سلام ${userFirstName}! 👋\n\nبه سامانهٔ آموزش کنکور مدیریت خوش آمدی.\nاز اینجا می‌تونی شروع کنی:\n\n🎯 تعیین سطح — ۵ سؤال سریع\n📚 مطالعهٔ کتاب فصل‌به‌فصل\n🗂 فلش‌کارت‌های مرور هوشمند\n📝 کنکورهای ۱۳۹۱ تا ۱۴۰۵`,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🎯 تعیین سطح — ۵ سؤال',
                      web_app: { url: APP_URL + '?startapp=placement' },
                    },
                  ],
                  [
                    { text: '📖 مطالعهٔ کتاب', web_app: { url: APP_URL + '?startapp=lessons' } },
                    { text: '🗂 فلش‌کارت', web_app: { url: APP_URL + '?startapp=flashcards' } },
                  ],
                  [
                    { text: '📝 کنکورهای سالانه', web_app: { url: APP_URL + '?startapp=yearly_exams' } },
                  ],
                  [{ text: '📅 یادآور روزانه', callback_data: 'reminder_info' }],
                ],
              },
            });
          } else {
            await tg('sendMessage', {
              chat_id: chatId,
              text: `برای ورود به سامانهٔ «آموزش کنکور» و مشاهدهٔ سرفصل‌ها و تست‌های تطبیقی، روی دکمهٔ زیر بزنید:`,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚀 باز کردن آموزش کنکور',
                      web_app: { url: APP_URL },
                    },
                  ],
                ],
              },
            });
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[Telegram Service] Polling error:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startPolling();
