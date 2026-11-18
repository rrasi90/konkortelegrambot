# خط تولید OCR آزمون (نسخهٔ محلی — WIndows/سندباکس)

دو اسکریپت این پوشه، فاز ۳ مأموریت را بدون نصب باینری Tesseract اجرا می‌کنند:

1. `ocr-booklet-tesseractjs.js` — صفحات رندرشدهٔ دفترچه (PNG در ۳۰۰DPI) را با tesseract.js و مدل `fas` نسخهٔ best تشخیص می‌دهد و خروجی JSON شامل متن خام و خطوط با مختصات می‌سازد.
   - اجرا: `node ocr-booklet-tesseractjs.js <pagesDir> <out.json>`
   - رندر صفحات با PyMuPDF (pymupdf) انجام می‌شود.
2. `parse-ocr-question-blocks.py` — مارکرهای شمارهٔ سؤال (الگوی «۵- متن») را با برازش LIS روی دنبالهٔ ۱..N جدا می‌کند و بلوک خام هر سؤال را با `needsVisualReview=true` می‌نویسد.
   - اجرا: `python parse-ocr-question-blocks.py <ocr.json> <maxQuestions>`

**وضعیت:** پایلوت روی دفترچهٔ ۲۱۶۲/۱۳۹۷ (۱۲۶D) اجرا شد؛ متن سؤال‌ها با کیفیت خوب استخراج می‌شود اما تطبیق مارکرها در اولین گذر ۱۱ از ۸۰ بود (گزارش در `manual-review/ocr-pilot-phd2162-1397-126d.json`). کالیبراسیون مارکر به‌ازای هر دفترچه لازم است؛ هیچ بلوکی بدون بازبینی تصویری معتبر نیست.
