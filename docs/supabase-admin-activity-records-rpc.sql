-- 해피통서비스 Supabase 관리자 확인기록 목록 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 확인기록 목록 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회하도록 제한이 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 확인기록 요약만 반환
-- note, 상세 메모 등은 이번 RPC에서 최소 범위만 반환

create or replace function public.get_public_admin_activity_records(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  target_id uuid,
  target_name text,
  target_address text,
  checker_id uuid,
  checker_name text,
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
    t.organization_id,
    ar.target_id,
    t.name as target_name,
    coalesce(to_jsonb(t)->>'address', '-') as target_address,
    ar.checker_id,
    u.name as checker_name,
    coalesce(
      to_jsonb(ar)->>'check_type',
      to_jsonb(ar)->>'type',
      to_jsonb(ar)->>'method',
      'phone'
    ) as check_type,
    coalesce(
      to_jsonb(ar)->>'result_status',
      to_jsonb(ar)->>'status',
      to_jsonb(ar)->>'result',
      to_jsonb(ar)->>'condition_status',
      'normal'
    ) as result_status,
    ar.checked_at,
    coalesce(ar.created_at, ar.checked_at) as created_at
  from public.activity_records ar
  join public.targets t on t.id = ar.target_id
  left join public.users u on u.id = ar.checker_id
  where t.organization_id = p_organization_id
  order by ar.checked_at desc nulls last, coalesce(ar.created_at, ar.checked_at) desc nulls last;
$$;

grant execute on function public.get_public_admin_activity_records(uuid) to anon;
grant execute on function public.get_public_admin_activity_records(uuid) to authenticated;
