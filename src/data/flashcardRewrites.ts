/**
 * بازنویسی کارت‌های «اصطلاح ← تعریف» انکی به پرسش قابل‌بازیابی.
 *
 * این فایل دادهٔ ثابت است، نه تبدیل خودکار در زمان اجرا. شناسهٔ هر مدخل
 * همان `id` کارت خام است؛ متن پاسخ در صورت نیاز از کارت اصلی گرفته می‌شود.
 * کارت‌های خام دست‌نخورده می‌مانند و فقط لایهٔ مطالعه از این بازنویسی‌ها
 * استفاده می‌کند.
 */
export interface FlashcardRewrite {
  front: string;
  back?: string;
  layer?: 'L1' | 'L2' | 'L3';
}

export const FLASHCARD_REWRITES: Record<string, FlashcardRewrite> = {
  anki_marketing_1: {
    front: 'چهار هدف اصلی بازاریابی چیست؟',
    back: 'حداکثر کردن مصرف، رضایت مشتری، حق انتخاب و کیفیت زندگی.',
    layer: 'L2',
  },
  anki_marketing_2: { front: 'هدف بازاریابی در سازمان‌های غیرتجاری چیست؟', layer: 'L1' },
  anki_marketing_3: { front: '«نیاز» را تعریف کن.', layer: 'L1' },
  anki_marketing_4: { front: '«نیاز آشکار» را با یک مثال تعریف کن.', layer: 'L1' },
  anki_marketing_5: { front: '«نیاز پنهان» چه تفاوتی با نیاز آشکار دارد؟', layer: 'L2' },
  anki_marketing_6: { front: '«نیاز گمراه‌کننده» را تعریف کن.', layer: 'L1' },
  anki_marketing_7: { front: '«نیازهای کور» چه نیازهایی هستند؟', layer: 'L1' },
  anki_marketing_8: { front: '«خواسته» چگونه از نیاز ساخته می‌شود؟', layer: 'L2' },
  anki_marketing_9: { front: 'منشأ و رکن اساسی بازاریابی چیست؟', layer: 'L1' },
  anki_marketing_10: { front: '«نزدیک‌بینی بازاریابی» چه زمانی رخ می‌دهد؟', layer: 'L2' },
  anki_marketing_11: { front: 'تفاوت نیاز و خواسته را توضیح بده.', layer: 'L2' },
  anki_marketing_12: { front: '«تقاضا» چه زمانی شکل می‌گیرد؟', layer: 'L1' },
  anki_marketing_13: { front: '«مبادله» چیست و چرا ارزش‌زا است؟', layer: 'L2' },
  anki_marketing_14: { front: '«معامله» چه زمانی اتفاق می‌افتد؟', layer: 'L1' },
  anki_marketing_15: { front: '«بازار» را تعریف کن.', layer: 'L1' },
  anki_marketing_16: { front: '«فرابازار» را با یک مثال توضیح بده.', layer: 'L2' },
  anki_marketing_17: { front: 'ابعاد مختلف مدیریت بازاریابی کدام‌اند؟', layer: 'L2' },
  anki_marketing_18: { front: '«بازارگرایی» چه چیزی را در کانون فعالیت قرار می‌دهد؟', layer: 'L1' },
  anki_marketing_19: { front: '«بازارشناسی» چه کاری انجام می‌دهد؟', layer: 'L2' },
  anki_marketing_20: { front: 'مراحل بازاریابی را به ترتیب بگو.', layer: 'L2' },
  anki_marketing_21: { front: '«بازارگرمی» از چه ابزارهایی استفاده می‌کند؟', layer: 'L1' },
  anki_marketing_22: { front: '«بازارسازی» چه هدفی را دنبال می‌کند؟', layer: 'L2' },
  anki_marketing_24: { front: '«بازارداری» چگونه وفاداری می‌سازد؟', layer: 'L2' },
  anki_marketing_25: { front: '«بازارگردی» چه نقشی در دید بازاریاب دارد؟', layer: 'L2' },
  anki_marketing_26: { front: '«بازارسنجی» چه چیزی را ارزیابی می‌کند؟', layer: 'L1' },
  anki_marketing_27: { front: 'چرا «بازارگردانی» جامع‌ترین واژهٔ بازاریابی است؟', layer: 'L2' },
  anki_marketing_28: { front: 'سه سطح بازاریابی رابطه‌مند کدام‌اند؟', layer: 'L1' },
  anki_marketing_29: { front: 'ارزش یک پیشنهاد از چه اجزایی تشکیل می‌شود؟', layer: 'L2' },
  anki_marketing_30: { front: '«افزایش سهم از کیف پول مشتری» یعنی چه؟', layer: 'L1' },
  anki_marketing_31: { front: '«فروش عرضی» یعنی چه؟', layer: 'L1' },
  anki_marketing_32: { front: '«فروش عمودی» یعنی چه؟', layer: 'L1' },
  anki_marketing_33: { front: '«پروانه‌ها» در بخش‌بندی مشتریان چه ویژگی‌ای دارند؟', layer: 'L2' },
  anki_marketing_35: { front: '«تقاضای منفی» چیست و چه استراتژی‌ای می‌خواهد؟', layer: 'L2' },
  anki_marketing_36: { front: '«فقدان تقاضا» چه زمانی رخ می‌دهد؟', layer: 'L1' },
  anki_marketing_37: { front: '«تقاضای پنهان» با چه استراتژی‌ای پاسخ داده می‌شود؟', layer: 'L2' },
  anki_marketing_38: { front: '«تقاضای تنزلی» چه نشانه‌ای دارد؟', layer: 'L1' },
  anki_marketing_39: { front: '«تقاضای فصلی نامنظم» چه استراتژی‌ای می‌خواهد؟', layer: 'L1' },
  anki_marketing_42: { front: '«تقاضای بیش از حد» چه مشکلی می‌سازد؟', layer: 'L2' },
  anki_marketing_43: { front: 'سه روش بازاریابی معکوس کدام‌اند؟', layer: 'L1' },
  anki_marketing_44: { front: '«بازاریابی معکوس عمومی» را با یک مثال توضیح بده.', layer: 'L2' },
  anki_marketing_45: { front: '«بازاریابی معکوس گزینشی» چه کاری می‌کند؟', layer: 'L1' },
  anki_marketing_46: { front: '«بازاریابی معکوس نمایان» چه هدفی دارد؟', layer: 'L2' },
  anki_marketing_47: { front: '«تقاضای ناسالم» چه واکنشی می‌خواهد؟', layer: 'L1' },
  anki_marketing_48: { front: '«بازارزدایی» چیست و کاتلر آن را برای چه مطرح کرد؟', layer: 'L2' },
  anki_marketing_50: { front: '«بازاریابی خویشاوندی» چیست؟', layer: 'L2' },
  anki_marketing_51: { front: '«بازاریابی چندگانه» چه زمانی به کار می‌آید؟', layer: 'L2' },
  anki_marketing_52: { front: '«بازاریابی پرورشی» چه نوع تقاضایی را تبدیل می‌کند؟', layer: 'L2' },
  anki_marketing_54: { front: '«خواسته‌ها» چگونه تحت تأثیر فرهنگ و جامعه تغییر می‌کنند؟', layer: 'L2' },
  anki_marketing_55: { front: '«گرایش تولید» بر چه چیزی تمرکز دارد؟', layer: 'L1' },
  anki_marketing_56: { front: '«گرایش تولید» چه زمانی انتخاب مناسبی است؟', layer: 'L2' },
};

export const REWRITTEN_CARD_COUNT = Object.keys(FLASHCARD_REWRITES).length;
