-- 해피통서비스 Supabase 관리자 이상징후 목록 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 관리자 이상징후 목록 읽기 전용 테스트용
-- 실제 운영 전에는 Supabase Auth/RLS로 본인 기관만 조회하도록 제한이 필요
-- 현재 MVP 단계에서는 p_organization_id를 명시적으로 받아 해당 기관 이상징후 요약만 반환
-- description, handling memo, 연락처 등 민감/상세 필드는 이번 RPC에서 최소 범위만 반환

create or replace function public.get_public_admin_emergencies(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  target_id uuid,
  target_name text,
  target_address text,
  checker_id uuid,
  checker_name text,
  title text,
  severity text,
  status text,
  reported_at timestamptz,
  last_handling_status text,
  last_handling_memo text,
  handled_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with emergency_base as (
    select
      er.id,
      er.organization_id,
      er.target_id,
      t.name as target_name,
      t.address as target_address,
      er.checker_id,
      u.name as checker_name,
      coalesce(
        to_jsonb(er)->>'title',
        to_jsonb(er)->>'issue_type',
        to_jsonb(er)->>'type',
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
      er.reported_at,
      coalesce(er.created_at, er.reported_at) as created_at
    from public.emergency_reports er
    left join public.targets t on t.id = er.target_id
    left join public.users u on u.id = er.checker_id
    where er.organization_id = p_organization_id
  )
  select
    eb.id,
    eb.organization_id,
    eb.target_id,
    eb.target_name,
    eb.target_address,
    eb.checker_id,
    eb.checker_name,
    eb.title,
    eb.severity,
    eb.status,
    eb.reported_at,
    log_data.last_handling_status,
    log_data.last_handling_memo,
    log_data.handled_at,
    eb.created_at
  from emergency_base eb
  left join lateral (
    select
      to_jsonb(ehl)->>'status' as last_handling_status,
      to_jsonb(ehl)->>'memo' as last_handling_memo,
      coalesce(
        nullif(to_jsonb(ehl)->>'handled_at', '')::timestamptz,
        ehl.created_at
      ) as handled_at
    from public.emergency_handling_logs ehl
    where ehl.organization_id = p_organization_id
      and ehl.emergency_report_id = eb.id
    order by ehl.created_at desc
    limit 1
  ) log_data on true
  order by
    case when coalesce(eb.status, 'received') in ('completed', 'resolved', '완료') then 1 else 0 end asc,
    case when coalesce(eb.severity, 'caution') in ('urgent', 'high') then 0 else 1 end asc,
    eb.reported_at desc;
$$;

grant execute on function public.get_public_admin_emergencies(uuid) to anon;
grant execute on function public.get_public_admin_emergencies(uuid) to authenticated;
