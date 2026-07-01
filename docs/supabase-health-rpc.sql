-- 해피통서비스 Supabase health check RPC
-- docs/supabase-schema.sql 실행 후 적용
-- organizations/users/targets 전체 데이터를 공개하지 않고 count만 반환
-- 총관리자 대시보드의 연결 확인 카드에서 사용 예정
-- 실제 운영 전 보안 검토가 필요합니다.

create or replace function public.get_public_health_counts()
returns table (
  organization_count bigint,
  user_count bigint,
  target_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.organizations) as organization_count,
    (select count(*) from public.users) as user_count,
    (select count(*) from public.targets) as target_count;
$$;

grant execute on function public.get_public_health_counts() to anon;
grant execute on function public.get_public_health_counts() to authenticated;

-- 실행 순서
-- 1. docs/supabase-schema.sql 실행
-- 2. docs/supabase-seed.sql 실행
-- 3. docs/supabase-health-rpc.sql 실행
-- 4. 앱에서 /super/dashboard 연결 상태 카드 확인
-- 5. organizations/users/targets count가 2/5/6처럼 표시되는지 확인
