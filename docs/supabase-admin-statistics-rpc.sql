-- 해피통서비스 Supabase 관리자 통계 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 통계 화면 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회하도록 제한이 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 통계 요약만 반환
-- 개인 정보/상세 메모는 제외하고 집계값 위주로 반환

create or replace function public.get_public_admin_statistics(p_organization_id uuid)
returns table (
  organization_id uuid,
  organization_name text,
  target_count bigint,
  active_target_count bigint,
  ended_target_count bigint,
  checker_count bigint,
  activity_count bigint,
  recent_activity_count bigint,
  today_activity_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint,
  completed_emergency_count bigint,
  normal_target_count bigint,
  caution_target_count bigint,
  high_risk_target_count bigint,
  activity_by_type jsonb,
  activity_by_result jsonb,
  emergency_by_status jsonb,
  emergency_by_severity jsonb,
  daily_activity_counts jsonb
)
language sql
stable
security definer
set search_path = public
as $$
with organization_row as (
  select o.id, o.name
  from public.organizations o
  where o.id = p_organization_id
),
target_base as (
  select
    t.id,
    coalesce(to_jsonb(t)->>'lifecycle_status', 'active') as lifecycle_status,
    coalesce(to_jsonb(t)->>'risk_level', 'normal') as risk_level
  from public.targets t
  where t.organization_id = p_organization_id
),
activity_base as (
  select
    ar.id,
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
    coalesce(to_jsonb(er)->>'status', 'received') as status,
    coalesce(
      to_jsonb(er)->>'severity',
      to_jsonb(er)->>'risk_level',
      'caution'
    ) as severity
  from public.emergency_reports er
  where er.organization_id = p_organization_id
),
daily_activity_source as (
  select generate_series(current_date - interval '6 day', current_date, interval '1 day')::date as day
),
daily_activity_counts as (
  select
    das.day,
    count(ab.id)::bigint as count
  from daily_activity_source das
  left join activity_base ab on ab.checked_at::date = das.day
  group by das.day
  order by das.day asc
)
select
  org.id as organization_id,
  org.name as organization_name,
  (select count(*)::bigint from target_base) as target_count,
  (select count(*)::bigint from target_base where lifecycle_status <> 'ended') as active_target_count,
  (select count(*)::bigint from target_base where lifecycle_status = 'ended') as ended_target_count,
  (
    select count(*)::bigint
    from public.users u
    where u.organization_id = p_organization_id
      and u.role = 'checker'
  ) as checker_count,
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
  (select count(*)::bigint from target_base where risk_level in ('normal', '정상')) as normal_target_count,
  (select count(*)::bigint from target_base where risk_level in ('caution', '주의')) as caution_target_count,
  (select count(*)::bigint from target_base where risk_level in ('high', 'urgent', 'danger', '위험', '긴급')) as high_risk_target_count,
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
          'status', grouped.result_status,
          'count', grouped.count
        )
        order by grouped.count desc, grouped.result_status asc
      )
      from (
        select result_status, count(*)::bigint as count
        from activity_base
        group by result_status
      ) grouped
    ),
    '[]'::jsonb
  ) as activity_by_result,
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
          'date', to_char(day, 'YYYY-MM-DD'),
          'count', count
        )
        order by day asc
      )
      from daily_activity_counts
    ),
    '[]'::jsonb
  ) as daily_activity_counts
from organization_row org;
$$;

grant execute on function public.get_public_admin_statistics(uuid) to anon;
grant execute on function public.get_public_admin_statistics(uuid) to authenticated;
