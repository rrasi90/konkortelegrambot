/**
 * AEL-201..209 — مسیرهای Admin API با RBAC سمت سرور (ADR-007).
 * همهٔ نقاط Default Deny هستند؛ `ADMIN_API_TOKEN` فقط دروازهٔ Bootstrap اولین OWNER است.
 */
import { Hono } from 'hono';
import { verifyTelegramInitData } from '../auth';
import { ROLE_PERMISSIONS, hasPermission, type AdminRoleAssignment } from './rbac';
import type { AdminStore } from './store';
import { sha256Hex } from './store';
import { REGISTRY_ENTITY_TABLES, validateRegistryBundle } from '@ael/contracts';

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
