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
