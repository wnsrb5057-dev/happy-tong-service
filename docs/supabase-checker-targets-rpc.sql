-- 해피통서비스 Supabase 체커 대상자 목록 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 체커 대상자 목록 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 담당 대상자만 조회하도록 제한 필요
-- 현재 MVP 단계에서는 p_checker_id를 명시적으로 받아 해당 체커의 대상자만 반환
-- 연락처와 상세 메모는 반환하지 않고 목록 화면에 필요한 요약만 반환

create or replace function public.get_public_checker_targets(p_checker_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  checker_id uuid,
  checker_name text,
  name text,
  birth_year integer,
  age integer,
  gender text,
  address text,
  risk_level text,
  lifecycle_status text,
  default_check_type text,
  check_days jsonb,
  last_activity_at timestamptz,
  last_activity_status text,
  today_completed boolean,
  unresolved_emergency_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
with checker_user as (
  select
    u.id,
    u.name,
    u.organization_id,
    o.name as organization_name
  from public.users u
  left join public.organizations o on o.id = u.organization_id
  where u.id = p_checker_id
    and u.role = 'checker'
  limit 1
)
select
  t.id,
  cu.organization_id,
  cu.organization_name,
  cu.id as checker_id,
  cu.name as checker_name,
  t.name,
  coalesce(
    nullif(to_jsonb(t)->>'birth_year', '')::integer,
    case
      when nullif(to_jsonb(t)->>'age', '') is not null
        then extract(year from current_date)::integer - nullif(to_jsonb(t)->>'age', '')::integer + 1
      else null
    end
  ) as birth_year,
  coalesce(
    t.age,
    nullif(to_jsonb(t)->>'age', '')::integer
  ) as age,
  t.gender,
  t.address,
  coalesce(t.risk_level, nullif(to_jsonb(t)->>'risk_level', ''), 'normal') as risk_level,
  coalesce(t.lifecycle_status, nullif(to_jsonb(t)->>'lifecycle_status', ''), 'active') as lifecycle_status,
  coalesce(t.default_check_type, nullif(to_jsonb(t)->>'default_check_type', ''), 'phone') as default_check_type,
  coalesce(to_jsonb(t)->'check_days', '[]'::jsonb) as check_days,
  latest_activity.checked_at as last_activity_at,
  coalesce(
    nullif(to_jsonb(latest_activity)->>'result_status', ''),
    nullif(to_jsonb(latest_activity)->>'status', ''),
    null
  ) as last_activity_status,
  exists (
    select 1
    from public.activity_records today_record
    where today_record.target_id = t.id
      and today_record.checked_at::date = current_date
  ) as today_completed,
  coalesce(unresolved_emergencies.unresolved_emergency_count, 0)::bigint as unresolved_emergency_count,
  t.created_at
from checker_user cu
join public.targets t on t.assigned_checker_id = cu.id
left join lateral (
  select ar.*
  from public.activity_records ar
  where ar.target_id = t.id
  order by ar.checked_at desc nulls last, ar.created_at desc
  limit 1
) latest_activity on true
left join lateral (
  select count(er.id)::bigint as unresolved_emergency_count
  from public.emergency_reports er
  where er.target_id = t.id
    and coalesce(er.status, 'received') not in ('completed', 'resolved', '완료')
) unresolved_emergencies on true
order by
  case when coalesce(t.lifecycle_status, nullif(to_jsonb(t)->>'lifecycle_status', ''), 'active') = 'ended' then 1 else 0 end asc,
  coalesce(unresolved_emergencies.unresolved_emergency_count, 0) desc,
  exists (
    select 1
    from public.activity_records today_record
    where today_record.target_id = t.id
      and today_record.checked_at::date = current_date
  ) asc,
  latest_activity.checked_at asc nulls first,
  t.name asc;
$$;

grant execute on function public.get_public_checker_targets(uuid) to anon;
grant execute on function public.get_public_checker_targets(uuid) to authenticated;
