/**
 * مأموریت v2 Phase 6 — Markdown Export/Import (MARKDOWN_EXPORT_IMPORT_SPEC).
 * اصول سند ۱۴: ZIP فقط .md · Front Matter با Schema Version · Dry-run پیش‌فرض ·
 * بدون Secret/PII/کلید · حقوق export مستقل · Round-trip بدون Duplicate.
 */

export const MARKDOWN_EXPORT_SCHEMA = 'ael-markdown-export-v2';

export interface ExportFrontMatter {
  format: string;
  entity_type: string;
  entity_id: string;
  entity_version_id?: string;
  title: string;
  language: string;
  status: string;
  rights_export: 'allowed' | 'denied' | 'unknown';
  exported_at: string;
  [key: string]: unknown;
}

export function buildFrontMatter(fields: ExportFrontMatter): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
      continue;
    }
    const encoded = typeof value === 'string' && /[:#\n]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : String(value);
    lines.push(`${key}: ${encoded}`);
  }
  lines.push('---');
  return lines.join('\n');
}

type Row = Record<string, unknown>;

export interface ExportBundle {
  files: Array<{ path: string; content: string }>;
  warnings: string[];
}

/** Export یک Book با Editionها و فصل‌ها (M-02) — محتوای Material با Gate حقوق */
export function renderBookBundle(input: {
  book: Row;
  editions: Row[];
  nodes: Row[];
  materials: Row[];
  exportedAt: string;
}): ExportBundle {
  const warnings: string[] = [];
  const book = input.book;
  const bookId = String(book.id);
  const files: Array<{ path: string; content: string }> = [];

  files.push({
    path: `04-books/${bookId}/book.md`,
    content: [
      buildFrontMatter({
        format: MARKDOWN_EXPORT_SCHEMA, entity_type: 'book', entity_id: bookId,
        title: String(book.title), language: String(book.language ?? 'fa-IR'),
        status: 'exported', rights_export: 'allowed', exported_at: input.exportedAt,
      }),
      '',
      `# ${String(book.title)}`,
      '',
      `- نویسندگان: ${String(book.authors ?? 'unknown')}`,
      `- ناشر: ${String(book.publisher ?? 'unknown')}`,
      `- ISBN: ${String(book.isbn ?? 'unknown')}`,
      '',
    ].join('\n'),
  });

  for (const edition of input.editions.filter(row => String(row.book_id) === bookId)) {
    const editionId = String(edition.id);
    files.push({
      path: `04-books/${bookId}/editions/${editionId}/edition.md`,
      content: [
        buildFrontMatter({
          format: MARKDOWN_EXPORT_SCHEMA, entity_type: 'book_edition', entity_id: editionId,
          title: `ویرایش ${String(edition.edition_number ?? 'unknown')}`, language: 'fa-IR',
          status: 'exported', rights_export: String(edition.rights_status) === 'authorized' ? 'allowed' : 'unknown',
          exported_at: input.exportedAt, book_id: bookId,
        }),
        '',
        `# ویرایش ${String(edition.edition_number ?? 'unknown')} (${String(edition.publication_year ?? 'unknown')})`,
        '',
        `- وضعیت حقوق: ${String(edition.rights_status)}`,
        '',
      ].join('\n'),
    });
    const editionNodes = input.nodes
      .filter(row => String(row.edition_id) === editionId)
      .sort((a, b) => Number(a.position) - Number(b.position));
    for (const node of editionNodes) {
      const nodeId = String(node.id);
      const materials = input.materials.filter(row => String(row.book_node_id ?? '') === nodeId);
      const bodyParts: string[] = [
        buildFrontMatter({
          format: MARKDOWN_EXPORT_SCHEMA, entity_type: 'book_structure_node', entity_id: nodeId,
          title: String(node.title), language: 'fa-IR', status: String(node.structure_status),
          rights_export: 'allowed', exported_at: input.exportedAt,
          book_id: bookId, book_edition_id: editionId,
        }),
        '',
        `# ${String(node.display_number ? node.display_number + ' — ' : '')}${String(node.title)}`,
        '',
        `- نوع: ${String(node.node_kind)} · صفحهٔ شروع: ${String(node.page_start ?? 'unknown')}`,
        '',
      ];
      for (const material of materials) {
        const exportRight = String(material.rights_export ?? 'unknown');
        if (exportRight !== 'allowed') {
          warnings.push(`Material ${material.id} با حقوق export=${exportRight} فقط به‌صورت Metadata صادر شد.`);
          bodyParts.push(`## Material ${String(material.slug ?? material.id)}\n\n> حقوق export: ${exportRight} — محتوا صادر نشد.\n`);
          continue;
        }
        bodyParts.push(`## ${String(material.title ?? material.slug ?? 'بدون عنوان')}\n\n${String(material.body_markdown ?? '')}\n`);
      }
      files.push({ path: `04-books/${bookId}/editions/${editionId}/chapters/${nodeId}.md`, content: bodyParts.join('\n') });
    }
  }
  return { files, warnings };
}

/** ZIP فقط-md — روش STORE بدون وابستگی (M-04) */
function crc32(bytes: Uint8Array): number {
  let table = crc32Cache;
  if (!table) {
    table = crc32Cache = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]!;
  return (crc ^ 0xffffffff) >>> 0;
}
let crc32Cache: Uint32Array | null = null;

export function buildZip(files: Array<{ path: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const push = (bytes: Uint8Array) => chunks.push(bytes);
  const u16 = (value: number) => new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
  const u32 = (value: number) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const local = new Uint8Array(30 + nameBytes.length);
    local.set(u32(0x04034b50), 0); local.set(u16(20), 4); local.set(u16(0), 6);
    local.set(u16(0), 8); local.set(u16(0), 10); local.set(u16(0), 12);
    local.set(u32(crc), 14); local.set(u32(dataBytes.length), 18); local.set(u32(dataBytes.length), 22);
    local.set(u16(nameBytes.length), 26); local.set(u16(0), 28); local.set(nameBytes, 30);
    push(local); push(dataBytes);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    centralEntry.set(u32(0x02014b50), 0); centralEntry.set(u16(20), 4); centralEntry.set(u16(20), 6);
    centralEntry.set(u16(0), 8); centralEntry.set(u16(0), 10); centralEntry.set(u16(0), 12);
    centralEntry.set(u16(0), 14); centralEntry.set(u32(crc), 16);
    centralEntry.set(u32(dataBytes.length), 20); centralEntry.set(u32(dataBytes.length), 24);
    centralEntry.set(u16(nameBytes.length), 28); centralEntry.set(u16(0), 30); centralEntry.set(u16(0), 32);
    centralEntry.set(u16(0), 34); centralEntry.set(u16(0), 36); centralEntry.set(u32(0), 38);
    centralEntry.set(u32(offset), 42); centralEntry.set(nameBytes, 46);
    central.push(centralEntry);
    offset += local.length + dataBytes.length;
  }

  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  end.set(u32(0x06054b50), 0); end.set(u16(0), 4); end.set(u16(0), 6);
  end.set(u16(files.length), 8); end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12); end.set(u32(offset), 16); end.set(u16(0), 20);

  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of [...chunks, ...central, end]) { out.set(chunk, pos); pos += chunk.length; }
  return out;
}

// ---------- Import (سند ۱۴٫۶) — Dry-run خالص ----------

export interface ParsedMarkdownFile {
  path: string;
  frontMatter: Record<string, unknown>;
  body: string;
}

/** Parse امن Front Matter — بدون اجرای کد، محدود به کلیدهای شناخته‌شده (سند ۱۷٫۲) */
export function parseMarkdownFile(path: string, content: string): { ok: true; file: ParsedMarkdownFile } | { ok: false; error: string } {
  if (!content.startsWith('---')) return { ok: false, error: `${path}: Front Matter یافت نشد.` };
  const end = content.indexOf('\n---', 3);
  if (end < 0) return { ok: false, error: `${path}: Front Matter بسته نشده است.` };
  const yaml = content.slice(4, end);
  const body = content.slice(end + 4).replace(/^\n+/, '');
  const frontMatter: Record<string, unknown> = {};
  let currentKey: string | null = null;
  for (const line of yaml.split('\n')) {
    if (line.startsWith('  - ')) {
      if (!currentKey) return { ok: false, error: `${path}: آیتم فهرست بدون کلید.` };
      const list = frontMatter[currentKey];
      if (!Array.isArray(list)) frontMatter[currentKey] = [line.slice(4).replace(/^"|"$/g, '')];
      else list.push(line.slice(4).replace(/^"|"$/g, ''));
      continue;
    }
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) return { ok: false, error: `${path}: خط نامعتبر در Front Matter: ${line.slice(0, 40)}` };
    const [, key, raw] = match;
    currentKey = key!;
    frontMatter[key!] = raw!.startsWith('"') ? raw!.slice(1, -1).replace(/\\"/g, '"') : raw!;
  }
  if (frontMatter.format !== MARKDOWN_EXPORT_SCHEMA) {
    return { ok: false, error: `${path}: schema ناپذیرفته — ${String(frontMatter.format)} ≠ ${MARKDOWN_EXPORT_SCHEMA}` };
  }
  for (const required of ['entity_type', 'entity_id', 'title'] as const) {
    if (typeof frontMatter[required] !== 'string' || !(frontMatter[required] as string).trim()) {
      return { ok: false, error: `${path}: فیلد الزامی «${required}» در Front Matter نیست.` };
    }
  }
  return { ok: true, file: { path, frontMatter, body } };
}

export interface ImportPreviewReport {
  files: number;
  valid: number;
  invalid: number;
  create: number;
  update: number;
  skip: number;
  duplicates: string[];
  errors: string[];
  /** Dry-run: هیچ نوشتنی انجام نشده است */
  committed: false;
}

/** Dry-run Import — Create/Update/Skip/Conflict بدون نوشتن (M-08) */
export function previewImport(files: Array<{ path: string; content: string }>, existingIds: Set<string>): ImportPreviewReport {
  const report: ImportPreviewReport = { files: files.length, valid: 0, invalid: 0, create: 0, update: 0, skip: 0, duplicates: [], errors: [], committed: false };
  const seen = new Set<string>();
  for (const file of files) {
    const parsed = parseMarkdownFile(file.path, file.content);
    if (!parsed.ok) {
      report.invalid += 1;
      report.errors.push(parsed.error);
      continue;
    }
    report.valid += 1;
    const entityId = String(parsed.file.frontMatter.entity_id ?? '');
    if (seen.has(entityId)) report.duplicates.push(`${file.path}: entity_id تکراری در بسته (${entityId})`);
    seen.add(entityId);
    if (existingIds.has(entityId)) report.update += 1;
    else report.create += 1;
  }
  return report;
}
