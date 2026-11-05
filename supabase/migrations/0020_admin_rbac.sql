-- 0020_admin_rbac.sql — AEL فاز ۲ (AEL-201/202/207/208)
-- RBAC سمت سرور با Default Deny، تفکیک وظایف (SoD) و Audit کامل.
-- `ADMIN_API_TOKEN` فقط دروازهٔ Bootstrap نقش OWNER است (ADR-007)، نه جای RBAC.

-- ============ کاربران مدیریتی و نشست ============
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  username text,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  token_hash text not null unique,        -- sha256(توکن) — توکن خام هرگز ذخیره نمی‌شود
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_sessions_user on admin_sessions(admin_user_id);

-- ============ نقش‌ها و مجوزها ============
create table if not exists admin_roles (
  code text primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_permissions (
  permission text primary key,            -- مثل release:publish
  created_at timestamptz not null default now()
);

create table if not exists admin_role_permissions (
  role_code text not null references admin_roles(code) on delete cascade,
  permission text not null references admin_permissions(permission) on delete cascade,
  primary key (role_code, permission)
);

create table if not exists admin_user_roles (
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  role_code text not null references admin_roles(code) on delete cascade,
  scope jsonb,                            -- محدودهٔ نقش (مثل {programCode: 'prog-masters-mgmt'})
  granted_by text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (admin_user_id, role_code)
);

-- ============ Seed نقش‌های سند ۹٫۱ ============
insert into admin_roles (code, title) values
  ('OWNER', 'مالک محصول'),
  ('SUPER_ADMIN', 'مدیر ارشد'),
  ('CONTENT_MANAGER', 'مدیر محتوا'),
  ('INGESTION_OPERATOR', 'اپراتور ورود منابع'),
  ('CONTENT_AUTHOR', 'تألیف‌کنندهٔ محتوا'),
  ('ACADEMIC_REVIEWER', 'بازبین علمی'),
  ('RIGHTS_REVIEWER', 'بازبین حقوق'),
  ('MAPPING_REVIEWER', 'بازبین نگاشت'),
  ('PUBLISHER', 'ناشر'),
  ('EXAM_MANAGER', 'مدیر آزمون'),
  ('SUPPORT_AGENT', 'پشتیبان'),
  ('OPS_ADMIN', 'مدیر عملیات'),
  ('ANALYST', 'تحلیل‌گر'),
  ('AUDITOR_READONLY', 'حسابرس فقط‌خواندن')
on conflict (code) do update set title = excluded.title;

insert into admin_permissions (permission) values
  ('course:create'), ('course:update'), ('course:archive'),
  ('registry:read'), ('registry:write'),
  ('source:upload'), ('source:read_restricted'),
  ('ingestion:start'), ('ingestion:retry'),
  ('review:scientific:approve'), ('review:rights:approve'), ('review:mapping:approve'),
  ('release:stage'), ('release:publish'), ('release:rollback'),
  ('exam:policy:update'), ('user:read_limited'), ('user:manage'),
  ('audit:read'), ('coverage:read'), ('admin:bootstrap')
on conflict (permission) do nothing;

-- جدول مجوزها (نقش → مجوز) — جدا از هم دیگر نگه داشته می‌شود تا SoD قابل تست باشد
insert into admin_role_permissions (role_code, permission)
select r.code, p.permission
from admin_roles r
join (values
  ('OWNER', array[
    'course:create','course:update','course:archive','registry:read','registry:write',
    'source:upload','source:read_restricted','ingestion:start','ingestion:retry',
    'review:scientific:approve','review:rights:approve','review:mapping:approve',
    'release:stage','release:publish','release:rollback','exam:policy:update',
    'user:read_limited','user:manage','audit:read','coverage:read','admin:bootstrap']),
  ('SUPER_ADMIN', array[
    'course:create','course:update','course:archive','registry:read','registry:write',
    'source:upload','ingestion:start','ingestion:retry','release:stage','release:publish',
    'exam:policy:update','user:read_limited','user:manage','audit:read','coverage:read']),
  ('CONTENT_MANAGER', array[
    'course:create','course:update','course:archive','registry:read','registry:write',
    'source:upload','ingestion:start','coverage:read']),
  ('INGESTION_OPERATOR', array['registry:read','source:upload','ingestion:start','ingestion:retry']),
  ('CONTENT_AUTHOR', array['registry:read','course:create','course:update']),
  ('ACADEMIC_REVIEWER', array['registry:read','review:scientific:approve']),
  ('RIGHTS_REVIEWER', array['registry:read','source:read_restricted','review:rights:approve']),
  ('MAPPING_REVIEWER', array['registry:read','review:mapping:approve']),
  ('PUBLISHER', array['registry:read','release:stage','release:publish','release:rollback','coverage:read']),
  ('EXAM_MANAGER', array['registry:read','registry:write','exam:policy:update']),
  ('SUPPORT_AGENT', array['user:read_limited']),
  ('OPS_ADMIN', array['audit:read','coverage:read','registry:read']),
  ('ANALYST', array['registry:read','coverage:read','audit:read']),
  ('AUDITOR_READONLY', array['registry:read','audit:read','coverage:read'])
) as grants(role_code, permissions) on grants.role_code = r.code
join admin_permissions p on p.permission = any(grants.permissions)
on conflict (role_code, permission) do nothing;

-- ============ RLS: جدول‌های مدیریتی فقط برای service_role ============
do $$
declare
  t text;
  tables text[] := array[
    'admin_users','admin_sessions','admin_roles','admin_permissions',
    'admin_role_permissions','admin_user_roles'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;
-- هیچ policy برای anon/authenticated تعریف نمی‌شود → Default Deny.

-- ============ تابع درون‌دیتابیسی بررسی مجوز (برای RPCهای آینده) ============
create or replace function admin_has_permission(
  p_admin_user_id uuid,
  p_permission text
) returns boolean as $$
  select exists (
    select 1
    from admin_user_roles ur
    join admin_role_permissions rp on rp.role_code = ur.role_code
    where ur.admin_user_id = p_admin_user_id
      and ur.revoked_at is null
      and rp.permission = p_permission
  );
$$ language sql stable security definer;
