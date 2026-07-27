# 높은 위험 Supabase RPC 서버 API 전환 계획

## 1. 작업 목적

PUBLIC/anon EXECUTE가 열려 있는 `get_public_*` RPC 중 높은 위험 RPC를 서버 API로 전환하기 위한 감사와 계획을 정리한다.

이번 단계는 문서 작성만 수행한다. 코드, API, DB, SQL, RLS, Auth 설정은 수정하지 않는다.

## 2. 현재 RPC 권한 위험 배경

현재 다수의 `get_public_*` RPC는 `SECURITY DEFINER`로 생성되어 있으며, `PUBLIC`, `anon`, `authenticated`에 EXECUTE 권한이 열려 있다.

테이블 write 권한 1단계 정리는 완료되었지만, SELECT 권한과 RPC EXECUTE 권한은 아직 정리되지 않았다. 특히 `SECURITY DEFINER` RPC는 테이블 SELECT 권한을 줄여도 함수 경로로 데이터를 반환할 수 있다.

## 3. mock 로그인과 anon EXECUTE 영향

현재 mock 로그인은 Supabase Auth session을 생성하지 않고 localStorage/currentUser만 저장한다.

RPC service들은 `src/services/supabaseClient.js`의 `VITE_SUPABASE_ANON_KEY` 기반 client를 사용한다. 따라서 mock 로그인 상태에서 RPC 호출은 anon role로 실행될 가능성이 크다.

anon EXECUTE를 바로 제거하면 총관리자/관리자/체커 화면의 read 경로가 깨질 수 있으므로, 높은 위험 RPC부터 서버 API로 감싸는 방향을 먼저 검토한다.

## 4. 높은 위험 RPC 후보

- `get_public_health_counts()`
- `get_public_organization_summaries()`
- `get_public_organization_detail(p_organization_id uuid)`
- `get_public_recent_emergency_summaries()`
- `get_public_super_dashboard_kpis()`
- `get_public_super_status_summaries()`

## 5. RPC별 사용 위치

| RPC | 호출 파일 | 호출 함수 | 사용 화면 | 전달 인자 | 반환 데이터 용도 | fallback | 화면 깨짐 영향 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_public_health_counts()` | `src/services/supabaseHealthService.js` | `getSupabaseConnectionStatus` | Supabase 연결/상태 확인 | 없음 | organizations/users/targets count | 직접 count select fallback 있음 | 낮음~중간. 상태 점검 표시 영향 |
| `get_public_organization_summaries()` | `src/services/supabaseOrganizationSummaryService.js` | `getSupabaseOrganizationSummaries` | 총관리자 기관 목록 | 없음 | 기관명, 지역, 관리자명, 대상자/체커/미해결 이상징후 수 | `superAdminPages.jsx`에서 local organization summary fallback | 높음. Supabase 최신 기관 요약 표시 영향 |
| `get_public_organization_detail(p_organization_id uuid)` | `src/services/supabaseOrganizationDetailService.js` | `getSupabaseOrganizationDetail` | 총관리자 기관 상세 | `p_organization_id` | 기관 상세, 대상자/체커/최근 이상징후 등 | `buildLocalOrganizationDetail` fallback | 높음. 기관 상세 최신 데이터 표시 영향 |
| `get_public_recent_emergency_summaries()` | `src/services/supabaseRecentEmergencyService.js` | `getSupabaseRecentEmergencySummaries` | 총관리자 최근 이상징후 요약 | 없음 | 최근 이상징후 목록/요약 | `buildRecentEmergencySummaries` fallback | 중간~높음. 전체 최근 이상징후 노출 RPC라 권한 위험 큼 |
| `get_public_super_dashboard_kpis()` | `src/services/supabaseSuperDashboardKpiService.js` | `getSupabaseSuperDashboardKpis` | 총관리자 대시보드 KPI | 없음 | 기관 수, active 대상자 수, 체커 수, 이상징후 수 | local KPI fallback | 높음. 총관리자 대시보드 최신 KPI 영향 |
| `get_public_super_status_summaries()` | `src/services/supabaseSuperStatusService.js` | `getSupabaseSuperStatusSummaries` | 총관리자 기관 상태 | 없음 | 기관별 운영 상태, 위험도, 최근 활동/이상징후 | `buildLocalSuperStatusSummaries` fallback | 높음. 전체 기관 상태 요약 노출 위험 큼 |

## 6. 현재 총관리자/기관 read 흐름

`src/App.jsx`에서 `super_admin` 역할은 아래 경로로 진입한다.

- `/super/dashboard` → `SuperAdminDashboard`
- `/super/organizations` → `SuperOrganizations`
- `/super/organizations/:id` → `SuperOrganizationDetailPage`
- `/super/status` → `SuperStatusPlaceholder`

`src/pages/superAdminPages.jsx`는 각 화면에서 localStorage/mock 기반 local summary를 먼저 계산하고, Supabase RPC 결과가 성공하면 Supabase 값을 우선 표시한다.

확인된 hook 흐름:

- `useOrganizationSummarySource` → `getSupabaseOrganizationSummaries`
- `useRecentEmergencySummarySource` → `getSupabaseRecentEmergencySummaries`
- `useSuperDashboardKpiSource` → `getSupabaseSuperDashboardKpis`
- `useOrganizationDetailSource` → `getSupabaseOrganizationDetail`
- `useSuperStatusSource` → `getSupabaseSuperStatusSummaries`

따라서 서버 API 전환 시에도 기존 local fallback은 유지할 수 있다.

## 7. 서버 API 전환 후보 비교

### A안: `api/super.js` 통합 API

action 후보:

- `getDashboardKpis`
- `getStatusSummaries`
- `getRecentEmergencySummaries`
- `getOrganizationSummaries`
- `getOrganizationDetail`
- `getHealthCounts`

장점:

- 총관리자/기관성 read를 한 API에 모을 수 있다.
- Vercel Hobby 플랜의 Serverless Function 개수 제한에 유리하다.
- 클라이언트에서 직접 RPC를 호출하지 않도록 바꾸기 쉽다.

단점:

- health check까지 super API에 넣는 것이 이름상 조금 넓다.

### B안: `api/organizations.js` 통합 API

action 후보:

- `listOrganizations`
- `getOrganizationDetail`
- `getRecentEmergencySummaries`
- `getHealthCounts`

장점:

- 기관 목록/상세 중심으로 이름이 명확하다.

단점:

- super dashboard KPI/status summary까지 넣으면 API 이름과 역할이 어긋난다.

### C안: 기존 API 재사용

후보:

- `/api/reports`
- `/api/targets`
- `/api/checkers`

판단:

- 보고서/대상자/체커 API에 총관리자 read를 추가하면 책임 경계가 흐려진다.
- 기존 API의 action 분기가 더 복잡해진다.
- 추천하지 않는다.

## 8. 추천 API 구조

추천안은 `api/super.js` 단일 통합 API다.

예상 요청:

```json
{
  "action": "getDashboardKpis"
}
```

```json
{
  "action": "getOrganizationDetail",
  "organizationId": "..."
}
```

지원 action 후보:

- `getDashboardKpis`
- `getStatusSummaries`
- `getRecentEmergencySummaries`
- `getOrganizationSummaries`
- `getOrganizationDetail`
- `getHealthCounts`

서버 API 내부는 service_role Supabase client를 사용한다. 초기 구현은 기존 RPC를 서버에서 호출해 응답 형태를 유지하고, 이후 필요하면 직접 select/query로 대체한다.

클라이언트 서비스는 기존 함수명을 유지하되 내부 구현만 `supabase.rpc(...)`에서 `fetch("/api/super")`로 바꾸는 방식이 가장 작다.

## 9. 전환 후 권한 정리 가능성

서버 API 전환이 완료되고 화면 QA가 끝나면 아래 RPC의 anon EXECUTE 제거를 검토할 수 있다.

- `get_public_health_counts`
- `get_public_organization_summaries`
- `get_public_organization_detail`
- `get_public_recent_emergency_summaries`
- `get_public_super_dashboard_kpis`
- `get_public_super_status_summaries`

권한 정리 방향:

- `PUBLIC EXECUTE` 제거 검토
- `anon EXECUTE` 제거 검토
- `authenticated EXECUTE`는 운영 로그인 구조와 RPC 내부 auth 검증 여부를 보고 별도 판단
- `service_role`과 `postgres`는 유지

주의:

- 서버 API가 아직 기존 RPC를 내부 호출하는 구조라면 service_role EXECUTE 권한은 필요하다.
- 클라이언트 직접 RPC 호출이 완전히 제거되었는지 확인한 뒤 revoke해야 한다.

## 10. 구현 단계 초안

1. 높은 위험 RPC 사용 위치를 최종 확인한다.
2. `api/super.js` 통합 API를 설계한다.
3. action별 응답 형식을 기존 service 결과와 맞춘다.
4. 기존 Supabase RPC service 내부를 `fetch("/api/super")` 기반으로 바꾼다.
5. `superAdminPages.jsx`의 기존 fallback 흐름은 유지한다.
6. `npm run build`를 실행한다.
7. super_admin 화면 QA를 진행한다.
8. Vercel 배포 후 `/api/super` 각 action smoke test를 진행한다.
9. 클라이언트 직접 RPC 호출 제거 여부를 재검색한다.
10. RPC anon EXECUTE 제거는 별도 단계에서 수행한다.

## 11. 테스트 계획

전환 후 확인할 항목:

- `super_admin / 1234` 로그인
- 총관리자 대시보드 KPI 표시
- 기관 목록 표시
- 기관 상세 표시
- 최근 이상징후 요약 표시
- 기관 상태 화면 표시
- Supabase 연결 상태/health check 표시
- `/api/super`에 빈 body 또는 잘못된 action 요청 시 `INVALID_ACTION` 반환
- `getDashboardKpis` action 200 확인
- `getStatusSummaries` action 200 확인
- `getRecentEmergencySummaries` action 200 확인
- `getOrganizationSummaries` action 200 확인
- `getOrganizationDetail` action 200 확인
- `getHealthCounts` action 200 확인
- Supabase 실패 시 localStorage fallback 유지

## 12. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 생성하지 않음
- DB/SQL/RLS/Auth 수정하지 않음
- RPC 권한 revoke하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
- RPC 권한 정리를 완료했다고 판단하지 않음
