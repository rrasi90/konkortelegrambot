/**
 * AEL-201/202/207 — لایهٔ دادهٔ مدیریتی.
 * جداسازی از DataStore کاربر تا فیک‌های تست کاربر نشکنند؛ پیاده‌سازی‌ها:
 * SupabaseAdminStore (REST) و MemoryAdminStore (آزمون/محلی).
 * هش توکن با Web Crypto انجام می‌شود (سازگار با Cloudflare Workers).
 */
import type { AdminRoleAssignment } from './rbac';

export interface AdminUserRow {
  id: string;
  telegramUserId: number | null;
  username: string | null;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminSessionRow {
  id: string;
  adminUserId: string;
  expiresAt: string;
}

export interface AdminAuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  at: string;
}

export interface AdminStore {
  upsertAdminUser(input: { telegramUserId: number | null; username: string | null; displayName: string; isActive?: boolean }): Promise<AdminUserRow>;
  getAdminUserByTelegramId(telegramUserId: number): Promise<AdminUserRow | null>;
  getAdminUserById(id: string): Promise<AdminUserRow | null>;
  listAdminUsers(): Promise<AdminUserRow[]>;
  countActiveOwnerAdmins(): Promise<number>;
  grantRole(adminUserId: string, roleCode: string, scope: Record<string, unknown> | null, grantedBy: string | null): Promise<void>;
  revokeRole(adminUserId: string, roleCode: string): Promise<void>;
  listUserRoles(adminUserId: string): Promise<AdminRoleAssignment[]>;
  createAdminSession(adminUserId: string, tokenHash: string, expiresAt: string): Promise<AdminSessionRow>;
  getActiveSessionByTokenHash(tokenHash: string, nowIso: string): Promise<AdminSessionRow | null>;
  revokeSession(tokenHash: string): Promise<void>;
  logAdminAction(event: { actorId: string | null; action: string; entityType: string | null; entityId: string | null; before?: unknown; after?: unknown; reason: string | null }): Promise<void>;
  listAdminAudit(limit: number): Promise<AdminAuditRow[]>;
  /** Upsert عمومی رجیستری (فقط entityهای فهرست‌سفید — رنگ دفاعی دوم) */
  upsertRegistryRows(table: string, rows: Record<string, unknown>[]): Promise<void>;
  listRegistryRows(table: string, limit: number): Promise<Record<string, unknown>[]>;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

type Row = Record<string, unknown>;

function toAdminUser(row: Row): AdminUserRow {
  return {
    id: String(row.id),
    telegramUserId: row.telegram_user_id === null || row.telegram_user_id === undefined ? null : Number(row.telegram_user_id),
    username: (row.username as string | null) ?? null,
    displayName: String(row.display_name ?? ''),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? ''),
  };
}

export class SupabaseAdminStore implements AdminStore {
  constructor(private readonly url: string, private readonly serviceRoleKey: string) {}

  private async request(method: string, path: string, body?: unknown, query = ''): Promise<unknown> {
    const res = await fetch(`${this.url}/rest/v1/${path}${query}`, {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=representation' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async upsertAdminUser(input: { telegramUserId: number | null; username: string | null; displayName: string; isActive?: boolean }): Promise<AdminUserRow> {
    const rows = await this.request('POST', 'admin_users', {
      telegram_user_id: input.telegramUserId,
      username: input.username,
      display_name: input.displayName,
      is_active: input.isActive ?? true,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('admin_users upsert failed');
    return toAdminUser(rows[0]!);
  }

  async getAdminUserByTelegramId(telegramUserId: number): Promise<AdminUserRow | null> {
    const rows = await this.request('GET', 'admin_users', undefined, `?telegram_user_id=eq.${telegramUserId}&limit=1`) as Row[] | null;
    return rows?.length ? toAdminUser(rows[0]!) : null;
  }

  async getAdminUserById(id: string): Promise<AdminUserRow | null> {
    const rows = await this.request('GET', 'admin_users', undefined, `?id=eq.${id}&limit=1`) as Row[] | null;
    return rows?.length ? toAdminUser(rows[0]!) : null;
  }

  async listAdminUsers(): Promise<AdminUserRow[]> {
    const rows = await this.request('GET', 'admin_users', undefined, '?order=created_at.desc&limit=200') as Row[] | null;
    return (rows ?? []).map(toAdminUser);
  }

  async countActiveOwnerAdmins(): Promise<number> {
    // نقش OWNER فعال برای کاربر فعال — با یک join سمت REST (دو پرس‌وجوی سبک)
    const roleRows = await this.request('GET', 'admin_user_roles', undefined, '?role_code=eq.OWNER&revoked_at=is.null&select=admin_user_id') as Row[] | null;
    let active = 0;
    for (const row of roleRows ?? []) {
      const user = await this.getAdminUserById(String(row.admin_user_id));
      if (user?.isActive) active += 1;
    }
    return active;
  }

  async grantRole(adminUserId: string, roleCode: string, scope: Record<string, unknown> | null, grantedBy: string | null): Promise<void> {
    await this.request('POST', 'admin_user_roles', {
      admin_user_id: adminUserId,
      role_code: roleCode,
      scope: scope ?? null,
      granted_by: grantedBy,
      revoked_at: null,
    });
  }

  async revokeRole(adminUserId: string, roleCode: string): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/admin_user_roles?admin_user_id=eq.${adminUserId}&role_code=eq.${roleCode}`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Supabase PATCH admin_user_roles: ${res.status} ${await res.text()}`);
  }

  async listUserRoles(adminUserId: string): Promise<AdminRoleAssignment[]> {
    const rows = await this.request('GET', 'admin_user_roles', undefined, `?admin_user_id=eq.${adminUserId}&revoked_at=is.null`) as Row[] | null;
    return (rows ?? []).map(row => ({
      roleCode: String(row.role_code),
      scope: (row.scope as Record<string, unknown> | null) ?? null,
    }));
  }

  async createAdminSession(adminUserId: string, tokenHash: string, expiresAt: string): Promise<AdminSessionRow> {
    const res = await fetch(`${this.url}/rest/v1/admin_sessions`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ admin_user_id: adminUserId, token_hash: tokenHash, expires_at: expiresAt }),
    });
    if (!res.ok) throw new Error(`Supabase POST admin_sessions: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    const row = rows[0]!;
    return { id: String(row.id), adminUserId: String(row.admin_user_id), expiresAt: String(row.expires_at) };
  }

  async getActiveSessionByTokenHash(tokenHash: string, nowIso: string): Promise<AdminSessionRow | null> {
    const rows = await this.request('GET', 'admin_sessions', undefined, `?token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${nowIso}&limit=1`) as Row[] | null;
    if (!rows?.length) return null;
    const row = rows[0]!;
    return { id: String(row.id), adminUserId: String(row.admin_user_id), expiresAt: String(row.expires_at) };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/admin_sessions?token_hash=eq.${tokenHash}&revoked_at=is.null`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`Supabase PATCH admin_sessions: ${res.status} ${await res.text()}`);
  }

  async logAdminAction(event: { actorId: string | null; action: string; entityType: string | null; entityId: string | null; before?: unknown; after?: unknown; reason: string | null }): Promise<void> {
    await this.request('POST', 'admin_audit_events', {
      actor_id: event.actorId,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId,
      before: event.before === undefined ? null : event.before,
      after: event.after === undefined ? null : event.after,
      reason: event.reason,
    });
  }

  async listAdminAudit(limit: number): Promise<AdminAuditRow[]> {
    const rows = await this.request('GET', 'admin_audit_events', undefined, `?order=at.desc&limit=${Math.min(500, Math.max(1, limit))}`) as Row[] | null;
    return (rows ?? []).map(row => ({
      id: String(row.id),
      actorId: (row.actor_id as string | null) ?? null,
      action: String(row.action ?? ''),
      entityType: (row.entity_type as string | null) ?? null,
      entityId: (row.entity_id as string | null) ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
      reason: (row.reason as string | null) ?? null,
      at: String(row.at ?? ''),
    }));
  }

  async upsertRegistryRows(table: string, rows: Row[]): Promise<void> {
    for (const row of rows) await this.request('POST', table, row);
  }

  async listRegistryRows(table: string, limit: number): Promise<Row[]> {
    const rows = await this.request('GET', table, undefined, `?limit=${Math.min(1000, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }
}

interface MemoryRoleEntry {
  adminUserId: string;
  roleCode: string;
  scope: Record<string, unknown> | null;
  revoked: boolean;
}

interface MemorySessionEntry {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: string;
  revoked: boolean;
}

export class MemoryAdminStore implements AdminStore {
  private users = new Map<string, AdminUserRow>();
  private roles: MemoryRoleEntry[] = [];
  private sessions = new Map<string, MemorySessionEntry>();
  private audit: AdminAuditRow[] = [];
  private registry = new Map<string, Map<string, Row>>();
  private nextId = 1;

  private generateId(): string {
    return `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
  }

  async upsertAdminUser(input: { telegramUserId: number | null; username: string | null; displayName: string; isActive?: boolean }): Promise<AdminUserRow> {
    if (input.telegramUserId !== null) {
      const existing = await this.getAdminUserByTelegramId(input.telegramUserId);
      if (existing) {
        existing.username = input.username;
        existing.displayName = input.displayName;
        existing.isActive = input.isActive ?? existing.isActive;
        return existing;
      }
    }
    const user: AdminUserRow = {
      id: this.generateId(),
      telegramUserId: input.telegramUserId,
      username: input.username,
      displayName: input.displayName,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getAdminUserByTelegramId(telegramUserId: number): Promise<AdminUserRow | null> {
    for (const user of this.users.values()) if (user.telegramUserId === telegramUserId) return user;
    return null;
  }

  async getAdminUserById(id: string): Promise<AdminUserRow | null> {
    return this.users.get(id) ?? null;
  }

  async listAdminUsers(): Promise<AdminUserRow[]> {
    return [...this.users.values()];
  }

  async countActiveOwnerAdmins(): Promise<number> {
    const ownerIds = new Set(this.roles.filter(row => row.roleCode === 'OWNER' && !row.revoked).map(row => row.adminUserId));
    let active = 0;
    for (const id of ownerIds) {
      const user = this.users.get(id);
      if (user?.isActive) active += 1;
    }
    return active;
  }

  async grantRole(adminUserId: string, roleCode: string, scope: Record<string, unknown> | null, grantedBy: string | null): Promise<void> {
    this.roles = this.roles.filter(row => !(row.adminUserId === adminUserId && row.roleCode === roleCode));
    this.roles.push({ adminUserId, roleCode, scope, revoked: false });
    void grantedBy;
  }

  async revokeRole(adminUserId: string, roleCode: string): Promise<void> {
    for (const row of this.roles) if (row.adminUserId === adminUserId && row.roleCode === roleCode) row.revoked = true;
  }

  async listUserRoles(adminUserId: string): Promise<AdminRoleAssignment[]> {
    return this.roles
      .filter(row => row.adminUserId === adminUserId && !row.revoked)
      .map(row => ({ roleCode: row.roleCode, scope: row.scope }));
  }

  async createAdminSession(adminUserId: string, tokenHash: string, expiresAt: string): Promise<AdminSessionRow> {
    const session: MemorySessionEntry = { id: this.generateId(), adminUserId, tokenHash, expiresAt, revoked: false };
    this.sessions.set(tokenHash, session);
    return { id: session.id, adminUserId, expiresAt };
  }

  async getActiveSessionByTokenHash(tokenHash: string, nowIso: string): Promise<AdminSessionRow | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revoked) return null;
    if (session.expiresAt <= nowIso) return null;
    return { id: session.id, adminUserId: session.adminUserId, expiresAt: session.expiresAt };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revoked = true;
  }

  async logAdminAction(event: { actorId: string | null; action: string; entityType: string | null; entityId: string | null; before?: unknown; after?: unknown; reason: string | null }): Promise<void> {
    this.audit.push({
      id: this.generateId(),
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: event.before ?? null,
      after: event.after ?? null,
      reason: event.reason,
      at: new Date().toISOString(),
    });
  }

  async listAdminAudit(limit: number): Promise<AdminAuditRow[]> {
    return this.audit.slice(-limit).reverse();
  }

  async upsertRegistryRows(table: string, rows: Row[]): Promise<void> {
    const tableRows = this.registry.get(table) ?? new Map<string, Row>();
    for (const row of rows) tableRows.set(String(row.id ?? row.code), { ...row });
    this.registry.set(table, tableRows);
  }

  async listRegistryRows(table: string, limit: number): Promise<Row[]> {
    return [...(this.registry.get(table)?.values() ?? [])].slice(0, limit);
  }
}
