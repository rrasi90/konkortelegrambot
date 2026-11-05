/**
 * AEL-308 (نرمال‌سازی فارسی) — Raw همیشه حفظ؛ این ماژول فقط Projection نرمال می‌سازد.
 * §5.3/§8: ی/ک عربی→فارسی، اعداد، نیم‌فاصله، فاصله، RTL marks؛ گزینه‌ها و اعداد سؤال تغییر نمی‌کنند.
 */
export function normalizePersian(text) {
  return String(text ?? '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '') // bidi controls حذف در Projection
    .replace(/[\u064A]/g, '\u06CC')               // ي → ی
    .replace(/[\u0643]/g, '\u06A9')               // ك → ک
    .replace(/[\u0660-\u0669]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))  // ارقام عربی → لاتین
    .replace(/[\u06F0-\u06F9]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))  // ارقام فارسی → لاتین
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** استخراج متن PDF متنی با pdfjs-dist (devDep موجود — بدون وابستگی جدید) */
export async function extractPdfText(path) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await import('node:fs').then(fs => fs.readFileSync(path)));
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    try {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => ('str' in item ? item.str : '')).join(' ').trim();
      pages.push({ pageNumber, text, error: null, extraction_method: 'native_text' });
    } catch (error) {
      // §2-8: خطای یک صفحه مستقل است
      pages.push({ pageNumber, text: '', error: String(error.message ?? error).slice(0, 200), extraction_method: 'failed' });
    }
  }
  return { pageCount: doc.numPages, pages };
}
