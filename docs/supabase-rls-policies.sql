-- 해피통서비스 Supabase RLS 정책 초안
-- docs/supabase-schema.sql 실행 후 적용하는 정책 초안입니다.
-- docs/supabase-seed.sql 실행 후 테스트할 수 있습니다.
-- 실제 운영 전에는 Supabase Auth 구조와 JWT claims 설계를 함께 확정해야 합니다.
-- 현재는 public.users 기반 role / organization_id 구조를 전제로 한 초안입니다.
-- Supabase Auth의 auth.uid()와 public.users.id가 일치한다고 가정합니다.
-- 현재 localStorage MVP 앱에는 아직 적용하지 않습니다.
--
-- 중요:
-- 현재 MVP 로그인은 localStorage/mock 기반이므로,
-- 아래 RLS 정책은 Supabase Auth 또는 사용자 매핑 전략이 확정되어야 실제로 동작합니다.

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.targets enable row level security;
alter table public.activity_records enable row level security;
alter table public.emergency_reports enable row level security;
alter table public.emergency_handling_logs enable row level security;
alter table public.admin_reports enable row level security;
alter table public.signup_requests enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.organization_id
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'super_admin'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.is_checker()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'checker'
$$;

comment on function public.current_user_role() is
  'auth.uid()와 public.users.id가 일치한다는 가정 하에 현재 사용자의 role을 반환합니다.';

comment on function public.current_user_organization_id() is
  'auth.uid()와 public.users.id가 일치한다는 가정 하에 현재 사용자의 organization_id를 반환합니다.';

comment on function public.is_super_admin() is
  '실제 운영 전에는 security definer 함수와 auth 매핑에 대한 추가 보안 검토가 필요합니다.';

comment on function public.is_admin() is
  '실제 운영 전에는 security definer 함수와 auth 매핑에 대한 추가 보안 검토가 필요합니다.';

comment on function public.is_checker() is
  '실제 운영 전에는 security definer 함수와 auth 매핑에 대한 추가 보안 검토가 필요합니다.';

drop policy if exists "organizations_select" on public.organizations;
drop policy if exists "organizations_insert_super_admin" on public.organizations;
drop policy if exists "organizations_update_super_admin" on public.organizations;
drop policy if exists "organizations_delete_super_admin" on public.organizations;

create policy "organizations_select"
on public.organizations
for select
to authenticated
using (
  public.is_super_admin()
  or (
    (public.is_admin() or public.is_checker())
    and id = public.current_user_organization_id()
  )
);

create policy "organizations_insert_super_admin"
on public.organizations
for insert
to authenticated
with check (
  public.is_super_admin()
);

create policy "organizations_update_super_admin"
on public.organizations
for update
to authenticated
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);

create policy "organizations_delete_super_admin"
on public.organizations
for delete
to authenticated
using (
  public.is_super_admin()
);

-- 실제 운영에서는 organizations 테이블 삭제 대신 soft delete를 권장합니다.

drop policy if exists "users_select" on public.users;
drop policy if exists "users_insert_super_admin_or_admin" on public.users;
drop policy if exists "users_update_super_admin_or_admin" on public.users;
drop policy if exists "users_delete_super_admin" on public.users;

create policy "users_select"
on public.users
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and id = auth.uid()
  )
);

create policy "users_insert_super_admin_or_admin"
on public.users
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
    and role = 'checker'
  )
);

create policy "users_update_super_admin_or_admin"
on public.users
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
    and role = 'checker'
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
    and role = 'checker'
  )
);

create policy "users_delete_super_admin"
on public.users
for delete
to authenticated
using (
  public.is_super_admin()
);

-- admin이 users를 생성/수정할 때는 checker 역할만 허용하는 초안입니다.
-- 실제 운영에서는 계정 생성/수정 로직을 server-side function 또는 Edge Function으로 옮기는 것을 권장합니다.

drop policy if exists "targets_select" on public.targets;
drop policy if exists "targets_insert_admin" on public.targets;
drop policy if exists "targets_update_admin" on public.targets;
drop policy if exists "targets_delete_admin_or_super_admin" on public.targets;

create policy "targets_select"
on public.targets
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and assigned_checker_id = auth.uid()
  )
);

create policy "targets_insert_admin"
on public.targets
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "targets_update_admin"
on public.targets
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "targets_delete_admin_or_super_admin"
on public.targets
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

-- 관리종료 대상자를 체커 화면에서 숨기는 동작은 앱 레벨 필터와 함께 사용합니다.
-- RLS는 배정 대상자 기준 제한을 담당하는 초안입니다.

drop policy if exists "activity_records_select" on public.activity_records;
drop policy if exists "activity_records_insert_checker" on public.activity_records;
drop policy if exists "activity_records_update_admin" on public.activity_records;
drop policy if exists "activity_records_delete_admin_or_super_admin" on public.activity_records;

create policy "activity_records_select"
on public.activity_records
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and checker_id = auth.uid()
  )
);

create policy "activity_records_insert_checker"
on public.activity_records
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and checker_id = auth.uid()
    and organization_id = public.current_user_organization_id()
    and exists (
      select 1
      from public.targets t
      where t.id = target_id
        and t.assigned_checker_id = auth.uid()
        and t.organization_id = public.current_user_organization_id()
    )
  )
);

create policy "activity_records_update_admin"
on public.activity_records
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "activity_records_delete_admin_or_super_admin"
on public.activity_records
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "emergency_reports_select" on public.emergency_reports;
drop policy if exists "emergency_reports_insert_checker" on public.emergency_reports;
drop policy if exists "emergency_reports_update_admin" on public.emergency_reports;
drop policy if exists "emergency_reports_delete_admin_or_super_admin" on public.emergency_reports;

create policy "emergency_reports_select"
on public.emergency_reports
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and checker_id = auth.uid()
  )
);

create policy "emergency_reports_insert_checker"
on public.emergency_reports
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and checker_id = auth.uid()
    and organization_id = public.current_user_organization_id()
    and exists (
      select 1
      from public.targets t
      where t.id = target_id
        and t.assigned_checker_id = auth.uid()
        and t.organization_id = public.current_user_organization_id()
    )
  )
);

create policy "emergency_reports_update_admin"
on public.emergency_reports
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "emergency_reports_delete_admin_or_super_admin"
on public.emergency_reports
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

-- checker가 status를 completed로 직접 생성하지 못하게 하려면
-- 실제 운영에서는 trigger 또는 server-side validation을 추가하는 것을 권장합니다.
-- 이번 SQL은 기본 RLS 초안입니다.

drop policy if exists "emergency_handling_logs_select" on public.emergency_handling_logs;
drop policy if exists "emergency_handling_logs_insert_admin" on public.emergency_handling_logs;
drop policy if exists "emergency_handling_logs_update_admin" on public.emergency_handling_logs;
drop policy if exists "emergency_handling_logs_delete_admin_or_super_admin" on public.emergency_handling_logs;

create policy "emergency_handling_logs_select"
on public.emergency_handling_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
  or (
    public.is_checker()
    and exists (
      select 1
      from public.emergency_reports er
      where er.id = emergency_report_id
        and er.organization_id = public.current_user_organization_id()
        and (
          er.checker_id = auth.uid()
          or exists (
            select 1
            from public.targets t
            where t.id = er.target_id
              and t.assigned_checker_id = auth.uid()
          )
        )
    )
  )
);

create policy "emergency_handling_logs_insert_admin"
on public.emergency_handling_logs
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "emergency_handling_logs_update_admin"
on public.emergency_handling_logs
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "emergency_handling_logs_delete_admin_or_super_admin"
on public.emergency_handling_logs
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "admin_reports_select" on public.admin_reports;
drop policy if exists "admin_reports_insert_admin" on public.admin_reports;
drop policy if exists "admin_reports_update_admin" on public.admin_reports;
drop policy if exists "admin_reports_delete_admin_or_super_admin" on public.admin_reports;

create policy "admin_reports_select"
on public.admin_reports
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "admin_reports_insert_admin"
on public.admin_reports
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "admin_reports_update_admin"
on public.admin_reports
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

create policy "admin_reports_delete_admin_or_super_admin"
on public.admin_reports
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_admin()
    and organization_id = public.current_user_organization_id()
  )
);

drop policy if exists "signup_requests_insert_public" on public.signup_requests;
drop policy if exists "signup_requests_select_super_admin" on public.signup_requests;
drop policy if exists "signup_requests_update_super_admin" on public.signup_requests;
drop policy if exists "signup_requests_delete_super_admin" on public.signup_requests;

create policy "signup_requests_insert_public"
on public.signup_requests
for insert
to public
with check (true);

create policy "signup_requests_select_super_admin"
on public.signup_requests
for select
to authenticated
using (
  public.is_super_admin()
);

create policy "signup_requests_update_super_admin"
on public.signup_requests
for update
to authenticated
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);

create policy "signup_requests_delete_super_admin"
on public.signup_requests
for delete
to authenticated
using (
  public.is_super_admin()
);

-- signup_requests에 public insert를 허용하는 경우 spam 방지를 위해
-- captcha, rate limiting, Edge Function 또는 별도 anti-abuse 계층이 필요합니다.
-- 현재 앱에서는 아직 사용하지 않는 정책 초안입니다.
