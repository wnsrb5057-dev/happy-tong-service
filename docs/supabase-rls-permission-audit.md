# Supabase RLS/권한 감사 체크리스트

## 1. 작업 목적

RLS, policy, grants 정리에 들어가기 전에 현재 Supabase DB 권한 상태와 위험 요소를 확인한다.

이 문서의 목적:

- 주요 테이블의 RLS 활성화 여부 확인
- policy와 grants 상태 확인
- anon/authenticated/service_role 권한 범위 확인
- FK/CHECK 제약조건 확인
- 현재 서버 API와 테이블 사용 관계 정리
- 실제 수정 전 SELECT 전용 점검 SQL 제공

이번 단계는 감사 문서 작성만 수행한다. 실제 권한 정리, RLS 변경, policy 생성/삭제, grant/revoke는 하지 않는다.

## 2. 현재 Supabase 접근 구조

현재 원칙:

- 주요 write는 서버 API route에서 service_role client로 수행
- 클라이언트에서 직접 insert/update하지 않는 구조를 목표로 함
- 기존 localStorage fallback 유지
- RLS/policy/grants 정리는 마지막 단계로 보류
- Supabase Auth 계정 자동 생성은 아직 하지 않음

서버 API 기반 write/read:

- `api/activity-records/create.js`
- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`
- `api/targets.js`
- `api/checkers.js`
- `api/reports.js`
- `api/push/subscribe.js`
- `api/push/test-send.js`
- `api/push/send-checker-reminders.js`
- `api/cron/checker-reminders.js`

클라이언트 Supabase read service 후보:

- `supabaseAdminActivityRecordsService.js`
- `supabaseAdminDashboardService.js`
- `supabaseAdminEmergenciesService.js`
- `supabaseAdminReportsReadService.js`
- `supabaseAdminReportSummaryService.js`
- `supabaseAdminStatisticsService.js`
- `supabaseAdminTargetsService.js`
- `supabaseCheckerActivityFormTargetsService.js`
- `supabaseCheckerActivityHistoryService.js`
- `supabaseCheckerHomeService.js`
- `supabaseCheckerTargetsService.js`
- `supabaseOrganizationDetailService.js`
- `supabaseOrganizationSummaryService.js`
- `supabaseRecentEmergencyService.js`
- `supabaseSuperDashboardKpiService.js`
- `supabaseSuperStatusService.js`

위 service들은 RLS/권한 정리 전에 실제 anon/authenticated 권한 필요 여부를 다시 확인해야 한다.

## 3. 주요 API와 사용 테이블

| API | 주요 목적 | 관련 테이블 |
| --- | --- | --- |
| `api/activity-records/create.js` | 생활 확인 기록 생성 | `activity_records`, `organizations`, `targets`, `users` |
| `api/emergency-reports/create.js` | 이상징후 보고 생성 | `emergency_reports`, `emergency_handling_logs`, `organizations`, `targets`, `users` |
| `api/emergency-reports/update-status.js` | 이상징후 처리 상태 변경 | `emergency_reports`, `emergency_handling_logs` |
| `api/targets.js` | 대상자 생성/수정/상태 변경 | `targets`, `organizations`, `users` |
| `api/checkers.js` | 체커 생성/수정/상태 변경 | `users`, `organizations` |
| `api/reports.js` | 보고서 저장/read | `admin_reports`, `organizations`, `users` |
| `api/push/subscribe.js` | push 구독 저장 | `push_subscriptions` |
| `api/push/test-send.js` | push 테스트 발송 | `push_subscriptions`, `push_notification_logs` |
| `api/push/send-checker-reminders.js` | 체커 리마인더 발송 | `push_subscriptions`, `push_notification_logs`, 기타 read 테이블 |
| `api/cron/checker-reminders.js` | cron 리마인더 | `push_subscriptions`, `push_notification_logs`, 기타 read 테이블 |

## 4. 주요 테이블별 점검 항목

대상 테이블:

- `public.organizations`
- `public.users`
- `public.targets`
- `public.activity_records`
- `public.emergency_reports`
- `public.emergency_handling_logs`
- `public.admin_reports`
- `public.push_subscriptions`
- `public.push_notification_logs`

각 테이블별 확인 항목:

- RLS enabled 여부
- policy 존재 여부
- anon grants
- authenticated grants
- service_role grants
- FK 구조
- CHECK 제약조건
- 현재 사용 API
- 클라이언트 직접 접근 여부

개인정보성 테이블 우선 점검:

- `users`
- `targets`
- `activity_records`
- `emergency_reports`
- `admin_reports`
- `push_subscriptions`

## 5. SELECT 전용 SQL 체크리스트

주의: 아래 SQL은 SELECT 전용이다. `ALTER`, `CREATE`, `DROP`, `REVOKE`, `GRANT`, `UPDATE`, `DELETE`를 실행하지 않는다.

### A. public 테이블 목록

```sql
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

### B. RLS 상태

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by tablename;
```

### C. policy 목록

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by tablename, policyname;
```

### D. grants 목록

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by table_name, grantee, privilege_type;
```

### E. 컬럼 구조

```sql
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by table_name, ordinal_position;
```

### F. FK/CHECK/PK 제약조건

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by c.relname, con.contype, con.conname;
```

### G. RPC/function 목록

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

### H. 각 테이블 row count

```sql
select 'organizations' as table_name, count(*) as row_count from public.organizations
union all
select 'users', count(*) from public.users
union all
select 'targets', count(*) from public.targets
union all
select 'activity_records', count(*) from public.activity_records
union all
select 'emergency_reports', count(*) from public.emergency_reports
union all
select 'emergency_handling_logs', count(*) from public.emergency_handling_logs
union all
select 'admin_reports', count(*) from public.admin_reports
union all
select 'push_subscriptions', count(*) from public.push_subscriptions
union all
select 'push_notification_logs', count(*) from public.push_notification_logs;
```

### I. anon/authenticated에 열린 INSERT/UPDATE/DELETE 권한

```sql
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  and table_name in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by table_name, grantee, privilege_type;
```

### J. service_role 권한 확인

```sql
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'service_role'
  and table_name in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by table_name, privilege_type;
```

### K. anon/authenticated SELECT 권한 확인

```sql
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT'
  and table_name in (
    'organizations',
    'users',
    'targets',
    'activity_records',
    'emergency_reports',
    'emergency_handling_logs',
    'admin_reports',
    'push_subscriptions',
    'push_notification_logs'
  )
order by table_name, grantee;
```

## 6. 위험도 판단 기준

### 높은 위험

- anon에게 `INSERT`, `UPDATE`, `DELETE`가 열려 있음
- authenticated에게 불필요한 broad `INSERT`, `UPDATE`, `DELETE`가 열려 있음
- RLS enabled이지만 policy가 없거나 grants가 과도하게 열려 있음
- `users`, `targets` 같은 개인정보성 테이블에 broad `SELECT`/`UPDATE` 권한
- `push_subscriptions` endpoint가 넓게 노출됨
- `push_notification_logs`에 broad write 권한

### 중간 위험

- authenticated `SELECT`가 넓게 열려 있음
- RLS는 켜져 있으나 조직/역할 기준 policy 설계가 미완성
- service_role API와 클라이언트 direct read 경로가 혼재
- RPC가 organization/role 필터 없이 넓은 데이터를 반환함

### 낮은 위험

- write는 service_role 서버 API에서만 수행
- 클라이언트는 필요한 read만 수행
- RLS policy가 역할/조직 기준으로 제한됨
- 개인정보성 테이블은 최소 권한 원칙 적용
- push endpoint는 사용자 본인 또는 서버 API 기준으로 제한됨

## 7. 우선 정리 대상 후보

우선 점검 권장:

1. `public.users`
2. `public.targets`
3. `public.activity_records`
4. `public.emergency_reports`
5. `public.admin_reports`
6. `public.push_subscriptions`
7. `public.push_notification_logs`
8. `public.emergency_handling_logs`
9. `public.organizations`

이유:

- `users`, `targets`는 개인정보와 조직 권한에 직접 연결됨
- `activity_records`, `emergency_reports`는 생활/이상징후 민감 데이터 포함
- `admin_reports`는 운영 보고서와 작성자 추적 포함
- push 테이블은 endpoint와 발송 로그 보호가 필요

## 8. 권한 정리 추천 순서

추천 순서:

1. 현재 기능이 사용하는 read/write 경로 확정
2. 클라이언트 직접 Supabase 접근 service 목록 확인
3. anon/authenticated broad write 권한 제거 계획 수립
4. `users`, `targets`, `admin_reports` 등 개인정보성 테이블 우선 점검
5. `push_subscriptions`, `push_notification_logs` 점검
6. 조직/역할 기준 RLS policy 설계
7. staging 또는 백업 후 적용
8. `docs/supabase-read-write-qa-checklist.md` 기준 QA 재실행

## 9. 이번 단계에서 하지 않는 것

이번 단계에서는 아래 작업을 하지 않는다.

- 코드 수정
- API 수정
- DB/SQL/RLS/Auth 수정
- `ALTER POLICY`
- `CREATE POLICY`
- `DROP POLICY`
- `REVOKE`
- `GRANT`
- `UPDATE`
- `DELETE`
- package.json 수정
- package-lock.json 수정
- vercel.json 수정
- 기존 문서 삭제

실제 권한 정리는 이 문서의 SELECT 결과를 확인한 뒤 후속 단계에서 진행한다.

## 10. 다음 단계

다음 단계:

1. Supabase SQL Editor에서 이 문서의 SELECT SQL 실행
2. 결과를 그대로 붙여넣어 현재 권한 상태 공유
3. 테이블별 위험도 분류
4. 실제 RLS/policy/grants 정리 계획 작성
5. 적용 전 백업 또는 staging 확인
6. 적용 후 전체 QA 재실행

특히 anon/authenticated의 write 권한과 개인정보성 테이블의 broad SELECT 권한을 우선 확인한다.
