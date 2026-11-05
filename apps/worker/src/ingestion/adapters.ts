/**
 * AEL-304/305/308 — Adapterهای ورود محتوا (خالص).
 * خروجی همه: NormalizedDocument مشترک با Locator و Confidence.
 * اصل AEL-308: متن Original همیشه حفظ می‌شود؛ این خروجی نرمال‌شدهٔ جداگانه است.
 */
import {
  type IngestionAdapter,
  type IngestionInputFile,
  type NormalizedDocument,
  type NormalizedPage,
  type NormalizedSegment,
  type SegmentLocator,
  type SegmentKind,
} from '@ael/contracts';

let ordinalCounter = 0;

function makeLocator(sourceVersionId: string, pageNumber: number, line: number | null, charStart: number | null, charEnd: number | null): SegmentLocator {
  return { sourceVersionId, pageNumber, line, charStart, charEnd };
}

function segment(kind: SegmentKind, text: string, locator: SegmentLocator, confidence = 1): NormalizedSegment {
  ordinalCounter += 1;
  return { kind, ordinal: ordinalCounter, text, locator, confidence };
}

function blankPage(pageNumber: number, reason: string): NormalizedPage {
  return { pageNumber, segments: [], confidence: 0, quarantined: true, quarantineReason: reason };
}

function isHeading(text: string): boolean {
  return headingLevel(text) !== null;
}

/** درجه‌بندی سرفصل Markdown یا خطوط کوتاه بدون نقطهٔ پایان */
function headingLevel(text: string): number | null {
  const md = text.match(/^(#{1,6})\s+/);
  if (md) return md[1]!.length;
  return null;
}

/** Adapter Markdown/TXT — پاراگراف‌بندی با خط خالی، سرفصل #، فرمول $$..$$، جدول |..| */
export function adaptMarkdown(file: IngestionInputFile, sourceVersionId: string): NormalizedDocument {
  const warnings: string[] = [];
  if (file.encoding !== 'text') throw new Error('Adapter متنی به ورودی متن نیاز دارد.');
  const lines = file.content.replace(/\r\n/g, '\n').split('\n');
  const pages: NormalizedPage[] = [];
  const PAGE_LINES = 40;
  let current: NormalizedSegment[] = [];
  let pageNumber = 1;
  let paragraphBuffer: string[] = [];
  let lineIndex = 0;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(' ').trim();
    const startLine = lineIndex - paragraphBuffer.length + 1;
    if (text) {
      current.push(segment('paragraph', text, makeLocator(sourceVersionId, pageNumber, startLine, null, null)));
    }
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    lineIndex += 1;
    const line = rawLine.trim();
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      flushParagraph();
      current.push(segment('formula', line.slice(2, -2).trim(), makeLocator(sourceVersionId, pageNumber, lineIndex, null, null)));
    } else if (line.startsWith('|') && line.endsWith('|')) {
      flushParagraph();
      current.push(segment('table', line, makeLocator(sourceVersionId, pageNumber, lineIndex, null, null)));
    } else if (line === '') {
      flushParagraph();
    } else {
      const level = headingLevel(line);
      if (level !== null) {
        flushParagraph();
        current.push(segment('heading', line.replace(/^#+\s+/, ''), makeLocator(sourceVersionId, pageNumber, lineIndex, null, null)));
      } else {
        paragraphBuffer.push(line);
      }
    }
    if (lineIndex % PAGE_LINES === 0) {
      flushParagraph();
      pages.push({ pageNumber, segments: current, confidence: 1, quarantined: false, quarantineReason: null });
      current = [];
      pageNumber += 1;
    }
  }
  flushParagraph();
  if (current.length || pages.length === 0) {
    pages.push({ pageNumber, segments: current, confidence: 1, quarantined: false, quarantineReason: null });
  }
  if (file.content.trim() === '') {
    return { adapter: 'markdown', contractVersion: 1, language: 'fa', pages: [blankPage(1, 'فایل خالی است.')], warnings };
  }
  return { adapter: file.declaredMimeType.includes('markdown') || file.fileName.endsWith('.md') ? 'markdown' : 'plaintext', contractVersion: 1, language: 'fa', pages, warnings };
}

/** Adapter JSON — ساختار کتاب‌واره/بستهٔ محتوا یا سؤال؛ خطا قرنطینهٔ کل نمی‌شود مگر JSON نامعتبر باشد. */
export function adaptJson(file: IngestionInputFile, sourceVersionId: string): NormalizedDocument {
  const warnings: string[] = [];
  if (file.encoding !== 'text') throw new Error('Adapter JSON به ورودی متن نیاز دارد.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch (error) {
    return {
      adapter: 'json', contractVersion: 1, language: 'fa',
      pages: [blankPage(1, `JSON نامعتبر: ${(error as Error).message.slice(0, 200)}`)],
      warnings,
    };
  }
  const pages: NormalizedPage[] = [];
  const doc = parsed as Record<string, unknown>;
  if (Array.isArray(doc?.pages)) {
    (doc.pages as unknown[]).forEach((entry, index) => {
      const page = entry as Record<string, unknown>;
      const segments: NormalizedSegment[] = [];
      const pushText = (kind: SegmentKind, value: unknown, ordinal: number) => {
        if (typeof value === 'string' && value.trim()) {
          segments.push(segment(kind, value.trim(), makeLocator(sourceVersionId, index + 1, null, null, null)));
        }
      };
      pushText('heading', page.title, 1);
      pushText('paragraph', page.text ?? page.content, 2);
      if (Array.isArray(page.segments)) {
        (page.segments as unknown[]).forEach((item, ordinal) => {
          const seg = item as Record<string, unknown>;
          pushText((typeof seg.kind === 'string' && ['heading', 'paragraph', 'table', 'figure', 'formula', 'footnote', 'list_item'].includes(seg.kind) ? seg.kind : 'paragraph') as SegmentKind, seg.text, ordinal + 3);
        });
      }
      pages.push({
        pageNumber: index + 1,
        segments,
        confidence: typeof page.confidence === 'number' ? page.confidence : 1,
        quarantined: page.quarantined === true,
        quarantineReason: typeof page.quarantineReason === 'string' ? page.quarantineReason : null,
      });
    });
  } else {
    // JSON ساختاری دلخواه: هر کلید سطح بالا یک Segment
    const segments: NormalizedSegment[] = [];
    for (const [key, value] of Object.entries(doc ?? {})) {
      if (typeof value === 'string') segments.push(segment('paragraph', value, makeLocator(sourceVersionId, 1, null, null, null)));
      else segments.push(segment('paragraph', JSON.stringify(value), makeLocator(sourceVersionId, 1, null, null, null)));
      void key;
    }
    pages.push({ pageNumber: 1, segments, confidence: 1, quarantined: false, quarantineReason: null });
  }
  return { adapter: 'json', contractVersion: 1, language: typeof doc?.language === 'string' ? doc.language : 'fa', pages, warnings };
}

/** Adapter CSV — هر سطر یک list_item؛ سطرهای ستون‌ناهم‌خوان قرنطینهٔ همان سطر. */
export function adaptCsv(file: IngestionInputFile, sourceVersionId: string): NormalizedDocument {
  const warnings: string[] = [];
  if (file.encoding !== 'text') throw new Error('Adapter CSV به ورودی متن نیاز دارد.');
  const rows = file.content.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
  if (!rows.length) {
    return { adapter: 'csv', contractVersion: 1, language: 'fa', pages: [blankPage(1, 'CSV خالی است.')], warnings };
  }
  const headerCells = rows[0]!.split(',');
  const segments: NormalizedSegment[] = [];
  rows.slice(1).forEach((row, index) => {
    const cells = row.split(',');
    if (cells.length !== headerCells.length) {
      warnings.push(`سطر ${index + 2} تعداد ستون ناهم‌خوان دارد (${cells.length} به‌جای ${headerCells.length}) — قرنطینه.`);
      return;
    }
    segments.push(segment('list_item', row, makeLocator(sourceVersionId, 1, index + 2, null, null), 1));
  });
  segments.unshift(segment('heading', headerCells.join(' | '), makeLocator(sourceVersionId, 1, 1, null, null)));
  return { adapter: 'csv', contractVersion: 1, language: 'fa', pages: [{ pageNumber: 1, segments, confidence: 1, quarantined: false, quarantineReason: null }], warnings };
}

/** انتخاب Adapter بر اساس نوع اعلامی/پسوند — pdf/docx به Job خارجی می‌رود (AEL-303). */
export function pickAdapter(file: IngestionInputFile): IngestionAdapter {
  const name = file.fileName.toLowerCase();
  const mime = file.declaredMimeType.toLowerCase();
  if (name.endsWith('.md') || mime.includes('markdown')) return 'markdown';
  if (name.endsWith('.json') || name.endsWith('.jsonl') || mime.includes('json')) return 'json';
  if (name.endsWith('.csv') || mime.includes('csv')) return 'csv';
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf_text';
  if (name.endsWith('.docx') || mime.includes('officedocument.wordprocessingml')) return 'docx';
  return 'plaintext';
}

export function adaptTextFile(file: IngestionInputFile, sourceVersionId: string): NormalizedDocument {
  const adapter = pickAdapter(file);
  if (adapter === 'json') return adaptJson(file, sourceVersionId);
  if (adapter === 'csv') return adaptCsv(file, sourceVersionId);
  return adaptMarkdown(file, sourceVersionId);
}

export { isHeading };
