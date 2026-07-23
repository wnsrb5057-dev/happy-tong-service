# 관리자 보고서 read/merge 감사

## 1. 작업 목적

관리자 보고서 목록, 미리보기, 상세 흐름에서 Supabase `public.admin_reports` row를 읽고 있는지 확인하고, 후속 read/merge 전환 구현 방향을 정리한다.

이번 단계는 감사/문서화만 수행하며 코드, API, DB, RLS, Auth, package 설정은 수정하지 않는다.

## 2. 현재 보고서 write 완료 상태

보고서 write 전환은 완료된 상태다.

완료된 내용:

- `public.admin_reports` 스키마 보완
- `status` 컬럼 추가
- status 허용값: `draft`, `saved`, `completed`, `published`
- `report_data default '{}'::jsonb`
- `POST /api/reports` 통합 API 구현
- 지원 action: `saveDraft`, `saveReport`, `updateReport`
- 관리자 화면 저장 시 `admin_reports` row 생성 확인
- `created_by` null 보완 API 단독 테스트 성공
- 기존 localStorage 보고서 초안/저장 흐름 유지

## 3. 현재 보고서 목록 read 흐름

현재 코드 기준으로 별도의 `AdminReports` 목록 컴포넌트는 확인되지 않았다.

라우팅 확인:

- `/admin/reports`
- `/admin/reports/new`

위 두 경로는 모두 `AdminReportNew`로 연결된다.

```jsx
if (location.pathname === "/admin/reports" || location.pathname === "/admin/reports/new") {
  return <AdminReportNew data={data} actions={actions} navigate={navigate} currentUser={user} />;
}
```

관리자 보고서 저장 목록 데이터는 App 상태의 `adminReports`에 존재한다.

관련 흐름:

- `App.jsx`
  - `const [adminReports, setAdminReports] = usePersistentState(readAdminReports, writeAdminReports);`
  - `actions.addAdminReport(report)`에서 local state/localStorage에 저장

- `src/services/adminReportDataService.js`
  - `readAdminReports()`
  - `writeAdminReports(reports)`

현재 `readAdminReports()`는 mock seed와 localStorage만 merge한다.

```js
const savedReports = readWithMigration(STORAGE_KEYS.adminReports, [], LEGACY_STORAGE_KEYS.adminReports);
return mergeById(initialAdminReports, Array.isArray(savedReports) ? savedReports : []);
```

확인 결과:

- 저장된 `public.admin_reports` 목록을 직접 읽는 service는 아직 없음
- `getSupabaseAdminReportSummary`는 보고서 목록 read가 아니라 통계 요약 RPC read임
- `/api/reports`에도 현재 `listReports` 또는 `getReport` action은 없음

## 4. 현재 보고서 미리보기/read 흐름

현재 미리보기 라우트:

- `/admin/reports/preview`
- 컴포넌트: `AdminReportPreview`

`AdminReportPreview`는 Supabase id나 route state를 사용하지 않고 localStorage draft를 읽는다.

주요 흐름:

- `generateReportDraft(...)`로 기본 draft 생성
- `readReportDraft(defaultDraft)`로 localStorage draft 병합
- report stats/narrative를 다시 계산
- `ReportDocument`에 전달

즉, 현재 미리보기는 Supabase `admin_reports` row를 fetch하지 않는다.

현재 `ReportDocument`는 props로 받은 report object만 렌더링한다.

## 5. localStorage 보고서 구조

localStorage key:

- `happytong_admin_reports`
- `happytong_report_drafts`

legacy key:

- `happy-tong-admin-reports`
- `happytong_admin_report_draft`
- `happy-tong-admin-report-draft`

보고서 object 주요 후보:

- `id`
- `title`
- `status`
- `periodStart`
- `periodEnd`
- `overview`
- `keyIssues`
- `actionTaken`
- `adminOpinion`
- `handlingSummary`
- `recentEmergencies`
- `additionalSupportTargets`
- `reassignmentNeededTargets`
- `createdAt`
- `updatedAt`
- 통계 필드:
  - `totalTargets`
  - `totalCheckers`
  - `totalActivities`
  - `emergencyCount`
  - `unresolvedEmergencyCount`
  - `dangerTargetCount`

현재 localStorage 보고서는 화면 렌더링에 바로 사용할 수 있는 camelCase 구조다.

## 6. Supabase admin_reports 구조

현재 확인된 `public.admin_reports` 주요 컬럼:

- `id`
- `organization_id`
- `title`
- `status`
- `period_start`
- `period_end`
- `summary`
- `action_note`
- `report_data`
- `created_by`
- `created_at`
- `updated_at`

`report_data`에는 화면에서 생성된 보고서 payload가 JSONB로 저장된다.

Supabase row는 snake_case 컬럼과 JSONB payload가 섞여 있으므로 화면용 report object로 normalize가 필요하다.

## 7. 구조 차이와 normalize 필요 항목

Supabase row와 기존 localStorage report object는 필드명이 다르다.

필요한 normalize 방향:

- `id` 유지
- `organization_id` → `organizationId`
- `period_start` → `periodStart`
- `period_end` → `periodEnd`
- `action_note` → `actionNote` 또는 `actionTaken`
- `summary` → `summary` 또는 `adminOpinion`
- `created_by` → `createdBy`
- `created_at` → `createdAt`
- `updated_at` → `updatedAt`
- `report_data` 내부 필드는 우선 보존
- `status` 유지

권장:

- `report_data` 내부의 기존 화면 payload를 먼저 펼친다.
- 그 위에 Supabase row의 최신 컬럼 값을 덮는다.
- 특히 `id`, `status`, `periodStart`, `periodEnd`, `createdAt`, `updatedAt`, `createdBy`는 Supabase row 기준을 우선한다.

## 8. merge 전략 후보

localStorage 보고서와 Supabase 보고서를 함께 보여줄 경우 중복 처리가 필요하다.

중복 후보 기준:

- 같은 `id`
- Supabase `report_data.id`와 localStorage `id`가 같은 경우
- 제목 + 기간이 같고 updatedAt이 매우 가까운 경우

주의:

- localStorage id는 `admin-report-${Date.now()}` 형태일 수 있다.
- Supabase id는 UUID다.
- 단순 id 비교만으로는 같은 보고서를 중복 표시할 수 있다.

## 9. 추천 merge 전략

추천 전략:

1. Supabase row를 `normalizeSupabaseAdminReport(row)`로 화면 report object로 변환
2. localStorage reports와 병합
3. 같은 `id` 또는 `report_data.id`가 localStorage id와 같으면 Supabase row 우선
4. 중복 판단이 불명확하면 둘 다 표시하되 source 표시를 검토
5. 정렬은 `updatedAt` 또는 `updated_at` 최신순
6. Supabase fetch 실패 시 localStorage만 표시

Supabase 우선 필드:

- `id`
- `status`
- `periodStart`
- `periodEnd`
- `summary`
- `actionTaken`
- `createdBy`
- `createdByName`
- `createdAt`
- `updatedAt`
- `reportData`

## 10. 필요한 service/API 후보

후속 구현 시 필요한 service 후보:

- `src/services/supabaseAdminReportsReadService.js`

함수 후보:

- `getSupabaseAdminReports(organizationId)`
- `getSupabaseAdminReportById(reportId)`
- `normalizeSupabaseAdminReport(row)`

이번 단계에서는 위 service를 생성하지 않는다.

## 11. /api/reports 통합 API 확장 필요성

현재 프로젝트는 Vercel Hobby 플랜 Serverless Function 개수 제한을 경험했다.

따라서 보고서 read API도 별도 `api/reports-read.js` 같은 새 파일을 만들기보다 기존 `/api/reports` 통합 API에 action을 추가하는 방식이 안전하다.

후속 action 후보:

- `listReports`
- `getReport`

추천:

- MVP 다음 단계에서는 `/api/reports`에 `action=listReports`, `action=getReport`를 추가
- RLS/policy/grants 정리 후에는 클라이언트 직접 read 전환도 검토 가능

## 12. 테스트 계획

API 테스트 후보:

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/reports" \
  -H "Content-Type: application/json" \
  --data "{\"action\":\"listReports\",\"organizationId\":\"11111111-1111-1111-1111-111111111111\"}"
```

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/reports" \
  -H "Content-Type: application/json" \
  --data "{\"action\":\"getReport\",\"reportId\":\"...\"}"
```

SQL 확인:

```sql
select
  id,
  title,
  status,
  period_start,
  period_end,
  created_by,
  created_at,
  updated_at
from public.admin_reports
where organization_id = '11111111-1111-1111-1111-111111111111'
order by updated_at desc;
```

화면 테스트:

- 관리자 보고서 목록에서 Supabase 저장 보고서가 보이는지 확인
- 기존 localStorage 보고서가 사라지지 않는지 확인
- 중복 표시가 과도하지 않은지 확인
- 미리보기/상세 진입이 깨지지 않는지 확인
- Supabase 실패 시 localStorage fallback이 유지되는지 확인

## 13. 다음 구현 단계

추천 구현 순서:

1. `/api/reports`에 `listReports`, `getReport` action 추가
2. `src/services/supabaseAdminReportsReadService.js` 생성
3. `normalizeSupabaseAdminReport(row)` 구현
4. 관리자 보고서 목록 UI 위치 확정
5. Supabase reports fetch 후 localStorage reports와 merge
6. `AdminReportPreview`에서 Supabase id fallback fetch 지원
7. 실패 시 기존 localStorage 흐름 유지
8. `npm run build`
9. API/화면 테스트
10. 완료 문서 작성

## 14. 이번 단계에서 하지 않는 것

이번 단계에서는 아래 작업을 하지 않는다.

- 코드 수정
- API 수정
- DB/SQL/RLS/Auth 수정
- package.json 수정
- package-lock.json 수정
- vercel.json 수정
- 기존 localStorage 흐름 변경
- 보고서 화면 UX 변경
