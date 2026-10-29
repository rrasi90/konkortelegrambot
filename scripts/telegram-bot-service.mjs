/**
 * سرویس پس‌زمینه ربات تلگرام — آموزش کنکور
 * Long-polling مقاوم در برابر قطعی و بدون نیاز به وب‌هوک
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8875977365:AAGEDS3Z6tvJJhggaNA571yB9q-DaFns89I';
const APP_URL = process.env.APP_URL || 'https://adaptive-exam-worker.crystalline-jingle.workers.dev';
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

          const chatId = msg.chat.id;
          const userFirstName = msg.from?.first_name || 'داوطلب';
          const username = msg.from?.username ? `@${msg.from.username}` : userFirstName;
          const text = (msg.text || '').trim();

          console.log(`[Telegram Service] Message from ${userFirstName} (${chatId}): ${text}`);

          const userLink = `${APP_URL}?tg=${encodeURIComponent(username)}`;

          if (text.startsWith('/start')) {
            await tg('sendMessage', {
              chat_id: chatId,
              text: `سلام ${userFirstName} عزیز! به سامانهٔ یادگیری تطبیقی «آموزش کنکور» خوش آمدید 🎓\n\nپروفایل اختصاصی شما ثبت شد. برای ورود و شروع مطالعه، روی دکمهٔ زیر بزنید:`,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚀 باز کردن آموزش کنکور',
                      web_app: { url: APP_URL },
                    },
                  ],
                  [
                    {
                      text: '🌐 ورود مستقیم در مرورگر',
                      url: userLink,
                    },
                  ],
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
                  [
                    {
                      text: '🌐 ورود مستقیم در مرورگر',
                      url: userLink,
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
