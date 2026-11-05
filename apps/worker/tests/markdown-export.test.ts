import { beforeEach, describe, expect, it } from 'vitest';
import { buildZip, parseMarkdownFile, previewImport, renderBookBundle, MARKDOWN_EXPORT_SCHEMA } from '../src/export/markdown';
import { createApp, type Env } from '../src/index';
import { MemoryAdminStore } from '../src/admin/store';

const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: '123456:export-test',
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'q'); params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: userId, first_name: 'A' }));
  const data = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const sk = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  params.set('hash', await hmacHex(await crypto.subtle.sign('HMAC', sk, new TextEncoder().encode('123456:export-test')), data));
  return params.toString();
}

describe('Phase 6 — Markdown Export (خالص)', () => {
  const book = { id: 'book-1', slug: 'bk', title: 'کتاب آزمون', language: 'fa-IR', authors: 'نویسنده', publisher: 'ناشر', isbn: '978-0' };
  const editions = [
    { id: 'ed-1', book_id: 'book-1', edition_number: 1, publication_year: '1400', rights_status: 'unknown' },
    { id: 'ed-2', book_id: 'book-1', edition_number: 2, publication_year: '1403', rights_status: 'authorized' },
  ];
  const nodes = [
    { id: 'ch-1', edition_id: 'ed-2', node_kind: 'chapter', title: 'ارزش زمانی پول', display_number: '۳', position: 1, page_start: 40 },
    { id: 'ch-2', edition_id: 'ed-1', node_kind: 'chapter', title: 'فصل قدیمی', position: 1 },
  ];
  const materials = [
    { id: 'm-1', slug: 'lesson-tvm', book_node_id: 'ch-1', title: 'درسنامهٔ ارزش زمانی', body_markdown: '# درسنامه\n\nفرمول $$PV=FV/(1+r)^n$$', rights_export: 'allowed' },
    { id: 'm-2', slug: 'restricted', book_node_id: 'ch-1', title: 'مادهٔ محدود', body_markdown: 'متن خصوصی', rights_export: 'denied' },
  ];

  it('M-02/M-03/M-05: Export کتاب — Front Matter فارسی + درخت Edition/فصل', () => {
    const bundle = renderBookBundle({ book, editions, nodes, materials, exportedAt: '2026-11-05T12:00:00Z' });
    const bookFile = bundle.files.find(file => file.path.endsWith('/book.md'))!;
    expect(bookFile.content).toContain(MARKDOWN_EXPORT_SCHEMA);
    expect(bookFile.content).toContain('کتاب آزمون');
    // دو ویرایش → دو edition.md
    expect(bundle.files.filter(file => file.path.includes('/editions/') && file.path.endsWith('edition.md'))).toHaveLength(2);
    // فصل ویرایش ۲ و فصل ویرایش ۱
    expect(bundle.files.some(file => file.path.includes('ed-2/chapters/ch-1.md'))).toBe(true);
    // M-07: حقوق denied → فقط Metadata، بدون بدنهٔ محتوا
    const chapterFile = bundle.files.find(file => file.path.endsWith('ch-1.md'))!;
    expect(chapterFile.content).toContain('# درسنامه');
    expect(chapterFile.content).toContain('حقوق export: denied');
    expect(chapterFile.content).not.toContain('متن خصوصی');
  });

  it('M-04: ZIP ساخته می‌شود و فقط فایل .md دارد + امضای PK', () => {
    const bundle = renderBookBundle({ book, editions, nodes, materials, exportedAt: '2026-11-05T12:00:00Z' });
    const zip = buildZip([...bundle.files, { path: 'MANIFEST.md', content: '---\nformat: x\n---\n' }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(bundle.files.every(file => file.path.endsWith('.md'))).toBe(true);
  });
});

describe('Phase 6 — Import Dry-run (M-08/M-09) + Round-trip', () => {
  const book = { id: 'book-9', slug: 'bk9', title: 'کتاب RT', language: 'fa-IR' };
  const editions = [{ id: 'ed-9', book_id: 'book-9', edition_number: 1, publication_year: '1404', rights_status: 'authorized' }];
  const nodes = [{ id: 'ch-9', edition_id: 'ed-9', node_kind: 'chapter', title: 'فصل RT', position: 1, structure_status: 'verified' }];
  const materials: Array<Record<string, unknown>> = [];

  it('Round-trip: Export → Parse → Dry-run همان Snapshot = صفر Duplicate', () => {
    const bundle = renderBookBundle({ book, editions, nodes, materials, exportedAt: '2026-11-05T12:00:00Z' });
    // همهٔ فایل‌ها Front Matter معتبر دارند
    const parsed = bundle.files.map(file => parseMarkdownFile(file.path, file.content));
    expect(parsed.every(row => row.ok)).toBe(true);
    // Dry-run با DB خالی: همه create، بدون duplicate
    const report = previewImport(bundle.files, new Set());
    expect(report.committed).toBe(false);
    expect(report.duplicates).toHaveLength(0);
    expect(report.invalid).toBe(0);
    expect(report.create).toBe(bundle.files.length);
    // Dry-run دوم روی همان بسته (همه در DB): همه update، باز هم بدون duplicate
    const existingIds = new Set(bundle.files.map(file =>
      String((parseMarkdownFile(file.path, file.content) as { ok: true; file: { frontMatter: Record<string, unknown> } }).file.frontMatter.entity_id)));
    const report2 = previewImport(bundle.files, existingIds);
    expect(report2.update).toBe(bundle.files.length);
    expect(report2.duplicates).toHaveLength(0);
  });

  it('M-09: فایل دستکاری‌شده — Validation Error', () => {
    const bad = previewImport([
      { path: 'x.md', content: 'بدون front matter' },
      { path: 'y.md', content: '---\nformat: other-v1\nentity_id: e1\n---\nبدنه' },
      { path: 'z.md', content: '---\nformat: ael-markdown-export-v2\n---\nبدنه' }, // entity_id ندارد
    ], new Set());
    expect(bad.invalid).toBe(3);
    expect(bad.errors.length).toBe(3);
    expect(bad.committed).toBe(false);
  });

  it('M-06: Internal Note/PII در بستهٔ Export محتوایی نیست', () => {
    const bundle = renderBookBundle({ book, editions, nodes, materials, exportedAt: '2026-11-05T12:00:00Z' });
    const all = bundle.files.map(file => file.content).join('\n');
    expect(all).not.toContain('internal_note');
    expect(all).not.toContain('session');
  });
});

describe('Phase 6 — API واقعی Export/Import', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store: {} as never, adminStore });
    await app.request('/api/admin/bootstrap', {
      method: 'POST', headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    });
    ownerToken = ((await (await app.request('/api/admin/session', {
      method: 'POST', body: JSON.stringify({ initData: await buildInitData(111) }),
    })).json()) as { token: string }).token;
    await app.request('/api/admin/domain/books', {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'bk-api', title: 'کتاب API', language: 'fa-IR' }),
    });
  });

  it('M-01/M-04: Export از مسیر API — JSON و ZIP', async () => {
    const bookId = (await (await app.request('/api/admin/domain/books', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { rows: Array<{ id: string }> }).rows[0]!.id;

    const jsonRes = await app.request(`/api/admin/panel/export/book/${bookId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(jsonRes.status).toBe(200);
    const data = await jsonRes.json() as { files: Array<{ path: string }>; manifest: string };
    expect(data.files.length).toBeGreaterThan(0);
    expect(data.manifest).toContain('MANIFEST');

    const zipRes = await app.request(`/api/admin/panel/export/book/${bookId}?bundle=zip`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(zipRes.headers.get('Content-Type')).toBe('application/zip');
    const bytes = new Uint8Array(await zipRes.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
  });

  it('M-08: Import preview از مسیر API — Dry-run بدون نوشتن', async () => {
    const res = await app.request('/api/admin/panel/import/preview', {
      method: 'POST', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ path: 'a.md', content: '---\nformat: ael-markdown-export-v2\nentity_id: new-entity\nentity_type: book\ntitle: تست\n---\n' }] }),
    });
    const report = await res.json() as { create: number; committed: boolean };
    expect(report.create).toBe(1);
    expect(report.committed).toBe(false);
    // واقعاً چیزی نوشته نشده باشد
    const books = await (await app.request('/api/admin/domain/books', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { rows: unknown[] };
    expect(books.rows).toHaveLength(1); // فقط کتاب seed اولیه
  });
});
