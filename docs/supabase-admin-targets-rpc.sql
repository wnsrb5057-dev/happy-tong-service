-- 해피통서비스 Supabase 관리자 대상자 목록 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 대상자 목록 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회하도록 제한이 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 대상자 요약만 반환

create or replace function public.get_public_admin_targets(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  birth_year integer,
  age integer,
  gender text,
  address text,
  phone text,
  guardian_name text,
  guardian_phone text,
  checker_id uuid,
  checker_name text,
  risk_level text,
  lifecycle_status text,
  memo text,
  default_check_type text,
  check_days text[],
  last_activity_at timestamptz,
  last_activity_status text,
  unresolved_emergency_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with base_targets as (
    select
      t.id,
      t.organization_id,
      t.name,
      coalesce(
        nullif(to_jsonb(t)->>'birth_year', '')::integer,
        nullif(to_jsonb(t)->>'age', '')::integer
      ) as birth_year,
      nullif(to_jsonb(t)->>'age', '')::integer as age,
      to_jsonb(t)->>'gender' as gender,
      to_jsonb(t)->>'address' as address,
      to_jsonb(t)->>'phone' as phone,
      to_jsonb(t)->>'guardian_name' as guardian_name,
      to_jsonb(t)->>'guardian_phone' as guardian_phone,
      nullif(to_jsonb(t)->>'assigned_checker_id', '')::uuid as checker_id,
      coalesce(to_jsonb(t)->>'risk_level', 'normal') as risk_level,
      coalesce(to_jsonb(t)->>'lifecycle_status', 'active') as lifecycle_status,
      to_jsonb(t)->>'memo' as memo,
      coalesce(to_jsonb(t)->>'default_check_type', 'external') as default_check_type,
      array(
        select jsonb_array_elements_text(
          coalesce(to_jsonb(t)->'check_days', '[]'::jsonb)
        )
      ) as check_days,
      t.created_at
    from public.targets t
    where t.organization_id = p_organization_id
  ),
  latest_activity as (
    select
      ar.target_id,
      ar.checked_at,
      coalesce(
        to_jsonb(ar)->>'result_status',
        to_jsonb(ar)->>'status'
      ) as result_status,
      row_number() over (
        partition by ar.target_id
        order by ar.checked_at desc nulls last, ar.created_at desc nulls last
      ) as row_number
    from public.activity_records ar
    where ar.organization_id = p_organization_id
  ),
  unresolved_emergency_counts as (
    select
      er.target_id,
      count(*)::bigint as unresolved_count
    from public.emergency_reports er
    where er.organization_id = p_organization_id
      and coalesce(
        to_jsonb(er)->>'status',
        'received'
      ) not in ('completed', 'resolved', '완료')
    group by er.target_id
  )
  select
    bt.id,
    bt.organization_id,
    bt.name,
    bt.birth_year,
    bt.age,
    bt.gender,
    bt.address,
    bt.phone,
    bt.guardian_name,
    bt.guardian_phone,
    bt.checker_id,
    u.name as checker_name,
    bt.risk_level,
    bt.lifecycle_status,
    bt.memo,
    bt.default_check_type,
    bt.check_days,
    la.checked_at as last_activity_at,
    la.result_status as last_activity_status,
    coalesce(uec.unresolved_count, 0) as unresolved_emergency_count,
    bt.created_at
  from base_targets bt
  left join public.users u on u.id = bt.checker_id
  left join latest_activity la
    on la.target_id = bt.id
   and la.row_number = 1
  left join unresolved_emergency_counts uec
    on uec.target_id = bt.id
  order by
    case when bt.lifecycle_status = 'ended' then 1 else 0 end asc,
    coalesce(uec.unresolved_count, 0) desc,
    la.checked_at asc nulls first,
    bt.name asc;
$$;

grant execute on function public.get_public_admin_targets(uuid) to anon;
grant execute on function public.get_public_admin_targets(uuid) to authenticated;
