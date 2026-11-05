/**
 * AEL-202 — مدل مجوز سمت سرور (Default Deny، ADR-007).
 * این ماژول خالص است؛ منبع حقیقت در DB (admin_role_permissions) است و این
 * جدول هم‌سانیِ همان دادهٔ Seed مهاجرت 0020 برای تست/حافظهٔ موقت را نگه می‌دارد.
 */

export const ADMIN_ROLES = [
  'OWNER', 'SUPER_ADMIN', 'CONTENT_MANAGER', 'INGESTION_OPERATOR', 'CONTENT_AUTHOR',
  'ACADEMIC_REVIEWER', 'RIGHTS_REVIEWER', 'MAPPING_REVIEWER', 'PUBLISHER', 'EXAM_MANAGER',
  'SUPPORT_AGENT', 'OPS_ADMIN', 'ANALYST', 'AUDITOR_READONLY',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'course:create', 'course:update', 'course:archive',
  'registry:read', 'registry:write',
  'source:upload', 'source:read_restricted',
  'ingestion:start', 'ingestion:retry',
  'review:scientific:approve', 'review:rights:approve', 'review:mapping:approve',
  'release:stage', 'release:publish', 'release:rollback',
  'exam:policy:update', 'user:read_limited', 'user:manage',
  'audit:read', 'coverage:read', 'admin:bootstrap',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  OWNER: [...ADMIN_PERMISSIONS],
  SUPER_ADMIN: ['course:create', 'course:update', 'course:archive', 'registry:read', 'registry:write',
    'source:upload', 'ingestion:start', 'ingestion:retry', 'release:stage', 'release:publish',
    'exam:policy:update', 'user:read_limited', 'user:manage', 'audit:read', 'coverage:read'],
  CONTENT_MANAGER: ['course:create', 'course:update', 'course:archive', 'registry:read', 'registry:write',
    'source:upload', 'ingestion:start', 'coverage:read'],
  INGESTION_OPERATOR: ['registry:read', 'source:upload', 'ingestion:start', 'ingestion:retry'],
  CONTENT_AUTHOR: ['registry:read', 'course:create', 'course:update'],
  ACADEMIC_REVIEWER: ['registry:read', 'review:scientific:approve'],
  RIGHTS_REVIEWER: ['registry:read', 'source:read_restricted', 'review:rights:approve'],
  MAPPING_REVIEWER: ['registry:read', 'review:mapping:approve'],
  PUBLISHER: ['registry:read', 'release:stage', 'release:publish', 'release:rollback', 'coverage:read'],
  EXAM_MANAGER: ['registry:read', 'registry:write', 'exam:policy:update'],
  SUPPORT_AGENT: ['user:read_limited'],
  OPS_ADMIN: ['audit:read', 'coverage:read', 'registry:read'],
  ANALYST: ['registry:read', 'coverage:read', 'audit:read'],
  AUDITOR_READONLY: ['registry:read', 'audit:read', 'coverage:read'],
};

export interface AdminRoleAssignment {
  roleCode: string;
  scope: Record<string, unknown> | null;
}

/** بررسی مجوز با Default Deny — هیچ wildcard و هیچ role-name magic وجود ندارد. */
export function hasPermission(assignments: readonly AdminRoleAssignment[], permission: AdminPermission | string): boolean {
  return assignments.some(assignment => {
    const granted = ROLE_PERMISSIONS[assignment.roleCode as AdminRole];
    return Array.isArray(granted) && (granted as readonly string[]).includes(permission);
  });
}

/** SoD — AEL-503: تألیف‌کننده نمی‌تواند تأیید علمی محتوای خودش را بدهد. */
export function canApproveOwnContent(assignments: readonly AdminRoleAssignment[]): boolean {
  return false; // هیچ نقشی اجازهٔ self-approval ندارد؛ Author اصلاً مجوز approve ندارد.
}

/** تفکیک وظایف: نقش‌هایی که نباید در یک نفر جمع شوند (AEL-503). */
export function conflictsWithDuties(roleCodes: readonly string[]): string | null {
  const has = (role: AdminRole) => roleCodes.includes(role);
  // Publisher + هر دو بازبین: ناشر نباید تنها امضای علمی و حقوقی داشته باشد.
  if (has('PUBLISHER') && has('ACADEMIC_REVIEWER') && has('RIGHTS_REVIEWER')) {
    return 'SOD_PUBLISHER_BOTH_REVIEWS: نقش ناشر نباید هم‌زمان امضای علمی و حقوقی یک نفر باشد.';
  }
  return null;
}
