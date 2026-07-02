-- 해피통서비스 Supabase 최근 이상징후 요약 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 총관리자 대시보드의 읽기 전용 테스트용
-- 개별 민감 데이터를 과도하게 공개하지 않고 최근 이상징후 요약만 반환
-- 실제 운영 전 RLS/Auth 정책 검토가 필요합니다.

create or replace function public.get_public_recent_emergency_summaries()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  target_id uuid,
  target_name text,
  title text,
  severity text,
  status text,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    er.id,
    er.organization_id,
    o.name as organization_name,
    er.target_id,
    t.name as target_name,
    er.title,
    er.severity,
    er.status,
    er.reported_at
  from public.emergency_reports er
  left join public.organizations o on o.id = er.organization_id
  left join public.targets t on t.id = er.target_id
  order by er.reported_at desc
  limit 5;
$$;

grant execute on function public.get_public_recent_emergency_summaries() to anon;
grant execute on function public.get_public_recent_emergency_summaries() to authenticated;
