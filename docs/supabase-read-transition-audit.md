# 해피통서비스 Supabase 읽기 전환 점검

## 1. 목적

이 문서는 현재 해피통서비스 React/Vite MVP에서 어디까지 Supabase 읽기 전용 전환이 완료되었는지 정리한다.

현재 원칙은 다음과 같다.

- 기존 `localStorage` MVP 유지
- Supabase는 읽기 전용 조회만 단계적으로 연결
- `insert / update / delete / upsert` 전환 금지
- 로그인 방식 변경 금지
- Supabase Auth 추가 금지
- package.json 변경 금지

## 2. 읽기 전용 전환 완료 화면

### 총관리자

| 화면 | RPC | service | 성공 시 안내 | 실패 시 fallback | 쓰기 기능 영향 |
| --- | --- | --- | --- | --- | --- |
| `/super/dashboard` | `get_public_health_counts()` / `get_public_recent_emergency_summaries()` / `get_public_super_dashboard_kpis()` | `supabaseHealthService.js` / `supabaseRecentEmergencyService.js` / `supabaseSuperDashboardKpiService.js` | Supabase 연결/요약 기준 표시 | 기존 localStorage/mock 요약 유지 | 없음 |
| `/super/organizations` | `get_public_organization_summaries()` | `supabaseOrganizationSummaryService.js` | Supabase 기관 요약 기준 표시 | 기존 localStorage/mock 기관 목록 유지 | 없음 |
| `/super/organizations/:id` | `get_public_organization_detail(p_organization_id uuid)` | `supabaseOrganizationDetailService.js` | Supabase 기관 상세 기준 표시 | 기존 localStorage/mock 상세 유지 | 없음 |
| `/super/status` | `get_public_super_status_summaries()` | `supabaseSuperStatusService.js` | Supabase 현황 요약 기준 표시 | 기존 localStorage/mock 현황 유지 | 없음 |

### 관리자

| 화면 | RPC | service | 성공 시 안내 | 실패 시 fallback | 쓰기 기능 영향 |
| --- | --- | --- | --- | --- | --- |
| `/admin/dashboard` | `get_public_admin_dashboard(p_organization_id uuid)` | `supabaseAdminDashboardService.js` | `Supabase 기준`, `Supabase 관리자 대시보드 요약을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 없음 |
| `/admin/targets` | `get_public_admin_targets(p_organization_id uuid)` | `supabaseAdminTargetsService.js` | `Supabase 기준`, `Supabase 대상자 목록을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 대상자 등록/수정/상태변경은 기존 localStorage 유지 |
| `/admin/emergencies` | `get_public_admin_emergencies(p_organization_id uuid)` | `supabaseAdminEmergenciesService.js` | `Supabase 기준`, `Supabase 이상징후 목록을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 처리상태/메모/연락 확인은 기존 localStorage 유지 |
| `/admin/activities` | `get_public_admin_activity_records(p_organization_id uuid)` | `supabaseAdminActivityRecordsService.js` | `Supabase 기준`, `Supabase 확인기록 목록을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 기록 상세/수정/삭제는 기존 localStorage 유지 |
| `/admin/statistics` | `get_public_admin_statistics(p_organization_id uuid)` | `supabaseAdminStatisticsService.js` | `Supabase 기준`, `Supabase 통계 요약을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 없음 |
| `/admin/reports` | `get_public_admin_report_summary(p_organization_id uuid)` | `supabaseAdminReportSummaryService.js` | `Supabase 기준`, `Supabase 보고서 요약을 불러왔습니다.` | 기관 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 보고서 저장/PDF/인쇄는 기존 localStorage 유지 |

### 체커

| 화면 | RPC | service | 성공 시 안내 | 실패 시 fallback | 쓰기 기능 영향 |
| --- | --- | --- | --- | --- | --- |
| `/checker/home` | `get_public_checker_home(p_checker_id uuid)` | `supabaseCheckerHomeService.js` | `Supabase 기준`, `Supabase 체커 홈 요약을 불러왔습니다.` | 체커 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 확인기록 작성/이상징후 보고 저장은 기존 localStorage 유지 |
| `/checker/targets` | `get_public_checker_targets(p_checker_id uuid)` | `supabaseCheckerTargetsService.js` | `Supabase 기준`, `Supabase 체커 대상자 목록을 불러왔습니다.` | 체커 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 상세/작성 이동은 로컬 매칭 가능한 경우만 유지 |
| `/checker/activity/history` | `get_public_checker_activity_history(p_checker_id uuid)` | `supabaseCheckerActivityHistoryService.js` | `Supabase 기준`, `Supabase 체커 확인기록을 불러왔습니다.` | 체커 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 기록 작성/이상징후 보고 저장은 기존 localStorage 유지 |
| `/checker/activity/new` 대상자 선택 목록 | `get_public_checker_activity_form_targets(p_checker_id uuid)` | `supabaseCheckerActivityFormTargetsService.js` | `Supabase 기준`, `Supabase 기록작성 대상자 목록을 불러왔습니다.` | 체커 매핑 실패 또는 RPC 실패 시 로컬 데이터 표시 | 실제 저장은 기존 localStorage 유지 |

## 3. RPC 파일 목록

아래 RPC 문서가 현재 읽기 전용 전환 범위에 사용된다.

| 문서 파일 | 함수 | 목적 | 읽기 전용 여부 |
| --- | --- | --- | --- |
| `docs/supabase-health-rpc.sql` | `get_public_health_counts()` | 연결 상태 count | 읽기 전용 |
| `docs/supabase-organization-summary-rpc.sql` | `get_public_organization_summaries()` | 총관리자 기관 요약 | 읽기 전용 |
| `docs/supabase-recent-emergencies-rpc.sql` | `get_public_recent_emergency_summaries()` | 총관리자 최근 이상징후 | 읽기 전용 |
| `docs/supabase-super-dashboard-kpi-rpc.sql` | `get_public_super_dashboard_kpis()` | 총관리자 KPI | 읽기 전용 |
| `docs/supabase-organization-detail-rpc.sql` | `get_public_organization_detail(p_organization_id uuid)` | 총관리자 기관 상세 | 읽기 전용 |
| `docs/supabase-super-status-rpc.sql` | `get_public_super_status_summaries()` | 총관리자 현황 요약 | 읽기 전용 |
| `docs/supabase-admin-dashboard-rpc.sql` | `get_public_admin_dashboard(p_organization_id uuid)` | 관리자 대시보드 | 읽기 전용 |
| `docs/supabase-admin-targets-rpc.sql` | `get_public_admin_targets(p_organization_id uuid)` | 관리자 대상자 목록 | 읽기 전용 |
| `docs/supabase-admin-emergencies-rpc.sql` | `get_public_admin_emergencies(p_organization_id uuid)` | 관리자 이상징후 목록 | 읽기 전용 |
| `docs/supabase-admin-activity-records-rpc.sql` | `get_public_admin_activity_records(p_organization_id uuid)` | 관리자 확인기록 목록 | 읽기 전용 |
| `docs/supabase-admin-statistics-rpc.sql` | `get_public_admin_statistics(p_organization_id uuid)` | 관리자 통계 | 읽기 전용 |
| `docs/supabase-admin-report-summary-rpc.sql` | `get_public_admin_report_summary(p_organization_id uuid)` | 관리자 보고서 요약 | 읽기 전용 |
| `docs/supabase-checker-home-rpc.sql` | `get_public_checker_home(p_checker_id uuid)` | 체커 홈 요약 | 읽기 전용 |
| `docs/supabase-checker-targets-rpc.sql` | `get_public_checker_targets(p_checker_id uuid)` | 체커 대상자 목록 | 읽기 전용 |
| `docs/supabase-checker-activity-history-rpc.sql` | `get_public_checker_activity_history(p_checker_id uuid)` | 체커 확인기록 목록 | 읽기 전용 |
| `docs/supabase-checker-activity-form-targets-rpc.sql` | `get_public_checker_activity_form_targets(p_checker_id uuid)` | 기록작성 대상자 선택 목록 | 읽기 전용 |

정리 기준:

- 현재 앱 서비스에서 RPC 호출만 사용한다.
- 이번 단계의 service에서는 `insert`, `update`, `delete`, `upsert`를 호출하지 않는다.
- grant / policy는 RPC 문서와 Supabase 설정 단계에서 관리하며, 앱 코드에서는 읽기 호출만 사용한다.

## 4. service 파일 목록

| 파일 | exported function | 호출 RPC | 성공 source | 실패 source |
| --- | --- | --- | --- | --- |
| `src/services/supabaseHealthService.js` | `getSupabaseConnectionStatus()` | `get_public_health_counts()` | `supabase` 또는 정상 연결 상태 | `not_configured`, `error` 등 |
| `src/services/supabaseOrganizationSummaryService.js` | `getSupabaseOrganizationSummaries()` | `get_public_organization_summaries()` | `supabase` | `not_configured`, `error` |
| `src/services/supabaseRecentEmergencyService.js` | `getSupabaseRecentEmergencySummaries()` | `get_public_recent_emergency_summaries()` | `supabase` | `not_configured`, `error` |
| `src/services/supabaseSuperDashboardKpiService.js` | `getSupabaseSuperDashboardKpis()` | `get_public_super_dashboard_kpis()` | `supabase` | `not_configured`, `error` |
| `src/services/supabaseOrganizationDetailService.js` | `getSupabaseOrganizationDetail(organizationId)` | `get_public_organization_detail()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseSuperStatusService.js` | `getSupabaseSuperStatusSummaries()` | `get_public_super_status_summaries()` | `supabase` | `not_configured`, `error` |
| `src/services/supabaseAdminDashboardService.js` | `getSupabaseAdminDashboard(organizationId)` | `get_public_admin_dashboard()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseAdminTargetsService.js` | `getSupabaseAdminTargets(organizationId)` | `get_public_admin_targets()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencies(organizationId)` | `get_public_admin_emergencies()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseAdminActivityRecordsService.js` | `getSupabaseAdminActivityRecords(organizationId)` | `get_public_admin_activity_records()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseAdminStatisticsService.js` | `getSupabaseAdminStatistics(organizationId)` | `get_public_admin_statistics()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseAdminReportSummaryService.js` | `getSupabaseAdminReportSummary(organizationId)` | `get_public_admin_report_summary()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseCheckerHomeService.js` | `getSupabaseCheckerHome(checkerId)` | `get_public_checker_home()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseCheckerTargetsService.js` | `getSupabaseCheckerTargets(checkerId)` | `get_public_checker_targets()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseCheckerActivityHistoryService.js` | `getSupabaseCheckerActivityHistory(checkerId)` | `get_public_checker_activity_history()` | `supabase` | `not_configured`, `not_found`, `error` |
| `src/services/supabaseCheckerActivityFormTargetsService.js` | `getSupabaseCheckerActivityFormTargets(checkerId)` | `get_public_checker_activity_form_targets()` | `supabase` | `not_configured`, `not_found`, `error` |

추가 확인:

- `src/services`의 Supabase service 검색 기준으로 `supabase.rpc(...)` 호출만 확인했다.
- 이번 단계 service 파일에서는 `supabase.from(...).insert(...)`, `.update(...)`, `.delete(...)`, `.upsert(...)` 패턴이 없다.

## 5. 임시 매핑 정리

### 관리자 organization 매핑

- 위치: `src/pages/adminPages.jsx`
- 함수: `resolveAdminSupabaseOrganizationId(currentUser, data)`
- 목적: 로그인 방식을 바꾸지 않고 관리자 화면에서 seed organization id를 읽기 전용 조회용으로 연결

현재 우선순위:

1. `currentUser` 직접 신호 우선
2. 행복복지관 / 은평 / `admin` / `박서연` 신호면 `11111111-1111-1111-1111-111111111111`
3. 그 다음 충주 / `chungju` 신호면 `22222222-2222-2222-2222-222222222222`
4. 마지막으로 로컬 `organizations`, `targets` 신호와 기존 맵을 참고

이 매핑은 MVP 읽기 전용 단계 전용이며, 실제 운영 단계에서는 `Supabase Auth`, `users.id`, `users.organization_id` 기준으로 대체해야 한다.

### 체커 checker 매핑

- 위치: `src/pages/checkerPages.jsx`
- 함수: `resolveCheckerSupabaseId(user)`
- 목적: 로그인 방식을 바꾸지 않고 체커 화면에서 seed checker id를 읽기 전용 조회용으로 연결

현재 임시 매핑:

- `checker / 1234`
- `김민정`
- 일부 테스트 이름 신호
- 반환 UUID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3`

이 매핑도 MVP 읽기 전용 테스트용이며, 실제 운영 단계에서는 `Supabase Auth` 또는 `users.id` 기반 연결로 대체해야 한다.

## 6. ID mismatch 위험 정리

현재 구조는 읽기와 쓰기가 공존하는 과도기 상태다.

위험 지점:

- Supabase `target.id`와 localStorage `target.id`가 다를 수 있음
- Supabase `emergency_report.id`와 localStorage `emergency.id`가 다를 수 있음
- Supabase `activity_record.id`와 localStorage `record.id`가 다를 수 있음

현재 대응:

- 목록/요약 렌더링은 Supabase 결과를 우선 사용
- 실제 저장/수정/삭제는 기존 localStorage 흐름 유지
- 상세 이동이나 작성 연결은 로컬 대상자 매칭이 가능한 경우에만 안전하게 유지
- 매칭이 안 되면 쓰기 대신 안내 문구를 표시

체커 화면의 대표 안전장치:

- `findLocalTargetId(...)`로 이름 또는 id 기준 매칭
- `localDetailTargetId`가 없는 Supabase 전용 대상자는 상세/저장 연결을 제한
- `/checker/activity/new`에서는 `로컬 대상자와 연결된 경우에만 기록을 저장할 수 있습니다.` 안내 후 저장 차단

## 7. 쓰기 기능 전환 여부

이번 단계에서 Supabase 쓰기 전환은 하지 않았다.

확인 내용:

- 체커 활동 기록 저장: 기존 localStorage 유지
- 체커 이상징후 보고 저장: 기존 localStorage 유지
- 관리자 대상자 등록/수정/상태변경: 기존 localStorage 유지
- 관리자 이상징후 처리 상태/메모: 기존 localStorage 유지
- 관리자 보고서 저장/PDF/인쇄: 기존 localStorage 유지

즉, 현재 Supabase는 조회 전용이다.

## 8. 화면별 QA 체크리스트

아래 항목을 각 전환 화면에서 확인한다.

- `Supabase 기준` 또는 `로컬 데이터 기준` 배지 표시 여부
- 로딩 중 확인 문구 표시 여부
- fallback 문구 표시 여부
- 흰 화면 여부
- 브라우저 Console `ReferenceError` 여부
- 주요 숫자/목록이 선택된 출처 기준으로 바뀌는지 여부
- 필터/탭이 현재 표시 데이터 기준으로 동작하는지 여부
- 쓰기 기능이 기존 localStorage 기준으로 유지되는지 여부

## 9. 다음 단계 메모

다음 단계에서 필요한 작업:

1. `Supabase Auth` 도입 검토
2. `users.id`, `users.organization_id`, `targets.id` 기준 실제 매핑 구조 정리
3. localStorage id와 Supabase id의 임시 연결 제거
4. 읽기 전환 안정화 후 쓰기 전환 단계 분리
5. 마지막 단계에서 RLS 전체 적용
