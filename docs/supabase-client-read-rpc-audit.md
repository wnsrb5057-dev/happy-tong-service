# Supabase 클라이언트 Read/RPC 감사

## 1. 작업 목적

Supabase SELECT 권한과 RLS policy를 정리하기 전에, 현재 프론트엔드 코드가 `VITE_SUPABASE_ANON_KEY` 기반 클라이언트로 직접 읽는 경로를 확인한다.

이번 문서는 SELECT 권한을 바로 제거했을 때 어떤 화면과 기능이 영향을 받는지 파악하기 위한 감사 문서다. 코드, API, DB, RLS, policy, grants는 수정하지 않는다.

## 2. 현재 권한 정리 상태

1단계 권한 정리에서 아래 테이블의 `anon` / `authenticated` 직접 write 권한은 제거되었다.

- `public.activity_records`
- `public.admin_reports`
- `public.emergency_handling_logs`
- `public.emergency_reports`
- `public.organizations`
- `public.targets`

제거한 권한:

- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

유지된 권한:

- `service_role` 권한
- `postgres` 권한
- `SELECT` 권한

현재 주요 write는 service_role 기반 서버 API로 전환되어 있다. 다만 클라이언트 read/RPC 경로가 남아 있어 SELECT 권한과 RLS policy 정리 전 영향 범위 확인이 필요하다.

## 3. 감사 대상과 검색 기준

감사 대상:

- `src/services`
- `src/pages`
- `src/App.jsx`
- `src/utils`

검색 기준:

- `supabase.from(`
- `.select(`
- `.rpc(`
- `get_public_`
- `VITE_SUPABASE_ANON_KEY`
- `createClient`
- `auth.getUser`
- `auth.signInWithPassword`
- `auth.signOut`

## 4. 클라이언트 Supabase read service 목록

| 파일 | 함수 | 사용 테이블/RPC | 읽는 데이터 | 사용 화면/기능 | fallback | SELECT/RLS 변경 영향 |
| --- | --- | --- | --- | --- | --- | --- |
| `src/services/authService.js` | 로그인 흐름 | `users`, `organizations` | 로그인 사용자 프로필, 기관명 | 로그인, `currentUser` 구성 | mock 로그인 흐름 존재 | 높음. `users`/`organizations` SELECT가 막히면 Supabase Auth 로그인 후 프로필 매핑 실패 가능 |
| `src/services/supabaseAdminActivityRecordsService.js` | `getSupabaseAdminActivityRecords` | `get_public_admin_activity_records`, `targets`, `activity_records` | 관리자 확인기록, 주소, 이상징후 컬럼 | 관리자 확인기록 | localStorage fallback | 높음. 관리자 확인기록의 Supabase 최신 데이터 표시 영향 |
| `src/services/supabaseCheckerActivityHistoryService.js` | `getSupabaseCheckerActivityHistory` | `get_public_checker_activity_history`, `targets`, `activity_records` | 체커 확인기록, 주소, 이상징후 컬럼 | 체커 확인기록 | localStorage fallback | 높음. 체커 확인기록의 Supabase 최신 데이터 표시 영향 |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencies`, `getSupabaseAdminEmergencyById` | `get_public_admin_emergencies`, `emergency_handling_logs` | 관리자 이상징후 목록/상세, 처리 이력 | 관리자 이상징후 | localStorage fallback | 높음. 처리 이력 표시가 비거나 최신 상태 반영 누락 가능 |
| `src/services/supabaseAdminTargetsService.js` | `getSupabaseAdminTargets`, `getSupabaseAdminTargetById` | `get_public_admin_targets` | 관리자 대상자 목록/상세 | 관리자 대상자 관리 | localStorage fallback | 높음. Supabase-only 대상자 표시 영향 |
| `src/services/supabaseCheckerTargetsService.js` | `getSupabaseCheckerTargets`, `getSupabaseCheckerTargetById` | `get_public_checker_targets` | 체커 담당 대상자 목록/상세 | 체커 대상자, 기록작성 대상자 | localStorage fallback | 높음. 체커 대상자 목록과 기록작성 대상자 선택 영향 |
| `src/services/supabaseCheckerActivityFormTargetsService.js` | `getSupabaseCheckerActivityFormTargets` | `get_public_checker_activity_form_targets` | 기록작성용 대상자 목록 | 체커 기록작성 | localStorage fallback | 높음. 기록작성 대상자 선택 영향 |
| `src/services/supabaseCheckerHomeService.js` | `getSupabaseCheckerHome` | `get_public_checker_home` | 체커 홈 요약 | 체커 홈 | localStorage fallback | 중간. 홈 요약 최신성 영향 |
| `src/services/supabaseAdminDashboardService.js` | `getSupabaseAdminDashboard` | `get_public_admin_dashboard` | 관리자 대시보드 요약 | 관리자 대시보드 | 기존 데이터 fallback 가능 | 중간. 대시보드 최신성 영향 |
| `src/services/supabaseAdminStatisticsService.js` | `getSupabaseAdminStatistics` | `get_public_admin_statistics` | 관리자 통계 | 관리자 통계 | 기존 데이터 fallback 가능 | 중간. 통계 최신성 영향 |
| `src/services/supabaseAdminReportSummaryService.js` | `getSupabaseAdminReportSummary` | `get_public_admin_report_summary` | 보고서용 운영 요약 | 관리자 보고서 작성 | fallback 가능 | 중간. 보고서 생성 요약 데이터 영향 |
| `src/services/supabaseOrganizationDetailService.js` | `getSupabaseOrganizationDetail` | `get_public_organization_detail` | 기관 상세 | 기관/관리 화면 | fallback 여부 확인 필요 | 중간 |
| `src/services/supabaseOrganizationSummaryService.js` | `getSupabaseOrganizationSummaries` | `get_public_organization_summaries` | 기관 요약 | 슈퍼 관리자/기관 요약 | fallback 여부 확인 필요 | 중간 |
| `src/services/supabaseRecentEmergencyService.js` | `getSupabaseRecentEmergencySummaries` | `get_public_recent_emergency_summaries` | 최근 이상징후 요약 | 대시보드/요약 | fallback 여부 확인 필요 | 중간 |
| `src/services/supabaseSuperStatusService.js` | `getSupabaseSuperStatusSummaries` | `get_public_super_status_summaries` | 전체 기관 상태 요약 | 슈퍼 관리자 | fallback 여부 확인 필요 | 중간 |
| `src/services/supabaseSuperDashboardKpiService.js` | `getSupabaseSuperDashboardKpis` | `get_public_super_dashboard_kpis` | 슈퍼 관리자 KPI | 슈퍼 관리자 대시보드 | fallback 여부 확인 필요 | 중간 |
| `src/services/supabaseHealthService.js` | `getSupabaseConnectionStatus` | `get_public_health_counts`, 직접 count select | 연결/테이블 count | 진단/상태 확인 | 실패 허용 가능 | 낮음. 기능보다는 점검성 영향 |
| `src/services/supabaseAdminReportsReadService.js` | `getSupabaseAdminReports`, `getSupabaseAdminReportById` | 서버 API `/api/reports` | 관리자 보고서 목록/상세 | 보고서 미리보기/read | localStorage fallback | 낮음. 클라이언트 직접 SELECT가 아니라 서버 API read |

## 5. RPC 사용 목록

| RPC | 호출 파일 | 전달 인자 | 반환 데이터 용도 | 사용 화면 | 권한 영향 |
| --- | --- | --- | --- | --- | --- |
| `get_public_admin_statistics` | `src/services/supabaseAdminStatisticsService.js` | `p_organization_id` | 관리자 통계 | 관리자 통계 | RPC 실행 권한과 내부 테이블 SELECT 정책 확인 필요 |
| `get_public_admin_emergencies` | `src/services/supabaseAdminEmergenciesService.js` | `p_organization_id` | 이상징후 목록/상세 기본 데이터 | 관리자 이상징후 | 내부 조직 제한 여부 확인 필요 |
| `get_public_admin_dashboard` | `src/services/supabaseAdminDashboardService.js` | `p_organization_id` | 관리자 홈 대시보드 | 관리자 홈 | 내부 조직 제한 여부 확인 필요 |
| `get_public_admin_report_summary` | `src/services/supabaseAdminReportSummaryService.js` | `p_organization_id` | 보고서 생성 요약 | 관리자 보고서 작성 | 내부 조직 제한 여부 확인 필요 |
| `get_public_admin_activity_records` | `src/services/supabaseAdminActivityRecordsService.js` | `p_organization_id` | 관리자 확인기록 | 관리자 확인기록 | 내부 조직 제한 여부 확인 필요 |
| `get_public_admin_targets` | `src/services/supabaseAdminTargetsService.js` | `p_organization_id` | 대상자 목록/상세 | 관리자 대상자 관리 | 내부 조직 제한 여부 확인 필요 |
| `get_public_checker_activity_form_targets` | `src/services/supabaseCheckerActivityFormTargetsService.js` | `p_checker_id` | 기록작성 대상자 목록 | 체커 기록작성 | 체커별 제한 여부 확인 필요 |
| `get_public_checker_home` | `src/services/supabaseCheckerHomeService.js` | `p_checker_id` | 체커 홈 요약 | 체커 홈 | 체커별 제한 여부 확인 필요 |
| `get_public_checker_targets` | `src/services/supabaseCheckerTargetsService.js` | `p_checker_id` | 체커 담당 대상자 | 체커 대상자 목록/상세 | 체커별 제한 여부 확인 필요 |
| `get_public_checker_activity_history` | `src/services/supabaseCheckerActivityHistoryService.js` | `p_checker_id` | 체커 확인기록 | 체커 확인기록 | 체커별 제한 여부 확인 필요 |
| `get_public_health_counts` | `src/services/supabaseHealthService.js` | 없음 | 테이블 count 상태 | 연결/상태 점검 | 낮음. 점검성 RPC |
| `get_public_organization_detail` | `src/services/supabaseOrganizationDetailService.js` | `p_organization_id` | 기관 상세 | 기관/관리 화면 | 조직 제한 여부 확인 필요 |
| `get_public_recent_emergency_summaries` | `src/services/supabaseRecentEmergencyService.js` | 없음 | 최근 이상징후 요약 | 대시보드/요약 | 넓은 범위 반환 여부 확인 필요 |
| `get_public_organization_summaries` | `src/services/supabaseOrganizationSummaryService.js` | 없음 | 기관 요약 | 슈퍼 관리자 | 슈퍼 관리자 전용 여부 확인 필요 |
| `get_public_super_status_summaries` | `src/services/supabaseSuperStatusService.js` | 없음 | 전체 상태 요약 | 슈퍼 관리자 | 슈퍼 관리자 전용 여부 확인 필요 |
| `get_public_super_dashboard_kpis` | `src/services/supabaseSuperDashboardKpiService.js` | 없음 | 전체 KPI | 슈퍼 관리자 대시보드 | 슈퍼 관리자 전용 여부 확인 필요 |

## 6. 직접 table select 목록

| 테이블 | 호출 파일/함수 | 목적 | 화면 영향 | SELECT 제거 시 영향 | 대체 방향 |
| --- | --- | --- | --- | --- | --- |
| `users` | `src/services/authService.js` | Supabase Auth 로그인 후 `auth_user_id` 기준 public user 조회 | 로그인/currentUser 구성 | 높음. Supabase 로그인 프로필 생성 실패 가능 | 서버 API 또는 제한된 own-profile policy/RPC |
| `organizations` | `src/services/authService.js` | 로그인 사용자 기관명 조회 | 로그인/currentUser 표시 | 중간. 기관명 누락 가능 | 서버 API 또는 조직 단건 RPC/policy |
| `targets` | `src/services/supabaseAdminActivityRecordsService.js` | 관리자 확인기록 주소 보강 | 관리자 확인기록 상세 | 높음. 주소 통일/표시 보강 영향 | RPC 반환값에 address 포함 또는 서버 API read |
| `activity_records` | `src/services/supabaseAdminActivityRecordsService.js` | 관리자 확인기록 이상징후/메모/check_items 보강 | 관리자 확인기록 | 높음. has_issue, issue_level 반영 누락 가능 | RPC 반환값 확장 또는 서버 API read |
| `activity_records` | `src/services/supabaseAdminActivityRecordsService.js` | RPC 결과가 비거나 부족할 때 조직 기준 직접 조회 | 관리자 확인기록 | 높음. Supabase-only 기록 누락 가능 | 서버 API read 또는 제한된 RPC |
| `targets` | `src/services/supabaseCheckerActivityHistoryService.js` | 체커 확인기록 주소 보강 | 체커 확인기록 상세 | 높음. 주소 통일/표시 보강 영향 | RPC 반환값에 address 포함 또는 서버 API read |
| `activity_records` | `src/services/supabaseCheckerActivityHistoryService.js` | 체커 확인기록 이상징후/메모/check_items 보강 | 체커 확인기록 | 높음. has_issue, issue_level 반영 누락 가능 | RPC 반환값 확장 또는 서버 API read |
| `activity_records` | `src/services/supabaseCheckerActivityHistoryService.js` | RPC 결과가 비거나 부족할 때 checker 기준 직접 조회 | 체커 확인기록 | 높음. Supabase-only 기록 누락 가능 | 서버 API read 또는 제한된 RPC |
| `emergency_handling_logs` | `src/services/supabaseAdminEmergenciesService.js` | 이상징후 처리 이력 조회 | 관리자 이상징후 상세 | 높음. 처리 이력 빈 상태로 표시 가능 | RPC 반환값 포함 또는 서버 API read |
| 동적 테이블 | `src/services/supabaseHealthService.js` | 테이블별 count 점검 | 연결/상태 진단 | 낮음. 진단 count 실패 가능 | 서버 health API 또는 RPC 유지 |

## 7. Auth 호출 목록

| 호출 | 파일 | 용도 | SELECT 권한 정리와의 관계 |
| --- | --- | --- | --- |
| `supabase.auth.signInWithPassword` | `src/services/authService.js` | Supabase 이메일 로그인 | Auth 자체 호출은 SELECT grants와 별개다. 로그인 후 public profile 조회는 별도 영향 있음 |
| `supabase.auth.signOut` | `src/services/authService.js` | 로그아웃 | SELECT grants와 별개 |

확인 범위에서 `auth.getUser`, `onAuthStateChange` 직접 호출은 발견되지 않았다.

## 8. read 경로 분류

### A. 이미 서버 API read로 전환됨

- 관리자 보고서 read
  - `src/services/supabaseAdminReportsReadService.js`
  - `/api/reports` action `listReports`
  - `/api/reports` action `getReport`

### B. 클라이언트 RPC read 유지 중

- 관리자 대시보드/통계/보고서 요약
- 관리자 대상자
- 관리자 이상징후
- 관리자 확인기록
- 체커 홈
- 체커 대상자
- 체커 기록작성 대상자
- 체커 확인기록
- 슈퍼 관리자 요약/KPI
- 기관 상세/요약
- 최근 이상징후 요약
- health counts

### C. 클라이언트 직접 table select 유지 중

- 로그인 후 `users` profile 조회
- 로그인 후 `organizations` name 조회
- 관리자/체커 확인기록의 `targets` address 보강
- 관리자/체커 확인기록의 `activity_records` 상세 컬럼 보강
- 관리자 이상징후 상세의 `emergency_handling_logs` 조회
- health check용 동적 count select

### D. Auth 전용

- `signInWithPassword`
- `signOut`

## 9. SELECT 권한 정리 시 영향 예상

가장 큰 영향은 로그인 프로필 매핑과 운영 화면의 Supabase 최신 데이터 표시다.

- `users` SELECT 제한 시 Supabase Auth 로그인 후 `currentUser` 구성에 실패할 수 있다.
- `activity_records` SELECT 제한 시 체커/관리자 확인기록에서 `has_issue`, `issue_level`, `check_items`, `memo` 보강이 깨질 수 있다.
- `targets` SELECT 제한 시 확인기록 주소 통일 보강이 깨질 수 있다.
- `emergency_handling_logs` SELECT 제한 시 관리자 이상징후 상세의 처리 이력이 비어 보일 수 있다.
- RPC 실행 권한 또는 함수 내부 SELECT 권한이 제한되면 대시보드, 통계, 대상자, 확인기록, 이상징후 목록의 Supabase read가 실패할 수 있다.

## 10. 위험도 평가

### 높은 위험

- `src/services/authService.js`의 `users` 직접 select
- `src/services/supabaseAdminActivityRecordsService.js`의 `activity_records`, `targets` 직접 select
- `src/services/supabaseCheckerActivityHistoryService.js`의 `activity_records`, `targets` 직접 select
- `src/services/supabaseAdminEmergenciesService.js`의 `emergency_handling_logs` 직접 select
- `get_public_*` RPC가 내부에서 조직/사용자 제한을 보장하는지 아직 미확인인 상태

### 중간 위험

- 관리자/체커/슈퍼 관리자 대시보드성 RPC
- 기관/최근 이상징후 요약 RPC
- fallback은 있으나 최신 Supabase 데이터가 사라질 수 있는 화면

### 낮은 위험

- `/api/reports` 기반 보고서 read
- Auth 전용 `signInWithPassword`, `signOut`
- health check성 count/RPC

## 11. 권장 정리 방향

- SELECT 권한을 바로 제거하지 않는다.
- 먼저 `get_public_*` RPC 함수 정의를 확인해 organization/user 제한이 SQL 내부에서 보장되는지 검토한다.
- 직접 table select는 가능한 서버 API read 또는 제한된 RPC로 대체한다.
- 개인정보성 테이블인 `users`, `targets`, `activity_records`, `emergency_reports`, `admin_reports`는 broad SELECT 제거 전 화면별 read 경로를 확정한다.
- 로그인 프로필 조회는 own profile policy, 제한 RPC, 또는 서버 API 중 하나로 표준화한다.
- 확인기록과 이상징후 처리 이력은 현재 화면 품질에 중요하므로 RPC 반환값 확장 또는 서버 API read 전환을 우선 검토한다.
- 슈퍼 관리자용 RPC는 일반 anon/authenticated에서 호출 가능해야 하는지 별도로 구분한다.

## 12. 다음 단계

1. Supabase SQL Editor에서 `get_public_*` RPC 함수 정의와 권한을 확인한다.
2. 직접 table select 경로를 서버 API/RPC로 대체할 필요가 있는지 화면별로 판단한다.
3. `users`, `targets`, `activity_records`, `emergency_handling_logs` SELECT 제한 계획을 우선 수립한다.
4. 조직/역할 기반 read policy 초안을 작성한다.
5. SELECT 권한 변경 전 QA 기준을 만든다.
6. 권한 변경은 staging 또는 백업 후 단계적으로 적용한다.

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 수정하지 않음
- DB/RLS/policy/grants 수정하지 않음
- SELECT 권한 revoke하지 않음
- RPC 수정하지 않음
- SELECT 권한 정리를 완료했다고 판단하지 않음
