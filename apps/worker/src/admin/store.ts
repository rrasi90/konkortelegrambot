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

  /* ---------- AEL-301..312 — Source Library و Ingestion ---------- */
  createSource(input: { slug: string; title: string; kind: string; language: string; authors: string | null; publisher: string | null; createdBy: string }): Promise<Row>;
  listSources(limit: number): Promise<Row[]>;
  createSourceVersion(input: { sourceId: string; versionNumber?: number | null; pageCount: number | null; contentHash: string | null; createdBy: string }): Promise<Row>;
  getSourceVersion(id: string): Promise<Row | null>;
  addSourceFile(input: { sourceVersionId: string; fileName: string; mimeType: string; byteSize: number; sha256: string; contentText: string | null; contentBase64: string | null; uploadedBy: string }): Promise<Row>;
  listSourceFiles(sourceVersionId: string): Promise<Row[]>;
  upsertRightsDecision(input: { sourceVersionId: string; useType: string; status: string; license: string | null; decidedBy: string; note: string | null }): Promise<Row>;
  listRights(sourceVersionId: string): Promise<Row[]>;
  createIngestionJob(input: { sourceVersionId: string; adapter: string; settings: Record<string, unknown>; idempotencyKey: string; createdBy: string }): Promise<{ job: Row; created: boolean }>;
  getIngestionJob(id: string): Promise<Row | null>;
  listIngestionJobs(limit: number): Promise<Row[]>;
  /** Claim اتمیک یک Job صف (Lease) — دو اجرا هم‌زمان نباید یک Job بگیرند */
  claimNextIngestionJob(leaseSeconds: number): Promise<Row | null>;
  updateIngestionJob(id: string, patch: { status?: string; lastError?: string | null; incrementAttempt?: boolean; heartbeat?: boolean; releaseLease?: boolean }): Promise<void>;
  insertIngestionArtifact(input: { jobId: string; kind: string; content: unknown; sha256: string | null }): Promise<void>;
  insertDocumentPages(sourceVersionId: string, pages: Array<{ pageNumber: number; confidence: number; quarantined: boolean; quarantineReason: string | null; segments: Array<{ kind: string; ordinal: number; text: string; locator: unknown; confidence: number }> }>): Promise<void>;
  listDocumentPages(sourceVersionId: string, limit: number): Promise<Row[]>;
  countDocumentSegments(sourceVersionId: string): Promise<number>;

  /* ---------- AEL-501..509 — Content, Review, Release, Catalog ---------- */
  upsertContentItem(input: { kind: string; slug: string; title: string; createdBy: string }): Promise<Row>;
  listContentItems(limit: number): Promise<Row[]>;
  getContentItemBySlug(slug: string): Promise<Row | null>;
  createContentVersion(input: { contentItemId: string; body: unknown; contentHash: string; sourceIds: string[]; createdBy: string }): Promise<Row>;
  getContentVersion(id: string): Promise<Row | null>;
  listContentVersions(status: string | null, limit: number): Promise<Row[]>;
  setScientificApproval(versionId: string, approverId: string, approve: boolean): Promise<void>;
  createReviewTask(input: { taskKind: string; contentVersionId: string | null; sourceVersionId: string | null; severity: string; payload: Record<string, unknown>; createdBy: string }): Promise<Row>;
  listReviewTasks(kind: string | null, status: string | null, limit: number): Promise<Row[]>;
  decideReviewTask(id: string, status: string, decidedBy: string, note: string | null): Promise<Row | null>;
  createRelease(input: { code: string; notes: string | null; createdBy: string }): Promise<Row>;
  addReleaseItem(releaseId: string, contentVersionId: string, addedBy: string): Promise<void>;
  listReleaseItems(releaseId: string): Promise<Row[]>;
  getRelease(id: string): Promise<Row | null>;
  listReleases(limit: number): Promise<Row[]>;
  updateRelease(id: string, patch: { status?: string; stagedAt?: boolean; publishedAt?: boolean; publishedBy?: string }): Promise<void>;
  getActiveReleaseId(): Promise<string | null>;
  setActiveRelease(releaseId: string, updatedBy: string): Promise<void>;
  upsertPublishedSnapshot(releaseId: string, contentHash: string, snapshot: unknown): Promise<void>;
  getPublishedSnapshot(releaseId: string): Promise<Row | null>;

  /* ---------- مأموریت v2 Phase 2 — CRUD دامنهٔ آموزشی (فهرست‌سفید در routes) ---------- */
  upsertDomainRow(table: string, row: Row): Promise<Row>;
  listDomainRows(table: string, filters: Array<{ column: string; value: string }>, limit: number): Promise<Row[]>;
  updateDomainRow(table: string, filters: Array<{ column: string; value: string }>, patch: Row): Promise<Row[]>;
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

  /* ---------- AEL-301..312 ---------- */

  async createSource(input: { slug: string; title: string; kind: string; language: string; authors: string | null; publisher: string | null; createdBy: string }): Promise<Row> {
    const rows = await this.request('POST', 'sources', {
      slug: input.slug, title: input.title, kind: input.kind, language: input.language,
      authors: input.authors, publisher: input.publisher, created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('sources insert failed');
    return rows[0]!;
  }

  async listSources(limit: number): Promise<Row[]> {
    const rows = await this.request('GET', 'sources', undefined, `?order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }

  async createSourceVersion(input: { sourceId: string; versionNumber?: number | null; pageCount: number | null; contentHash: string | null; createdBy: string }): Promise<Row> {
    let versionNumber = input.versionNumber ?? null;
    if (versionNumber === null) {
      const existing = await this.request('GET', 'source_versions', undefined, `?source_id=eq.${input.sourceId}&select=version_number&order=version_number.desc&limit=1`) as Row[] | null;
      versionNumber = existing?.length ? Number(existing[0]!.version_number) + 1 : 1;
    }
    const rows = await this.request('POST', 'source_versions', {
      source_id: input.sourceId, version_number: versionNumber, status: 'draft',
      page_count: input.pageCount, content_hash: input.contentHash, created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('source_versions insert failed');
    return rows[0]!;
  }

  async getSourceVersion(id: string): Promise<Row | null> {
    const rows = await this.request('GET', 'source_versions', undefined, `?id=eq.${id}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  async addSourceFile(input: { sourceVersionId: string; fileName: string; mimeType: string; byteSize: number; sha256: string; contentText: string | null; contentBase64: string | null; uploadedBy: string }): Promise<Row> {
    const rows = await this.request('POST', 'source_files', {
      source_version_id: input.sourceVersionId, file_name: input.fileName, mime_type: input.mimeType,
      byte_size: input.byteSize, sha256: input.sha256, content_text: input.contentText,
      content_base64: input.contentBase64, uploaded_by: input.uploadedBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('source_files insert failed');
    return rows[0]!;
  }

  async listSourceFiles(sourceVersionId: string): Promise<Row[]> {
    const rows = await this.request('GET', 'source_files', undefined, `?source_version_id=eq.${sourceVersionId}`) as Row[] | null;
    return rows ?? [];
  }

  async upsertRightsDecision(input: { sourceVersionId: string; useType: string; status: string; license: string | null; decidedBy: string; note: string | null }): Promise<Row> {
    const rows = await this.request('POST', 'source_rights_decisions', {
      source_version_id: input.sourceVersionId, use_type: input.useType, status: input.status,
      license: input.license, decided_by: input.decidedBy, decided_at: new Date().toISOString(), note: input.note,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('source_rights_decisions upsert failed');
    return rows[0]!;
  }

  async listRights(sourceVersionId: string): Promise<Row[]> {
    const rows = await this.request('GET', 'source_rights_decisions', undefined, `?source_version_id=eq.${sourceVersionId}`) as Row[] | null;
    return rows ?? [];
  }

  async createIngestionJob(input: { sourceVersionId: string; adapter: string; settings: Record<string, unknown>; idempotencyKey: string; createdBy: string }): Promise<{ job: Row; created: boolean }> {
    const existing = await this.request('GET', 'ingestion_jobs', undefined, `?idempotency_key=eq.${input.idempotencyKey}&limit=1`) as Row[] | null;
    if (existing?.length) return { job: existing[0]!, created: false };
    const rows = await this.request('POST', 'ingestion_jobs', {
      source_version_id: input.sourceVersionId, adapter: input.adapter, status: 'queued',
      idempotency_key: input.idempotencyKey, settings: input.settings, created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('ingestion_jobs insert failed');
    return { job: rows[0]!, created: true };
  }

  async getIngestionJob(id: string): Promise<Row | null> {
    const rows = await this.request('GET', 'ingestion_jobs', undefined, `?id=eq.${id}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  async listIngestionJobs(limit: number): Promise<Row[]> {
    const rows = await this.request('GET', 'ingestion_jobs', undefined, `?order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }

  async claimNextIngestionJob(leaseSeconds: number): Promise<Row | null> {
    const nowIso = new Date().toISOString();
    const leaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    const candidates = await this.request('GET', 'ingestion_jobs', undefined,
      `?status=in.(queued,leased)&lease_expires_at=or.(is.null,lt.${nowIso})&order=created_at.asc&limit=1`) as Row[] | null;
    if (!candidates?.length) return null;
    const candidate = candidates[0]!;
    const claimed = await fetch(
      `${this.url}/rest/v1/ingestion_jobs?id=eq.${candidate.id}&status=in.(queued,leased)&lease_expires_at=or.(is.null,lt.${nowIso})`,
      {
        method: 'PATCH',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status: 'leased', lease_expires_at: leaseUntil, heartbeat_at: nowIso, attempt: Number(candidate.attempt ?? 0) + 1 }),
      });
    if (!claimed.ok) return null;
    const rows = (await claimed.json()) as Row[];
    return rows.length ? rows[0]! : null;
  }

  async updateIngestionJob(id: string, patch: { status?: string; lastError?: string | null; incrementAttempt?: boolean; heartbeat?: boolean; releaseLease?: boolean }): Promise<void> {
    const body: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.lastError !== undefined) body.last_error = patch.lastError;
    if (patch.heartbeat) body.heartbeat_at = new Date().toISOString();
    if (patch.releaseLease) body.lease_expires_at = null;
    if (patch.incrementAttempt) {
      const current = await this.getIngestionJob(id);
      body.attempt = Number((current?.attempt as number | undefined) ?? 0) + 1;
    }
    const res = await fetch(`${this.url}/rest/v1/ingestion_jobs?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ingestion_jobs: ${res.status} ${await res.text()}`);
  }

  async insertIngestionArtifact(input: { jobId: string; kind: string; content: unknown; sha256: string | null }): Promise<void> {
    await this.request('POST', 'ingestion_artifacts', { job_id: input.jobId, kind: input.kind, content: input.content, sha256: input.sha256 });
  }

  async insertDocumentPages(sourceVersionId: string, pages: Array<{ pageNumber: number; confidence: number; quarantined: boolean; quarantineReason: string | null; segments: Array<{ kind: string; ordinal: number; text: string; locator: unknown; confidence: number }> }>): Promise<void> {
    for (const page of pages) {
      const pageRows = await this.request('POST', 'document_pages', {
        source_version_id: sourceVersionId, page_number: page.pageNumber,
        confidence: page.confidence, quarantined: page.quarantined, quarantine_reason: page.quarantineReason,
      }) as Row[] | null;
      const pageId = String(pageRows?.[0]!.id);
      for (const seg of page.segments) {
        await this.request('POST', 'document_segments', {
          page_id: pageId, kind: seg.kind, ordinal: seg.ordinal, text: seg.text,
          locator: seg.locator, confidence: seg.confidence,
        });
      }
    }
  }

  async listDocumentPages(sourceVersionId: string, limit: number): Promise<Row[]> {
    const rows = await this.request('GET', 'document_pages', undefined, `?source_version_id=eq.${sourceVersionId}&order=page_number.asc&limit=${Math.min(2000, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }

  async countDocumentSegments(sourceVersionId: string): Promise<number> {
    const pageIds = await this.pageIdsFor(sourceVersionId);
    const rows = await this.request('GET', 'document_segments', undefined,
      `?page_id=in.(${pageIds})&select=id`) as Row[] | null;
    return rows?.length ?? 0;
  }

  private async pageIdsFor(sourceVersionId: string): Promise<string> {
    const pages = await this.listDocumentPages(sourceVersionId, 2000);
    return pages.map(page => String(page.id)).join(',') || '00000000-0000-0000-0000-000000000000';
  }

  /* ---------- AEL-501..509 ---------- */

  async upsertContentItem(input: { kind: string; slug: string; title: string; createdBy: string }): Promise<Row> {
    const rows = await this.request('POST', 'content_items', {
      kind: input.kind, slug: input.slug, title: input.title,
      status: 'draft', created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('content_items upsert failed');
    return rows[0]!;
  }

  async listContentItems(limit: number): Promise<Row[]> {
    const rows = await this.request('GET', 'content_items', undefined, `?order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }

  async getContentItemBySlug(slug: string): Promise<Row | null> {
    const rows = await this.request('GET', 'content_items', undefined, `?slug=eq.${slug}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  async createContentVersion(input: { contentItemId: string; body: unknown; contentHash: string; sourceIds: string[]; createdBy: string }): Promise<Row> {
    const existing = await this.request('GET', 'content_versions', undefined, `?content_item_id=eq.${input.contentItemId}&select=version_number&order=version_number.desc&limit=1`) as Row[] | null;
    const versionNumber = existing?.length ? Number(existing[0]!.version_number) + 1 : 1;
    const rows = await this.request('POST', 'content_versions', {
      content_item_id: input.contentItemId, version_number: versionNumber,
      status: 'draft', body: input.body, content_hash: input.contentHash,
      source_ids: input.sourceIds, created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('content_versions insert failed');
    return rows[0]!;
  }

  async getContentVersion(id: string): Promise<Row | null> {
    const rows = await this.request('GET', 'content_versions', undefined, `?id=eq.${id}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  async listContentVersions(status: string | null, limit: number): Promise<Row[]> {
    const query = status
      ? `?status=eq.${status}&order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`
      : `?order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`;
    const rows = await this.request('GET', 'content_versions', undefined, query) as Row[] | null;
    return rows ?? [];
  }

  async setScientificApproval(versionId: string, approverId: string, approve: boolean): Promise<void> {
    const body: Row = approve
      ? { status: 'approved', scientific_approved_by: approverId, scientific_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { status: 'rejected', updated_at: new Date().toISOString() };
    const res = await fetch(`${this.url}/rest/v1/content_versions?id=eq.${versionId}`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH content_versions: ${res.status} ${await res.text()}`);
  }

  async createReviewTask(input: { taskKind: string; contentVersionId: string | null; sourceVersionId: string | null; severity: string; payload: Record<string, unknown>; createdBy: string }): Promise<Row> {
    const rows = await this.request('POST', 'review_tasks', {
      task_kind: input.taskKind, content_version_id: input.contentVersionId,
      source_version_id: input.sourceVersionId, status: 'pending',
      severity: input.severity, payload: input.payload, created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('review_tasks insert failed');
    return rows[0]!;
  }

  async listReviewTasks(kind: string | null, status: string | null, limit: number): Promise<Row[]> {
    const clauses: string[] = [];
    if (kind) clauses.push(`task_kind=eq.${kind}`);
    if (status) clauses.push(`status=eq.${status}`);
    const query = `?${clauses.length ? clauses.join('&') + '&' : ''}order=created_at.desc&limit=${Math.min(500, Math.max(1, limit))}`;
    const rows = await this.request('GET', 'review_tasks', undefined, query) as Row[] | null;
    return rows ?? [];
  }

  async decideReviewTask(id: string, status: string, decidedBy: string, note: string | null): Promise<Row | null> {
    const res = await fetch(`${this.url}/rest/v1/review_tasks?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status, decided_by: decidedBy, decision_note: note, decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`Supabase PATCH review_tasks: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    return rows.length ? rows[0]! : null;
  }

  async createRelease(input: { code: string; notes: string | null; createdBy: string }): Promise<Row> {
    const rows = await this.request('POST', 'content_releases', {
      code: input.code, notes: input.notes, status: 'draft', created_by: input.createdBy,
    }) as Row[] | null;
    if (!rows?.length) throw new Error('content_releases insert failed');
    return rows[0]!;
  }

  async addReleaseItem(releaseId: string, contentVersionId: string, addedBy: string): Promise<void> {
    await this.request('POST', 'release_items', { release_id: releaseId, content_version_id: contentVersionId, added_by: addedBy });
  }

  async listReleaseItems(releaseId: string): Promise<Row[]> {
    const rows = await this.request('GET', 'release_items', undefined, `?release_id=eq.${releaseId}`) as Row[] | null;
    return rows ?? [];
  }

  async getRelease(id: string): Promise<Row | null> {
    const rows = await this.request('GET', 'content_releases', undefined, `?id=eq.${id}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  async listReleases(limit: number): Promise<Row[]> {
    const rows = await this.request('GET', 'content_releases', undefined, `?order=created_at.desc&limit=${Math.min(200, Math.max(1, limit))}`) as Row[] | null;
    return rows ?? [];
  }

  async updateRelease(id: string, patch: { status?: string; stagedAt?: boolean; publishedAt?: boolean; publishedBy?: string }): Promise<void> {
    const body: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.stagedAt) body.staged_at = new Date().toISOString();
    if (patch.publishedAt) body.published_at = new Date().toISOString();
    if (patch.publishedBy !== undefined) body.published_by = patch.publishedBy;
    const res = await fetch(`${this.url}/rest/v1/content_releases?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH content_releases: ${res.status} ${await res.text()}`);
  }

  async getActiveReleaseId(): Promise<string | null> {
    const rows = await this.request('GET', 'catalog_state', undefined, '?id=eq.1&limit=1') as Row[] | null;
    return rows?.length && rows[0]!.active_release_id ? String(rows[0]!.active_release_id) : null;
  }

  async setActiveRelease(releaseId: string, updatedBy: string): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/catalog_state?id=eq.1`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: 1, active_release_id: releaseId, updated_at: new Date().toISOString(), updated_by: updatedBy }),
    });
    if (!res.ok) throw new Error(`Supabase upsert catalog_state: ${res.status} ${await res.text()}`);
  }

  async upsertPublishedSnapshot(releaseId: string, contentHash: string, snapshot: unknown): Promise<void> {
    await this.request('POST', 'published_snapshots', { release_id: releaseId, content_hash: contentHash, snapshot });
  }

  async getPublishedSnapshot(releaseId: string): Promise<Row | null> {
    const rows = await this.request('GET', 'published_snapshots', undefined, `?release_id=eq.${releaseId}&limit=1`) as Row[] | null;
    return rows?.length ? rows[0]! : null;
  }

  /* ---------- مأموریت v2 Phase 2 ---------- */

  async upsertDomainRow(table: string, row: Row): Promise<Row> {
    const rows = await this.request('POST', table, row) as Row[] | null;
    if (!rows?.length) throw new Error(`${table} upsert failed`);
    return rows[0]!;
  }

  async listDomainRows(table: string, filters: Array<{ column: string; value: string }>, limit: number): Promise<Row[]> {
    const query = `?${filters.map(f => `${f.column}=eq.${encodeURIComponent(f.value)}`).join('&')}${filters.length ? '&' : ''}limit=${Math.min(1000, Math.max(1, limit))}`;
    const rows = await this.request('GET', table, undefined, query) as Row[] | null;
    return rows ?? [];
  }

  async updateDomainRow(table: string, filters: Array<{ column: string; value: string }>, patch: Row): Promise<Row[]> {
    const clause = filters.map(f => `${f.column}=eq.${encodeURIComponent(f.value)}`).join('&');
    const rows = await this.request('PATCH', `${table}?${clause}`, patch) as Row[] | null;
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
  private sources = new Map<string, Row>();
  private sourceVersions = new Map<string, Row>();
  private sourceFiles: Row[] = [];
  private rights = new Map<string, Row>();
  private jobs = new Map<string, Row>();
  private artifacts: Row[] = [];
  private documentPages = new Map<string, Row>();
  private documentSegments: Row[] = [];
  private contentItems = new Map<string, Row>();
  private contentVersions = new Map<string, Row>();
  private reviewTasks: Row[] = [];
  private releases = new Map<string, Row>();
  private releaseItems: Row[] = [];
  private activeReleaseId: string | null = null;
  private activeReleaseUpdatedBy: string | null = null;
  private snapshots = new Map<string, Row>();
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

  /* ---------- AEL-301..312 ---------- */

  async createSource(input: { slug: string; title: string; kind: string; language: string; authors: string | null; publisher: string | null; createdBy: string }): Promise<Row> {
    const row: Row = {
      id: this.generateId(), slug: input.slug, title: input.title, kind: input.kind,
      language: input.language, authors: input.authors, publisher: input.publisher,
      status: 'draft', created_by: input.createdBy,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.sources.set(String(row.id), row);
    return row;
  }

  async listSources(limit: number): Promise<Row[]> {
    return [...this.sources.values()].slice(0, limit);
  }

  async createSourceVersion(input: { sourceId: string; versionNumber?: number | null; pageCount: number | null; contentHash: string | null; createdBy: string }): Promise<Row> {
    let versionNumber = input.versionNumber ?? null;
    if (versionNumber === null) {
      const all = [...this.sourceVersions.values()].filter(row => String(row.source_id) === input.sourceId);
      versionNumber = all.length ? Math.max(...all.map(row => Number(row.version_number))) + 1 : 1;
    }
    const row: Row = {
      id: this.generateId(), source_id: input.sourceId, version_number: versionNumber, status: 'draft',
      page_count: input.pageCount, content_hash: input.contentHash, previous_version_id: null,
      change_reason: null, created_by: input.createdBy,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.sourceVersions.set(String(row.id), row);
    return row;
  }

  async getSourceVersion(id: string): Promise<Row | null> {
    return this.sourceVersions.get(id) ?? null;
  }

  async addSourceFile(input: { sourceVersionId: string; fileName: string; mimeType: string; byteSize: number; sha256: string; contentText: string | null; contentBase64: string | null; uploadedBy: string }): Promise<Row> {
    const row: Row = {
      id: this.generateId(), source_version_id: input.sourceVersionId, file_name: input.fileName,
      mime_type: input.mimeType, byte_size: input.byteSize, sha256: input.sha256,
      content_text: input.contentText, content_base64: input.contentBase64, storage_path: null,
      uploaded_by: input.uploadedBy, uploaded_at: new Date().toISOString(),
    };
    this.sourceFiles.push(row);
    return row;
  }

  async listSourceFiles(sourceVersionId: string): Promise<Row[]> {
    return this.sourceFiles.filter(row => String(row.source_version_id) === sourceVersionId);
  }

  async upsertRightsDecision(input: { sourceVersionId: string; useType: string; status: string; license: string | null; decidedBy: string; note: string | null }): Promise<Row> {
    const key = input.sourceVersionId + ':' + input.useType;
    const row: Row = {
      id: this.generateId(), source_version_id: input.sourceVersionId, use_type: input.useType,
      status: input.status, license: input.license, territory: null, decided_by: input.decidedBy,
      decided_at: new Date().toISOString(), note: input.note,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.rights.set(key, row);
    return row;
  }

  async listRights(sourceVersionId: string): Promise<Row[]> {
    return [...this.rights.values()].filter(row => String(row.source_version_id) === sourceVersionId);
  }

  async createIngestionJob(input: { sourceVersionId: string; adapter: string; settings: Record<string, unknown>; idempotencyKey: string; createdBy: string }): Promise<{ job: Row; created: boolean }> {
    const existing = this.jobs.get(input.idempotencyKey);
    if (existing) return { job: existing, created: false };
    const row: Row = {
      id: this.generateId(), source_version_id: input.sourceVersionId, adapter: input.adapter,
      status: 'queued', attempt: 0, max_attempts: 5, lease_expires_at: null, heartbeat_at: null,
      idempotency_key: input.idempotencyKey, settings: input.settings, last_error: null,
      created_by: input.createdBy, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.jobs.set(input.idempotencyKey, row);
    return { job: row, created: true };
  }

  async getIngestionJob(id: string): Promise<Row | null> {
    for (const row of this.jobs.values()) if (String(row.id) === id) return row;
    return null;
  }

  async listIngestionJobs(limit: number): Promise<Row[]> {
    return [...this.jobs.values()].slice(0, limit);
  }

  async claimNextIngestionJob(leaseSeconds: number): Promise<Row | null> {
    const now = Date.now();
    for (const row of this.jobs.values()) {
      const leaseExpired = row.lease_expires_at === null || new Date(String(row.lease_expires_at)).getTime() < now;
      if ((row.status === 'queued' || (row.status === 'leased' && leaseExpired)) && Number(row.attempt) < Number(row.max_attempts)) {
        row.status = 'leased';
        row.lease_expires_at = new Date(now + leaseSeconds * 1000).toISOString();
        row.heartbeat_at = new Date(now).toISOString();
        row.attempt = Number(row.attempt) + 1;
        return row;
      }
    }
    return null;
  }

  async updateIngestionJob(id: string, patch: { status?: string; lastError?: string | null; incrementAttempt?: boolean; heartbeat?: boolean; releaseLease?: boolean }): Promise<void> {
    const row = await this.getIngestionJob(id);
    if (!row) return;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.lastError !== undefined) row.last_error = patch.lastError;
    if (patch.heartbeat) row.heartbeat_at = new Date().toISOString();
    if (patch.releaseLease) row.lease_expires_at = null;
    if (patch.incrementAttempt) row.attempt = Number(row.attempt) + 1;
    row.updated_at = new Date().toISOString();
  }

  async insertIngestionArtifact(input: { jobId: string; kind: string; content: unknown; sha256: string | null }): Promise<void> {
    this.artifacts.push({
      id: this.generateId(), job_id: input.jobId, kind: input.kind,
      content: input.content, sha256: input.sha256, created_at: new Date().toISOString(),
    });
  }

  async insertDocumentPages(sourceVersionId: string, pages: Array<{ pageNumber: number; confidence: number; quarantined: boolean; quarantineReason: string | null; segments: Array<{ kind: string; ordinal: number; text: string; locator: unknown; confidence: number }> }>): Promise<void> {
    for (const page of pages) {
      const pageRow: Row = {
        id: this.generateId(), source_version_id: sourceVersionId, page_number: page.pageNumber,
        confidence: page.confidence, quarantined: page.quarantined, quarantine_reason: page.quarantineReason,
        created_at: new Date().toISOString(),
      };
      this.documentPages.set(sourceVersionId + ':' + page.pageNumber, pageRow);
      for (const seg of page.segments) {
        this.documentSegments.push({
          id: this.generateId(), page_id: String(pageRow.id), kind: seg.kind, ordinal: seg.ordinal,
          text: seg.text, locator: seg.locator, confidence: seg.confidence, created_at: new Date().toISOString(),
        });
      }
    }
  }

  async listDocumentPages(sourceVersionId: string, limit: number): Promise<Row[]> {
    return [...this.documentPages.values()]
      .filter(row => String(row.source_version_id) === sourceVersionId)
      .sort((a, b) => Number(a.page_number) - Number(b.page_number))
      .slice(0, limit);
  }

  async countDocumentSegments(sourceVersionId: string): Promise<number> {
    const pages = await this.listDocumentPages(sourceVersionId, 2000);
    const pageIds = new Set(pages.map(page => String(page.id)));
    return this.documentSegments.filter(seg => pageIds.has(String(seg.page_id))).length;
  }

  /* ---------- AEL-501..509 ---------- */

  async upsertContentItem(input: { kind: string; slug: string; title: string; createdBy: string }): Promise<Row> {
    const existing = this.contentItems.get(input.slug);
    if (existing) {
      existing.title = input.title;
      existing.kind = input.kind;
      return existing;
    }
    const row: Row = {
      id: this.generateId(), kind: input.kind, slug: input.slug, title: input.title,
      status: 'draft', created_by: input.createdBy,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.contentItems.set(input.slug, row);
    return row;
  }

  async listContentItems(limit: number): Promise<Row[]> {
    return [...this.contentItems.values()].slice(0, limit);
  }

  async getContentItemBySlug(slug: string): Promise<Row | null> {
    return this.contentItems.get(slug) ?? null;
  }

  async createContentVersion(input: { contentItemId: string; body: unknown; contentHash: string; sourceIds: string[]; createdBy: string }): Promise<Row> {
    const all = [...this.contentVersions.values()].filter(row => String(row.content_item_id) === input.contentItemId);
    const versionNumber = all.length ? Math.max(...all.map(row => Number(row.version_number))) + 1 : 1;
    const row: Row = {
      id: this.generateId(), content_item_id: input.contentItemId, version_number: versionNumber,
      status: 'draft', body: input.body, content_hash: input.contentHash,
      previous_version_id: null, change_reason: null, source_ids: input.sourceIds,
      scientific_approved_by: null, scientific_approved_at: null, created_by: input.createdBy,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.contentVersions.set(String(row.id), row);
    return row;
  }

  async getContentVersion(id: string): Promise<Row | null> {
    return this.contentVersions.get(id) ?? null;
  }

  async listContentVersions(status: string | null, limit: number): Promise<Row[]> {
    return [...this.contentVersions.values()]
      .filter(row => !status || String(row.status) === status)
      .slice(0, limit);
  }

  async setScientificApproval(versionId: string, approverId: string, approve: boolean): Promise<void> {
    const row = this.contentVersions.get(versionId);
    if (!row) throw new Error('content_version not found');
    row.status = approve ? 'approved' : 'rejected';
    row.scientific_approved_by = approve ? approverId : null;
    row.scientific_approved_at = approve ? new Date().toISOString() : null;
    row.updated_at = new Date().toISOString();
  }

  async createReviewTask(input: { taskKind: string; contentVersionId: string | null; sourceVersionId: string | null; severity: string; payload: Record<string, unknown>; createdBy: string }): Promise<Row> {
    const row: Row = {
      id: this.generateId(), task_kind: input.taskKind, content_version_id: input.contentVersionId,
      source_version_id: input.sourceVersionId, status: 'pending', severity: input.severity,
      payload: input.payload, assigned_to: null, decided_by: null, decision_note: null, decided_at: null,
      created_by: input.createdBy, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.reviewTasks.push(row);
    return row;
  }

  async listReviewTasks(kind: string | null, status: string | null, limit: number): Promise<Row[]> {
    return this.reviewTasks
      .filter(row => (!kind || String(row.task_kind) === kind) && (!status || String(row.status) === status))
      .slice(0, limit);
  }

  async decideReviewTask(id: string, status: string, decidedBy: string, note: string | null): Promise<Row | null> {
    const row = this.reviewTasks.find(item => String(item.id) === id);
    if (!row) return null;
    row.status = status;
    row.decided_by = decidedBy;
    row.decision_note = note;
    row.decided_at = new Date().toISOString();
    row.updated_at = new Date().toISOString();
    return row;
  }

  async createRelease(input: { code: string; notes: string | null; createdBy: string }): Promise<Row> {
    const row: Row = {
      id: this.generateId(), code: input.code, status: 'draft', notes: input.notes,
      created_by: input.createdBy, staged_at: null, published_at: null, published_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    this.releases.set(String(row.id), row);
    return row;
  }

  async addReleaseItem(releaseId: string, contentVersionId: string, addedBy: string): Promise<void> {
    this.releaseItems.push({ release_id: releaseId, content_version_id: contentVersionId, added_by: addedBy, added_at: new Date().toISOString() });
  }

  async listReleaseItems(releaseId: string): Promise<Row[]> {
    return this.releaseItems.filter(row => String(row.release_id) === releaseId);
  }

  async getRelease(id: string): Promise<Row | null> {
    return this.releases.get(id) ?? null;
  }

  async listReleases(limit: number): Promise<Row[]> {
    return [...this.releases.values()].slice(0, limit);
  }

  async updateRelease(id: string, patch: { status?: string; stagedAt?: boolean; publishedAt?: boolean; publishedBy?: string }): Promise<void> {
    const row = this.releases.get(id);
    if (!row) throw new Error('release not found');
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.stagedAt) row.staged_at = new Date().toISOString();
    if (patch.publishedAt) { row.published_at = new Date().toISOString(); row.published_by = patch.publishedBy ?? null; }
    row.updated_at = new Date().toISOString();
  }

  async getActiveReleaseId(): Promise<string | null> {
    return this.activeReleaseId;
  }

  async setActiveRelease(releaseId: string, updatedBy: string): Promise<void> {
    this.activeReleaseId = releaseId;
    this.activeReleaseUpdatedBy = updatedBy;
  }

  async upsertPublishedSnapshot(releaseId: string, contentHash: string, snapshot: unknown): Promise<void> {
    this.snapshots.set(releaseId, { release_id: releaseId, content_hash: contentHash, snapshot, created_at: new Date().toISOString() });
  }

  async getPublishedSnapshot(releaseId: string): Promise<Row | null> {
    return this.snapshots.get(releaseId) ?? null;
  }

  /* ---------- مأموریت v2 Phase 2 ---------- */

  private domainTables = new Map<string, Map<string, Row>>();
  private domainRowSeq = 1;

  private domainTable(name: string): Map<string, Row> {
    const table = this.domainTables.get(name) ?? new Map<string, Row>();
    this.domainTables.set(name, table);
    return table;
  }

  async upsertDomainRow(table: string, row: Row): Promise<Row> {
    const store = this.domainTable(table);
    const key = String(row.id ?? row.slug ?? `row-${this.domainRowSeq++}`);
    // تقلید گاردهای Trigger مهاجرت 0025 برای mapping (E-09 و SoD)
    if (table === 'question_chapter_mappings') {
      const mappedBy = row.mapped_by ?? null;
      if (row.review_status === 'approved' && row.relation_kind === 'direct_source_verified' && !row.evidence_id) {
        throw new Error('MAPPING_EVIDENCE_REQUIRED');
      }
      if (row.review_status === 'approved' && row.reviewed_by && mappedBy && row.reviewed_by === mappedBy) {
        throw new Error('MAPPING_SELF_APPROVAL');
      }
    }
    const existing = store.get(key);
    const merged: Row = { ...existing, ...row, id: key, updated_at: new Date().toISOString() };
    store.set(key, merged);
    return merged;
  }

  async listDomainRows(table: string, filters: Array<{ column: string; value: string }>, limit: number): Promise<Row[]> {
    return [...this.domainTable(table).values()]
      .filter(row => filters.every(f => String(row[f.column]) === f.value))
      .slice(0, limit);
  }

  async updateDomainRow(table: string, filters: Array<{ column: string; value: string }>, patch: Row): Promise<Row[]> {
    const store = this.domainTable(table);
    const updated: Row[] = [];
    for (const [key, row] of store.entries()) {
      if (filters.every(f => String(row[f.column]) === f.value)) {
        const next: Row = { ...row, ...patch, updated_at: new Date().toISOString() };
        if (table === 'question_chapter_mappings') {
          if (next.review_status === 'approved' && next.relation_kind === 'direct_source_verified' && !next.evidence_id) {
            throw new Error('MAPPING_EVIDENCE_REQUIRED');
          }
          if (next.review_status === 'approved' && next.reviewed_by && next.mapped_by && next.reviewed_by === next.mapped_by) {
            throw new Error('MAPPING_SELF_APPROVAL');
          }
        }
        store.set(key, next);
        updated.push(next);
      }
    }
    return updated;
  }
}
