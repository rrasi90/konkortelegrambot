/**
 * تبدیل MinerU middle_json به MD در pdf/ + گزارش Batch (_CONVERSION_REPORT).
 * سازگار با ۲۶ فایل موجود (CRLF، Front Matter، Placeholderها).
 *   node scripts/convert-pdf-md.mjs [--check]   # --check فقط گزارش اختلاف، بدون نوشتن
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const CHECK = process.argv.includes('--check');
const registry = JSON.parse(readFileSync(join(root, '.ael-work', 'pdf-ingestion', 'registry', 'registry.json'), 'utf8'));
const cacheRoot = join(root, '.ael-work', 'pdf-ingestion', 'mineru-cache');
const pdfDir = join(root, 'pdf');

const BLOCKQUOTE = '> استخراج خودکار OCR با MinerU؛ همه بلوک\u200cهای متن، معادله و جدول این فایل در ادامه آورده شده\u200cاند. خطاهای محتمل OCR (به\u200cویژه در اعداد/حروف فارسی) ممکن است وجود داشته باشد؛ مرجع نهایی متن، PDF اصلی است.';
const PARSER = 'MinerU 4.1.7 middle_json';
const TEXT_TYPES = new Set(['header', 'text', 'footer', 'page_number', 'ref_text', 'aside_text']);

function classify(basename) {
  if (/^(جواب|پاسخ)/.test(basename)) return 'answer_key';
  if (/دفترچه|سؤالات|کنکور/.test(basename)) return 'exam_paper';
  return 'unknown';
}

function flatStrings(content) {
  if (typeof content === 'string') return [content];
  if (Array.isArray(content)) {
    const out = [];
    for (const item of content) {
      if (item && typeof item === 'object') out.push(...flatStrings(item.content));
    }
    return out;
  }
  return [];
}

function renderInline(items) {
  if (typeof items === 'string') return items;
  if (!Array.isArray(items)) return '';
  const pieces = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'equation_inline') pieces.push(`$${item.content ?? ''}$`);
    else if (item.type === 'hyperlink') pieces.push(renderInline(item.content ?? ''));
    else if (typeof item.content === 'string') pieces.push(item.content);
    else if (Array.isArray(item.content)) pieces.push(renderInline(item.content));
  }
  return pieces.join('\n');
}

function renderBlock(block, pageNumber) {
  const type = block.type;
  const content = block.content;
  if (type === 'equation') {
    const text = typeof content === 'string' ? content : flatStrings(content).join('');
    if (!text.trim()) return '';
    return `$$\n${text}\n$$`;
  }
  if (type === 'table') {
    const parts = [];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'table_caption') {
          const t = renderInline(item.content ?? '').trim();
          if (t) parts.push(`**${t}**`);
        } else if (item.type === 'table_body') {
          if (item.content) parts.push(item.content);
        } else if (item.type === 'table_footnote') {
          const t = renderInline(item.content ?? '');
          if (t.trim()) parts.push(t);
        } else if (typeof item.content === 'string') {
          if (item.content) parts.push(item.content);
        }
      }
    } else if (typeof content === 'string' && content) {
      parts.push(content);
    }
    return parts.join('\n\n');
  }
  if (type === 'image') {
    const parts = [`[تصویر (صفحه ${pageNumber}) — متن داخل تصویر استخراج نشده است؛ برای مشاهده به PDF اصلی رجوع شود.]`];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'image_caption' || item.type === 'image_footnote') {
          const t = renderInline(item.content ?? '');
          if (t.trim()) parts.push(t);
        }
      }
    }
    return parts.join('\n\n');
  }
  if (type === 'chart') {
    const parts = [`[نمودار/چارت (صفحه ${pageNumber})]`];
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'chart_caption' || item.type === 'chart_footnote') {
          const t = renderInline(item.content ?? '');
          if (t.trim()) parts.push(t);
        }
      }
    }
    return parts.join('\n\n');
  }
  if (type === 'paragraph_title' || type === 'doc_title') {
    const level = Number(block.level) || (type === 'doc_title' ? 1 : 2);
    const t = renderInline(Array.isArray(content) ? content : []).trim();
    if (!t) return '';
    return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${t}`;
  }
  if (type === 'code') {
    let body = '';
    if (typeof content === 'string') body = content;
    else if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.content === 'string') {
          if (item.content) body += item.content;
        } else if (Array.isArray(item.content)) {
          body += item.content.map((sub) => (sub && typeof sub.content === 'string' ? sub.content : '')).join(' ');
        }
      }
    }
    if (!body.trim()) return '';
    return '```\n' + body + '\n```';
  }
  return renderInline(Array.isArray(content) ? content : (typeof content === 'string' ? [content] : []));
}

function buildMarkdown(source, pages) {
  const basename = source.basename;
  const docType = classify(basename);
  const mdName = basename.replace(/\.pdf$/i, '.md');
  const totalPages = pages.length;
  const frontmatter = [
    '---',
    `document_id: ${source.source_id}`,
    `source_id: ${source.source_id}`,
    `source_version_id: ${source.source_version_id}`,
    `document_type: ${docType}`,
    `source_pdf_sha256: "${source.sha256}"`,
    `source_page_count: ${totalPages}`,
    'source_file_present_in_git: false',
    'exam_year: null',
    'exam_year_status: unknown',
    'exam_set_code: null',
    'booklet_code: null',
    'combination_code: null',
    'paired_document_id: null',
    'pairing_status: unresolved',
    `classification_status: ${docType === 'unknown' ? 'needs_review' : 'classified'}`,
    'rights_status: pending_review',
    'verification_status: pending_official_check',
    'language: fa',
    'content_version: 1',
    `parser: "${PARSER}"`,
    '---',
    '',
    BLOCKQUOTE,
    '',
    '',
  ].join('\n');
  const pageSections = [];
  for (const [pi, page] of pages.entries()) {
    const pageNumber = pi + 1;
    const rendered = [];
    for (const block of page.blocks ?? []) {
      const r = renderBlock(block, pageNumber).trim();
      if (r) rendered.push(r);
    }
    pageSections.push(`## صفحه ${pageNumber} از ${totalPages}\n\n` + rendered.join('\n\n'));
  }
  return { mdName, markdown: frontmatter + pageSections.join('\n\n') + '\n' };
}

function toCRLF(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

function auditMissing(pages, markdown) {
  const missing = [];
  for (const [pi, page] of pages.entries()) {
    for (const [bi, block] of (page.blocks ?? []).entries()) {
      const items = [];
      const collect = (content) => {
        if (typeof content === 'string') items.push(content);
        else if (Array.isArray(content)) {
          for (const it of content) {
            if (it && typeof it === 'object' && typeof it.content !== 'undefined') collect(it.content);
          }
        }
      };
      collect(block.content);
      for (const s of items) {
        if (typeof s !== 'string' || !s.trim()) continue;
        if (!markdown.includes(s) && !markdown.includes(s.trim())) missing.push({ page: pi + 1, block_index: bi, type: block.type, text: s.slice(0, 80) });
      }
    }
  }
  return missing;
}

const report = [];
let diffCount = 0;
for (const source of Object.values(registry.sources)) {
  const outDir = join(cacheRoot, source.source_id);
  let jsonFile = null;
  if (existsSync(outDir)) jsonFile = readdirSync(outDir).find((name) => name.endsWith('.json')) ?? null;
  if (!jsonFile) {
    report.push({ file: source.basename, status: 'missing_middle_json', detail: `no middle_json in ${source.source_id}` });
    continue;
  }
  const middle = JSON.parse(readFileSync(join(outDir, jsonFile), 'utf8'));
  const pages = middle.pages ?? middle.pdf_info ?? [];
  const { mdName, markdown } = buildMarkdown(source, pages);
  const crlf = toCRLF(markdown);
  const mdBytes = Buffer.byteLength(crlf, 'utf8');
  let blocks = 0, equations = 0, tables = 0, images = 0, textBlocks = 0;
  for (const page of pages) {
    for (const block of page.blocks ?? []) {
      blocks += 1;
      if (block.type === 'equation') equations += 1;
      else if (block.type === 'table') tables += 1;
      else if (block.type === 'image') images += 1;
      if (TEXT_TYPES.has(block.type) && flatStrings(block.content).join('').trim()) textBlocks += 1;
    }
  }
  let chars = 0;
  for (const [pi, page] of pages.entries()) {
    for (const block of page.blocks ?? []) {
      const r = renderBlock(block, pi + 1).trim();
      if (r) chars += [...r].length;
    }
  }
  const missingItems = auditMissing(pages, markdown);
  const destPath = join(pdfDir, mdName);
  if (CHECK) {
    if (existsSync(destPath)) {
      const existing = readFileSync(destPath);
      const same = Buffer.compare(existing, Buffer.from(crlf, 'utf8')) === 0;
      if (!same) diffCount += 1;
      console.log(`${same ? 'MATCH' : 'DIFF '} ${source.basename} (blocks=${blocks}, chars=${chars}, bytes=${mdBytes}, missing=${missingItems.length})`);
    } else {
      console.log(`NEW   ${source.basename} -> ${mdName} (blocks=${blocks}, chars=${chars}, bytes=${mdBytes}, missing=${missingItems.length})`);
    }
  } else {
    writeFileSync(destPath, crlf, 'utf8');
    console.log(`OK    ${source.basename} -> ${mdName} (blocks=${blocks}, chars=${chars}, bytes=${mdBytes}, missing=${missingItems.length})`);
  }
  report.push({
    file: source.basename,
    status: missingItems.length ? 'audit_failed' : 'ok',
    md: mdName,
    pages: pages.length,
    blocks,
    missing: missingItems.length,
    missing_items: missingItems,
    text_blocks: textBlocks,
    equations,
    tables,
    images,
    chars,
    md_bytes: mdBytes,
  });
}

if (CHECK) {
  console.log(`check done: ${diffCount} differing file(s).`);
  process.exit(diffCount ? 1 : 0);
}

const date = new Date().toISOString().slice(0, 10);
const mdReport = [
  '# گزارش تبدیل PDF به Markdown',
  '',
  `تاریخ: ${date}`,
  '',
  '| فایل PDF | وضعیت | صفحات | بلوک‌ها | بدون متن (ممیزی) | معادله | جدول | تصویر | حجم MD |',
  '|---|---|---|---|---|---|---|---|---|',
];
for (const r of report) {
  if (r.status === 'missing_middle_json') {
    mdReport.push(`| ${r.file} | ${r.status}: ${r.detail} | — | — | — | — | — | — | — |`);
  } else {
    mdReport.push(`| ${r.file} | ${r.status} | ${r.pages} | ${r.blocks} | ${r.missing} | ${r.equations} | ${r.tables} | ${r.images} | ${r.md_bytes} بایت |`);
  }
}
mdReport.push('');
mdReport.push('ممیزی: هر بلوک middle_json (متن/معادله/جدول/سربرگ/پابرگ/شماره صفحه) باید عیناً در فایل MD وجود داشته باشد. بلوک‌های image در مواردی که متن قابل‌استخراج ندارند، با نشان `[تصویر (صفحه N) — ...]` جای دقیق خود را حفظ کرده‌اند.');
mdReport.push('');
writeFileSync(join(pdfDir, '_CONVERSION_REPORT.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
writeFileSync(join(pdfDir, '_CONVERSION_REPORT.md'), toCRLF(mdReport.join('\n')), 'utf8');
console.log(`report written: ${report.filter((r) => r.status === 'ok').length} ok, ${report.filter((r) => r.status === 'missing_middle_json').length} missing.`);
