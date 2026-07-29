# Supabase Direct Table SELECT Audit

## 1. 작업 목적

Supabase SELECT 권한/RLS 정리에 들어가기 전, 클라이언트 `src` 코드에 남아 있는 직접 table SELECT 경로를 확인한다.

이번 단계는 감사/문서화 단계이며, 코드 수정, API 수정, DB/RLS/Auth 수정, SELECT 권한 revoke는 하지 않는다.

## 2. 현재 보안 정리 상태

완료된 작업:

1. 주요 테이블 `anon`/`authenticated` write 권한 제거
2. 높은 위험 총관리자/기관성 RPC 6개 `/api/super` 전환
3. 높은 위험 RPC 6개 `PUBLIC`/`anon` EXECUTE 제거
4. 관리자 조직 단위 RPC 6개 `/api/admin-read` 전환
5. 관리자 RPC 6개 `PUBLIC`/`anon` EXECUTE 제거
6. 체커 단위 RPC 4개 `/api/checkers` 통합 전환
7. 체커 RPC 4개 `PUBLIC`/`anon` EXECUTE 제거
8. Vercel Hobby Serverless Functions 개수 제한 대응 완료

남은 큰 보안 과제:

- 직접 table SELECT 권한/RLS 정리
- `users` read와 로그인/currentUser 구조 정리
- 직접 table SELECT를 서버 API 또는 제한된 RLS policy로 전환

## 3. 감사 대상과 검색 기준

확인 대상:

- `src/services`
- `src/pages`
- `src/App.jsx`
- `src/utils`
- `api`

검색 기준:

- `supabase.from(`
- `.select(`
- `.single(`
- `.maybeSingle(`
- `.limit(`
- `.eq(`
- 주요 테이블명:
  - `users`
  - `organizations`
  - `targets`
  - `activity_records`
  - `emergency_reports`
  - `emergency_handling_logs`
  - `admin_reports`
  - `push_subscriptions`
  - `push_notification_logs`

중요 구분:

- `api` 내부 service_role SELECT는 정상 서버 경로로 분류한다.
- 이번 감사의 핵심은 `src` 클라이언트에서 `VITE_SUPABASE_ANON_KEY` 기반 client로 직접 table SELECT를 수행하는 경로다.

## 4. 클라이언트 직접 table select 전체 목록

### `src/services/authService.js`

함수:

- `authenticateSupabaseUser`

직접 SELECT:

- `users`
  - select: `id, auth_user_id, username, role, name, organization_id, status, email`
  - 조건: `auth_user_id = authUserId`
  - 형태: `.maybeSingle()`
- `organizations`
  - select: `name`
  - 조건: `id = userRow.organization_id`
  - 형태: `.maybeSingle()`

용도:

- 이메일 Supabase Auth 로그인 후 `auth.users.id`와 `public.users.auth_user_id`를 매핑
- `currentUser` 구성
- 기관명 보강

fallback:

- mock 로그인 흐름은 별도 local/mock 사용자 구조를 유지

SELECT 권한 제거 시 영향:

- `users` 또는 `organizations` SELECT가 막히면 이메일 Auth 로그인 후 `currentUser` 구성이 실패할 수 있음

위험도:

- 높음

### `src/services/supabaseCheckerActivityHistoryService.js`

함수:

- `enrichTargetAddresses`
- `enrichActivityRecordColumns`
- `getDirectActivityRecords`

직접 SELECT:

- `targets`
  - select: `id, address`
  - 조건: `id in targetIds`
  - 목적: 체커 활동 이력 대상자 주소 보강
- `activity_records`
  - select: `id, has_issue, issue_level, check_items, status, condition_summary, memo`
  - 조건: `id in ids`
  - 목적: RPC 결과에 새 컬럼 보강
- `activity_records`
  - select: `id, organization_id, target_id, checker_id, check_type, checked_at, created_at, has_issue, issue_level, check_items, status, condition_summary, memo`
  - 조건: `checker_id = checkerId`
  - 목적: Supabase 저장 row를 체커 활동 이력에 직접 포함

사용 화면:

- 체커 활동 이력

fallback:

- 화면에는 localStorage fallback이 유지됨

SELECT 권한 제거 시 영향:

- 체커 활동 이력에서 Supabase 최신 row, memo, 이상징후 컬럼, 주소 보강이 빠질 수 있음

위험도:

- 높음

### `src/services/supabaseAdminActivityRecordsService.js`

함수:

- `enrichTargetAddresses`
- `enrichActivityRecordColumns`
- `getDirectActivityRecords`

직접 SELECT:

- `targets`
  - select: `id, address`
  - 조건: `id in targetIds`
  - 목적: 관리자 확인기록 대상자 주소 보강
- `activity_records`
  - select: `id, has_issue, issue_level, check_items, status, condition_summary, memo`
  - 조건: `id in ids`
  - 목적: RPC 결과에 새 컬럼 보강
- `activity_records`
  - select: `id, organization_id, target_id, checker_id, check_type, checked_at, created_at, has_issue, issue_level, check_items, status, condition_summary, memo`
  - 조건: `organization_id = organizationId`
  - 목적: Supabase 저장 row를 관리자 확인기록에 직접 포함

사용 화면:

- 관리자 확인기록 목록/상세

fallback:

- localStorage fallback 유지

SELECT 권한 제거 시 영향:

- 관리자 확인기록에서 Supabase 최신 row와 이상징후 컬럼 보강이 빠질 수 있음

위험도:

- 높음

### `src/services/supabaseAdminEmergenciesService.js`

함수:

- `getSupabaseEmergencyHandlingLogs`

직접 SELECT:

- `emergency_handling_logs`
  - select: `id, emergency_report_id, organization_id, status, memo, contacted_guardian, visit_required, created_by, created_by_name, created_at`
  - 조건:
    - `organization_id = organizationId`
    - `emergency_report_id = emergencyId`
  - 정렬: `created_at desc`

사용 화면:

- 관리자 이상징후 상세 처리 이력

fallback:

- localStorage handlingLogs fallback 유지

SELECT 권한 제거 시 영향:

- 관리자 이상징후 상세에서 Supabase 처리 이력이 비어 보일 수 있음

위험도:

- 높음

## 5. 테이블별 직접 select 현황

### `public.users`

직접 select 있음:

- `src/services/authService.js`

용도:

- 이메일 Auth 로그인 후 `public.users` 프로필 조회

위험:

- 사용자 계정, 역할, 조직 정보 포함
- SELECT 권한을 바로 닫으면 이메일 Auth 로그인/currentUser 구성이 깨질 수 있음

정리 필요:

- 로그인/currentUser 전용 서버 API 또는 RLS policy 설계 필요

### `public.organizations`

직접 select 있음:

- `src/services/authService.js`

용도:

- 로그인 사용자 기관명 보강

위험:

- 기관 정보 노출 가능
- 단, 현재 select 범위는 `name`으로 제한됨

정리 필요:

- users 조회와 함께 서버 API에서 currentUser payload로 반환하거나 제한된 RLS 적용 검토

### `public.targets`

직접 select 있음:

- `src/services/supabaseCheckerActivityHistoryService.js`
- `src/services/supabaseAdminActivityRecordsService.js`

용도:

- 활동 이력 주소 보강

위험:

- 대상자 주소는 개인정보성 데이터
- anon/authenticated broad SELECT가 열려 있으면 주소 노출 위험

정리 필요:

- 활동 이력 read 서버 API 응답에 target address를 포함하도록 보강하거나 제한 RLS 필요

### `public.activity_records`

직접 select 있음:

- `src/services/supabaseCheckerActivityHistoryService.js`
- `src/services/supabaseAdminActivityRecordsService.js`

용도:

- Supabase 저장 row 직접 포함
- `has_issue`, `issue_level`, `check_items`, `memo`, `condition_summary` 보강

위험:

- 생활 확인 기록, 메모, 이상징후 정보 포함
- 개인정보/운영 데이터 성격이 강함

정리 필요:

- `/api/checkers`와 `/api/admin-read` 응답 또는 별도 action으로 보강 권장

### `public.emergency_reports`

이번 검색에서 `src` 직접 table select는 확인되지 않음.

관리자/체커 이상징후 read는 주로 서버 API/RPC 전환 경로와 localStorage fallback을 사용한다.

### `public.emergency_handling_logs`

직접 select 있음:

- `src/services/supabaseAdminEmergenciesService.js`

용도:

- 관리자 이상징후 상세 처리 이력 표시

위험:

- 처리 메모, 작성자명, 보호자 연락 여부 등 운영 민감 정보 포함

정리 필요:

- `/api/admin-read`의 emergencies/detail action 또는 별도 통합 action에 handling logs 포함 검토

### `public.admin_reports`

이번 검색에서 `src` 직접 table select는 확인되지 않음.

보고서 read는 `/api/reports`의 `listReports`, `getReport` 기반으로 전환되어 있다.

## 6. Auth/currentUser 관련 select 현황

`src/services/authService.js`에서 Supabase Auth 로그인 후 직접 table select를 수행한다.

흐름:

1. `supabase.auth.signInWithPassword({ email, password })`
2. `authData.user.id`를 `authUserId`로 사용
3. `public.users.auth_user_id = authUserId`로 사용자 row 조회
4. `public.organizations.id = userRow.organization_id`로 기관명 조회
5. `normalizeSupabaseCurrentUser`로 `currentUser` 구성

mock 로그인:

- mock 로그인은 Supabase Auth session 없이 local/mock currentUser를 사용하는 흐름이다.
- 따라서 `users` SELECT 권한을 정리할 때 mock 로그인과 이메일 Auth 로그인을 분리해서 판단해야 한다.

SELECT 권한 제거 시 영향:

- 이메일 Auth 로그인은 `users`/`organizations` SELECT 권한 또는 대응 서버 API가 필요하다.
- `users` SELECT를 바로 제거하면 Auth 로그인 후 public profile 매핑이 실패할 수 있다.

## 7. push 관련 select 현황

`src` 클라이언트에서 `push_subscriptions`, `push_notification_logs` 직접 select는 확인되지 않았다.

push 관련 table 접근은 `api` 내부 서버 API에서 확인된다.

관련 서버 API/서비스 후보:

- `api/push/subscribe.js`
- `api/push/test-send.js`
- `api/push/send-checker-reminders.js`
- `api/push/_checkerReminderService.js`
- `api/cron/checker-reminders.js`

의미:

- push 테이블은 클라이언트 직접 SELECT 의존도가 낮아 보임
- 후속 권한 정리에서는 서버 API 동작을 기준으로 `anon/authenticated` SELECT 필요 여부를 별도 판단하면 됨

## 8. 이미 서버 API 전환된 read와 구분

아래 read 경로는 이미 서버 API 기반으로 전환되어 있다.

- `/api/super`
  - 총관리자/기관성 높은 위험 RPC read
- `/api/admin-read`
  - 관리자 조직 단위 RPC read
- `/api/checkers`
  - 체커 단위 RPC read action
- `/api/reports`
  - `listReports`, `getReport`

`api` 내부에서 service_role로 select/rpc하는 것은 정상 서버 경로다.

현재 남은 핵심 문제는 `src`에서 직접 table SELECT를 하는 보강/로그인 경로다.

## 9. 위험도 분류

### 높은 위험

- `authService.js`의 `users` 직접 select
- `supabaseCheckerActivityHistoryService.js`의 `targets`, `activity_records` 직접 select
- `supabaseAdminActivityRecordsService.js`의 `targets`, `activity_records` 직접 select
- `supabaseAdminEmergenciesService.js`의 `emergency_handling_logs` 직접 select

이유:

- 개인정보 또는 운영 민감 정보 포함
- SELECT 권한을 바로 닫으면 로그인 또는 화면 표시가 깨질 수 있음
- 아직 서버 API 응답으로 완전히 흡수되지 않은 보강 경로가 존재

### 중간 위험

- localStorage fallback이 있는 화면 보강용 select
- 이미 RPC/API read가 있으나 최신 Supabase row 보강을 위해 남은 select

### 낮은 위험

- `api` 내부 service_role select
- Supabase Auth 전용 호출
- push 관련 서버 API 내부 select

## 10. SELECT 권한 제거 시 예상 영향

`users` SELECT 제거:

- 이메일 Auth 로그인 후 currentUser 구성 실패 가능

`organizations` SELECT 제거:

- 이메일 Auth 로그인 후 organizationName 보강 실패 가능

`targets` SELECT 제거:

- 체커/관리자 확인기록 주소 보강 실패 가능
- 대상자 주소가 비거나 fallback 값으로 표시될 수 있음

`activity_records` SELECT 제거:

- 체커/관리자 확인기록에서 Supabase 최신 row, memo, 이상징후 컬럼 보강 실패 가능

`emergency_handling_logs` SELECT 제거:

- 관리자 이상징후 상세 처리 이력이 비어 보일 수 있음

`admin_reports` SELECT 제거:

- 현재 `src` 직접 select 의존은 확인되지 않음
- `/api/reports` 기반 read는 유지 가능

## 11. 정리 방향 후보

### A안: 직접 table select를 모두 서버 API로 전환

장점:

- `anon`/`authenticated` SELECT 권한 제거가 쉬워짐
- 권한 통제 위치가 서버 API로 일원화됨
- mock 로그인과 충돌이 적음

단점:

- 구현 범위가 큼
- Vercel 함수 제한 때문에 기존 통합 API action을 활용해야 함

적합한 항목:

- activity_records 보강 select
- targets 주소 보강 select
- emergency_handling_logs 처리 이력 select

### B안: authenticated RLS policy 설계 후 직접 select 일부 유지

장점:

- Supabase 권장 구조에 가까움
- 클라이언트 read를 유지할 수 있음

단점:

- mock 로그인은 Supabase Auth session이 없어서 충돌 가능
- `auth.uid()` 기반 설계와 테스트가 필요
- 현재 hybrid login 구조에서는 영향 범위가 큼

적합한 항목:

- 이메일 Auth 로그인 이후의 자기 profile 조회

### C안: 혼합 전략

추천 방향:

- 로그인/currentUser 관련 `users` select는 별도 설계
- 개인정보/운영 데이터 read는 서버 API로 전환
- health/fallback성 select는 제거 또는 서버 API로 대체
- RLS policy는 마지막에 최소 범위로 설계

## 12. 추천 다음 단계

1. `public.users` 직접 select/currentUser 흐름을 별도 감사한다.
2. 체커 활동 이력 보강용 `targets`/`activity_records` direct select를 `/api/checkers` action으로 흡수할지 판단한다.
3. 관리자 확인기록 보강용 `targets`/`activity_records` direct select를 `/api/admin-read` action으로 흡수할지 판단한다.
4. `emergency_handling_logs` direct select를 `/api/admin-read` 또는 기존 emergency detail read에 포함할지 판단한다.
5. 직접 SELECT 잔여 제거 후 SELECT grants 정리 SQL 계획을 작성한다.
6. mock 로그인 유지 범위와 이메일 Auth 전환 계획을 함께 고려해 RLS policy를 설계한다.

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 수정하지 않음
- DB/RLS/Auth 수정하지 않음
- SELECT 권한 revoke하지 않음
- `authenticated` EXECUTE 제거하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- SELECT 권한 정리가 완료됐다고 판단하지 않음
