-- 해피통서비스 Supabase 체커 홈 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 체커 홈 화면 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 해당 대상자만 조회하도록 제한 필요
-- 현재 MVP 단계에서는 p_checker_id를 명시적으로 받아 해당 체커의 요약만 반환
-- 개인정보/상세 메모를 과도하게 반환하지 않고 해당 대상자 요약 위주로 반환

create or replace function public.get_public_checker_home(p_checker_id uuid)
returns table (
  checker_id uuid,
  checker_name text,
  organization_id uuid,
  organization_name text,
  assigned_target_count bigint,
  today_pending_count bigint,
  today_completed_count bigint,
  unresolved_emergency_count bigint,
  assigned_targets jsonb,
  today_targets jsonb,
  recent_activities jsonb,
  recent_emergencies jsonb
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
),
assigned as (
  select t.*
  from public.targets t
  join checker_user cu on cu.id = t.assigned_checker_id
  where coalesce(t.lifecycle_status, 'active') <> 'ended'
),
today_activity_targets as (
  select distinct ar.target_id
  from public.activity_records ar
  join assigned a on a.id = ar.target_id
  where ar.checked_at::date = current_date
),
target_last_activity as (
  select
    a.id as target_id,
    max(ar.checked_at) as last_activity_at
  from assigned a
  left join public.activity_records ar on ar.target_id = a.id
  group by a.id
),
target_unresolved_emergencies as (
  select
    a.id as target_id,
    count(er.id)::bigint as unresolved_emergency_count
  from assigned a
  left join public.emergency_reports er
    on er.target_id = a.id
   and coalesce(er.status, 'received') not in ('completed', 'resolved', '완료')
  group by a.id
),
target_summary as (
  select
    a.id,
    a.name,
    null::int as birth_year,
    a.age,
    a.gender,
    a.address,
    a.risk_level,
    a.lifecycle_status,
    tla.last_activity_at,
    coalesce(tue.unresolved_emergency_count, 0)::bigint as unresolved_emergency_count
  from assigned a
  left join target_last_activity tla on tla.target_id = a.id
  left join target_unresolved_emergencies tue on tue.target_id = a.id
),
assigned_targets_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'name', ts.name,
        'birth_year', ts.birth_year,
        'age', ts.age,
        'gender', ts.gender,
        'address', ts.address,
        'risk_level', ts.risk_level,
        'lifecycle_status', ts.lifecycle_status,
        'last_activity_at', ts.last_activity_at,
        'unresolved_emergency_count', ts.unresolved_emergency_count
      )
      order by
        case ts.risk_level when 'danger' then 1 when 'urgent' then 1 when 'caution' then 2 else 3 end,
        ts.last_activity_at asc nulls first,
        ts.name asc
    ) filter (where ts.id is not null),
    '[]'::jsonb
  ) as items
  from (
    select *
    from target_summary
    order by
      case risk_level when 'danger' then 1 when 'urgent' then 1 when 'caution' then 2 else 3 end,
      last_activity_at asc nulls first,
      name asc
    limit 10
  ) ts
),
today_targets_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'name', ts.name,
        'address', ts.address,
        'risk_level', ts.risk_level,
        'last_activity_at', ts.last_activity_at,
        'unresolved_emergency_count', ts.unresolved_emergency_count
      )
      order by
        case ts.risk_level when 'danger' then 1 when 'urgent' then 1 when 'caution' then 2 else 3 end,
        ts.last_activity_at asc nulls first,
        ts.name asc
    ) filter (where ts.id is not null),
    '[]'::jsonb
  ) as items
  from (
    select ts.*
    from target_summary ts
    where not exists (
      select 1
      from today_activity_targets tat
      where tat.target_id = ts.id
    )
    order by
      case ts.risk_level when 'danger' then 1 when 'urgent' then 1 when 'caution' then 2 else 3 end,
      ts.last_activity_at asc nulls first,
      ts.name asc
    limit 10
  ) ts
),
recent_activities_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ar.id,
        'target_id', ar.target_id,
        'target_name', t.name,
        'check_type', ar.check_type,
        'result_status', 'completed',
        'checked_at', ar.checked_at
      )
      order by ar.checked_at desc nulls last, ar.created_at desc
    ) filter (where ar.id is not null),
    '[]'::jsonb
  ) as items
  from (
    select ar.*
    from public.activity_records ar
    join assigned a on a.id = ar.target_id
    where ar.checker_id = p_checker_id
    order by ar.checked_at desc nulls last, ar.created_at desc
    limit 5
  ) ar
  left join public.targets t on t.id = ar.target_id
),
recent_emergencies_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', er.id,
        'target_id', er.target_id,
        'target_name', t.name,
        'title', er.title,
        'severity', er.severity,
        'status', er.status,
        'reported_at', er.reported_at
      )
      order by er.reported_at desc nulls last, er.created_at desc
    ) filter (where er.id is not null),
    '[]'::jsonb
  ) as items
  from (
    select er.*
    from public.emergency_reports er
    join assigned a on a.id = er.target_id
    order by er.reported_at desc nulls last, er.created_at desc
    limit 5
  ) er
  left join public.targets t on t.id = er.target_id
)
select
  cu.id as checker_id,
  cu.name as checker_name,
  cu.organization_id,
  cu.organization_name,
  (select count(*)::bigint from assigned) as assigned_target_count,
  (
    select count(*)::bigint
    from assigned a
    where not exists (
      select 1
      from today_activity_targets tat
      where tat.target_id = a.id
    )
  ) as today_pending_count,
  (select count(*)::bigint from today_activity_targets) as today_completed_count,
  (
    select count(er.id)::bigint
    from public.emergency_reports er
    join assigned a on a.id = er.target_id
    where coalesce(er.status, 'received') not in ('completed', 'resolved', '완료')
  ) as unresolved_emergency_count,
  (select items from assigned_targets_json) as assigned_targets,
  (select items from today_targets_json) as today_targets,
  (select items from recent_activities_json) as recent_activities,
  (select items from recent_emergencies_json) as recent_emergencies
from checker_user cu;
$$;

grant execute on function public.get_public_checker_home(uuid) to anon;
grant execute on function public.get_public_checker_home(uuid) to authenticated;
