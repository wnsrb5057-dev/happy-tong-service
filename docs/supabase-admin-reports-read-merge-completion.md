# 관리자 보고서 Supabase read/merge 보완 완료

## 1. 작업 개요

관리자 보고서 저장 이후 Supabase `public.admin_reports` row를 읽고 기존 localStorage 보고서 흐름과 병합할 수 있는 read/merge 구조를 보완했다.

이번 작업은 Vercel Hobby 플랜 Serverless Function 개수 제한을 고려해 새 API 파일을 만들지 않고 기존 `/api/reports` 통합 API에 read action을 추가하는 방식으로 진행했다.

기존 보고서 저장 흐름과 localStorage fallback은 유지했다.

## 2. /api/reports read action 확장

기존 `/api/reports` action은 유지했다.

기존 action:

- `saveDraft`
- `saveReport`
- `updateReport`

추가 action:

- `listReports`
- `getReport`

별도 API 파일은 생성하지 않았고, 기존 통합 API 구조를 확장했다.

## 3. listReports 동작

`listReports`는 조직 기준 보고서 목록을 조회한다.

요청 기준:

- `organizationId`
- 또는 `organization_id`

동작:

- `public.admin_reports`에서 `organization_id` 기준 조회
- `updated_at desc`, `created_at desc` 정렬
- `created_by`가 있으면 `public.users`에서 작성자 이름/role 보강
- `reports` 배열과 `count` 반환

성공 응답 구조:

```json
{
  "success": true,
  "reports": [],
  "count": 0
}
```

## 4. getReport 동작

`getReport`는 보고서 단건을 조회한다.

요청 기준:

- `reportId`
- 또는 `id`

동작:

- `public.admin_reports.id` 기준 단건 조회
- 없으면 `REPORT_NOT_FOUND`
- `created_by`가 있으면 작성자 이름/role 보강

성공 응답 구조:

```json
{
  "success": true,
  "report": {}
}
```

## 5. read service 구조

생성 파일:

- `src/services/supabaseAdminReportsReadService.js`

구현 함수:

- `getSupabaseAdminReports(organizationId)`
- `getSupabaseAdminReportById(reportId)`
- `normalizeSupabaseAdminReport(row)`
- `mergeAdminReports(localReports, supabaseReports)`

service는 모두 기존 `/api/reports`로 POST 요청을 보낸다.

## 6. normalizeSupabaseAdminReport 매핑

Supabase row와 기존 화면 report object의 구조 차이를 맞추기 위해 normalize 함수를 추가했다.

기본 원칙:

- `report_data` 내부 payload를 우선 보존
- Supabase row 컬럼으로 주요 필드를 덮어씀
- 화면에서 쓰는 camelCase 필드로 변환

주요 매핑:

- `id` → `id`
- `id` → `supabaseId`
- `report_data.id` → `originalId`
- `organization_id` → `organizationId`
- `period_start` → `periodStart`
- `period_end` → `periodEnd`
- `action_note` → `actionNote`
- `action_note` 또는 `report_data.actionTaken` → `actionTaken`
- `summary` → `summary`
- `summary` 또는 `report_data.adminOpinion` → `adminOpinion`
- `created_by` → `createdBy`
- `created_by_name` → `createdByName`
- `created_by_role` → `createdByRole`
- `created_at` → `createdAt`
- `updated_at` → `updatedAt`

보존되는 `report_data` 내부 필드 예:

- `overview`
- `keyIssues`
- `actionTaken`
- `adminOpinion`
- `handlingSummary`
- `recentEmergencies`
- `additionalSupportTargets`
- `reassignmentNeededTargets`
- `totalTargets`
- `totalActivities`
- `emergencyCount`

## 7. mergeAdminReports 전략

`mergeAdminReports(localReports, supabaseReports)`는 localStorage 보고서와 Supabase 보고서를 병합한다.

중복 기준:

- 같은 `id`
- `local.id === supabase.originalId`
- `local.id === supabase.reportData.id`
- `local.supabaseId === supabase.id`

중복이면 Supabase report를 우선한다.

정렬:

- `updatedAt`
- 없으면 `createdAt`
- 최신순 정렬

Supabase 조회 실패 시에는 기존 localStorage reports만 사용할 수 있도록 service가 안전한 fallback 형태를 유지한다.

## 8. AdminReportNew 적용 범위

현재 라우팅 구조에서 `/admin/reports`와 `/admin/reports/new`는 `AdminReportNew` 작성 화면으로 연결된다.

별도 보고서 목록 UI는 아직 없으므로, 이번 작업에서는 새 목록 UI를 만들지 않았다.

기존 작성 화면 UX는 유지했다.

## 9. AdminReportPreview fallback

`AdminReportPreview`에 Supabase 단건 조회 fallback을 추가했다.

지원 URL:

- `/admin/reports/preview?reportId=...`
- `/admin/reports/preview?id=...`

동작:

- query id가 있으면 `getSupabaseAdminReportById`로 Supabase 보고서 우선 조회
- 성공하면 Supabase 보고서를 `ReportDocument`에 전달
- 실패하거나 query id가 없으면 기존 `readReportDraft()` 기반 미리보기 유지

기존 `ReportDocument` props 구조는 유지했다.

## 10. localStorage fallback 유지

기존 localStorage 흐름은 유지했다.

유지된 key:

- `happytong_admin_reports`
- `happytong_report_drafts`

legacy key:

- `happy-tong-admin-reports`
- `happytong_admin_report_draft`
- `happy-tong-admin-report-draft`

Supabase read 실패 시 기존 localStorage 기반 보고서 흐름이 계속 동작하도록 구성했다.

## 11. 테스트 결과

확인된 결과:

- `POST /api/reports action=listReports` → `200 OK`
- `POST /api/reports action=getReport` → `200 OK`
- 브라우저 미리보기 fallback 정상 확인
- localStorage fallback 유지 확인
- `npm run build` 성공
- `package.json` 변경 없음
- `vercel.json` 변경 없음

## 12. 남은 주의사항

- 별도 보고서 목록 UI는 아직 없다.
- `/admin/reports`는 작성 화면 중심이라 `mergeAdminReports` 활용 범위는 현재 제한적이다.
- 향후 보고서 목록 화면을 만들면 `mergeAdminReports`를 그대로 활용할 수 있다.
- RLS/권한 정리 전까지는 `/api/reports` service_role read 구조를 유지한다.
- read action이 추가되었으므로 운영 QA에서 기존 save action이 깨지지 않았는지 함께 확인해야 한다.

## 13. 후속 과제

후속 작업 후보:

- 관리자 보고서 목록 UI 설계 및 연결
- `getSupabaseAdminReports`와 `mergeAdminReports`를 목록 화면에 적용
- 보고서 상세 route 설계
- Supabase report id 기반 상세/미리보기 진입 UX 정리
- RLS/policy/grants 정리 후 클라이언트 read 가능 여부 재검토
- 운영 배포 후 `/api/reports` 전체 action QA
