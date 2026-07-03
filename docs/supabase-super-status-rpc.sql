-- 해피통서비스 Supabase 총관리자 운영 상태 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 총관리자 운영 상태 화면 읽기 전용 테스트용
-- 개별 민감 정보를 과도하게 공개하지 않고 기관별 운영 리스크 요약만 반환
-- 실제 운영 시 RLS/Auth 정책 검토가 필요

create or replace function public.get_public_super_status_summaries()
returns table (
  organization_id uuid,
  organization_name text,
  region text,
  status text,
  admin_name text,
  target_count bigint,
  checker_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint,
  recent_activity_count bigint,
  last_activity_at timestamptz,
  last_emergency_at timestamptz,
  risk_level text,
  risk_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with organization_base as (
    select
      o.id,
      o.name,
      o.region,
      coalesce(o.status, 'active') as status,
      o.admin_name
    from public.organizations o
  ),
  active_target_counts as (
    select
      t.organization_id,
      count(*)::bigint as target_count
    from public.targets t
    where coalesce(t.lifecycle_status, 'active') <> 'ended'
    group by t.organization_id
  ),
  checker_counts as (
    select
      u.organization_id,
      count(*)::bigint as checker_count
    from public.users u
    where u.role = 'checker'
    group by u.organization_id
  ),
  emergency_counts as (
    select
      e.organization_id,
      count(*)::bigint as emergency_count,
      count(*) filter (
        where coalesce(e.status, 'received') not in ('completed', 'resolved', '완료')
      )::bigint as unresolved_emergency_count,
      max(e.reported_at) as last_emergency_at
    from public.emergency_reports e
    group by e.organization_id
  ),
  recent_activity_counts as (
    select
      t.organization_id,
      count(*)::bigint as recent_activity_count
    from public.activity_records ar
    join public.targets t on t.id = ar.target_id
    where coalesce(t.lifecycle_status, 'active') <> 'ended'
      and ar.checked_at >= now() - interval '7 days'
    group by t.organization_id
  ),
  last_activity as (
    select
      t.organization_id,
      max(ar.checked_at) as last_activity_at
    from public.activity_records ar
    join public.targets t on t.id = ar.target_id
    where coalesce(t.lifecycle_status, 'active') <> 'ended'
    group by t.organization_id
  )
  select
    ob.id as organization_id,
    ob.name as organization_name,
    ob.region,
    ob.status,
    ob.admin_name,
    coalesce(atc.target_count, 0) as target_count,
    coalesce(cc.checker_count, 0) as checker_count,
    coalesce(ec.emergency_count, 0) as emergency_count,
    coalesce(ec.unresolved_emergency_count, 0) as unresolved_emergency_count,
    coalesce(rac.recent_activity_count, 0) as recent_activity_count,
    la.last_activity_at,
    ec.last_emergency_at,
    case
      when coalesce(ec.unresolved_emergency_count, 0) >= 3 then 'high'
      when coalesce(rac.recent_activity_count, 0) = 0 and coalesce(atc.target_count, 0) >= 1 then 'high'
      when coalesce(ec.unresolved_emergency_count, 0) >= 1 then 'medium'
      when coalesce(rac.recent_activity_count, 0) < coalesce(atc.target_count, 0)
        and coalesce(atc.target_count, 0) > 0 then 'medium'
      else 'low'
    end as risk_level,
    case
      when coalesce(ec.unresolved_emergency_count, 0) >= 3 then '미처리 이상징후가 많습니다.'
      when coalesce(rac.recent_activity_count, 0) = 0 and coalesce(atc.target_count, 0) >= 1 then '최근 생활 확인 기록이 없습니다.'
      when coalesce(ec.unresolved_emergency_count, 0) >= 1 then '미처리 이상징후가 남아 있습니다.'
      when coalesce(rac.recent_activity_count, 0) < coalesce(atc.target_count, 0)
        and coalesce(atc.target_count, 0) > 0 then '최근 생활 확인 기록이 대상자 수보다 적습니다.'
      else '운영 상태가 안정적입니다.'
    end as risk_reason
  from organization_base ob
  left join active_target_counts atc on atc.organization_id = ob.id
  left join checker_counts cc on cc.organization_id = ob.id
  left join emergency_counts ec on ec.organization_id = ob.id
  left join recent_activity_counts rac on rac.organization_id = ob.id
  left join last_activity la on la.organization_id = ob.id
  order by
    case
      when coalesce(ec.unresolved_emergency_count, 0) >= 3 then 1
      when coalesce(rac.recent_activity_count, 0) = 0 and coalesce(atc.target_count, 0) >= 1 then 1
      when coalesce(ec.unresolved_emergency_count, 0) >= 1 then 2
      when coalesce(rac.recent_activity_count, 0) < coalesce(atc.target_count, 0)
        and coalesce(atc.target_count, 0) > 0 then 2
      else 3
    end,
    coalesce(ec.unresolved_emergency_count, 0) desc,
    ob.name asc;
$$;

grant execute on function public.get_public_super_status_summaries() to anon;
grant execute on function public.get_public_super_status_summaries() to authenticated;
