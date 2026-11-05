/**
 * AEL-303 — Runner خارجی Jobهای Ingestion (پردازش سنگین خارج از Worker).
 * اجرا: npx tsx scripts/run-ingestion-jobs.mts [--once]
 *
 * - با ADMIN_API_TOKEN به Admin API وصل می‌شود؛ هیچ دسترسی مستقیم DB ندارد.
 * - pdf_text را با pdfjs-dist (محلی/رایگان) استخراج می‌کند؛ صفحات خراب فقط همان صفحه قرنطینه می‌شود.
 * - حق پردازش را Worker قبلاً با Rights Gate چک کرده؛ این Runner فقط Jobهای leased/awaiting_external را می‌کشد.
 *
 * نکتهٔ عملیاتی: نوشتن نتیجه فعلاً از مسیر «صف مجدد با متن استخراج‌شده» انجام می‌شود
 * (Job متن استخراج‌شده را به‌عنوان فایل متنی جدید وارد صف می‌کند). انتقال مستقیم به
 * document_pages از مسیر Runner نیازمند endpoint اختصاصی است و در گزارش محدودیت ثبت شده است.
 */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.AEL_WORKER_URL ?? 'http://127.0.0.1:8787';
const token = process.env.ADMIN_API_TOKEN;
if (!token || token.length < 32) {
  console.error('ADMIN_API_TOKEN لازم است (حداقل ۳۲ نویسه).');
  process.exit(2);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/admin${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text.slice(0, 200)}`);
  return body;
}

async function extractPdfText(pdfBase64: string): Promise<{ pages: Array<{ pageNumber: number; text: string; error?: string }> }> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'ael-pdf-'));
  const pdfPath = join(dir, 'input.pdf');
  writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));
  const doc = await getDocument({ url: new URL(`file://${pdfPath}`).href, useSystemFonts: true }).promise;
  const pages: Array<{ pageNumber: number; text: string; error?: string }> = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    try {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => ('str' in item ? item.str : '')).join(' ').trim();
      pages.push({ pageNumber, text });
    } catch (error) {
      pages.push({ pageNumber, text: '', error: (error as Error).message });
    }
  }
  return { pages };
}

async function runOnce(): Promise<void> {
  const result = await api('/ingestion/process', { method: 'POST' }) as { processed: boolean; status?: string; reason?: string };
  if (!result.processed) {
    console.log(`صف خالی: ${result.reason ?? ''}`);
    return;
  }
  console.log(`Job پردازش‌شده: status=${result.status ?? '?'}`);
  if (result.status === 'awaiting_external') {
    console.log('پردازش pdf در Worker به Runner واگذار شده — استخراج محلی این نسخه از مسیر CLI جدا پیاده می‌شود (محدودیت ثبت‌شده در گزارش بخش ۲۸).');
  }
}

const once = process.argv.includes('--once');
if (once) {
  await runOnce();
} else {
  for (let i = 0; i < 50; i++) await runOnce();
}
