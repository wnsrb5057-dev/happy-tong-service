-- 해피통서비스 Supabase 초기 스키마
-- localStorage MVP에서 Supabase로 전환하기 위한 초기 테이블 생성 SQL입니다.
-- 실제 적용 전에는 Supabase 프로젝트 환경에서 컬럼, 제약조건, 권한 정책을 다시 검토하세요.
-- RLS 정책은 후속 단계에서 별도로 적용합니다.
-- seed 데이터는 포함하지 않습니다. 필요 시 docs/supabase-seed.sql로 분리합니다.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  address text,
  phone text,
  admin_name text,
  status text not null default 'pilot',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_status_check
    check (status in ('active', 'pilot', 'paused', 'ended'))
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  username text not null unique,
  password_hash text,
  name text not null,
  role text not null,
  phone text,
  region text,
  activity_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check
    check (role in ('super_admin', 'admin', 'checker')),
  constraint users_activity_status_check
    check (activity_status in ('active', 'paused', 'left'))
);

comment on table public.users is 'MVP 단계에서는 users 테이블을 사용하지만, 실제 서비스에서는 Supabase Auth 전환을 검토합니다.';
comment on column public.users.password_hash is '평문 비밀번호 저장 용도가 아니며, 실제 서비스에서는 안전한 해시 또는 Auth 구조를 사용해야 합니다.';

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_checker_id uuid references public.users(id) on delete set null,
  name text not null,
  age int,
  gender text,
  phone text,
  address text,
  risk_level text not null default 'normal',
  default_check_type text,
  check_days text[],
  check_time text,
  health_note text,
  caution_note text,
  medication_note text,
  guardian_name text,
  guardian_phone text,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint targets_risk_level_check
    check (risk_level in ('normal', 'caution', 'danger')),
  constraint targets_lifecycle_status_check
    check (lifecycle_status in ('active', 'paused', 'hospitalized', 'transferred', 'ended', 'deceased', 'unknown_address'))
);

create table if not exists public.activity_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_id uuid not null references public.targets(id) on delete cascade,
  checker_id uuid not null references public.users(id) on delete cascade,
  check_type text,
  checked_at timestamptz,
  condition_summary text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_id uuid not null references public.targets(id) on delete cascade,
  checker_id uuid references public.users(id) on delete set null,
  type text,
  severity text not null default 'caution',
  status text not null default 'received',
  title text,
  description text,
  reported_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_reports_severity_check
    check (severity in ('normal', 'caution', 'urgent')),
  constraint emergency_reports_status_check
    check (status in ('received', 'checking', 'contacted', 'visiting', 'completed'))
);

create table if not exists public.emergency_handling_logs (
  id uuid primary key default gen_random_uuid(),
  emergency_report_id uuid not null references public.emergency_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null,
  memo text not null,
  contacted_guardian boolean not null default false,
  visit_required boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint emergency_handling_logs_status_check
    check (status in ('received', 'checking', 'contacted', 'visiting', 'completed'))
);

create table if not exists public.admin_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  period_start date,
  period_end date,
  summary text,
  action_note text,
  report_data jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  organization_name text,
  requester_name text,
  phone text,
  email text,
  region text,
  memo text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_targets_updated_at on public.targets;
create trigger set_targets_updated_at
before update on public.targets
for each row
execute function public.set_updated_at();

drop trigger if exists set_emergency_reports_updated_at on public.emergency_reports;
create trigger set_emergency_reports_updated_at
before update on public.emergency_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_admin_reports_updated_at on public.admin_reports;
create trigger set_admin_reports_updated_at
before update on public.admin_reports
for each row
execute function public.set_updated_at();

drop trigger if exists set_signup_requests_updated_at on public.signup_requests;
create trigger set_signup_requests_updated_at
before update on public.signup_requests
for each row
execute function public.set_updated_at();

create index if not exists idx_organizations_status on public.organizations(status);
create index if not exists idx_users_organization_id on public.users(organization_id);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_activity_status on public.users(activity_status);
create index if not exists idx_targets_organization_id on public.targets(organization_id);
create index if not exists idx_targets_assigned_checker_id on public.targets(assigned_checker_id);
create index if not exists idx_targets_lifecycle_status on public.targets(lifecycle_status);
create index if not exists idx_targets_risk_level on public.targets(risk_level);
create index if not exists idx_activity_records_organization_id on public.activity_records(organization_id);
create index if not exists idx_activity_records_target_id on public.activity_records(target_id);
create index if not exists idx_activity_records_checker_id on public.activity_records(checker_id);
create index if not exists idx_activity_records_checked_at on public.activity_records(checked_at);
create index if not exists idx_emergency_reports_organization_id on public.emergency_reports(organization_id);
create index if not exists idx_emergency_reports_target_id on public.emergency_reports(target_id);
create index if not exists idx_emergency_reports_status on public.emergency_reports(status);
create index if not exists idx_emergency_reports_reported_at on public.emergency_reports(reported_at);
create index if not exists idx_emergency_handling_logs_emergency_report_id on public.emergency_handling_logs(emergency_report_id);
create index if not exists idx_emergency_handling_logs_organization_id on public.emergency_handling_logs(organization_id);
create index if not exists idx_admin_reports_organization_id on public.admin_reports(organization_id);
create index if not exists idx_admin_reports_period_start on public.admin_reports(period_start);
create index if not exists idx_admin_reports_period_end on public.admin_reports(period_end);
create index if not exists idx_signup_requests_status on public.signup_requests(status);

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.targets enable row level security;
alter table public.activity_records enable row level security;
alter table public.emergency_reports enable row level security;
alter table public.emergency_handling_logs enable row level security;
alter table public.admin_reports enable row level security;
alter table public.signup_requests enable row level security;

-- TODO:
-- super_admin: all access
-- admin: own organization_id access
-- checker: assigned targets and own records access
--
-- 주의:
-- 이 단계에서는 RLS를 enable만 하고 실제 policy는 만들지 않습니다.
-- 앱을 실제로 Supabase에 연결하기 전, 필요한 policy를 함께 설계한 뒤 적용하세요.
