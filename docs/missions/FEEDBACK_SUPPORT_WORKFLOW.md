# گردش کار فیدبک (سند ۱۳)
- ورودها: متن آزاد چت خصوصی ربات (فعلاً) + API آینده برای دکمهٔ بازخورد. هر متن = feedback_threads رکورد یکتا با telegram_user_id/chat_id (F-01).
- وضعیت: new→triaged→in_progress→waiting_for_user→answered→resolved/closed/rejected (فیلد status).
- Thread: feedback_messages با author_kind (user/admin) و is_internal_note — یادداشت داخلی هرگز ارسال نمی‌شود (F-03، تست).
- پاسخ: پنل → POST /api/panel/feedback/:id/reply → sendMessage به chat_id همان کاربر + ثبت پیام (F-04)؛ خطای مبهم = وضعیت uncertain در پاسخ؛ Retry دستی با هشدار Duplicate.
- RBAC: read/reply با user:read_limited (SUPPORT_AGENT/OWNER)؛ بدون مجوز = 403 (F-06). Audit کامل reply.
