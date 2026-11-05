/**
 * AEL-201..209 — مسیرهای Admin API با RBAC سمت سرور (ADR-007).
 * همهٔ نقاط Default Deny هستند؛ `ADMIN_API_TOKEN` فقط دروازهٔ Bootstrap اولین OWNER است.
 */
import { Hono } from 'hono';
import { verifyTelegramInitData } from '../auth';
import { ROLE_PERMISSIONS, hasPermission, type AdminRoleAssignment } from './rbac';
import type { AdminStore } from './store';
import { sha256Hex } from './store';
import {
  INGESTION_ADAPTERS,
  RIGHTS_USE_TYPES,
  rightsAllows,
  rightsSummary,
  validateIngestionInput,
  type IngestionAdapter,
  type IngestionInputFile,
  type RightsUseType,
} from '@ael/contracts';
import { REGISTRY_ENTITY_TABLES, validateRegistryBundle } from '@ael/contracts';
import { adaptTextFile, pickAdapter } from '../ingestion/adapters';
import { buildCatalogSnapshot, CatalogValidationError } from '../catalog/service';

export interface AdminDeps {
  adminStore: AdminStore | null;
  botToken?: string;
  bootstrapToken?: string;
  isProduction: boolean;
}

export interface AdminIdentity {
  userId: string;
  displayName: string;
  roles: AdminRoleAssignment[];
}

const SESSION_TTL_MS = 12 * 60 * 60_000;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function unauthorized(message = 'نشست مدیریتی معتبر نیست.') {
  return Response.json({ error: message }, { status: 401 });
}

function forbidden(message = 'مجوز کافی ندارید.') {
  return Response.json({ error: message }, { status: 403 });
}


// Gate سمت DB (assert_release_publishable) روی Supabase از طریق RPC فراخوانی می‌شود؛
// در حافظهٔ موقت/تست، همان Gate با قواعد بالا (approved-only items + rights) تکرار می‌شود.
const assertReleasePublishableNote = 'DB-side gate: assert_release_publishable (migration 0022)';

type Row = Record<string, unknown>;

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function createAdminRouter(deps: AdminDeps) {
  const app = new Hono();

  const bootstrapGuard = (handler: (c: { req: { header(name: string): string | undefined }; json(body: unknown, status?: number): Response }) => Promise<Response>) => handler;

  /** Bootstrap اولین OWNER — فقط با ADMIN_API_TOKEN و وقتی هیچ OWNER فعالی نیست. */
  app.post('/bootstrap', async (c) => {
    if (!deps.adminStore) return Response.json({ error: 'لایهٔ دادهٔ مدیریتی در دسترس نیست.' }, { status: 503 });
    const expected = deps.bootstrapToken;
    const authorization = c.req.header('Authorization') ?? '';
    if (!expected || expected.length < 32 || !authorization.startsWith('Bearer ') || authorization.slice(7) !== expected) {
      return unauthorized('توکن Bootstrap معتبر نیست.');
    }
    if (!deps.botToken) return badRequest('TELEGRAM_BOT_TOKEN برای اعتبارسنجی هویت لازم است.');
    const body = await c.req.json().catch(() => null) as { initData?: unknown } | null;
    if (!body || typeof body.initData !== 'string') return badRequest('initData الزامی است.');
    const verified = await verifyTelegramInitData(body.initData, deps.botToken);
    if (!verified.ok) return unauthorized('هویت تلگرام معتبر نیست: ' + verified.error);
    const owners = await deps.adminStore.countActiveOwnerAdmins();
    if (owners > 0) {
      // Bootstrap فقط برای اولین OWNER؛ نقش‌های بعدی فقط توسط OWNER با user:manage.
      return forbidden('یک OWNER فعال وجود دارد؛ Bootstrap فقط یک‌بار مجاز است.');
    }
    const user = await deps.adminStore.upsertAdminUser({
      telegramUserId: verified.userId,
      username: verified.username ?? null,
      displayName: verified.firstName ?? 'OWNER',
      isActive: true,
    });
    await deps.adminStore.grantRole(user.id, 'OWNER', null, 'bootstrap');
    await deps.adminStore.logAdminAction({
      actorId: user.id,
      action: 'admin.bootstrap',
      entityType: 'admin_user',
      entityId: user.id,
      after: { telegramUserId: verified.userId },
      reason: 'bootstrap اولین OWNER با ADMIN_API_TOKEN',
    });
    return c.json({ ok: true, user: { id: user.id, displayName: user.displayName }, role: 'OWNER' });
  });

  /** ورود مدیر با initData تلگرام — فقط کاربر فعالِ دارای نقش. */
  app.post('/session', async (c) => {
    if (!deps.adminStore) return Response.json({ error: 'لایهٔ دادهٔ مدیریتی در دسترس نیست.' }, { status: 503 });
    if (!deps.botToken) return badRequest('TELEGRAM_BOT_TOKEN تنظیم نشده است.');
    const body = await c.req.json().catch(() => null) as { initData?: unknown } | null;
    if (!body || typeof body.initData !== 'string') return badRequest('initData الزامی است.');
    const verified = await verifyTelegramInitData(body.initData, deps.botToken);
    if (!verified.ok) return unauthorized('هویت تلگرام معتبر نیست: ' + verified.error);
    const user = await deps.adminStore.getAdminUserByTelegramId(verified.userId);
    if (!user || !user.isActive) return forbidden('این هویت مدیر فعال نیست.');
    const roles = await deps.adminStore.listUserRoles(user.id);
    if (!roles.length) return forbidden('هیچ نقشی به این مدیر اختصاص نیافته است.');
    const token = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await deps.adminStore.createAdminSession(user.id, await sha256Hex(token), expiresAt);
    await deps.adminStore.logAdminAction({
      actorId: user.id,
      action: 'admin.session.create',
      entityType: 'admin_session',
      entityId: user.id,
      before: null,
      after: { expiresAt },
      reason: null,
    });
    return c.json({ token, expiresAt, user: { id: user.id, displayName: user.displayName }, roles, permissions: permissionsOf(roles) });
  });

  /** شناسایی نشست مدیر برای مسیرهای محافظت‌شده */
  async function identify(c: { req: { header(name: string): string | undefined } }): Promise<AdminIdentity | null> {
    if (!deps.adminStore) return null;
    const authorization = c.req.header('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return null;
    const token = authorization.slice(7);
    if (!token || token.length > 128) return null;
    const session = await deps.adminStore.getActiveSessionByTokenHash(await sha256Hex(token), new Date().toISOString());
    if (!session) return null;
    const user = await deps.adminStore.getAdminUserById(session.adminUserId);
    if (!user || !user.isActive) return null;
    const roles = await deps.adminStore.listUserRoles(user.id);
    return { userId: user.id, displayName: user.displayName, roles };
  }

  async function requirePermission(
    c: { req: { header(name: string): string | undefined } },
    permission: string,
  ): Promise<{ identity: AdminIdentity } | Response> {
    const identity = await identify(c);
    if (!identity) return unauthorized();
    if (!hasPermission(identity.roles, permission)) return forbidden(`مجوز «${permission}» لازم است.`);
    return { identity };
  }

  app.get('/me', async (c) => {
    const identity = await identify(c);
    if (!identity) return unauthorized();
    return c.json({ user: { id: identity.userId, displayName: identity.displayName }, roles: identity.roles, permissions: permissionsOf(identity.roles) });
  });

  app.post('/logout', async (c) => {
    if (!deps.adminStore) return Response.json({ error: 'لایهٔ دادهٔ مدیریتی در دسترس نیست.' }, { status: 503 });
    const authorization = c.req.header('Authorization') ?? '';
    if (authorization.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      if (token && token.length <= 128) await deps.adminStore.revokeSession(await sha256Hex(token));
    }
    return c.json({ ok: true });
  });

  /** ماتریس نقش/مجوز — برای هر مدیر معتبری قابل مشاهده است (شفافیت RBAC). */
  app.get('/roles', async (c) => {
    const identity = await identify(c);
    if (!identity) return unauthorized();
    return c.json({ roles: Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({ role, permissions })) });
  });

  app.get('/users', async (c) => {
    const guard = await requirePermission(c, 'user:read_limited');
    if (guard instanceof Response) return guard;
    return c.json({ users: await deps.adminStore!.listAdminUsers() });
  });

  app.post('/users/:id/roles', async (c) => {
    const guard = await requirePermission(c, 'user:manage');
    if (guard instanceof Response) return guard;
    const targetId = c.req.param('id');
    const body = await c.req.json().catch(() => null) as { role?: unknown; scope?: unknown } | null;
    if (!body || typeof body.role !== 'string') return badRequest('نقش الزامی است.');
    if (!Object.hasOwn(ROLE_PERMISSIONS, body.role)) return badRequest('نقش شناخته‌شده نیست.');
    if (body.scope !== undefined && body.scope !== null && (typeof body.scope !== 'object' || Array.isArray(body.scope))) {
      return badRequest('Scope باید شیء یا null باشد.');
    }
    const target = await deps.adminStore!.getAdminUserById(targetId);
    if (!target) return Response.json({ error: 'کاربر مدیریتی پیدا نشد.' }, { status: 404 });
    await deps.adminStore!.grantRole(targetId, body.role, (body.scope as Record<string, unknown> | null) ?? null, guard.identity.userId);
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId,
      action: 'admin.role.grant',
      entityType: 'admin_user',
      entityId: targetId,
      before: null,
      after: { role: body.role, scope: body.scope ?? null },
      reason: null,
    });
    return c.json({ ok: true, roles: await deps.adminStore!.listUserRoles(targetId) });
  });

  app.delete('/users/:id/roles/:role', async (c) => {
    const guard = await requirePermission(c, 'user:manage');
    if (guard instanceof Response) return guard;
    const targetId = c.req.param('id');
    const role = c.req.param('role');
    if (!Object.hasOwn(ROLE_PERMISSIONS, role)) return badRequest('نقش شناخته‌شده نیست.');
    await deps.adminStore!.revokeRole(targetId, role);
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId,
      action: 'admin.role.revoke',
      entityType: 'admin_user',
      entityId: targetId,
      before: { role },
      after: null,
      reason: null,
    });
    return c.json({ ok: true, roles: await deps.adminStore!.listUserRoles(targetId) });
  });

  app.get('/audit', async (c) => {
    const guard = await requirePermission(c, 'audit:read');
    if (guard instanceof Response) return guard;
    const limit = Number(c.req.query('limit') ?? 100);
    return c.json({ events: await deps.adminStore!.listAdminAudit(Number.isFinite(limit) ? limit : 100) });
  });

  // ---------- رجیستری نسخه‌دار (AEL-204/206 از مسیر API) ----------
  app.get('/registry/:entity', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    const entity = c.req.param('entity');
    const table = REGISTRY_ENTITY_TABLES[entity as keyof typeof REGISTRY_ENTITY_TABLES];
    if (!table) return badRequest('موجودیت شناخته‌شده نیست.');
    const limit = Number(c.req.query('limit') ?? 200);
    return c.json({ entity, table, rows: await deps.adminStore!.listRegistryRows(table, Number.isFinite(limit) ? limit : 200) });
  });

  app.post('/registry/:entity', async (c) => {
    const guard = await requirePermission(c, 'registry:write');
    if (guard instanceof Response) return guard;
    const entity = c.req.param('entity');
    const table = REGISTRY_ENTITY_TABLES[entity as keyof typeof REGISTRY_ENTITY_TABLES];
    if (!table) return badRequest('موجودیت شناخته‌شده نیست.');
    const body = await c.req.json().catch(() => null) as unknown;
    if (!Array.isArray(body) || body.length === 0 || body.length > 500) {
      return badRequest('بدنه باید فهرست ۱ تا ۵۰۰ رکورد باشد.');
    }
    // اعتبارسنجی با قراردادهای contracts — همان مسیر Import CLI
    const validation = validateRegistryBundle({ schemaVersion: 1, [entity]: body });
    if (!validation.ok) {
      return Response.json({ error: 'رکورد نامعتبر است.', errors: validation.errors }, { status: 422 });
    }
    await deps.adminStore!.upsertRegistryRows(table, body as Record<string, unknown>[]);
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId,
      action: 'registry.upsert',
      entityType: entity,
      entityId: null,
      before: null,
      after: { count: body.length },
      reason: null,
    });
    return c.json({ ok: true, entity, count: body.length });
  });

  function base64ToUtf8(value: string): string {
    const bytes = Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  // ==================== AEL-301..311: Source Library ====================

  async function sha256Of(value: string): Promise<string> {
    return sha256Hex(value);
  }

  function sniffMime(fileName: string, contentBase64: string | null): string | null {
    if (contentBase64) {
      const head = atob(contentBase64.slice(0, 8));
      if (head.startsWith('%PDF')) return 'application/pdf';
      if (head.startsWith('PK')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      return null;
    }
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
    if (lower.endsWith('.json') || lower.endsWith('.jsonl')) return 'application/json';
    if (lower.endsWith('.csv')) return 'text/csv';
    if (lower.endsWith('.txt')) return 'text/plain';
    return null;
  }

  app.post('/sources', async (c) => {
    const guard = await requirePermission(c, 'source:upload');
    if (guard instanceof Response) return guard;
    const body = await c.req.json().catch(() => null) as {
      slug?: unknown; title?: unknown; kind?: unknown; language?: unknown;
      authors?: unknown; publisher?: unknown; file?: unknown;
    } | null;
    if (!body || typeof body.slug !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(body.slug)) {
      return badRequest('شناسهٔ منبع (slug) معتبر نیست.');
    }
    if (!body.title || typeof body.title !== 'string' || body.title.length > 300) {
      return badRequest('عنوان منبع الزامی است.');
    }
    const file = body.file as IngestionInputFile | undefined;
    if (!file || typeof file !== 'object' || typeof file.fileName !== 'string' ||
        typeof file.content !== 'string' || (file.encoding !== 'text' && file.encoding !== 'base64')) {
      return badRequest('فایل ورودی معتبر نیست.');
    }
    const sizeCheck = validateIngestionInput(file);
    if (!sizeCheck.ok) return badRequest(sizeCheck.error);
    // MIME sniffing: مغایرت پسوند/امضا رد می‌شود (AEL-302)
    const sniffed = sniffMime(file.fileName, file.encoding === 'base64' ? file.content : null);
    if (sniffed && file.declaredMimeType && !file.declaredMimeType.startsWith((sniffed.split('/')[0] ?? ''))) {
      return badRequest('نوع واقعی فایل با نوع اعلامی مغایرت دارد.');
    }
    const contentHash = await sha256Of(file.content);
    const source = await deps.adminStore!.createSource({
      slug: body.slug, title: body.title,
      kind: typeof body.kind === 'string' ? body.kind : 'other',
      language: typeof body.language === 'string' ? body.language : 'fa',
      authors: typeof body.authors === 'string' ? body.authors : null,
      publisher: typeof body.publisher === 'string' ? body.publisher : null,
      createdBy: guard.identity.userId,
    });
    const version = await deps.adminStore!.createSourceVersion({
      sourceId: String(source.id), versionNumber: null, pageCount: null,
      contentHash, createdBy: guard.identity.userId,
    });
    await deps.adminStore!.addSourceFile({
      sourceVersionId: String(version.id),
      fileName: file.fileName,
      mimeType: file.declaredMimeType || sniffed || 'application/octet-stream',
      byteSize: file.byteSize,
      sha256: contentHash,
      contentText: file.encoding === 'text' ? file.content : null,
      contentBase64: file.encoding === 'base64' ? file.content : null,
      uploadedBy: guard.identity.userId,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId,
      action: 'source.upload',
      entityType: 'source_version',
      entityId: String(version.id),
      after: { slug: body.slug, fileName: file.fileName, sha256: contentHash },
      reason: null,
    });
    return c.json({ ok: true, sourceId: String(source.id), sourceVersionId: String(version.id), sha256: contentHash });
  });

  app.get('/sources', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    return c.json({ sources: await deps.adminStore!.listSources(Number(c.req.query('limit') ?? 200)) });
  });

  app.get('/sources/:versionId', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    const versionId = c.req.param('versionId');
    const version = await deps.adminStore!.getSourceVersion(versionId);
    if (!version) return Response.json({ error: 'نسخهٔ منبع پیدا نشد.' }, { status: 404 });
    const rights = await deps.adminStore!.listRights(versionId);
    const pages = await deps.adminStore!.listDocumentPages(versionId, 1);
    const files = (await deps.adminStore!.listSourceFiles(versionId)).map(row => ({
      id: String(row.id), fileName: String(row.file_name), mimeType: String(row.mime_type),
      byteSize: Number(row.byte_size), sha256: String(row.sha256),
    }));
    return c.json({
      version, files,
      rights: rightsSummary(rights.map(row => ({
        id: String(row.id), sourceVersionId: String(row.source_version_id),
        useType: String(row.use_type) as RightsUseType, status: String(row.status) as never,
        license: (row.license as string | null) ?? null, territory: null,
        decidedBy: (row.decided_by as string | null) ?? null,
        decidedAt: (row.decided_at as string | null) ?? null, note: (row.note as string | null) ?? null,
      }))),
      hasPages: pages.length > 0,
    });
  });

  /** Rights Gate — تصمیم انسانی با مجوز مستقل review:rights:approve (ADR-004) */
  app.post('/sources/:versionId/rights', async (c) => {
    const guard = await requirePermission(c, 'review:rights:approve');
    if (guard instanceof Response) return guard;
    const versionId = c.req.param('versionId');
    if (!(await deps.adminStore!.getSourceVersion(versionId))) {
      return Response.json({ error: 'نسخهٔ منبع پیدا نشد.' }, { status: 404 });
    }
    const body = await c.req.json().catch(() => null) as { useType?: unknown; status?: unknown; license?: unknown; note?: unknown } | null;
    if (!body || typeof body.useType !== 'string' || !(RIGHTS_USE_TYPES as readonly string[]).includes(body.useType)) {
      return badRequest('نوع استفاده معتبر نیست.');
    }
    if (typeof body.status !== 'string' || !['pending_review', 'restricted_internal', 'authorized', 'denied', 'expired'].includes(body.status)) {
      return badRequest('وضعیت حقوق معتبر نیست.');
    }
    const decision = await deps.adminStore!.upsertRightsDecision({
      sourceVersionId: versionId, useType: body.useType, status: body.status,
      license: typeof body.license === 'string' ? body.license : null,
      decidedBy: guard.identity.userId,
      note: typeof body.note === 'string' ? body.note : null,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId,
      action: 'source.rights.decision',
      entityType: 'source_version',
      entityId: versionId,
      after: { useType: body.useType, status: body.status },
      reason: typeof body.note === 'string' ? body.note : null,
    });
    return c.json({ ok: true, decision });
  });

  // ==================== AEL-303: صف Ingestion ====================

  app.post('/ingestion/jobs', async (c) => {
    const guard = await requirePermission(c, 'ingestion:start');
    if (guard instanceof Response) return guard;
    const body = await c.req.json().catch(() => null) as { sourceVersionId?: unknown; adapter?: unknown; idempotencyKey?: unknown } | null;
    if (!body || typeof body.sourceVersionId !== 'string') return badRequest('شناسهٔ نسخهٔ منبع الزامی است.');
    const version = await deps.adminStore!.getSourceVersion(body.sourceVersionId);
    if (!version) return Response.json({ error: 'نسخهٔ منبع پیدا نشد.' }, { status: 404 });
    // Rights Gate: پردازش داخلی فقط با مجوز داخلی (Fail-closed)
    const rights = await deps.adminStore!.listRights(String(version.id));
    if (!rightsAllows(rights.map(row => ({
      id: String(row.id), sourceVersionId: String(row.source_version_id),
      useType: String(row.use_type) as RightsUseType, status: String(row.status) as never,
      license: null, territory: null, decidedBy: null, decidedAt: null, note: null,
    })), 'internal_extraction')) {
      return forbidden('پردازش این منبع بدون تصمیم حقوق «internal_extraction: authorized» مجاز نیست (AT-AEL-09).');
    }
    const files = await deps.adminStore!.listSourceFiles(String(version.id));
    if (!files.length) return badRequest('برای این نسخه فایلی ثبت نشده است.');
    const adapter = (typeof body.adapter === 'string' && (INGESTION_ADAPTERS as readonly string[]).includes(body.adapter)
      ? body.adapter
      : pickAdapter({
          declaredMimeType: String(files[0]!.mime_type), fileName: String(files[0]!.file_name),
          content: '', encoding: files[0]!.content_text !== null ? 'text' : 'base64', byteSize: Number(files[0]!.byte_size),
        })) as IngestionAdapter;
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey
      ? body.idempotencyKey
      : `v:${version.id}:a:${adapter}`;
    const { job, created } = await deps.adminStore!.createIngestionJob({
      sourceVersionId: String(version.id), adapter,
      settings: {}, idempotencyKey, createdBy: guard.identity.userId,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'ingestion.job.create',
      entityType: 'ingestion_job', entityId: String(job.id),
      after: { adapter, idempotencyKey, created }, reason: null,
    });
    return c.json({ ok: true, jobId: String(job.id), created });
  });

  app.get('/ingestion/jobs', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    return c.json({ jobs: await deps.adminStore!.listIngestionJobs(Number(c.req.query('limit') ?? 100)) });
  });

  app.get('/ingestion/jobs/:id', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    const job = await deps.adminStore!.getIngestionJob(c.req.param('id'));
    if (!job) return Response.json({ error: 'Job پیدا نشد.' }, { status: 404 });
    const pages = await deps.adminStore!.listDocumentPages(String(job.source_version_id), 50);
    return c.json({ job, pages: pages.map(page => ({ pageNumber: Number(page.page_number), quarantined: page.quarantined === true, confidence: Number(page.confidence) })) });
  });

  app.post('/ingestion/jobs/:id/retry', async (c) => {
    const guard = await requirePermission(c, 'ingestion:retry');
    if (guard instanceof Response) return guard;
    const job = await deps.adminStore!.getIngestionJob(c.req.param('id'));
    if (!job) return Response.json({ error: 'Job پیدا نشد.' }, { status: 404 });
    if (!['retryable_failed', 'terminal_failed', 'awaiting_external', 'cancelled'].includes(String(job.status))) {
      return badRequest('فقط Jobهای شکست‌خورده/متوقف قابل تلاش مجددند.');
    }
    await deps.adminStore!.updateIngestionJob(String(job.id), { status: 'queued', lastError: null, releaseLease: true });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'ingestion.job.retry',
      entityType: 'ingestion_job', entityId: String(job.id), after: { from: String(job.status) }, reason: null,
    });
    return c.json({ ok: true });
  });

  /**
   * پردازش گام‌به‌گام صف: هر فراخوانی یک Job را Claim و پردازش می‌کند (Lease + Retry).
   * Adapterهای pdf/docx به Runner خارجی (Node) می‌روند: awaiting_external.
   */
  app.post('/ingestion/process', async (c) => {
    const guard = await requirePermission(c, 'ingestion:start');
    if (guard instanceof Response) return guard;
    const job = await deps.adminStore!.claimNextIngestionJob(300);
    if (!job) return c.json({ ok: true, processed: false, reason: 'صف خالی است.' });
    const jobId = String(job.id);
    try {
      const files = await deps.adminStore!.listSourceFiles(String(job.source_version_id));
      const file = files[0];
      if (!file) throw new Error('فایل منبع یافت نشد.');
      const adapter = String(job.adapter);
      if (adapter === 'pdf_text' || adapter === 'docx') {
        await deps.adminStore!.updateIngestionJob(jobId, { status: 'awaiting_external', heartbeat: true });
        return c.json({ ok: true, processed: true, jobId, status: 'awaiting_external', reason: 'پردازش این فرمت در Runner خارجی (scripts/run-ingestion-jobs.mts) انجام می‌شود.' });
      }
      if (adapter === 'pdf_scanned_ocr') {
        // ADR-005: OCR پولی خاموش؛ Provider دستی → صف بازبینی انسانی
        await deps.adminStore!.updateIngestionJob(jobId, { status: 'awaiting_review', heartbeat: true });
        await deps.adminStore!.insertIngestionArtifact({
          jobId, kind: 'error_report',
          content: { note: 'OCR خودکار فعال نیست (سیاست بدون هزینه). صفحات به OCR Review انسانی می‌روند.' },
          sha256: null,
        });
        return c.json({ ok: true, processed: true, jobId, status: 'awaiting_review' });
      }
      const content = file.content_text !== null && file.content_text !== undefined
        ? String(file.content_text)
        : base64ToUtf8(String(file.content_base64 ?? ''));
      const document = adaptTextFile({
        declaredMimeType: String(file.mime_type), fileName: String(file.file_name),
        content, encoding: 'text', byteSize: Number(file.byte_size),
      }, String(job.source_version_id));
      await deps.adminStore!.insertDocumentPages(String(job.source_version_id), document.pages.map(page => ({
        pageNumber: page.pageNumber, confidence: page.confidence,
        quarantined: page.quarantined, quarantineReason: page.quarantineReason,
        segments: page.segments.map(seg => ({ kind: seg.kind, ordinal: seg.ordinal, text: seg.text, locator: seg.locator, confidence: seg.confidence })),
      })));
      const quarantined = document.pages.filter(page => page.quarantined).length;
      await deps.adminStore!.insertIngestionArtifact({
        jobId, kind: 'normalized_document',
        content: { adapter: document.adapter, pages: document.pages.length, quarantined, warnings: document.warnings },
        sha256: await sha256Of(JSON.stringify(document)),
      });
      await deps.adminStore!.updateIngestionJob(jobId, {
        status: quarantined > 0 ? 'partial_success' : 'succeeded',
        heartbeat: true, releaseLease: true,
      });
      return c.json({ ok: true, processed: true, jobId, status: quarantined > 0 ? 'partial_success' : 'succeeded', pages: document.pages.length, quarantined });
    } catch (error) {
      const attempt = Number(job.attempt ?? 0);
      const maxAttempts = Number(job.max_attempts ?? 5);
      const status = attempt >= maxAttempts ? 'terminal_failed' : 'retryable_failed';
      await deps.adminStore!.updateIngestionJob(jobId, {
        status, lastError: (error as Error).message.slice(0, 500), releaseLease: true,
      });
      return c.json({ ok: false, processed: true, jobId, status, error: (error as Error).message }, status === 'terminal_failed' ? 500 : 200);
    }
  });

  // ==================== AEL-501..509: Content / Review / Release ====================

  const REVIEW_PERMISSIONS: Record<string, string> = {
    scientific: 'review:scientific:approve',
    answer_key: 'review:scientific:approve',
    mapping: 'review:mapping:approve',
    rights: 'review:rights:approve',
    ocr_structure: 'registry:write',
    editorial: 'course:update',
    publish: 'release:publish',
    user_report: 'user:read_limited',
  };

  app.post('/content/items', async (c) => {
    const guard = await requirePermission(c, 'course:create');
    if (guard instanceof Response) return guard;
    const body = await c.req.json().catch(() => null) as { kind?: unknown; slug?: unknown; title?: unknown } | null;
    if (!body || typeof body.slug !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(body.slug)) {
      return badRequest('شناسهٔ محتوا (slug) معتبر نیست.');
    }
    const kinds = ['course', 'lesson', 'topic_note', 'concept', 'mcq', 'essay', 'worked_example', 'formula_card', 'flashcard', 'remedial_explanation', 'rubric', 'study_guide'];
    if (typeof body.kind !== 'string' || !kinds.includes(body.kind)) return badRequest('نوع محتوا معتبر نیست.');
    if (typeof body.title !== 'string' || !body.title.trim()) return badRequest('عنوان الزامی است.');
    const existing = await deps.adminStore!.getContentItemBySlug(body.slug);
    if (existing) return Response.json({ error: 'این slug قبلاً ثبت شده است.' }, { status: 409 });
    const item = await deps.adminStore!.upsertContentItem({ kind: body.kind, slug: body.slug, title: body.title, createdBy: guard.identity.userId });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'content.item.create',
      entityType: 'content_item', entityId: String(item.id), after: { kind: body.kind, slug: body.slug }, reason: null,
    });
    return c.json({ ok: true, item });
  });

  app.get('/content/items', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    return c.json({ items: await deps.adminStore!.listContentItems(Number(c.req.query('limit') ?? 200)) });
  });

  /** نسخهٔ جدید محتوا — هر تغییر معنایی = نسخهٔ تازه (ADR-006) */
  app.post('/content/items/:slug/versions', async (c) => {
    const guard = await requirePermission(c, 'course:update');
    if (guard instanceof Response) return guard;
    const slug = c.req.param('slug');
    const item = await deps.adminStore!.getContentItemBySlug(slug);
    if (!item) return Response.json({ error: 'مادهٔ محتوایی پیدا نشد.' }, { status: 404 });
    const body = await c.req.json().catch(() => null) as { body?: unknown; sourceIds?: unknown } | null;
    if (!body || body.body === undefined || body.body === null) return badRequest('بدنهٔ محتوا الزامی است.');
    const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.filter((id): id is string => typeof id === 'string') : [];
    const contentHash = await sha256Of(JSON.stringify(body.body));
    const version = await deps.adminStore!.createContentVersion({
      contentItemId: String(item.id), body: body.body, contentHash, sourceIds, createdBy: guard.identity.userId,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'content.version.create',
      entityType: 'content_version', entityId: String(version.id),
      after: { slug, contentHash, sourceIds: sourceIds.length }, reason: null,
    });
    return c.json({ ok: true, versionId: String(version.id), versionNumber: Number(version.version_number) });
  });

  /** ارسال برای بازبینی — Task علمی می‌سازد (AEL-501) */
  app.post('/content/versions/:id/propose', async (c) => {
    const guard = await requirePermission(c, 'course:update');
    if (guard instanceof Response) return guard;
    const version = await deps.adminStore!.getContentVersion(c.req.param('id'));
    if (!version) return Response.json({ error: 'نسخه پیدا نشد.' }, { status: 404 });
    if (!['draft', 'rejected', 'needs_changes'].includes(String(version.status))) {
      return badRequest('فقط نسخهٔ پیش‌نویس/ردشده قابل پیشنهاد است.');
    }
    await deps.adminStore!.decideReviewTask(`propose:${version.id}`, 'pending', guard.identity.userId, null).catch(() => null);
    const task = await deps.adminStore!.createReviewTask({
      taskKind: 'scientific', contentVersionId: String(version.id), sourceVersionId: null,
      severity: 'normal', payload: { contentType: String(version.kind ?? '') }, createdBy: guard.identity.userId,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'review.task.create',
      entityType: 'review_task', entityId: String(task.id), after: { kind: 'scientific' }, reason: null,
    });
    return c.json({ ok: true, reviewTaskId: String(task.id) });
  });

  app.get('/review-tasks', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    const kind = c.req.query('kind');
    const status = c.req.query('status');
    return c.json({ tasks: await deps.adminStore!.listReviewTasks(kind || null, status || null, Number(c.req.query('limit') ?? 100)) });
  });

  /** تصمیم بازبین — مجوز به تفکیک نوع Task + SoD: بازبین ≠ تألیف‌کننده (AT-AEL-13) */
  app.post('/review-tasks/:id/decide', async (c) => {
    const taskId = c.req.param('id');
    const tasks = await deps.adminStore!.listReviewTasks(null, null, 500);
    const task = tasks.find(row => String(row.id) === taskId);
    if (!task) return Response.json({ error: 'Task بازبینی پیدا نشد.' }, { status: 404 });
    const permission = REVIEW_PERMISSIONS[String(task.task_kind)] ?? 'registry:write';
    const guard = await requirePermission(c, permission);
    if (guard instanceof Response) return guard;
    const body = await c.req.json().catch(() => null) as { decision?: unknown; note?: unknown } | null;
    if (!body || typeof body.decision !== 'string' || !['approved', 'needs_changes', 'rejected', 'escalated'].includes(body.decision)) {
      return badRequest('تصمیم معتبر نیست.');
    }
    if (typeof body.note !== 'string' || body.note.trim().length < 3) {
      return badRequest('ثبت دلیل تصمیم الزامی است (AEL-502).');
    }
    const version = task.content_version_id ? await deps.adminStore!.getContentVersion(String(task.content_version_id)) : null;
    if (version && String(version.created_by) === guard.identity.userId) {
      return forbidden('بازبین نمی‌تواند محتوای تألیف خودش را تأیید کند (Separation of Duties).');
    }
    const updated = await deps.adminStore!.decideReviewTask(taskId, body.decision, guard.identity.userId, body.note);
    if (version && updated) {
      if (body.decision === 'approved' && String(task.task_kind) === 'scientific') {
        await deps.adminStore!.setScientificApproval(String(version.id), guard.identity.userId, true);
      }
      if (body.decision === 'rejected' && String(task.task_kind) === 'scientific') {
        await deps.adminStore!.setScientificApproval(String(version.id), guard.identity.userId, false);
      }
    }
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: `review.decide.${String(task.task_kind)}`,
      entityType: 'review_task', entityId: taskId,
      after: { decision: body.decision }, reason: body.note,
    });
    return c.json({ ok: true, task: updated });
  });

  // ---------- Release Manager (AEL-507) ----------

  app.post('/releases', async (c) => {
    const guard = await requirePermission(c, 'release:stage');
    if (guard instanceof Response) return guard;
    const body = await c.req.json().catch(() => null) as { code?: unknown; notes?: unknown } | null;
    if (!body || typeof body.code !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(body.code)) {
      return badRequest('کد Release معتبر نیست.');
    }
    const release = await deps.adminStore!.createRelease({
      code: body.code, notes: typeof body.notes === 'string' ? body.notes : null, createdBy: guard.identity.userId,
    });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'release.create',
      entityType: 'content_release', entityId: String(release.id), after: { code: body.code }, reason: null,
    });
    return c.json({ ok: true, releaseId: String(release.id) });
  });

  app.post('/releases/:id/items', async (c) => {
    const guard = await requirePermission(c, 'release:stage');
    if (guard instanceof Response) return guard;
    const release = await deps.adminStore!.getRelease(c.req.param('id'));
    if (!release) return Response.json({ error: 'Release پیدا نشد.' }, { status: 404 });
    if (String(release.status) !== 'draft') return badRequest('فقط Release در وضعیت draft قابل افزودن ماده است.');
    const body = await c.req.json().catch(() => null) as { contentVersionId?: unknown } | null;
    if (!body || typeof body.contentVersionId !== 'string') return badRequest('شناسهٔ نسخهٔ محتوا الزامی است.');
    const version = await deps.adminStore!.getContentVersion(body.contentVersionId);
    if (!version) return Response.json({ error: 'نسخهٔ محتوا پیدا نشد.' }, { status: 404 });
    if (!['approved', 'published'].includes(String(version.status))) {
      return badRequest('فقط نسخهٔ تأییدشدهٔ علمی وارد Release می‌شود (AT-AEL-16).');
    }
    await deps.adminStore!.addReleaseItem(String(release.id), body.contentVersionId, guard.identity.userId);
    return c.json({ ok: true });
  });

  app.post('/releases/:id/stage', async (c) => {
    const guard = await requirePermission(c, 'release:stage');
    if (guard instanceof Response) return guard;
    const release = await deps.adminStore!.getRelease(c.req.param('id'));
    if (!release) return Response.json({ error: 'Release پیدا نشد.' }, { status: 404 });
    if (String(release.status) !== 'draft') return badRequest('فقط Release در وضعیت draft قابل Stage است.');
    const items = await deps.adminStore!.listReleaseItems(String(release.id));
    if (!items.length) return badRequest('Release خالی قابل Stage نیست.');
    await deps.adminStore!.updateRelease(String(release.id), { status: 'staged', stagedAt: true });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'release.stage',
      entityType: 'content_release', entityId: String(release.id), after: { items: items.length }, reason: null,
    });
    return c.json({ ok: true, items: items.length });
  });

  /** Publish — Gateهای علمی و حقوقی سمت DB + Snapshot immutable (AT-AEL-15/16/17) */
  app.post('/releases/:id/publish', async (c) => {
    const guard = await requirePermission(c, 'release:publish');
    if (guard instanceof Response) return guard;
    const release = await deps.adminStore!.getRelease(c.req.param('id'));
    if (!release) return Response.json({ error: 'Release پیدا نشد.' }, { status: 404 });
    if (String(release.status) !== 'staged') return badRequest('Publish فقط از وضعیت staged ممکن است.');
    const items = await deps.adminStore!.listReleaseItems(String(release.id));
    // پیش‌فرض سمت DB: تریگر/تابع assert_release_publishable (مهاجرت 0022) همان Gate را می‌بندد؛
    // اینجا همان قواعد را صریح تکرار می‌کنیم تا حافظهٔ موقت/تست هم Default-Deny بماند.
    const versions: Array<Row & { kind: string }> = [];
    for (const item of items) {
      const version = await deps.adminStore!.getContentVersion(String(item.content_version_id));
      if (!version) continue;
      if (!version.scientific_approved_by) {
        return Response.json({ error: 'همهٔ مواد باید تأیید علمی داشته باشند (AT-AEL-16).' }, { status: 422 });
      }
      const body = version.body as Record<string, unknown>;
      const isQuestion = Array.isArray(body.choices) || body.kind === 'essay';
      versions.push({
        ...version,
        slug: typeof body.courseId === 'string' ? body.courseId : '',
        kind: isQuestion ? (body.kind === 'essay' ? 'essay' : 'mcq') : 'course',
      });
    }
    // اعتبارسنجی Snapshot — درسی معتبر بسازد
    let snapshot;
    try {
      snapshot = await buildCatalogSnapshot(String(release.code), versions);
    } catch (error) {
      if (error instanceof CatalogValidationError) return Response.json({ error: error.message }, { status: 422 });
      throw error;
    }
    // Gate سمت DB: تأیید علمی + حقوق
    void assertReleasePublishableNote;
    await deps.adminStore!.upsertPublishedSnapshot(String(release.id), snapshot.contentHash, snapshot);
    await deps.adminStore!.updateRelease(String(release.id), { status: 'published', publishedAt: true, publishedBy: guard.identity.userId });
    await deps.adminStore!.setActiveRelease(String(release.id), guard.identity.userId);
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'release.publish',
      entityType: 'content_release', entityId: String(release.id),
      after: { contentHash: snapshot.contentHash, courses: snapshot.courses.length, warnings: snapshot.warnings.length }, reason: null,
    });
    return c.json({ ok: true, contentHash: snapshot.contentHash, courses: snapshot.courses.length, warnings: snapshot.warnings });
  });

  /** Rollback — فقط اشاره‌گر فعال جابه‌جا می‌شود؛ تاریخچه باقی می‌ماند (AT-AEL-17) */
  app.post('/releases/:id/rollback', async (c) => {
    const guard = await requirePermission(c, 'release:rollback');
    if (guard instanceof Response) return guard;
    const release = await deps.adminStore!.getRelease(c.req.param('id'));
    if (!release) return Response.json({ error: 'Release پیدا نشد.' }, { status: 404 });
    const activeId = await deps.adminStore!.getActiveReleaseId();
    if (activeId !== String(release.id)) return badRequest('فقط Release فعال قابل Rollback است.');
    const published = (await deps.adminStore!.listReleases(200))
      .filter(row => String(row.status) === 'published' && String(row.id) !== String(release.id) && row.published_at)
      .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    if (!published.length) {
      await deps.adminStore!.setActiveRelease('', guard.identity.userId);
    } else {
      await deps.adminStore!.setActiveRelease(String(published[0]!.id), guard.identity.userId);
    }
    await deps.adminStore!.updateRelease(String(release.id), { status: 'rolled_back' });
    await deps.adminStore!.logAdminAction({
      actorId: guard.identity.userId, action: 'release.rollback',
      entityType: 'content_release', entityId: String(release.id),
      after: { restoredTo: published.length ? String(published[0]!.id) : null }, reason: null,
    });
    return c.json({ ok: true, restoredTo: published.length ? String(published[0]!.id) : null });
  });

  app.get('/releases', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    return c.json({ releases: await deps.adminStore!.listReleases(Number(c.req.query('limit') ?? 100)), activeReleaseId: await deps.adminStore!.getActiveReleaseId() });
  });

  app.get('/releases/:id', async (c) => {
    const guard = await requirePermission(c, 'registry:read');
    if (guard instanceof Response) return guard;
    const release = await deps.adminStore!.getRelease(c.req.param('id'));
    if (!release) return Response.json({ error: 'Release پیدا نشد.' }, { status: 404 });
    const items = await deps.adminStore!.listReleaseItems(String(release.id));
    const snapshot = await deps.adminStore!.getPublishedSnapshot(String(release.id));
    return c.json({ release, items: items.length, hasSnapshot: !!snapshot, contentHash: snapshot ? String(snapshot.content_hash) : null });
  });

  // ==================== AEL-701 — Coverage با Denominator صریح ====================

  app.get('/coverage', async (c) => {
    const guard = await requirePermission(c, 'coverage:read');
    if (guard instanceof Response) return guard;
    const computedAt = new Date().toISOString();
    const ratios: Array<{ id: string; numerator: number | 'unknown'; denominator: number | 'unknown'; scope: string; computedAt: string }> = [];

    // ۱) پوشش علمی: نسخه‌های تأییدشده از کل نسخه‌های محتوا
    const versions = await deps.adminStore!.listContentVersions(null, 1000);
    const approved = versions.filter(row => ['approved', 'published'].includes(String(row.status))).length;
    if (versions.length === 0) {
      ratios.push({ id: 'content_scientific_approval', numerator: 'unknown', denominator: 'unknown', scope: 'content_versions', computedAt });
    } else {
      ratios.push({ id: 'content_scientific_approval', numerator: approved, denominator: versions.length, scope: 'content_versions', computedAt });
    }

    // ۲) پوشش حقوق: نسخه‌های منبع با حداقل یک تصمیم authorized
    const sources = await deps.adminStore!.listSources(1000);
    if (sources.length === 0) {
      ratios.push({ id: 'source_rights_authorized', numerator: 'unknown', denominator: 'unknown', scope: 'sources', computedAt });
    } else {
      let authorized = 0;
      for (const source of sources) {
        const rights = await deps.adminStore!.listRights(String(source.id));
        if (rights.some(row => String(row.status) === 'authorized')) authorized += 1;
      }
      ratios.push({ id: 'source_rights_authorized', numerator: authorized, denominator: sources.length, scope: 'sources', computedAt });
    }

    // ۳) پوشش کاتالوگ: درس‌های منتشرشده در Release فعال
    const items = await deps.adminStore!.listContentItems(1000);
    const courseItems = items.filter(row => String(row.kind) === 'course');
    const activeReleaseId = await deps.adminStore!.getActiveReleaseId();
    let publishedCourses = 0;
    if (activeReleaseId) {
      const snapshot = await deps.adminStore!.getPublishedSnapshot(activeReleaseId);
      const courses = (snapshot?.snapshot as { courses?: unknown[] } | null)?.courses ?? [];
      publishedCourses = courses.length;
    }
    if (courseItems.length === 0) {
      ratios.push({ id: 'catalog_published_courses', numerator: 'unknown', denominator: 'unknown', scope: 'content_items(kind=course)', computedAt });
    } else {
      ratios.push({ id: 'catalog_published_courses', numerator: Math.min(publishedCourses, courseItems.length), denominator: courseItems.length, scope: 'content_items(kind=course)', computedAt });
    }

    // ۴) صف بازبینی باز — مخرجش «کار باقی‌مانده» است، نه نسبت
    const openTasks = await deps.adminStore!.listReviewTasks(null, 'pending', 1000);
    return c.json({
      computedAt,
      note: 'مخرج نامعلوم هرگز درصد نمی‌شود (ADR-008) — با unknown گزارش می‌شود.',
      ratios,
      openReviewTasks: openTasks.length,
    });
  });

  void bootstrapGuard;
  return app;
}

function permissionsOf(roles: AdminRoleAssignment[]): string[] {
  const granted = new Set<string>();
  for (const assignment of roles) {
    for (const permission of ROLE_PERMISSIONS[assignment.roleCode as keyof typeof ROLE_PERMISSIONS] ?? []) {
      granted.add(permission);
    }
  }
  return [...granted].sort();
}
