/**
 * AEL-301..312 — قراردادهای Source Library، ورود محتوا و Rights Gate.
 * اصول (ADR-004/005، ADR-012):
 *  - حقوق برای هر نوع استفاده جدا است؛ مجوز ارجاع ≠ مجوز بازنشر/ارسال به AI.
 *  - Fail-closed: حقوق نامعلوم = عدم نمایش، عدم پردازش خارجی، عدم انتشار.
 *  - متن Original همیشه حفظ می‌شود؛ Normalized جدا نگه داشته می‌شود.
 */

export const SOURCE_KINDS = ['book', 'booklet', 'article', 'lecture_note', 'exam_pack', 'answer_key', 'other'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const RIGHTS_STATUSES = ['unknown', 'pending_review', 'restricted_internal', 'authorized', 'denied', 'expired'] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const RIGHTS_USE_TYPES = [
  'metadata',
  'internal_extraction',
  'derived_content',
  'excerpt_display',
  'full_text_display',
  'image_reproduction',
  'offline_bundle',
  'external_ai_processing',
  'public_republishing',
] as const;
export type RightsUseType = (typeof RIGHTS_USE_TYPES)[number];

export interface SourceRightsDecision {
  id: string;
  sourceVersionId: string;
  useType: RightsUseType;
  status: RightsStatus;
  license: string | null;
  territory: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
}

export const INGESTION_JOB_STATUSES = [
  'queued', 'leased', 'running', 'awaiting_external', 'awaiting_review',
  'succeeded', 'partial_success', 'retryable_failed', 'terminal_failed', 'cancelled',
] as const;
export type IngestionJobStatus = (typeof INGESTION_JOB_STATUSES)[number];

export const INGESTION_ADAPTERS = ['markdown', 'plaintext', 'json', 'csv', 'pdf_text', 'pdf_scanned_ocr', 'docx'] as const;
export type IngestionAdapter = (typeof INGESTION_ADAPTERS)[number];

/** Locator — هر Segment باید قابل ردیابی به منبع اصلی باشد (AEL-409). */
export interface SegmentLocator {
  sourceVersionId: string;
  pageNumber: number | null;
  /** جای دقیق در متن/صفحه — مثل شمارهٔ سطر یا بایت‌آفست */
  line: number | null;
  charStart: number | null;
  charEnd: number | null;
}

export const SEGMENT_KINDS = ['heading', 'paragraph', 'table', 'figure', 'formula', 'footnote', 'list_item'] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];

export interface NormalizedSegment {
  kind: SegmentKind;
  ordinal: number;
  text: string;
  locator: SegmentLocator;
  /** OCR/استخراج Confidence (۰..۱) — برای استخراج متنی قطعی 1 */
  confidence: number;
}

export interface NormalizedPage {
  pageNumber: number;
  segments: NormalizedSegment[];
  confidence: number;
  /** صفحهٔ خراب/کم‌اطمینان — فقط همان صفحه قرنطینه می‌شود (AT-AEL-07) */
  quarantined: boolean;
  quarantineReason: string | null;
}

export interface NormalizedDocument {
  adapter: IngestionAdapter;
  /** شمارهٔ نسخهٔ قرارداد نرمال‌سازی */
  contractVersion: 1;
  language: string;
  pages: NormalizedPage[];
  warnings: string[];
}

export interface IngestionInputFile {
  /** نوع محتوای ورودی — MIME واقعی بعد از sniffing در سرویس آپلود ثبت می‌شود */
  declaredMimeType: string;
  fileName: string;
  /** محتوای متنی (برای md/txt/json/csv) یا base64 (برای pdf/docx) */
  content: string;
  encoding: 'text' | 'base64';
  byteSize: number;
}

/** Fail-closed: تنها مسیر مجاز برای اقدام — unknown/denied/expired همیشه رد می‌شوند. */
export function rightsAllows(decisions: readonly SourceRightsDecision[], useType: RightsUseType): boolean {
  const decision = decisions.find(item => item.useType === useType);
  if (!decision) return false;
  return decision.status === 'authorized';
}

export function rightsSummary(decisions: readonly SourceRightsDecision[]): Record<RightsUseType, RightsStatus> {
  const summary = Object.fromEntries(RIGHTS_USE_TYPES.map(useType => [useType, 'unknown'])) as Record<RightsUseType, RightsStatus>;
  for (const decision of decisions) summary[decision.useType] = decision.status;
  return summary;
}

/** اعتبارسنجی فایل ورودی — سقف حجم و نوع (AEL-302) */
export const INGESTION_LIMITS = {
  maxTextBytes: 8 * 1024 * 1024,
  maxBinaryBytes: 64 * 1024 * 1024,
  maxPagesPerJob: 2000,
} as const;

export function validateIngestionInput(file: IngestionInputFile): { ok: true } | { ok: false; error: string } {
  if (file.encoding === 'text' && file.byteSize > INGESTION_LIMITS.maxTextBytes) {
    return { ok: false, error: `حجم فایل متنی بیش از سقف مجاز است (${INGESTION_LIMITS.maxTextBytes} بایت).` };
  }
  if (file.encoding === 'base64' && file.byteSize > INGESTION_LIMITS.maxBinaryBytes) {
    return { ok: false, error: `حجم فایل باینری بیش از سقف مجاز است (${INGESTION_LIMITS.maxBinaryBytes} بایت).` };
  }
  if (!file.fileName || file.fileName.length > 512 || file.fileName.includes('\0')) {
    return { ok: false, error: 'نام فایل معتبر نیست.' };
  }
  return { ok: true };
}
