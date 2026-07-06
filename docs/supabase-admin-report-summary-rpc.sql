-- 해피통서비스 Supabase 관리자 보고서 요약 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 보고서 화면 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회되도록 제한 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 보고서 요약만 반환
-- 개인정보/상세 메모를 과도하게 반환하지 않고 집계값과 최근 요약 위주로 반환

create or replace function public.get_public_admin_report_summary(p_organization_id uuid)
returns table (
  organization_id uuid,
  organization_name text,
  region text,
  report_period_start date,
  report_period_end date,
  target_count bigint,
  active_target_count bigint,
  checker_count bigint,
  activity_count bigint,
  recent_activity_count bigint,
  today_activity_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint,
  completed_emergency_count bigint,
  activity_by_type jsonb,
  emergency_by_status jsonb,
  emergency_by_severity jsonb,
  recent_activities jsonb,
  recent_emergencies jsonb
)
language sql
stable
security definer
set search_path = public
as $$
with organization_row as (
  select
    o.id,
    o.name,
    coalesce(to_jsonb(o)->>'region', to_jsonb(o)->>'address', '-') as region
  from public.organizations o
  where o.id = p_organization_id
),
target_base as (
  select
    t.id,
    t.name,
    coalesce(to_jsonb(t)->>'lifecycle_status', 'active') as lifecycle_status
  from public.targets t
  where t.organization_id = p_organization_id
),
checker_base as (
  select
    u.id,
    u.name
  from public.users u
  where u.organization_id = p_organization_id
    and u.role = 'checker'
),
activity_base as (
  select
    ar.id,
    ar.target_id,
    ar.checker_id,
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
  where t.organization_id = p_organization_id
),
emergency_base as (
  select
    er.id,
    er.target_id,
    coalesce(
      to_jsonb(er)->>'title',
      to_jsonb(er)->>'issue_type',
      '이상징후 보고'
    ) as title,
    coalesce(
      to_jsonb(er)->>'severity',
      to_jsonb(er)->>'risk_level',
      'caution'
    ) as severity,
    coalesce(to_jsonb(er)->>'status', 'received') as status,
    coalesce(er.reported_at, er.created_at) as reported_at
  from public.emergency_reports er
  where er.organization_id = p_organization_id
)
select
  org.id as organization_id,
  org.name as organization_name,
  org.region as region,
  (current_date - interval '6 day')::date as report_period_start,
  current_date as report_period_end,
  (select count(*)::bigint from target_base) as target_count,
  (select count(*)::bigint from target_base where lifecycle_status <> 'ended') as active_target_count,
  (select count(*)::bigint from checker_base) as checker_count,
  (select count(*)::bigint from activity_base) as activity_count,
  (
    select count(*)::bigint
    from activity_base
    where checked_at >= now() - interval '7 day'
  ) as recent_activity_count,
  (
    select count(*)::bigint
    from activity_base
    where checked_at::date = current_date
  ) as today_activity_count,
  (select count(*)::bigint from emergency_base) as emergency_count,
  (
    select count(*)::bigint
    from emergency_base
    where status not in ('completed', 'resolved', '완료')
  ) as unresolved_emergency_count,
  (
    select count(*)::bigint
    from emergency_base
    where status in ('completed', 'resolved', '완료')
  ) as completed_emergency_count,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'type', grouped.check_type,
          'count', grouped.count
        )
        order by grouped.count desc, grouped.check_type asc
      )
      from (
        select check_type, count(*)::bigint as count
        from activity_base
        group by check_type
      ) grouped
    ),
    '[]'::jsonb
  ) as activity_by_type,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'status', grouped.status,
          'count', grouped.count
        )
        order by grouped.count desc, grouped.status asc
      )
      from (
        select status, count(*)::bigint as count
        from emergency_base
        group by status
      ) grouped
    ),
    '[]'::jsonb
  ) as emergency_by_status,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'severity', grouped.severity,
          'count', grouped.count
        )
        order by grouped.count desc, grouped.severity asc
      )
      from (
        select severity, count(*)::bigint as count
        from emergency_base
        group by severity
      ) grouped
    ),
    '[]'::jsonb
  ) as emergency_by_severity,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_activity.id,
          'target_id', recent_activity.target_id,
          'target_name', coalesce(target_info.name, '대상자 정보 없음'),
          'checker_id', recent_activity.checker_id,
          'checker_name', coalesce(checker_info.name, '체커 정보 없음'),
          'check_type', recent_activity.check_type,
          'result_status', recent_activity.result_status,
          'checked_at', recent_activity.checked_at
        )
        order by recent_activity.checked_at desc nulls last, recent_activity.created_at desc nulls last
      )
      from (
        select *
        from activity_base
        order by checked_at desc nulls last, created_at desc nulls last
        limit 5
      ) recent_activity
      left join target_base target_info on target_info.id = recent_activity.target_id
      left join checker_base checker_info on checker_info.id = recent_activity.checker_id
    ),
    '[]'::jsonb
  ) as recent_activities,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_emergency.id,
          'target_id', recent_emergency.target_id,
          'target_name', coalesce(target_info.name, '대상자 정보 없음'),
          'title', recent_emergency.title,
          'severity', recent_emergency.severity,
          'status', recent_emergency.status,
          'reported_at', recent_emergency.reported_at
        )
        order by recent_emergency.reported_at desc nulls last
      )
      from (
        select *
        from emergency_base
        order by reported_at desc nulls last
        limit 5
      ) recent_emergency
      left join target_base target_info on target_info.id = recent_emergency.target_id
    ),
    '[]'::jsonb
  ) as recent_emergencies
from organization_row org;
$$;

grant execute on function public.get_public_admin_report_summary(uuid) to anon;
grant execute on function public.get_public_admin_report_summary(uuid) to authenticated;
