-- 해피통서비스 Supabase 기관 요약 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 총관리자 대시보드와 기관 관리 화면의 읽기 전용 테스트용
-- 개별 민감 데이터는 직접 공개하지 않고 기관 요약만 반환
-- 실제 운영 전 RLS/Auth 정책 검토가 필요합니다.

create or replace function public.get_public_organization_summaries()
returns table (
  id uuid,
  name text,
  region text,
  admin_name text,
  status text,
  memo text,
  target_count bigint,
  checker_count bigint,
  unresolved_emergency_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.region,
    o.admin_name,
    coalesce(o.status, 'active') as status,
    o.memo,
    (
      select count(*)
      from public.targets t
      where t.organization_id = o.id
        and coalesce(t.lifecycle_status, 'active') <> 'ended'
    ) as target_count,
    (
      select count(*)
      from public.users u
      where u.organization_id = o.id
        and u.role = 'checker'
    ) as checker_count,
    (
      select count(*)
      from public.emergency_reports e
      where e.organization_id = o.id
        and coalesce(e.status, 'received') not in ('completed', 'resolved', '완료')
    ) as unresolved_emergency_count
  from public.organizations o
  order by o.name asc;
$$;

grant execute on function public.get_public_organization_summaries() to anon;
grant execute on function public.get_public_organization_summaries() to authenticated;
