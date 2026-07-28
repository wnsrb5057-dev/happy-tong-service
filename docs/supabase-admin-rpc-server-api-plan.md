# 관리자 조직 단위 RPC 서버 API 전환 계획

## 1. 작업 목적

관리자 조직 단위 `get_public_*` RPC를 클라이언트 직접 RPC 호출에서 서버 API 호출로 전환하기 위한 감사와 계획을 정리한다.

이번 단계는 문서 작성만 수행한다. 코드, API, DB, SQL, RLS, Auth 설정은 수정하지 않는다.

## 2. 현재 보안 정리 상태

완료된 작업:

- 주요 write 기능은 service_role 기반 서버 API로 전환됨
- 높은 위험 총관리자/기관성 RPC 6개는 `/api/super` 서버 API로 전환됨
- 해당 높은 위험 RPC 6개의 `PUBLIC` / `anon` EXECUTE 제거 완료

다음 보안 정리 대상은 관리자 조직 단위 RPC다.

관리자 조직 단위 RPC는 `p_organization_id`를 인자로 받아 조직 단위 데이터를 반환한다. 현재 mock 로그인은 Supabase Auth session을 만들지 않기 때문에, 바로 anon EXECUTE를 제거하면 관리자 화면 read가 깨질 수 있다.

## 3. 관리자 조직 단위 RPC 후보

- `get_public_admin_dashboard(p_organization_id uuid)`
- `get_public_admin_targets(p_organization_id uuid)`
- `get_public_admin_emergencies(p_organization_id uuid)`
- `get_public_admin_activity_records(p_organization_id uuid)`
- `get_public_admin_statistics(p_organization_id uuid)`
- `get_public_admin_report_summary(p_organization_id uuid)`

## 4. RPC별 사용 위치

| RPC | 호출 파일 | 호출 함수 | 사용 화면 | 전달 인자 | 반환 데이터 용도 | fallback | 화면 영향 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_public_admin_dashboard` | `src/services/supabaseAdminDashboardService.js` | `getSupabaseAdminDashboard` | 관리자 대시보드 | `p_organization_id` | 기관명, 대상자 수, 체커 수, 최근 활동, 최근 이상징후 | local/mock dashboard fallback | 높음. 관리자 첫 화면 최신 데이터 영향 |
| `get_public_admin_targets` | `src/services/supabaseAdminTargetsService.js` | `getSupabaseAdminTargets`, `getSupabaseAdminTargetById` | 대상자 목록, 대상자 상세/수정 fallback | `p_organization_id` | 대상자 목록 및 상세용 normalize 데이터 | localStorage fallback | 높음. Supabase-only 대상자 표시 영향 |
| `get_public_admin_emergencies` | `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencies`, `getSupabaseAdminEmergencyById` | 이상징후 목록, 이상징후 상세 | `p_organization_id` | 이상징후 목록/상세 기본 데이터 | localStorage fallback | 높음. 신규 Supabase 보고 표시 영향 |
| `get_public_admin_activity_records` | `src/services/supabaseAdminActivityRecordsService.js` | `getSupabaseAdminActivityRecords` | 생활 확인 기록 목록 | `p_organization_id` | 활동 기록 목록 | localStorage fallback | 높음. Supabase activity_records 표시 영향 |
| `get_public_admin_statistics` | `src/services/supabaseAdminStatisticsService.js` | `getSupabaseAdminStatistics` | 통계 화면 | `p_organization_id` | 대상자/체커/이상징후/활동 통계 | local 계산 fallback | 중간~높음. 통계 최신성 영향 |
| `get_public_admin_report_summary` | `src/services/supabaseAdminReportSummaryService.js` | `getSupabaseAdminReportSummary` | 보고서 생성/요약 화면 | `p_organization_id` | 보고서 생성용 요약, 최근 이상징후, 조치 요약 | local report summary fallback | 중간~높음. 보고서 요약 최신성 영향 |

추가 확인:

- `src/pages/adminPages.jsx` 자체에는 직접 `supabase.rpc` 호출이 없다.
- 관리자 화면은 위 service 함수를 import해 사용한다.

## 5. 관리자 화면 read 흐름

확인된 화면/함수 흐름:

- `AdminDashboard` → `getSupabaseAdminDashboard`
- `AdminTargets` → `getSupabaseAdminTargets`
- `AdminTargetDetail` → `getSupabaseAdminTargetById`
- `AdminActivities` → `getSupabaseAdminActivityRecords`
- `AdminEmergencies` → `getSupabaseAdminEmergencies`
- `AdminEmergencyDetail` → `getSupabaseAdminEmergencyById`
- `AdminReportNew` → `getSupabaseAdminReportSummary`
- `AdminStatistics` → `getSupabaseAdminStatistics`

대부분 `resolveAdminSupabaseOrganizationId(currentUser, data)`로 관리자 조직 id를 구한 뒤 service에 전달한다.

## 6. 이미 서버 API 전환된 기능과 아직 남은 read 구분

이미 서버 API를 사용하는 주요 write/read:

- 생활 확인 기록 작성: `/api/activity-records/create`
- 이상징후 보고 작성: `/api/emergency-reports/create`
- 이상징후 처리 상태 변경: `/api/emergency-reports/update-status`
- 대상자 등록/수정/상태 변경: `/api/targets`
- 체커 등록/수정/상태 변경: `/api/checkers`
- 보고서 저장/read 일부: `/api/reports`
- 총관리자/기관성 read: `/api/super`

아직 클라이언트 RPC read가 남은 관리자 read:

- 관리자 대시보드
- 대상자 목록/상세
- 이상징후 목록/상세
- 생활 확인 기록 목록
- 통계 화면
- 보고서 생성/요약 화면

주의:

- `supabaseAdminEmergenciesService.js`는 RPC 외에 `emergency_handling_logs` 직접 select가 있다.
- `supabaseAdminActivityRecordsService.js`는 RPC 외에 `activity_records`, `targets` 직접 select 보강이 있다.
- 서버 API 전환 시 이 보조 직접 select도 서버 API 내부로 함께 옮겨야 한다.

## 7. 서버 API 후보 비교

### A안: `api/admin-read.js` 통합 API

action 후보:

- `getDashboard`
- `getTargets`
- `getEmergencies`
- `getActivityRecords`
- `getStatistics`
- `getReportSummary`

장점:

- 관리자 조직 단위 read 책임이 명확하다.
- Vercel Hobby 플랜 Serverless Function 개수 제한에 맞춰 API 파일 1개로 통합할 수 있다.
- 기존 `/api/reports`, `/api/targets`, `/api/checkers` 책임을 흐리지 않는다.

단점:

- action 수가 많아지므로 내부 분기와 응답 형식을 명확히 유지해야 한다.

### B안: 기존 API 재사용

후보:

- `/api/reports`
- `/api/targets`
- `/api/emergency-reports/*`

판단:

- 기존 API는 특정 도메인의 write/read 책임을 가지고 있다.
- 관리자 전체 read를 넣으면 책임 경계가 흐려질 수 있다.
- 추천하지 않는다.

## 8. 추천 API 구조

추천은 `api/admin-read.js` 단일 통합 API다.

기본 구조:

- POST 전용
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `body.action` 기반 분기
- `body.organizationId` 또는 `body.organization_id` 필수
- 잘못된 action은 `INVALID_ACTION`
- 조직 id 누락은 `MISSING_ORGANIZATION_ID`
- request body 전체 로그 금지
- service_role key 노출 금지

응답 후보:

- `getDashboard` → `{ success: true, dashboard }`
- `getTargets` → `{ success: true, targets }`
- `getEmergencies` → `{ success: true, emergencies }`
- `getActivityRecords` → `{ success: true, records }`
- `getStatistics` → `{ success: true, statistics }`
- `getReportSummary` → `{ success: true, summary }`

초기 구현은 기존 RPC를 서버에서 service_role으로 호출하고, 기존 service normalize 함수가 화면 반환 형태를 유지하도록 한다.

## 9. service 전환 대상 후보

| 파일 | 현재 상태 | 전환 action | 반환 형태 유지 방식 | fallback |
| --- | --- | --- | --- | --- |
| `src/services/supabaseAdminDashboardService.js` | `supabase.rpc("get_public_admin_dashboard")` 직접 호출 | `getDashboard` | 기존 `normalizeDashboard` 유지 | 기존 local fallback 유지 |
| `src/services/supabaseAdminTargetsService.js` | `supabase.rpc("get_public_admin_targets")` 직접 호출 | `getTargets` | 기존 `normalizeTarget` 유지 | 기존 localStorage fallback 유지 |
| `src/services/supabaseAdminEmergenciesService.js` | `supabase.rpc("get_public_admin_emergencies")`, `emergency_handling_logs` 직접 select | `getEmergencies` | 기존 `normalizeEmergency`, `normalizeHandlingLog` 유지 | 기존 localStorage fallback 유지 |
| `src/services/supabaseAdminActivityRecordsService.js` | `supabase.rpc("get_public_admin_activity_records")`, `activity_records`/`targets` 직접 select | `getActivityRecords` | 기존 `normalizeRecord` 및 보강 로직 유지 | 기존 localStorage fallback 유지 |
| `src/services/supabaseAdminStatisticsService.js` | `supabase.rpc("get_public_admin_statistics")` 직접 호출 | `getStatistics` | 기존 `normalizeStatistics` 유지 | 기존 local 계산 fallback 유지 |
| `src/services/supabaseAdminReportSummaryService.js` | `supabase.rpc("get_public_admin_report_summary")` 직접 호출 | `getReportSummary` | 기존 `normalizeSummary` 유지 | 기존 report summary fallback 유지 |

## 10. 전환 후 권한 정리 가능성

서버 API 전환과 QA가 완료되면 아래 RPC의 `PUBLIC` / `anon` EXECUTE 제거를 검토할 수 있다.

- `get_public_admin_dashboard`
- `get_public_admin_targets`
- `get_public_admin_emergencies`
- `get_public_admin_activity_records`
- `get_public_admin_statistics`
- `get_public_admin_report_summary`

권한 정리 기준:

- `src`에서 해당 RPC 직접 호출 없음
- 관리자 read service가 `/api/admin-read` fetch로 전환됨
- `api/admin-read.js` 내부에서만 service_role으로 RPC 호출
- 관리자 화면 fallback 유지
- API smoke test 통과
- 관리자 화면 QA 통과

주의:

- `authenticated` EXECUTE 제거는 별도 단계다.
- `postgres`와 `service_role` 권한은 유지해야 한다.
- 화면 QA 후 권한 제거를 진행한다.

## 11. 구현 단계 초안

1. 관리자 RPC 사용 위치 최종 확인
2. `api/admin-read.js` 통합 API 생성
3. action별 RPC/service_role 호출 구현
4. 관리자 read service를 fetch 기반으로 전환
5. 기존 normalize/fallback 유지
6. `npm run build`
7. 로컬/배포 API smoke test
8. 관리자 화면 QA
9. `src` 직접 RPC 제거 확인
10. PUBLIC/anon EXECUTE 제거 준비 문서 작성
11. Supabase SQL Editor에서 revoke 실행

## 12. 테스트 계획

API smoke test:

- `POST /api/admin-read {}` → `400 INVALID_ACTION`
- `POST /api/admin-read action=getDashboard organizationId=...` → `200 success true`
- `POST /api/admin-read action=getTargets organizationId=...` → `200 success true`
- `POST /api/admin-read action=getEmergencies organizationId=...` → `200 success true`
- `POST /api/admin-read action=getActivityRecords organizationId=...` → `200 success true`
- `POST /api/admin-read action=getStatistics organizationId=...` → `200 success true`
- `POST /api/admin-read action=getReportSummary organizationId=...` → `200 success true`

화면 QA:

- `admin / 1234` 로그인
- 관리자 대시보드 정상
- 대상자 목록 정상
- 대상자 상세 진입 정상
- 이상징후 목록 정상
- 이상징후 상세 진입 정상
- 생활 확인 기록 목록 정상
- 통계 화면 정상
- 보고서 요약/생성 화면 정상

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 생성하지 않음
- DB/SQL/RLS/Auth 수정하지 않음
- RPC 권한 revoke하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
- 아직 완료되지 않은 전환을 완료했다고 판단하지 않음
