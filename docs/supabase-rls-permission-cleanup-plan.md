# Supabase RLS/권한 정리 계획 초안

## 1. 작업 목적

이 문서는 Supabase RLS/권한 감사 결과를 바탕으로 실제 권한 정리 전에 검토할 계획과 SQL 초안을 정리한다.

목적:

- 운영 전 anon/authenticated broad 권한 제거 준비
- 어떤 권한부터 줄일지 우선순위 명확화
- 실제 실행 전 필요한 QA, 백업, 복구 기준 정리
- 단계별 적용을 전제로 한 SQL 초안 제공

중요:

- 이 문서는 계획 문서다.
- 이 단계에서는 SQL을 실행하지 않는다.
- 이 단계에서는 코드, API, DB, RLS policy를 수정하지 않는다.
- 아래 SQL은 모두 실행용 확정본이 아니라 검토용 초안이다.

## 2. 현재 확인된 RLS/policy/grants 상태 요약

사용자가 Supabase SQL Editor에서 확인한 결과 기준:

### RLS 상태

주요 테이블은 모두 `rowsecurity = true` 상태다.

- `public.activity_records`
- `public.admin_reports`
- `public.emergency_handling_logs`
- `public.emergency_reports`
- `public.organizations`
- `public.push_notification_logs`
- `public.push_subscriptions`
- `public.targets`
- `public.users`

### policy 상태

확인된 policy:

- 테이블: `public.users`
- policy: `users_select_own_profile`
- role: `authenticated`
- cmd: `SELECT`
- qual: `auth.uid() = auth_user_id`

그 외 주요 테이블에서는 policy가 확인되지 않은 상태다.

### grants 상태

확인 결과 기준으로 anon/authenticated 권한이 넓게 열려 있다.

특히 아래 테이블에서 anon/authenticated에 broad 권한이 열려 있는 것으로 확인되었다.

- `activity_records`
- `admin_reports`
- `emergency_handling_logs`
- `emergency_reports`
- `organizations`
- `targets`
- `users` SELECT

확인된 broad 권한 후보:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

## 3. 위험도 분류

### 높은 위험

- anon에게 `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`가 열려 있음
- authenticated에게 broad `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`가 열려 있음
- 개인정보성 테이블에 broad `SELECT` 또는 `UPDATE` 권한이 열려 있음
- `users`, `targets`, `admin_reports`에 과도한 권한이 있음
- `organizations`에 broad write 권한이 열려 있음

### 중간 위험

- authenticated `SELECT`가 넓게 열려 있음
- RLS는 enabled지만 policy 설계가 대부분 미완성
- service_role API와 클라이언트 read 경로가 혼재되어 있음
- RLS policy 없이 grants만 넓게 열린 상태

### 낮은 위험

- 주요 write가 service_role 기반 Vercel 서버 API에서 수행되는 구조 자체
- `users_select_own_profile`처럼 자기 프로필만 조회하는 policy
- localStorage fallback을 유지해 read 실패 시 화면 장애를 완화할 수 있는 구조

## 4. 권한 정리 기본 원칙

기본 원칙:

- 클라이언트 직접 write는 허용하지 않는다.
- 주요 write는 Vercel API + service_role로만 수행한다.
- anon/authenticated의 `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`는 원칙적으로 제거한다.
- `SELECT`는 실제 클라이언트 read 경로를 확인한 뒤 최소화한다.
- RLS policy는 조직/역할 기준으로 별도 설계한다.
- 한 번에 모든 권한을 바꾸지 않고 단계별로 적용한다.
- 각 단계 적용 후 QA를 실행한다.

현재 서버 API write 구조:

- `api/activity-records/create.js`
- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`
- `api/targets.js`
- `api/checkers.js`
- `api/reports.js`

## 5. 우선 정리 대상

### 1순위

anon/authenticated의 broad write 권한 제거.

대상 테이블:

- `activity_records`
- `admin_reports`
- `emergency_handling_logs`
- `emergency_reports`
- `organizations`
- `targets`

제거 대상 권한:

- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

### 2순위

개인정보성 테이블의 SELECT 범위 검토.

대상:

- `users`
- `targets`
- `admin_reports`

검토 내용:

- authenticated SELECT가 필요한지
- anon SELECT가 필요한지
- 조직/역할 기준 RLS policy가 있는지
- 기존 클라이언트 Supabase read service가 어떤 테이블을 직접 읽는지

### 3순위

Push 관련 테이블 권한 정리.

대상:

- `push_subscriptions`
- `push_notification_logs`

검토 내용:

- 구독 저장이 클라이언트 직접 insert인지 서버 API인지
- endpoint 정보가 broad SELECT로 노출되는지
- 발송 로그 write가 서버 API로만 수행되는지

## 6. 실행 전 확인할 클라이언트 직접 Supabase 접근 경로

권한 정리 전 아래 패턴을 코드에서 확인한다.

검색 패턴:

- `supabase.from(`
- `.insert(`
- `.update(`
- `.delete(`
- `.select(`
- `.rpc(`
- `VITE_SUPABASE_ANON_KEY`

확인 대상:

- `src/services`
- `src/pages`
- `src/App.jsx`

확인 목적:

- 클라이언트 직접 write가 남아 있는지 확인
- RLS/권한 제거 시 깨질 read service가 있는지 확인
- server API로 이미 대체된 write인지 확인
- anon/authenticated SELECT가 실제로 필요한 테이블인지 확인

## 7. SQL 초안 작성 원칙

아래 SQL은 검토용 초안이다.

주의:

- 이 문서의 SQL을 즉시 실행하지 않는다.
- 실행 전 최신 배포 Ready, 백업, QA 계획을 확인한다.
- SQL 실행은 Supabase SQL Editor에서 수동으로 단계별 적용한다.
- 운영 적용 전 staging 또는 백업 환경에서 먼저 검증한다.
- RLS policy 없이 SELECT까지 제거하면 화면 read가 깨질 수 있으므로 1단계에서는 SELECT를 건드리지 않는다.

## 8. 1단계 권한 정리 SQL 초안

목표:

- anon/authenticated의 write 권한만 먼저 제거
- SELECT 권한은 아직 유지
- service_role/postgres 권한은 유지

대상:

- `activity_records`
- `admin_reports`
- `emergency_handling_logs`
- `emergency_reports`
- `organizations`
- `targets`

SQL 초안:

```sql
-- 검토용 초안: 실행 전 백업/QA 계획 확인 필요

revoke insert, update, delete, truncate on table public.activity_records from anon, authenticated;
revoke insert, update, delete, truncate on table public.admin_reports from anon, authenticated;
revoke insert, update, delete, truncate on table public.emergency_handling_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.emergency_reports from anon, authenticated;
revoke insert, update, delete, truncate on table public.organizations from anon, authenticated;
revoke insert, update, delete, truncate on table public.targets from anon, authenticated;
```

1단계에서 제외:

- `public.users`
- `public.push_subscriptions`
- `public.push_notification_logs`

제외 이유:

- `users`는 로그인/Auth/profile read 흐름과 연결되어 있어 별도 검토 필요
- push 테이블은 구독 저장/발송 로그 흐름을 확인한 뒤 정리 필요

## 9. 1단계 적용 후 확인 SQL

### anon/authenticated write 권한 제거 확인

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'admin_reports',
    'emergency_handling_logs',
    'emergency_reports',
    'organizations',
    'targets'
  )
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
order by table_name, grantee, privilege_type;
```

기대:

- 결과가 0 rows

### SELECT 권한 유지 여부 확인

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'admin_reports',
    'emergency_handling_logs',
    'emergency_reports',
    'organizations',
    'targets'
  )
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT'
order by table_name, grantee;
```

기대:

- 1단계에서는 SELECT가 남아 있을 수 있음
- SELECT 최소화는 2단계에서 별도 검토

### service_role 권한 유지 확인

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'admin_reports',
    'emergency_handling_logs',
    'emergency_reports',
    'organizations',
    'targets'
  )
  and grantee = 'service_role'
order by table_name, privilege_type;
```

기대:

- service_role에 필요한 권한이 유지됨

## 10. 1단계 적용 후 QA

1단계 적용 후 반드시 아래 기능을 확인한다.

주요 write 기능:

- 생활 확인 기록 작성
- 이상징후 보고 작성
- 이상징후 처리 상태 변경
- 대상자 등록/수정/관리종료/재관리시작
- 체커 등록/수정/상태 변경
- 보고서 초안/최종 저장
- 보고서 listReports/getReport read

Push/PWA:

- 이번 1단계 대상에서 push 테이블은 제외했지만, 전체 기능 영향 확인을 위해 push 구독/리마인더도 별도 점검한다.

확인 기준:

- 화면 저장/수정 성공
- API 응답 JSON 정상
- Supabase row 생성/수정 정상
- localStorage fallback 유지
- Vercel Function log에 권한 오류 없음
- `docs/supabase-read-write-qa-checklist.md` 기준 주요 기능 재확인

## 11. 2단계 후보

2단계에서 검토할 내용:

- `users` 권한 정리
- `push_subscriptions` 권한 정리
- `push_notification_logs` 권한 정리
- anon/authenticated SELECT 최소화
- organization/role 기반 RLS policy 설계
- authenticated read policy 설계

검토 포인트:

- 클라이언트 read service가 어떤 테이블을 직접 select하는지
- service_role API로 대체 가능한 read인지
- RLS policy를 만들기 전 SELECT revoke를 해도 화면이 깨지지 않는지
- `users_select_own_profile` policy 유지 여부

## 12. 롤백/복구 초안

문제가 생겼을 때 임시 복구를 위한 GRANT 초안이다.

중요:

- 운영에서는 최소 권한 원칙을 유지해야 한다.
- 아래 SQL은 장애 복구용 임시 초안이며, 실행 전 영향 범위를 확인한다.
- 가능하면 전체 broad 권한 복구보다 필요한 테이블/권한만 제한적으로 복구한다.

임시 복구 SQL 초안:

```sql
-- 검토용 초안: 장애 복구 시 필요한 범위만 선별 실행

grant insert, update, delete, truncate on table public.activity_records to anon, authenticated;
grant insert, update, delete, truncate on table public.admin_reports to anon, authenticated;
grant insert, update, delete, truncate on table public.emergency_handling_logs to anon, authenticated;
grant insert, update, delete, truncate on table public.emergency_reports to anon, authenticated;
grant insert, update, delete, truncate on table public.organizations to anon, authenticated;
grant insert, update, delete, truncate on table public.targets to anon, authenticated;
```

권장 복구 방식:

1. 장애 발생 기능 확인
2. Vercel Function log 확인
3. Supabase 권한 오류인지 확인
4. 필요한 테이블/권한만 임시 복구
5. 기능 복구 확인
6. 다시 최소 권한 설계로 축소

## 13. 이번 단계에서 하지 않는 것

이번 단계에서는 아래 작업을 하지 않는다.

- 실제 SQL 실행
- 코드 수정
- API 수정
- DB 권한 변경
- RLS policy 생성
- RLS policy 삭제
- SELECT 권한 제거
- package.json 수정
- package-lock.json 수정
- vercel.json 수정

또한 이 문서는 실제 권한 정리가 완료되었다고 표현하지 않는다.

## 14. 다음 단계

다음 단계 권장:

1. 클라이언트 직접 Supabase 접근 경로 재확인
2. 1단계 SQL 초안 리뷰
3. 적용 전 최신 Vercel 배포 Ready 확인
4. Supabase 백업 또는 staging 확인
5. 1단계 SQL을 수동 실행
6. 1단계 적용 후 확인 SQL 실행
7. 전체 QA 체크리스트 재실행
8. 문제가 없으면 2단계 users/push/SELECT policy 설계로 이동
