# 관리자 RPC EXECUTE 제거 준비 확인

## 1. 작업 목적

관리자 조직 단위 `get_public_admin_*` RPC 6개에 대해 `PUBLIC` / `anon` EXECUTE 제거 전 최종 준비 상태를 확인한다.

이번 단계는 확인/문서화만 수행한다. 코드, API, DB, SQL, RLS, Auth 설정은 수정하지 않았고, RPC 권한 revoke도 실행하지 않았다.

## 2. 확인 대상 RPC

- `get_public_admin_dashboard(p_organization_id uuid)`
- `get_public_admin_targets(p_organization_id uuid)`
- `get_public_admin_emergencies(p_organization_id uuid)`
- `get_public_admin_activity_records(p_organization_id uuid)`
- `get_public_admin_statistics(p_organization_id uuid)`
- `get_public_admin_report_summary(p_organization_id uuid)`

## 3. src 직접 호출 잔여 확인

검색 문자열:

- `get_public_admin_dashboard`
- `get_public_admin_targets`
- `get_public_admin_emergencies`
- `get_public_admin_activity_records`
- `get_public_admin_statistics`
- `get_public_admin_report_summary`

확인 결과:

- `src` 내부에서는 위 6개 RPC 문자열이 발견되지 않았다.
- `src` 화면/서비스에서 해당 RPC를 직접 호출하는 경로는 제거된 것으로 판단된다.
- 해당 RPC 문자열은 `api/admin-read.js` 내부 service_role 기반 호출에만 남아 있다.

## 4. 지정 service 직접 RPC 제거 확인

확인 대상 파일:

- `src/services/supabaseAdminDashboardService.js`
- `src/services/supabaseAdminTargetsService.js`
- `src/services/supabaseAdminEmergenciesService.js`
- `src/services/supabaseAdminActivityRecordsService.js`
- `src/services/supabaseAdminStatisticsService.js`
- `src/services/supabaseAdminReportSummaryService.js`

확인 결과:

- 위 6개 service에서 `.rpc(` 검색 결과 없음
- 위 6개 service에서 `get_public_admin_` 검색 결과 없음
- 각 service는 `/api/admin-read` fetch 호출로 전환되어 있다.

## 5. `api/admin-read` 내부 RPC 호출 확인

`api/admin-read.js`에는 아래 RPC 호출이 남아 있다. 이는 service_role 기반 서버 API 내부 호출이므로 정상이다.

- `get_public_admin_dashboard`
- `get_public_admin_targets`
- `get_public_admin_emergencies`
- `get_public_admin_activity_records`
- `get_public_admin_statistics`
- `get_public_admin_report_summary`

확인 내용:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 환경변수로 서버 Supabase client 생성
- request body 전체 로그 없음
- service_role key 출력 없음
- 오류 로그는 `[admin-read-api]`, code, message 수준의 `console.warn`만 사용

## 6. `adminPages` 화면 흐름 확인

`src/pages/adminPages.jsx`는 직접 `supabase.rpc`를 호출하지 않는다.

확인된 service 호출 흐름:

- `AdminDashboard` → `getSupabaseAdminDashboard`
- `AdminTargets` → `getSupabaseAdminTargets`
- `AdminTargetDetail` → `getSupabaseAdminTargetById`
- `AdminActivities` → `getSupabaseAdminActivityRecords`
- `AdminEmergencies` → `getSupabaseAdminEmergencies`
- `AdminEmergencyDetail` → `getSupabaseAdminEmergencyById`
- `AdminReportNew` → `getSupabaseAdminReportSummary`
- `AdminStatistics` → `getSupabaseAdminStatistics`

위 service들은 `/api/admin-read` 또는 해당 service의 상세 helper를 통해 데이터를 읽는다.

## 7. 권한 제거 가능성 판단

현재 기준으로 관리자 조직 단위 RPC 6개의 `PUBLIC` / `anon` EXECUTE 제거를 검토할 수 있는 상태로 판단된다.

판단 근거:

- `src`에서 해당 6개 RPC 직접 호출 없음
- 지정 6개 service의 직접 `.rpc(` 호출 제거 확인
- `api/admin-read.js`에서만 service_role으로 RPC 호출
- `adminPages.jsx`는 service 함수만 호출
- 관리자 화면 fallback 유지
- 배포 후 `/api/admin-read` smoke test 통과 기록 있음

주의:

- 이번 문서는 준비 상태 확인이며 실제 권한 제거를 수행한 것은 아니다.
- 권한 제거 후에는 `/api/admin-read` smoke test와 관리자 화면 QA를 반드시 수행해야 한다.
- `authenticated` EXECUTE는 이번 단계 대상이 아니다.

## 8. 실행 예정 SQL 초안

아래 SQL은 실행하지 않은 초안이다.

대상:

- `PUBLIC`
- `anon`

대상 아님:

- `authenticated`
- `postgres`
- `service_role`

```sql
revoke execute on function public.get_public_admin_dashboard(uuid) from public, anon;
revoke execute on function public.get_public_admin_targets(uuid) from public, anon;
revoke execute on function public.get_public_admin_emergencies(uuid) from public, anon;
revoke execute on function public.get_public_admin_activity_records(uuid) from public, anon;
revoke execute on function public.get_public_admin_statistics(uuid) from public, anon;
revoke execute on function public.get_public_admin_report_summary(uuid) from public, anon;
```

## 9. 확인 SQL 초안

실행 후 권한 상태를 확인하기 위한 SQL 초안이다.

기대 결과:

- 위 6개 RPC에 대해 `PUBLIC`, `anon` EXECUTE가 없어야 한다.
- `authenticated`, `service_role`, `postgres`는 아직 남아 있을 수 있다.

```sql
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_public_admin_dashboard',
    'get_public_admin_targets',
    'get_public_admin_emergencies',
    'get_public_admin_activity_records',
    'get_public_admin_statistics',
    'get_public_admin_report_summary'
  )
order by routine_name, grantee;
```

함수 signature 확인용 SQL:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_public_admin_dashboard',
    'get_public_admin_targets',
    'get_public_admin_emergencies',
    'get_public_admin_activity_records',
    'get_public_admin_statistics',
    'get_public_admin_report_summary'
  )
order by p.proname;
```

## 10. 롤백 SQL 초안

문제 발생 시 임시 복구용 SQL 초안이다.

주의:

- 아래 grant는 임시 복구용이다.
- 운영 전에는 다시 제거해야 한다.
- 화면/API 장애 원인을 확인한 뒤 재적용 여부를 결정해야 한다.

```sql
grant execute on function public.get_public_admin_dashboard(uuid) to public, anon;
grant execute on function public.get_public_admin_targets(uuid) to public, anon;
grant execute on function public.get_public_admin_emergencies(uuid) to public, anon;
grant execute on function public.get_public_admin_activity_records(uuid) to public, anon;
grant execute on function public.get_public_admin_statistics(uuid) to public, anon;
grant execute on function public.get_public_admin_report_summary(uuid) to public, anon;
```

## 11. 권장 다음 단계

1. 이 문서 확인 후 사용자가 승인하면 Supabase SQL Editor에서 `PUBLIC` / `anon` EXECUTE revoke 실행
2. 실행 직후 확인 SQL 수행
3. `/api/admin-read` smoke test 재수행
4. `admin / 1234` 로그인 후 관리자 화면 QA 수행
5. 문제 발생 시 롤백 SQL을 임시 적용하고 원인 확인
6. 이후 체커 단위 RPC 서버 API 전환 계획으로 이동

## 12. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 수정하지 않음
- DB/SQL/RLS/Auth 수정하지 않음
- 실제 revoke 실행하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
- 권한 정리를 완료했다고 판단하지 않음
