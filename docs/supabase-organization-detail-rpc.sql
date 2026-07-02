-- 해피통서비스 Supabase 총관리자 기관 상세 RPC
-- docs/supabase-schema.sql, docs/supabase-seed.sql 실행 후 사용
-- 총관리자 기관 상세 화면 읽기 전용 테스트용
-- 개별 민감 정보를 과도하게 공개하지 않고 기관 운영 요약만 반환
-- 실제 운영 전 RLS/Auth 정책 검토가 필요합니다.
-- checkers.phone은 현재 seed 확인용으로 포함하며, 실제 운영 전 노출 정책 검토가 필요합니다.

create or replace function public.get_public_organization_detail(p_organization_id uuid)
returns table (
  id uuid,
  name text,
  region text,
  admin_name text,
  status text,
  memo text,
  target_count bigint,
  checker_count bigint,
  emergency_count bigint,
  unresolved_emergency_count bigint,
  recent_emergencies jsonb,
  recent_activity_records jsonb,
  checkers jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.region,
    o.admin_name,
    coalesce(o.status, 'active') as status,
    o.memo,
    (
      select count(*)
      from public.targets t
      where t.organization_id = o.id
        and coalesce(t.lifecycle_status, 'active') <> 'ended'
    ) as target_count,
    (
      select count(*)
      from public.users u
      where u.organization_id = o.id
        and u.role = 'checker'
    ) as checker_count,
    (
      select count(*)
      from public.emergency_reports e
      where e.organization_id = o.id
    ) as emergency_count,
    (
      select count(*)
      from public.emergency_reports e
      where e.organization_id = o.id
        and coalesce(e.status, 'received') not in ('completed', 'resolved', '완료')
    ) as unresolved_emergency_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'target_id', e.target_id,
            'target_name', t.name,
            'title', e.title,
            'severity', e.severity,
            'status', e.status,
            'reported_at', e.reported_at
          )
          order by e.reported_at desc
        )
        from (
          select *
          from public.emergency_reports
          where organization_id = o.id
          order by reported_at desc
          limit 5
        ) e
        left join public.targets t on t.id = e.target_id
      ),
      '[]'::jsonb
    ) as recent_emergencies,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ar.id,
            'target_id', ar.target_id,
            'target_name', t.name,
            'checker_id', ar.checker_id,
            'checker_name', u.name,
            'check_type', coalesce(
              to_jsonb(ar)->>'check_type',
              to_jsonb(ar)->>'type',
              to_jsonb(ar)->>'method',
              'phone'
            ),
            'result_status', coalesce(
              to_jsonb(ar)->>'result_status',
              to_jsonb(ar)->>'status',
              to_jsonb(ar)->>'result',
              to_jsonb(ar)->>'condition_status',
              'normal'
            ),
            'checked_at', ar.checked_at
          )
          order by ar.checked_at desc
        )
        from (
          select ar.*
          from public.activity_records ar
          left join public.targets t2 on t2.id = ar.target_id
          where t2.organization_id = o.id
          order by ar.checked_at desc
          limit 5
        ) ar
        left join public.targets t on t.id = ar.target_id
        left join public.users u on u.id = ar.checker_id
      ),
      '[]'::jsonb
    ) as recent_activity_records,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'status', coalesce(
              to_jsonb(u)->>'status',
              'active'
            ),
            'phone', coalesce(
              to_jsonb(u)->>'phone',
              to_jsonb(u)->>'phone_number',
              ''
            )
          )
          order by u.name asc
        )
        from (
          select *
          from public.users
          where organization_id = o.id
            and role = 'checker'
          order by name asc
          limit 10
        ) u
      ),
      '[]'::jsonb
    ) as checkers
  from public.organizations o
  where o.id = p_organization_id;
$$;

grant execute on function public.get_public_organization_detail(uuid) to anon;
grant execute on function public.get_public_organization_detail(uuid) to authenticated;