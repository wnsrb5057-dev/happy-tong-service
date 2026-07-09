# 해피통서비스 Supabase 전환 계획

## 1. 목적

현재 해피통서비스는 `localStorage` 기반 MVP로 동작합니다.  
다음 단계에서는 기존 화면과 역할 구조를 유지하면서 Supabase 기반 데이터 저장 구조로 천천히 전환합니다.

이 문서의 목표는 전환 순서와 범위를 정리하는 것입니다.

## 2. 현재 단계

- `localStorage` 기반 기능 유지
- 로그인 구조 유지
- 관리자 / 체커 / 총관리자 화면 유지
- 기존 CRUD 및 보고서 기능 유지
- Supabase는 아직 실제 조회/저장에 사용하지 않음

## 3. Supabase 클라이언트 준비

- 준비 파일 위치: `src/services/supabaseClient.js`
- 환경변수:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

현재 단계에서는 위 파일만 준비하고, 앱의 기존 데이터 흐름은 바꾸지 않습니다.

## 4. 전환 원칙

1. 기존 `localStorage` 기능을 한 번에 제거하지 않음
2. 읽기 전용 조회부터 단계적으로 Supabase 전환
3. 쓰기 기능은 조회 안정화 후 전환
4. 전환 중에도 기존 관리자/체커/총관리자 화면은 계속 동작해야 함
5. 인증 전환은 마지막 단계에서 검토

## 5. 실제 데이터 전환 순서

1. `organizations` 조회
2. `users` 조회
3. `targets` 조회
4. `activity_records` 조회
5. `emergency_reports` 조회
6. 쓰기 기능 전환
7. RLS 적용
8. Supabase Auth 검토

## 6. 권장 구현 순서

### 1단계

- Supabase 프로젝트 생성
- 환경변수 설정
- `src/services/supabaseClient.js` 준비
- 앱에서 아직 import하지 않음

### 2단계

- 읽기 전용 서비스부터 별도 추가
- 기존 `localStorage` 서비스와 병행 가능 구조 유지
- 기관, 사용자, 대상자 조회를 우선 연결

### 3단계

- 활동기록, 이상징후, 보고서 조회 전환
- 관리자 대시보드 집계 데이터 전환

### 4단계

- 대상자/체커/이상징후 쓰기 기능 전환
- 보고서 저장 전환

### 5단계

- 기관별 권한 분리를 위한 RLS 적용
- 로그인 구조를 Supabase Auth 기반으로 검토

## 7. 주의사항

- 현재 기본 계정(`checker / 1234`, `admin / 1234`, `super_admin / 1234`)은 그대로 유지해야 합니다.
- 전환 초기에는 화면 로직보다 데이터 접근 계층부터 교체하는 것이 안전합니다.
- 인증, 권한, RLS는 데이터 조회/저장 전환이 안정화된 뒤 적용하는 것이 좋습니다.
- 실서비스 단계에서는 비밀번호를 `localStorage` 방식으로 유지하지 않고 안전한 인증 구조로 전환해야 합니다.
- Supabase 연결 확인은 `/super/dashboard`의 읽기 전용 상태 카드에서만 진행합니다. RLS 정책 적용 전에는 anon key 조회가 제한될 수 있으므로, 연결 오류가 나더라도 기존 localStorage MVP 동작에는 영향을 주지 않도록 유지합니다.
- 현재 `schema.sql`은 RLS enable 상태이므로, RLS policy 적용 전 anon key 기반 count 조회는 0건으로 표시될 수 있습니다. 이는 연결 실패가 아니라 접근 정책 미적용 상태일 수 있습니다.

## 8. 참고 문서

- 스키마 설계: `docs/supabase-schema.md`
- 데모 seed 데이터: `docs/supabase-seed.sql`
- RLS 정책 초안: `docs/supabase-rls-policies.sql`
- 프로젝트 생성 / 환경변수 설정 가이드: `docs/supabase-setup-guide.md`
- 수동 QA 체크리스트: `docs/manual-test-checklist.md`
- Auth / users 매핑 전략: `docs/supabase-auth-user-mapping-strategy.md`
- public.users 스키마 초안: `docs/supabase-users-schema-plan.md`

## 9. RLS 적용 순서

1. `docs/supabase-schema.sql` 실행
2. `docs/supabase-seed.sql` 실행
3. `docs/supabase-rls-policies.sql` 검토
4. `docs/supabase-rls-policies.sql` 적용
5. Supabase Auth 또는 `users.id` 매핑 구조 확인
6. 읽기 전용 조회부터 연결
7. 쓰기 기능 연결

## 10. Health Check RPC 메모

- Supabase 연결 상태 카드는 테이블 row를 직접 공개하지 않기 위해 `docs/supabase-health-rpc.sql`의 `get_public_health_counts()` RPC를 우선 사용합니다.
- 이 RPC는 `organizations`, `users`, `targets`의 count만 반환합니다.
- RPC가 아직 적용되지 않았거나 실행 오류가 나면 앱은 기존 direct count 방식으로 fallback합니다.

## 11. 기관 요약 읽기 전용 전환 메모

- 읽기 전용 전환 1단계에서는 총관리자 기관 요약 화면만 `docs/supabase-organization-summary-rpc.sql`의 `get_public_organization_summaries()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 12. 최근 이상징후 요약 읽기 전용 전환 메모

- 읽기 전용 전환 2단계에서는 총관리자 최근 이상징후 요약만 `docs/supabase-recent-emergencies-rpc.sql`의 `get_public_recent_emergency_summaries()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 13. 총관리자 KPI 읽기 전용 전환 메모

- 읽기 전용 전환 3단계에서는 총관리자 대시보드 상단 KPI가 `docs/supabase-super-dashboard-kpi-rpc.sql`의 `get_public_super_dashboard_kpis()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 14. 총관리자 기관 관리 화면 읽기 전용 전환 메모

- 읽기 전용 전환 4단계에서는 총관리자 기관 관리 화면(`/super/organizations`)이 기존 `get_public_organization_summaries()` RPC 결과를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 15. Super organization detail read-only step

- Read-only transition step 5 uses docs/supabase-organization-detail-rpc.sql and the get_public_organization_detail(p_organization_id uuid) RPC for /super/organizations/:id.
- If the RPC is unavailable, fails, or Supabase is not configured, the screen falls back to the existing localStorage/mock organization detail summary.


## 16. Super status read-only step

- Read-only transition step 6 uses docs/supabase-super-status-rpc.sql and the get_public_super_status_summaries() RPC for /super/status.
- If the RPC fails or Supabase is not configured, the screen falls back to the existing localStorage/mock data summary.


## 17. Admin dashboard read-only step

- Read-only transition step 7 uses docs/supabase-admin-dashboard-rpc.sql and the get_public_admin_dashboard(p_organization_id uuid) RPC for /admin/dashboard.
- In the current MVP stage, a temporary mapping connects local admin organizations to Supabase seed organization ids. If the mapping or RPC fails, the dashboard falls back to the existing localStorage/mock data.

## 18. Admin targets read-only step

- Read-only transition step 8 uses docs/supabase-admin-targets-rpc.sql and the get_public_admin_targets(p_organization_id uuid) RPC for /admin/targets.
- In the current MVP stage, local admin organizations are temporarily mapped to Supabase seed organization ids.
- If the mapping or RPC fails, the target list falls back to the existing localStorage/mock data.
- Target registration, editing, and lifecycle updates still use the existing localStorage flow in this stage.

## 19. Admin emergencies read-only step

- Read-only transition step 9 uses docs/supabase-admin-emergencies-rpc.sql and the get_public_admin_emergencies(p_organization_id uuid) RPC for /admin/emergencies.
- In the current MVP stage, local admin organizations are temporarily mapped to Supabase seed organization ids.
- If the mapping or RPC fails, the emergency list falls back to the existing localStorage/mock data.
- Emergency handling status changes, memos, guardian contact checks, and visit-required checks still use the existing localStorage flow in this stage.

## 20. Admin activity records read-only step

- Read-only transition step 10 uses docs/supabase-admin-activity-records-rpc.sql and the get_public_admin_activity_records(p_organization_id uuid) RPC for /admin/activities.
- In the current MVP stage, local admin organizations are temporarily mapped to Supabase seed organization ids.
- If the mapping or RPC fails, the activity records list falls back to the existing localStorage/mock data.
- Activity record detail, update, and delete flows still use the existing localStorage flow in this stage.

## 21. Admin statistics read-only step

- Read-only transition step 11 uses docs/supabase-admin-statistics-rpc.sql and the get_public_admin_statistics(p_organization_id uuid) RPC for /admin/statistics.
- In the current MVP stage, local admin organizations are temporarily mapped to Supabase seed organization ids.
- If the mapping or RPC fails, the statistics screen falls back to the existing localStorage/mock data.
- Existing period filters and chart rendering remain in place, and write flows stay on the localStorage side in this stage.

## 22. Admin report read-only step

- 읽기 전용 전환 12단계에서는 관리자 보고서 화면이 docs/supabase-admin-report-summary-rpc.sql의 get_public_admin_report_summary(p_organization_id uuid) RPC를 우선 사용한다.
- 현재 MVP 단계에서는 로컬 기관과 Supabase seed 기관 id를 임시 매핑하며, 실패 시 기존 localStorage/mock 보고서 요약으로 fallback한다.
- 보고서 저장/생성/PDF 인쇄 기능은 아직 기존 흐름을 유지한다.

## 23. Checker home read-only step

- 읽기 전용 전환 13단계에서는 체커 홈 화면(`/checker/home`)이 `docs/supabase-checker-home-rpc.sql`의 `get_public_checker_home(p_checker_id uuid)` RPC를 우선 사용한다.
- 현재 MVP 단계에서는 로컬 체커 계정과 Supabase seed 체커 id를 임시 매핑하며, 실패 시 기존 localStorage/mock 체커 홈 데이터로 fallback한다.
- 생활 확인 기록 작성과 이상징후 보고 저장은 아직 localStorage 기준으로 유지한다.
## 24. Checker targets read-only step

- 읽기 전용 전환 14단계에서는 체커 대상자 목록 화면(`/checker/targets`)이 `docs/supabase-checker-targets-rpc.sql`의 `get_public_checker_targets(p_checker_id uuid)` RPC를 우선 사용한다.
- 현재 MVP 단계에서는 로컬 체커 계정과 Supabase seed 체커 id를 임시 매핑하며, 실패 시 기존 localStorage/mock 체커 대상자 목록으로 fallback한다.
- 대상자 상세 이동, 생활 확인 기록 작성, 이상징후 보고 저장은 아직 localStorage 기준으로 유지한다.
## 25. Checker activity history read-only step

- 읽기 전용 전환 15단계에서는 체커 확인기록 화면(`/checker/activity/history`)이 `docs/supabase-checker-activity-history-rpc.sql`의 `get_public_checker_activity_history(p_checker_id uuid)` RPC를 우선 사용한다.
- 현재 MVP 단계에서는 로컬 체커 계정과 Supabase seed 체커 id를 임시 매핑하며, 실패 시 기존 localStorage/mock 체커 확인기록 목록으로 fallback한다.
- 확인기록 작성, 이상징후 보고 저장, 기록 상세 수정은 아직 localStorage 기준으로 유지한다.

## 26. Checker activity new target selection read-only step

- 읽기 전용 전환 16단계에서는 체커 확인기록 작성 화면(`/checker/activity/new`)의 대상자 선택 목록이 `docs/supabase-checker-activity-form-targets-rpc.sql`의 `get_public_checker_activity_form_targets(p_checker_id uuid)` RPC를 우선 사용한다.
- 현재 MVP 단계에서는 로컬 체커 계정과 Supabase seed 체커 id를 임시 매핑하며, 실패 시 기존 localStorage/mock 대상자 목록으로 fallback한다.
- 실제 확인기록 저장, 이상징후 보고 저장, 대상자 선택 이후의 쓰기 흐름은 아직 localStorage 기준으로 유지한다.
- Supabase target id와 localStorage target id가 다를 수 있으므로, 로컬 대상자와 연결된 경우에만 기존 저장 흐름으로 이어진다.

## 27. 현재 완료 범위 요약

- 총관리자 읽기 전용 전환 완료:
  - `/super/dashboard`
  - `/super/organizations`
  - `/super/organizations/:id`
  - `/super/status`
- 관리자 읽기 전용 전환 완료:
  - `/admin/dashboard`
  - `/admin/targets`
  - `/admin/emergencies`
  - `/admin/activities`
  - `/admin/statistics`
  - `/admin/reports`
- 체커 읽기 전용 전환 완료:
  - `/checker/home`
  - `/checker/targets`
  - `/checker/activity/history`
  - `/checker/activity/new` 대상자 선택 목록
- 위 화면들은 모두 Supabase 조회 실패 시 기존 localStorage/mock 데이터로 fallback한다.
- 쓰기 기능은 아직 전환하지 않았으며 기존 localStorage 흐름을 유지한다.

## 28. 임시 매핑과 다음 단계 메모

- 현재 단계의 organizationId/checkerId 연결은 MVP 읽기 전용 전환을 위한 임시 매핑이다.
- 관리자 계정은 `resolveAdminSupabaseOrganizationId()`에서 로컬 계정 신호를 우선 확인해 seed organization id로 연결한다.
- 체커 계정은 `resolveCheckerSupabaseId()`에서 로컬 계정 신호를 우선 확인해 seed checker id로 연결한다.
- 이 매핑은 localStorage 데이터와 Supabase seed 데이터가 완전히 같지 않을 수 있다는 전제를 가진다.
- 다음 단계에서는 `Supabase Auth`, `users.id`, `users.organization_id` 기준의 실제 사용자 매핑으로 대체해야 한다.
- 그 이후에만 쓰기 전환과 RLS 전체 적용을 진행한다.

## 29. Auth / users 매핑 설계 문서 메모

- 읽기 전환 1차 마무리 이후에는 구현보다 먼저 `docs/supabase-auth-user-mapping-strategy.md` 문서 기준으로 Auth / users / organization 연결 구조를 확정한다.
- `public.users` 권장 컬럼, id 전략 비교, 시범 Auth 계정 계획은 `docs/supabase-users-schema-plan.md` 문서를 기준으로 검토한다.
- 현재의 임시 admin/checker UUID 매핑은 유지하되, 이후 단계에서 제거 가능한 상태로만 관리한다.
- 다음 설계 기준은 `Supabase Auth + public.users + organization_id + role + status + RLS` 조합이다.

## 30. 이후 전환 순서 갱신

1. Auth / users 매핑 설계 문서 확정
2. `public.users` 스키마 문서 검토와 실제 Supabase 테이블 상태 확인
3. Supabase Auth 시범 계정 생성
4. `public.users`와 `auth.users` 연결
5. 로그인 후 `currentUser`를 Supabase 기준으로 로드
6. 기존 임시 admin/checker UUID 매핑 제거 준비
7. 기존 `get_public_*` RPC를 `auth.uid()` 기반 `get_my_*` 또는 동등한 authenticated RPC로 순차 전환
8. 역할 / organization / assigned target 기준 RLS 정책 적용
9. 마지막 단계에서 쓰기 기능 전환 시작
