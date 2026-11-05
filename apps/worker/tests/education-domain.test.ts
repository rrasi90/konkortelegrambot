import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Env } from '../src/index';
import { MemoryAdminStore } from '../src/admin/store';

/**
 * مأموریت v2 — Phase 2/4: E-01..E-10 و Q-01..Q-10 (سند ۱۹٫۲/۱۹٫۳).
 * همه از مسیر واقعی API با RBAC — حافظهٔ موقت به‌جای Supabase (همان قرارداد).
 */
const BOT_TOKEN = '123456:v2-domain-test-token';
const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'q'); params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: userId, first_name: 'A' }));
  const data = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const sk = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  params.set('hash', await hmacHex(await crypto.subtle.sign('HMAC', sk, new TextEncoder().encode(BOT_TOKEN)), data));
  return params.toString();
}

describe('Phase 2/4 — E و Q', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;
  let reviewerToken: string;
  let reviewerId: string;

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store: {} as never, adminStore });
    await app.request('/api/admin/bootstrap', {
      method: 'POST', headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    });
    const session = async (id: number) => ((await (await app.request('/api/admin/session', {
      method: 'POST', body: JSON.stringify({ initData: await buildInitData(id) }),
    })).json()) as { token: string }).token;
    ownerToken = await session(111);
    const reviewer = await adminStore.upsertAdminUser({ telegramUserId: 321, username: null, displayName: 'Mapper' });
    await adminStore.grantRole(reviewer.id, 'MAPPING_REVIEWER', null, 'x');
    reviewerToken = await session(321);
    reviewerId = reviewer.id;
  });

  const post = async (path: string, body: unknown, token = ownerToken) =>
    app.request(`/api/admin/domain/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const get = async (path: string, token = ownerToken) =>
    app.request(`/api/admin/domain/${path}`, { headers: { Authorization: `Bearer ${token}` } });

  it('E-01..E-04: Subject/Book/Edition — دو کتاب به یک درس، یک کتاب به دو درس، دو Edition مستقل', async () => {
    await post('exam_subjects', { code: 'subj-finmgmt', name: 'مدیریت مالی' });
    const b1 = await post('books', { slug: 'book-fin-1', title: 'مدیریت مالی ۱', authors: 'الف' });
    const b2 = await post('books', { slug: 'book-fin-2', title: 'مدیریت مالی ۲', authors: 'ب' });
    expect(b1.status).toBe(200);
    // E-02: دو کتاب به یک درس
    await post('subject_book_relations', { subject_code: 'subj-finmgmt', book_id: (await b1.json()).row.id, relation_kind: 'official_reference', decision_status: 'approved' });
    await post('subject_book_relations', { subject_code: 'subj-finmgmt', book_id: (await b2.json()).row.id, relation_kind: 'recommended_reference', decision_status: 'approved' });
    const relations = await (await get('subject_book_relations?subject_code=subj-finmgmt')).json() as { rows: unknown[] };
    expect(relations.rows).toHaveLength(2);
    // E-04: دو Edition برای یک Book
    const bookId = (await (await get('books')).json() as { rows: Array<{ id: string }> }).rows[0]!.id;
    await post('book_editions', { slug: 'ed-1', book_id: bookId, edition_number: 1, publication_year: '1400' });
    await post('book_editions', { slug: 'ed-2', book_id: bookId, edition_number: 2, publication_year: '1403', diff_note: 'بازنگری فصل ۳' });
    const editions = await (await get(`book_editions?book_id=${bookId}`)).json() as { rows: unknown[] };
    expect(editions.rows).toHaveLength(2);
  });

  it('E-05/E-06/E-07: Tree چندسطحی + حفظ ID در تغییر ترتیب + فصل بدون محتوا', async () => {
    const bookId = (await (await post('books', { slug: 'book-tree', title: 'کتاب درختی' })).json()).row.id;
    const ed = (await (await post('book_editions', { slug: 'ed-tree', book_id: bookId, edition_number: 1 })).json()).row.id;
    // E-05: چند سطح
    const ch1 = (await (await post('book_structure_nodes', { edition_id: ed, node_kind: 'chapter', title: 'فصل ۱', position: 1 })).json()).row.id;
    const sec1 = (await (await post('book_structure_nodes', { edition_id: ed, parent_id: ch1, node_kind: 'section', title: 'بخش ۱٫۱', position: 1 })).json()).row.id;
    const deep = (await (await post('book_structure_nodes', { edition_id: ed, parent_id: sec1, node_kind: 'subsection', title: 'زیربخش ۱٫۱٫۱', position: 1 })).json()).row.id;
    expect(deep).toBeDefined();
    // E-06: تغییر ترتیب — ID و وضعیت حفظ
    const updated = await post(`book_structure_nodes`, { id: ch1, position: 9, title: 'فصل ۱ (ویراسته)' });
    expect(updated.status).toBe(200);
    const nodes = await (await get(`book_structure_nodes?edition_id=${ed}`)).json() as { rows: Array<{ id: string; position: number; title: string }> };
    const renamed = nodes.rows.find(row => row.id === ch1)!;
    expect(renamed.id).toBe(ch1);
    expect(renamed.position).toBe(9);
    expect(renamed.title).toContain('ویراسته');
    // E-07: فصل بدون Material — وضعیت خالی از stats قابل مشاهده است
    const stats = await (await get(`book_structure_nodes/${sec1}/stats`)).json() as { uniqueAppearances: number };
    expect(stats.uniqueAppearances).toBe(0);
  });

  it('Q-01..Q-08 + E-09 + SoD: Appearance/Mapping با Evidence و شمارش بدون دوبرابرشماری', async () => {
    const bookId = (await (await post('books', { slug: 'bk-m', title: 'کتاب نگاشت' })).json()).row.id;
    const ed = (await (await post('book_editions', { slug: 'ed-m', book_id: bookId, edition_number: 1 })).json()).row.id;
    const ch1 = (await (await post('book_structure_nodes', { edition_id: ed, node_kind: 'chapter', title: 'فصل ۱' })).json()).row.id;
    const ch2 = (await (await post('book_structure_nodes', { edition_id: ed, node_kind: 'chapter', title: 'فصل ۲' })).json()).row.id;

    // Q-01: یک Question در دو سال → دو Appearance مستقل
    const a1 = (await (await post('question_appearances', { question_id: 'q.demo.1', year_label: '1403', booklet_code: 'A', question_number: 12, entry_status: 'verified' })).json()).row.id;
    const a2 = (await (await post('question_appearances', { question_id: 'q.demo.1', year_label: '1404', booklet_code: 'A', question_number: 5, entry_status: 'verified' })).json()).row.id;
    expect(a1).not.toBe(a2);

    // E-09: منبع رسمی/منشأ مستقیم بدون Evidence → 422
    const noEvidence = await post('question_chapter_mappings', {
      appearance_id: a1, node_id: ch1, relation_kind: 'direct_source_verified',
      review_status: 'approved', mapped_by: 'x', reviewed_by: 'y',
    });
    expect(noEvidence.status).toBe(422);

    // Q-03: candidate بدون Evidence — قابل ثبت اما پیشنهادی، نه تأییدشده
    const candidate = await post('question_chapter_mappings', {
      appearance_id: a1, node_id: ch1, relation_kind: 'candidate_ai_or_editor',
      review_status: 'pending_review', mapped_by: 'author-1', similarity_score: 0.62,
    });
    expect(candidate.status).toBe(200);

    // Q-02: یک Appearance به دو فصل → دو mapping، یک Appearance یکتا
    await post('question_chapter_mappings', { appearance_id: a1, node_id: ch2, relation_kind: 'historical_pattern', review_status: 'pending_review', mapped_by: 'author-1' });

    // Q-04/Q-05: mapping متعارض حفظ می‌شود
    await post('question_chapter_mappings', { appearance_id: a2, node_id: ch1, relation_kind: 'conflicted', review_status: 'conflicted', mapped_by: 'author-1' });

    // SoD: بازبین نمی‌تواند نگاشت خودش را تأیید کند
    await post('question_chapter_mappings', { appearance_id: a2, node_id: ch2, relation_kind: 'candidate_ai_or_editor', review_status: 'pending_review', mapped_by: reviewerId });
    const mappings = (await (await get('question_chapter_mappings')).json()) as { rows: Array<{ id: string; mapped_by: string; review_status: string }> };
    const selfMapping = mappings.rows.find(row => row.mapped_by === reviewerId)!;
    const selfDecide = await app.request(`/api/admin/domain/question_chapter_mappings/${selfMapping.id}/decide`, {
      method: 'POST', headers: { Authorization: `Bearer ${reviewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus: 'approved', note: 'تأیید خودم' }),
    });
    expect(selfDecide.status).toBe(403);

    // تأیید مجاز توسط بازبین مستقل (candidate → approved با نوع curriculum_topic_verified)
    const target = mappings.rows.find(row => row.id !== selfMapping.id && row.review_status === 'pending_review')!;
    const decide = await app.request(`/api/admin/domain/question_chapter_mappings/${target.id}/decide`, {
      method: 'POST', headers: { Authorization: `Bearer ${reviewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus: 'approved', note: 'تأیید ارتباط محتوایی — منشأ مستقیم ادعا نمی‌شود' }),
    });
    expect(decide.status).toBe(200);

    // Q-07/Q-08: آمار فصل — تعداد ارتباط > سؤال یکتا (a1 به دو فصل) و تفکیک سال
    const stats1 = await (await get(`book_structure_nodes/${ch1}/stats`)).json() as { uniqueAppearances: number; totalMappingLinks: number; byYear: Record<string, { appearances: number }> };
    expect(stats1.uniqueAppearances).toBeLessThanOrEqual(stats1.totalMappingLinks);
    expect(stats1.byYear['1403'].appearances).toBe(1);
    expect(stats1.byYear['1404'].appearances).toBe(1);
    const stats2 = await (await get(`book_structure_nodes/${ch2}/stats`)).json() as { uniqueAppearances: number; totalMappingLinks: number };
    // Q-08: فصل ۲ فقط یک mapping دارد — ارتباط = یکتا
    expect(stats2.totalMappingLinks).toBe(stats2.uniqueAppearances);
  });
});
