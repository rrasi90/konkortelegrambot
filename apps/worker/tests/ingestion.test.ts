import { beforeEach, describe, expect, it } from 'vitest';
import { adaptCsv, adaptJson, adaptMarkdown, pickAdapter } from '../src/ingestion/adapters';
import { rightsAllows, rightsSummary, validateIngestionInput, type IngestionInputFile, type SourceRightsDecision } from '@ael/contracts';
import { createApp, type CreateAppOptions, type Env } from '../src/index';
import { MemoryAdminStore } from '../src/admin/store';

const BOT_TOKEN = '123456:ael-ingestion-test-token';
const BOOTSTRAP_TOKEN = 'ael-bootstrap-token-0123456789abcdef0123';

async function hmacHex(key: string | ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildInitData(userId: number): Promise<string> {
  const params = new URLSearchParams();
  params.set('query_id', 'AAH-ingestion');
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('user', JSON.stringify({ id: userId, first_name: 'Admin' }));
  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  params.set('hash', await hmacHex(await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(BOT_TOKEN)), dataCheckString));
  return params.toString();
}

function buildEnv(): Env {
  return {
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_API_TOKEN: BOOTSTRAP_TOKEN,
  };
}

function textFile(fileName: string, content: string): IngestionInputFile {
  return { declaredMimeType: 'text/plain', fileName, content, encoding: 'text', byteSize: new TextEncoder().encode(content).length };
}

describe('AEL-305/308 — Adapterهای متنی', () => {
  it('Markdown: سرفصل/پاراگراف/فرمول/جدول با Locator تفکیک می‌شود', () => {
    const doc = adaptMarkdown(textFile('book.md', [
      '# فصل یک',
      '',
      'متن اول دربارهٔ ارزش پول.',
      '',
      '$$PV = FV / (1+r)^n$$',
      '',
      '| سال | جریان |',
      '| ۱ | ۱۰۰ |',
      '## فصل دو',
      '',
      'متن دوم.',
    ].join('\n')), 'sv-1');
    expect(doc.contractVersion).toBe(1);
    const kinds = doc.pages.flatMap(page => page.segments.map(seg => seg.kind));
    expect(kinds).toContain('heading');
    expect(kinds).toContain('paragraph');
    expect(kinds).toContain('formula');
    expect(kinds).toContain('table');
    const heading = doc.pages.flatMap(page => page.segments).find(seg => seg.kind === 'heading')!;
    expect(heading.locator.sourceVersionId).toBe('sv-1');
    expect(heading.locator.pageNumber).toBe(1);
    expect(heading.locator.line).toBe(1);
    expect(doc.pages.every(page => !page.quarantined)).toBe(true);
  });

  it('JSON نامعتبر فقط همان سند قرنطینه می‌شود (AT-AEL-07 روحیه)', () => {
    const doc = adaptJson(textFile('x.json', '{not-json'), 'sv-2');
    expect(doc.pages[0]!.quarantined).toBe(true);
    expect(doc.pages[0]!.quarantineReason).toContain('JSON نامعتبر');
  });

  it('JSON سادهٔ صفحات: عناوین و متن نرمال می‌شود', () => {
    const doc = adaptJson(textFile('doc.json', JSON.stringify({
      language: 'fa',
      pages: [
        { title: 'فصل ۱', text: 'متن صفحهٔ یک' },
        { title: 'فصل ۲', text: 'متن صفحهٔ دو' },
      ],
    })), 'sv-3');
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[1]!.segments.some(seg => seg.kind === 'heading' && seg.text === 'فصل ۲')).toBe(true);
  });

  it('CSV ناهم‌خوان: سطر معیوب قرنطینه و بقیه سالم می‌ماند (AT-AEL-07)', () => {
    const doc = adaptCsv(textFile('data.csv', 'a,b\n1,2\nbroken-row\n3,4'), 'sv-4');
    expect(doc.warnings.some(warning => warning.includes('سطر 3'))).toBe(true);
    const items = doc.pages[0]!.segments.filter(seg => seg.kind === 'list_item');
    expect(items).toHaveLength(2);
    expect(items[0]!.locator.line).toBe(2);
  });

  it('انتخاب Adapter بر اساس پسوند', () => {
    expect(pickAdapter(textFile('a.md', ''))).toBe('markdown');
    expect(pickAdapter(textFile('a.json', ''))).toBe('json');
    expect(pickAdapter(textFile('a.csv', ''))).toBe('csv');
    expect(pickAdapter({ ...textFile('a.pdf', ''), encoding: 'base64' })).toBe('pdf_text');
    expect(pickAdapter(textFile('a.xyz', ''))).toBe('plaintext');
  });
});

describe('AEL-310 — Rights Gate (Fail-closed)', () => {
  const decision = (useType: string, status: string): SourceRightsDecision => ({
    id: 'd1', sourceVersionId: 'sv', useType: useType as never, status: status as never,
    license: null, territory: null, decidedBy: null, decidedAt: null, note: null,
  });

  it('حقوق نامعلوم هر اقدامی را می‌بندد (AT-AEL-09)', () => {
    expect(rightsAllows([], 'internal_extraction')).toBe(false);
    expect(rightsAllows([decision('internal_extraction', 'unknown')], 'internal_extraction')).toBe(false);
    expect(rightsAllows([decision('internal_extraction', 'pending_review')], 'internal_extraction')).toBe(false);
    expect(rightsAllows([decision('internal_extraction', 'denied')], 'internal_extraction')).toBe(false);
  });

  it('مجوز هر نوع استفاده جداست', () => {
    const rights = [decision('internal_extraction', 'authorized')];
    expect(rightsAllows(rights, 'internal_extraction')).toBe(true);
    expect(rightsAllows(rights, 'full_text_display')).toBe(false);
    expect(rightsAllows(rights, 'external_ai_processing')).toBe(false);
  });

  it('rightsSummary پیش‌فرض unknown است', () => {
    const summary = rightsSummary([]);
    expect(summary.metadata).toBe('unknown');
    expect(summary.public_republishing).toBe('unknown');
  });
});

describe('AEL-302 — محدودیت فایل', () => {
  it('فایل بیش از سقف رد می‌شود', () => {
    const result = validateIngestionInput({ ...textFile('big.txt', 'x'), byteSize: 9 * 1024 * 1024 });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('سقف');
  });

  it('نام فایل با NUL رد می‌شود', () => {
    expect(validateIngestionInput({ ...textFile('bad\0.txt', 'x') }).ok).toBe(false);
  });
});

describe('AEL-302..311 — جریان کامل Upload → Rights → Job → Process', () => {
  let adminStore: MemoryAdminStore;
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;
  let rightsReviewerToken: string;
  let rightsReviewerId: string;

  async function sessionFor(userId: number): Promise<string> {
    return ((await (await app.request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ initData: await buildInitData(userId) }),
    })).json()) as { token: string }).token;
  }

  beforeEach(async () => {
    adminStore = new MemoryAdminStore();
    app = createApp(buildEnv(), { store: {} as never, adminStore });
    await app.request('/api/admin/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOOTSTRAP_TOKEN}` },
      body: JSON.stringify({ initData: await buildInitData(111) }),
    });
    ownerToken = await sessionFor(111);
    const reviewer = await adminStore.upsertAdminUser({ telegramUserId: 555, username: null, displayName: 'Rights' });
    await adminStore.grantRole(reviewer.id, 'RIGHTS_REVIEWER', null, 'owner');
    rightsReviewerId = reviewer.id;
    rightsReviewerToken = await sessionFor(555);
  });

  async function uploadSampleSource(): Promise<string> {
    const res = await app.request('/api/admin/sources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        slug: 'finmgmt-notes-1404', title: 'جزوهٔ مدیریت مالی', kind: 'lecture_note',
        file: textFile('notes.md', '# ارزش زمانی پول\n\nمتن نمونهٔ مجاز.\n\n$$PV=FV/(1+r)$$\n'),
      }),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { sourceVersionId: string }).sourceVersionId;
  }

  it('شروع پردازش بدون تصمیم حقوق رد می‌شود (AT-AEL-09)', async () => {
    const versionId = await uploadSampleSource();
    const res = await app.request('/api/admin/ingestion/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ sourceVersionId: versionId }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('internal_extraction');
  });

  it('جریان کامل: مجوز → Job → پردازش → صفحات + Idempotency', async () => {
    const versionId = await uploadSampleSource();
    const rightsRes = await app.request(`/api/admin/sources/${versionId}/rights`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rightsReviewerToken}` },
      body: JSON.stringify({ useType: 'internal_extraction', status: 'authorized', note: 'مجوز آزمایشی تألیفی' }),
    });
    expect(rightsRes.status).toBe(200);

    const jobRes = await app.request('/api/admin/ingestion/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ sourceVersionId: versionId }),
    });
    expect(jobRes.status).toBe(200);
    expect(((await jobRes.json()) as { created: boolean }).created).toBe(true);

    // Idempotency — همان کلید، Job دوم نمی‌سازد (AT-AEL-04)
    const repeat = await app.request('/api/admin/ingestion/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ sourceVersionId: versionId }),
    });
    expect(((await repeat.json()) as { created: boolean }).created).toBe(false);

    const processRes = await app.request('/api/admin/ingestion/process', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const processData = await processRes.json() as { status: string; pages: number; jobId: string };
    expect(processData.status).toBe('succeeded');
    expect(processData.pages).toBeGreaterThanOrEqual(1);

    const detail = await (await app.request(`/api/admin/ingestion/jobs/${processData.jobId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { pages: Array<{ quarantined: boolean }> };
    expect(detail.pages.every(page => !page.quarantined)).toBe(true);
  });

  it('retry فقط برای Job شکست‌خورده مجاز است', async () => {
    const versionId = await uploadSampleSource();
    await app.request(`/api/admin/sources/${versionId}/rights`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rightsReviewerToken}` },
      body: JSON.stringify({ useType: 'internal_extraction', status: 'authorized' }),
    });
    const jobId = ((await (await app.request('/api/admin/ingestion/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ sourceVersionId: versionId }),
    })).json()) as { jobId: string }).jobId;
    const retry = await app.request(`/api/admin/ingestion/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(retry.status).toBe(400); // Job در صف است، retry معنا ندارد
  });

  it('PDF بدون Runner خارجی به awaiting_external می‌رود و درخواست خارجی Rights می‌خواهد', async () => {
    const res = await app.request('/api/admin/sources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        slug: 'booklet-pdf', title: 'دفترچهٔ آزمون', kind: 'booklet',
        file: { declaredMimeType: 'application/pdf', fileName: 'booklet.pdf', content: 'JVBERi0xLjQK', encoding: 'base64', byteSize: 11 },
      }),
    });
    expect(res.status).toBe(200);
    const versionId = ((await res.json()) as { sourceVersionId: string }).sourceVersionId;
    await app.request(`/api/admin/sources/${versionId}/rights`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rightsReviewerToken}` },
      body: JSON.stringify({ useType: 'internal_extraction', status: 'authorized' }),
    });
    await app.request('/api/admin/ingestion/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ sourceVersionId: versionId }),
    });
    const processData = await (await app.request('/api/admin/ingestion/process', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    })).json() as { status?: string };
    expect(processData.status).toBe('awaiting_external');
  });
});
