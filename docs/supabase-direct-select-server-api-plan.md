# Supabase Direct SELECT Server API Plan

## 1. 작업 목적

남아 있는 보강용 직접 table SELECT 경로를 서버 API로 흡수하기 위한 계획을 정리한다.

이번 단계는 문서 작성만 수행하며, 코드 수정, API 수정, DB/RLS/Auth 수정, SELECT 권한 revoke는 하지 않는다.

## 2. 현재 direct select 감사 결과 요약

직접 table SELECT 감사 결과, `src` 클라이언트에 남은 주요 직접 SELECT 파일은 아래다.

- `src/services/authService.js`
- `src/services/supabaseCheckerActivityHistoryService.js`
- `src/services/supabaseAdminActivityRecordsService.js`
- `src/services/supabaseAdminEmergenciesService.js`

`authService.js`는 로그인/currentUser 구성과 연결되어 있어 별도 후속 단계로 분리한다.

이번 문서의 대상은 보강용 direct select 3개 service다.

## 3. 이번 계획 범위

이번 계획 대상:

- `src/services/supabaseCheckerActivityHistoryService.js`
- `src/services/supabaseAdminActivityRecordsService.js`
- `src/services/supabaseAdminEmergenciesService.js`

이번 계획에서 제외:

- `src/services/authService.js`

제외 이유:

- mock 로그인은 `public.users` SELECT를 사용하지 않음
- 이메일 Supabase Auth 로그인은 `public.users`와 `organizations` SELECT를 사용함
- authenticated `users` SELECT를 정리하면 이메일 Auth currentUser 구성이 깨질 수 있음
- 따라서 auth/currentUser는 별도 설계와 QA가 필요함

## 4. 파일별 direct select 상세

### `src/services/supabaseCheckerActivityHistoryService.js`

이미 전환된 주요 read:

- `/api/checkers`
- `action: "getActivityHistory"`

남은 direct select:

1. `enrichTargetAddresses(records)`
   - table: `targets`
   - select: `id, address`
   - 조건: `id in targetIds`
   - 보강 데이터: 체커 활동 이력의 대상자 주소
   - 화면 필요성: 활동 이력 상세/카드에서 주소 source 통일에 사용
   - 실패 시 fallback: 기존 record 반환

2. `enrichActivityRecordColumns(records)`
   - table: `activity_records`
   - select: `id, has_issue, issue_level, check_items, status, condition_summary, memo`
   - 조건: `id in ids`
   - 보강 데이터: 이상징후 여부, 위험도, check_items, memo, condition_summary
   - 화면 필요성: 체커 활동 이력의 이상징후 배지, 상세 내용, 메모 표시
   - 실패 시 fallback: 기존 record 반환

3. `getDirectActivityRecords(checkerId)`
   - table: `activity_records`
   - select: `id, organization_id, target_id, checker_id, check_type, checked_at, created_at, has_issue, issue_level, check_items, status, condition_summary, memo`
   - 조건: `checker_id = checkerId`
   - 정렬: `checked_at desc`
   - 보강 데이터: RPC 결과에 누락될 수 있는 Supabase 저장 row 자체
   - 화면 필요성: Supabase 저장 기록을 체커 활동 이력에 반드시 포함
   - 실패 시 fallback: 빈 배열 반환

서버 API 흡수 방향:

- `api/checkers.js`의 `getActivityHistory` action 응답을 보강한다.
- 서버에서 service_role으로 `activity_records` 직접 row와 `targets.address`를 합쳐 응답한다.
- 클라이언트 service에서는 `/api/checkers` 응답만 normalize하고 직접 select를 제거한다.

새 API 파일 생성은 하지 않는다.

### `src/services/supabaseAdminActivityRecordsService.js`

이미 전환된 주요 read:

- `/api/admin-read`
- `action: "getActivityRecords"`

남은 direct select:

1. `enrichTargetAddresses(records)`
   - table: `targets`
   - select: `id, address`
   - 조건: `id in targetIds`
   - 보강 데이터: 관리자 확인기록의 대상자 주소
   - 화면 필요성: 관리자/체커 주소 source 통일
   - 실패 시 fallback: 기존 record 반환

2. `enrichActivityRecordColumns(records)`
   - table: `activity_records`
   - select: `id, has_issue, issue_level, check_items, status, condition_summary, memo`
   - 조건: `id in ids`
   - 보강 데이터: 이상징후 여부, 위험도, check_items, memo, condition_summary
   - 화면 필요성: 관리자 확인기록 배지와 상세 표시
   - 실패 시 fallback: 기존 record 반환

3. `getDirectActivityRecords(organizationId)`
   - table: `activity_records`
   - select: `id, organization_id, target_id, checker_id, check_type, checked_at, created_at, has_issue, issue_level, check_items, status, condition_summary, memo`
   - 조건: `organization_id = organizationId`
   - 정렬: `checked_at desc`
   - 보강 데이터: RPC 결과에 누락될 수 있는 Supabase 저장 row 자체
   - 화면 필요성: 관리자 확인기록에 Supabase 저장 기록을 반영
   - 실패 시 fallback: 빈 배열 반환

서버 API 흡수 방향:

- `api/admin-read.js`의 `getActivityRecords` action 응답을 보강한다.
- 서버에서 service_role으로 `activity_records` 직접 row와 `targets.address`를 합쳐 응답한다.
- 클라이언트 service에서는 `/api/admin-read` 응답만 normalize하고 직접 select를 제거한다.

새 API 파일 생성은 하지 않는다.

### `src/services/supabaseAdminEmergenciesService.js`

이미 전환된 주요 read:

- `/api/admin-read`
- `action: "getEmergencies"`

남은 direct select:

1. `getSupabaseEmergencyHandlingLogs(organizationId, emergencyId)`
   - table: `emergency_handling_logs`
   - select: `id, emergency_report_id, organization_id, status, memo, contacted_guardian, visit_required, created_by, created_by_name, created_at`
   - 조건:
     - `organization_id = organizationId`
     - `emergency_report_id = emergencyId`
   - 정렬: `created_at desc`
   - 보강 데이터: 관리자 이상징후 상세 처리 이력
   - 화면 필요성: 처리 이력 영역, 최신 처리 상태/메모 표시
   - 실패 시 fallback: 기존 emergency 객체 반환 및 warn

직접 select가 확인되지 않은 항목:

- `emergency_reports` 직접 select 없음
- `targets` 직접 select 없음
- `users` 직접 select 없음

서버 API 흡수 방향:

- `api/admin-read.js`에 상세/처리 이력 read action 추가를 검토한다.
- 기존 `getEmergencies` 목록 action과 구분해 상세에서만 logs를 조회하는 구조가 적절하다.

후보 action:

- `getEmergencyDetail`
- `getEmergencyHandlingLogs`

역할 구분:

- `api/emergency-reports/update-status.js`는 처리 상태 write API
- `api/admin-read.js`의 신규 action은 처리 이력 read API
- 두 역할을 혼동하지 않도록 write와 read를 분리한다.

## 5. 서버 API 흡수 후보

사용할 기존 API:

- `api/checkers.js`
- `api/admin-read.js`

흡수 후보:

- 체커 활동 이력 보강 select → `api/checkers.js`, `action: "getActivityHistory"`
- 관리자 확인기록 보강 select → `api/admin-read.js`, `action: "getActivityRecords"`
- 관리자 이상징후 처리 이력 select → `api/admin-read.js`, 신규 detail/log action

새 API 파일은 만들지 않는다.

## 6. API action 추가 후보

### `api/checkers.js`

기존 action:

- `create`
- `update`
- `updateStatus`
- `getHome`
- `getTargets`
- `getActivityHistory`
- `getActivityFormTargets`

보강 방향:

- `getActivityHistory` 응답에 direct `activity_records` row 병합
- `targets.address` 보강
- `has_issue`, `issue_level`, `check_items`, `status`, `condition_summary`, `memo` 포함 보장

신규 action은 우선 필요하지 않다.

### `api/admin-read.js`

기존 action:

- `getDashboard`
- `getTargets`
- `getEmergencies`
- `getActivityRecords`
- `getStatistics`
- `getReportSummary`

보강 방향:

- `getActivityRecords` 응답에 direct `activity_records` row 병합
- `targets.address` 보강
- `has_issue`, `issue_level`, `check_items`, `status`, `condition_summary`, `memo` 포함 보장

추가 후보 action:

- `getEmergencyDetail`
- `getEmergencyHandlingLogs`

권장:

- 상세 화면에서 처리 이력만 필요하면 `getEmergencyHandlingLogs`
- 상세 record와 logs를 함께 안정적으로 받을 필요가 있으면 `getEmergencyDetail`

## 7. Vercel 함수 제한 고려

Vercel Hobby 플랜의 Serverless Functions 개수 제한 이력이 있으므로 새 API 파일은 만들지 않는다.

원칙:

- 기존 통합 API에 action 추가
- `/api/checkers`와 `/api/admin-read`를 재사용
- targets/checkers/reports처럼 통합 API 구조 유지

이 방식은 함수 개수를 늘리지 않고 SELECT 제거 준비를 진행할 수 있다.

## 8. 구현 우선순위

추천 순서:

1. `supabaseCheckerActivityHistoryService.js` direct select 제거
   - `api/checkers.js getActivityHistory` 응답 보강
   - 체커 활동 이력 QA
2. `supabaseAdminActivityRecordsService.js` direct select 제거
   - `api/admin-read.js getActivityRecords` 응답 보강
   - 관리자 확인기록 QA
3. `supabaseAdminEmergenciesService.js` direct select 제거
   - `api/admin-read.js`에 `getEmergencyHandlingLogs` 또는 `getEmergencyDetail` 추가
   - 관리자 이상징후 상세 처리 이력 QA
4. `src` 직접 select 잔여 재검색
5. SELECT grants 정리 계획 수립
6. RLS policy 설계 검토

## 9. SELECT 권한 정리와의 관계

위 direct select들을 서버 API로 흡수하면 아래 테이블의 `anon` SELECT 제거 가능성이 올라간다.

- `activity_records`
- `targets`
- `emergency_handling_logs`

추가로 관련 read 경로가 정리되면 아래 테이블도 점진적으로 검토 가능하다.

- `emergency_reports`
- `users`

단, `authService.js`의 이메일 Auth 로그인 흐름은 여전히 별도 판단이 필요하다.

## 10. 남은 auth/currentUser 이슈

이번 계획은 `authService.js`를 제외한다.

남은 이유:

- 이메일 Auth 로그인은 `public.users.auth_user_id` 기준 직접 SELECT에 의존한다.
- `organizations.name` 직접 SELECT도 currentUser 구성에 사용된다.
- authenticated users SELECT를 바로 닫으면 이메일 Auth 로그인 후 currentUser 구성이 실패할 수 있다.

후속으로 필요한 작업:

- currentUser 조회 서버 API 전환 여부 판단
- users own profile RLS policy 설계
- organizations 제한 read policy 또는 서버 API 보강
- mock 로그인 운영 제한/제거 정책 검토

## 11. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 수정하지 않음
- 새 API 파일 생성하지 않음
- DB/RLS/Auth 수정하지 않음
- SELECT 권한 revoke하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- direct select 제거가 완료됐다고 판단하지 않음
