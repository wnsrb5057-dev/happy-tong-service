-- 해피통서비스 Supabase 관리자 대시보드 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 대시보드 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회되도록 제한 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 요약만 반환

create or replace function public.get_public_admin_dashboard(p_organization_id uuid)
returns table (
  organization_id uuid,
  organization_name text,
  target_count bigint,
  checker_count bigint,
  today_activity_count bigint,
  recent_activity_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint,
  recent_activities jsonb,
  recent_emergencies jsonb
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
  active_targets as (
    select t.id, t.organization_id, t.name
    from public.targets t
    where t.organization_id = p_organization_id
      and coalesce(t.lifecycle_status, 'active') <> 'ended'
  ),
  checker_rows as (
    select u.id, u.name
    from public.users u
    where u.organization_id = p_organization_id
      and u.role = 'checker'
  ),
  activity_base as (
    select
      ar.id,
      ar.target_id,
      at.name as target_name,
      ar.checker_id,
      u.name as checker_name,
      coalesce(
        to_jsonb(ar)->>'check_type',
        to_jsonb(ar)->>'type',
        'visit'
      ) as check_type,
      coalesce(
        to_jsonb(ar)->>'result_status',
        to_jsonb(ar)->>'status',
        'normal'
      ) as result_status,
      ar.checked_at
    from public.activity_records ar
    join active_targets at on at.id = ar.target_id
    left join public.users u on u.id = ar.checker_id
  ),
  emergency_base as (
    select
      er.id,
      er.target_id,
      at.name as target_name,
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
      coalesce(
        to_jsonb(er)->>'status',
        'received'
      ) as status,
      er.reported_at
    from public.emergency_reports er
    left join active_targets at on at.id = er.target_id
    where er.organization_id = p_organization_id
  )
  select
    org.id as organization_id,
    org.name as organization_name,
    (select count(*)::bigint from active_targets) as target_count,
    (select count(*)::bigint from checker_rows) as checker_count,
    (
      select count(*)::bigint
      from activity_base ab
      where ab.checked_at::date = current_date
    ) as today_activity_count,
    (
      select count(*)::bigint
      from activity_base ab
      where ab.checked_at >= now() - interval '7 days'
    ) as recent_activity_count,
    (select count(*)::bigint from emergency_base) as emergency_count,
    (
      select count(*)::bigint
      from emergency_base eb
      where coalesce(eb.status, 'received') not in ('completed', 'resolved', '완료')
    ) as unresolved_emergency_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ab.id,
            'target_id', ab.target_id,
            'target_name', ab.target_name,
            'checker_id', ab.checker_id,
            'checker_name', ab.checker_name,
            'check_type', ab.check_type,
            'result_status', ab.result_status,
            'checked_at', ab.checked_at
          )
          order by ab.checked_at desc
        )
        from (
          select *
          from activity_base
          order by checked_at desc
          limit 5
        ) ab
      ),
      '[]'::jsonb
    ) as recent_activities,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', eb.id,
            'target_id', eb.target_id,
            'target_name', eb.target_name,
            'title', eb.title,
            'severity', eb.severity,
            'status', eb.status,
            'reported_at', eb.reported_at
          )
          order by eb.reported_at desc
        )
        from (
          select *
          from emergency_base
          order by reported_at desc
          limit 5
        ) eb
      ),
      '[]'::jsonb
    ) as recent_emergencies
  from organization_row org;
$$;

grant execute on function public.get_public_admin_dashboard(uuid) to anon;
grant execute on function public.get_public_admin_dashboard(uuid) to authenticated;
