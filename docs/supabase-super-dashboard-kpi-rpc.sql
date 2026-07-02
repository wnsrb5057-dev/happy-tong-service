-- 해피통서비스 Supabase 총관리자 KPI RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 총관리자 대시보드의 읽기 전용 테스트용
-- 개별 row 데이터는 공개하지 않고 집계 숫자만 반환
-- 실제 운영 전 RLS/Auth 정책 검토가 필요합니다.

create or replace function public.get_public_super_dashboard_kpis()
returns table (
  organization_count bigint,
  active_target_count bigint,
  checker_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.organizations) as organization_count,
    (
      select count(*)
      from public.targets
      where coalesce(lifecycle_status, 'active') <> 'ended'
    ) as active_target_count,
    (
      select count(*)
      from public.users
      where role = 'checker'
    ) as checker_count,
    (select count(*) from public.emergency_reports) as emergency_count,
    (
      select count(*)
      from public.emergency_reports
      where coalesce(status, 'received') not in ('completed', 'resolved', '완료')
    ) as unresolved_emergency_count;
$$;

grant execute on function public.get_public_super_dashboard_kpis() to anon;
grant execute on function public.get_public_super_dashboard_kpis() to authenticated;
