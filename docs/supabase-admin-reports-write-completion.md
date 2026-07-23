# 관리자 보고서 저장 Supabase write 전환 완료

## 1. 작업 개요

관리자 보고서 초안 저장과 최종 저장 기능을 Supabase write 구조로 전환했다.

기존 localStorage 기반 저장 흐름은 제거하지 않고 그대로 유지했으며, Supabase 저장은 병행 호출 방식으로 추가했다. 따라서 Supabase 저장이 실패해도 기존 화면 흐름과 기존 로컬 초안/보고서 저장 UX는 깨지지 않는다.

이번 전환은 Vercel Hobby 플랜의 Serverless Function 개수 제한을 고려해 `/api/reports` 단일 API에서 action 기반으로 분기하는 방식으로 구현했다.

## 2. admin_reports 스키마 보완 내용

`public.admin_reports`는 보고서 초안, 저장본, 완료본을 하나의 테이블에서 관리하는 구조로 보완했다.

추가 및 보완 내용:

- `status text not null default 'draft'` 컬럼 추가
- `admin_reports_status_check` CHECK 제약조건 추가
- 허용 status: `draft`, `saved`, `completed`, `published`
- `report_data` 기본값을 `'{}'::jsonb`로 설정

주요 컬럼:

- `id`
- `organization_id`
- `title`
- `period_start`
- `period_end`
- `summary`
- `action_note`
- `report_data`
- `created_by`
- `status`
- `created_at`
- `updated_at`

## 3. 통합 API 구조

보고서 write API는 단일 Serverless Function으로 구성했다.

- 경로: `POST /api/reports`
- 파일: `api/reports.js`
- Supabase client: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 기반 service_role client
- 분기 방식: request body의 `action` 값

지원 action:

- `saveDraft`
- `saveReport`
- `updateReport`

유효하지 않은 action은 아래 형태로 응답한다.

```json
{
  "success": false,
  "code": "INVALID_ACTION",
  "message": "Invalid report action."
}
```

## 4. action별 동작

### saveDraft

보고서 초안을 저장한다.

- `reportId` 또는 `id`가 있으면 기존 row update
- 없으면 `public.admin_reports` insert
- `status = draft`
- 기존 `saveReportDraft` localStorage 흐름 유지

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "reportId": "...",
  "status": "draft"
}
```

### saveReport

보고서 최종 저장 또는 생성 완료 상태를 저장한다.

- `reportId` 또는 `id`가 있으면 기존 row update
- 없으면 insert
- 기본 `status = completed`
- payload에 status가 있으면 허용값으로 정규화
- 기존 `actions.addAdminReport` 및 localStorage 흐름 유지

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "reportId": "...",
  "status": "completed"
}
```

### updateReport

기존 보고서를 수정한다.

- `reportId` 또는 `id` 기준 update
- payload status가 있으면 정규화
- payload status가 없으면 기존 status 유지
- `updated_at` 갱신

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "reportId": "...",
  "status": "saved"
}
```

## 5. report_data JSONB 저장 구조

화면에서 생성한 보고서 payload를 `report_data` JSONB에 보존한다.

컬럼에도 별도 매핑되는 값:

- `title`
- `periodStart` / `period_start`
- `periodEnd` / `period_end`
- `summary`
- `actionNote` / `action_note`
- `status`

`report_data`에는 아래와 같은 화면 보고서 데이터가 포함될 수 있다.

- `overview`
- `keyIssues`
- `actionTaken`
- `adminOpinion`
- `handlingSummary`
- `recentEmergencies`
- `additionalSupportTargets`
- `reassignmentNeededTargets`
- 기간별 통계 값
- 대상자/체커/확인 기록 집계 값

## 6. 관리자 화면 연결 위치

수정 파일:

- `src/pages/adminPages.jsx`
- `src/services/supabaseReportsWriteService.js`

연결 위치:

- `AdminReportNew.handlePrint`
  - 기존 `saveReportDraft(report)` 유지
  - 이후 `saveSupabaseReportDraft(...)` 호출

- `AdminReportNew.handleGenerate`
  - 기존 `actions.addAdminReport(report)` 유지
  - 기존 `saveReportDraft(report)` 유지
  - 이후 `saveSupabaseReport(...)` 호출

Supabase 저장 실패 시:

- 화면 흐름은 유지
- 전체 request body는 로그로 남기지 않음
- `console.warn`에는 `code`, `message`, `status`만 남김

## 7. 기존 localStorage 흐름 유지 여부

기존 localStorage 흐름은 유지했다.

유지된 흐름:

- 보고서 초안 저장
- 보고서 미리보기 생성
- `actions.addAdminReport` 기반 로컬 보고서 저장
- PDF 내보내기 흐름

Supabase write는 기존 흐름을 대체하지 않고 병행 저장으로 추가했다.

## 8. Vercel Serverless Function 제한 대응

Vercel Hobby 플랜에서는 Deployment에 추가할 수 있는 Serverless Function 수 제한이 있다.

이번 작업 중 `/api/reports` 추가 후 배포 URL에서 `/api/reports`가 index.html로 fallback되는 문제가 확인됐다. 원인은 함수 수 제한에 가까워지거나 제한에 걸린 상태로 판단했다.

대응:

- 보고서 API는 처음부터 `/api/reports` 단일 통합 API로 구성
- 추가로 기존 targets API 3개를 하나의 API로 통합해 함수 수를 줄임

## 9. targets API 통합 내용

함수 수 절감을 위해 기존 targets API 3개를 통합했다.

기존 삭제 파일:

- `api/targets/create.js`
- `api/targets/update.js`
- `api/targets/update-status.js`

신규 통합 파일:

- `api/targets.js`

통합 경로:

- `POST /api/targets`

지원 action:

- `create`
- `update`
- `updateStatus`

서비스 변경:

- `src/services/supabaseTargetsWriteService.js`
- 기존 `/api/targets/create`, `/api/targets/update`, `/api/targets/update-status` 호출을 `/api/targets` + action 방식으로 변경

이후 `/api/targets`, `/api/reports` 모두 API route로 정상 등록되는 것을 확인했다.

## 10. API 단독 테스트 결과

확인된 API 테스트:

- `POST /api/targets {}` → `400 INVALID_ACTION`
- `POST /api/reports {}` → `400 INVALID_ACTION`

보고서 API 테스트:

- `saveDraft` 성공
  - `reportId`: `6c38d9fc-f5a3-43b9-bdf8-04918927b8de`
  - `status`: `draft`

- `saveReport` 성공
  - 같은 `reportId` row 업데이트
  - `status`: `completed`

- `updateReport` 성공
  - `status`: `saved`
  - `title`: `보고서 API 수정 테스트`

## 11. 화면 저장 테스트 결과

관리자 보고서 화면 저장 테스트에서 `public.admin_reports` row 생성을 확인했다.

확인된 row 예시:

- `title`: `해피통서비스 운영 보고서`
- `status`: `draft`
- `period_start`: `2026-06-10`
- `period_end`: `2026-07-23`
- `report_data`: 화면에서 생성된 보고서 payload 저장 확인

## 12. 확인된 테스트 데이터

확인된 주요 테스트 데이터:

- `saveDraft` reportId: `6c38d9fc-f5a3-43b9-bdf8-04918927b8de`
- `saveDraft` status: `draft`
- `saveReport` status: `completed`
- `updateReport` status: `saved`
- 화면 저장 title: `해피통서비스 운영 보고서`
- 화면 저장 period: `2026-06-10` ~ `2026-07-23`

SQL 확인 결과:

- `saveDraft` 후 `admin_reports` row 생성 확인
- `saveReport` 후 같은 row 업데이트 확인
- `updateReport` 후 status `saved` 확인
- 화면 저장 row의 `report_data` JSONB 저장 확인

## 13. 남은 주의사항

- 화면 저장 row에서 `created_by`가 null로 저장되는 사례가 확인됐다.
- `created_by`는 nullable이라 저장 자체에는 문제가 없다.
- 후속으로 `currentUser.id` 또는 Supabase `public.users.id` 매핑을 더 정확히 전달하도록 보완할 수 있다.
- 이번 단계에서는 보고서 read/merge 전환은 진행하지 않았다.
- 보고서 목록이 Supabase `admin_reports` row를 직접 읽는 보완은 후속 과제로 분리한다.
- RLS, policy, grants 정리는 마지막 단계에서 진행한다.

## 14. 후속 과제

후속 작업 후보:

- 관리자 보고서 목록 Supabase read 전환
- 보고서 상세/미리보기 Supabase row 기반 조회
- `created_by`를 Supabase `public.users.id`와 정확히 매핑
- 보고서 status별 필터 및 목록 표시 보완
- 테스트 데이터 정리
- RLS/policy/grants 운영용 정리
