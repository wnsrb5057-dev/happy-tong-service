-- 해피통서비스 Supabase 체커 확인기록 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 체커 확인기록 화면 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 작성 기록만 조회하도록 제한 필요
-- 현재 MVP 단계에서는 p_checker_id를 명시적으로 받아 해당 체커의 확인기록만 반환
-- 상세 메모와 description은 과도하게 반환하지 않고 목록 화면에 필요한 요약만 반환

create or replace function public.get_public_checker_activity_history(p_checker_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  checker_id uuid,
  checker_name text,
  target_id uuid,
  target_name text,
  target_address text,
  check_type text,
  result_status text,
  checked_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
select
  ar.id,
  ar.organization_id,
  o.name as organization_name,
  ar.checker_id,
  u.name as checker_name,
  ar.target_id,
  t.name as target_name,
  coalesce(t.address, to_jsonb(t)->>'address', '-') as target_address,
  coalesce(
    nullif(to_jsonb(ar)->>'check_type', ''),
    nullif(to_jsonb(ar)->>'type', ''),
    nullif(to_jsonb(ar)->>'method', ''),
    'phone'
  ) as check_type,
  coalesce(
    nullif(to_jsonb(ar)->>'result_status', ''),
    nullif(to_jsonb(ar)->>'status', ''),
    nullif(to_jsonb(ar)->>'result', ''),
    nullif(to_jsonb(ar)->>'condition_status', ''),
    'normal'
  ) as result_status,
  ar.checked_at,
  coalesce(ar.created_at, ar.checked_at) as created_at
from public.activity_records ar
left join public.targets t on t.id = ar.target_id
left join public.users u on u.id = ar.checker_id
left join public.organizations o on o.id = ar.organization_id
where ar.checker_id = p_checker_id
order by ar.checked_at desc nulls last, coalesce(ar.created_at, ar.checked_at) desc;
$$;

grant execute on function public.get_public_checker_activity_history(uuid) to anon;
grant execute on function public.get_public_checker_activity_history(uuid) to authenticated;
