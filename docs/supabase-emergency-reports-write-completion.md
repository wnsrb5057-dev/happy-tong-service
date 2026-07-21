# 이상징후 보고 Supabase write 전환 완료 문서

## 1. 작업 개요

이 문서는 이상징후 보고 작성 기능과 관리자 처리 상태 변경 기능을 Supabase write 구조로 전환한 결과를 정리한다.

전환 후에도 기존 `localStorage` 저장/처리 흐름은 제거하지 않았다. 체커와 관리자 화면의 기존 UX는 유지하고, Supabase 저장/갱신을 추가 호출하는 병행 구조로 구성했다. Supabase 호출이 실패해도 기존 localStorage 기반 화면 흐름이 깨지지 않도록 처리했다.

## 2. DB 구조

### public.emergency_reports

- `id`
- `organization_id`
- `target_id`
- `checker_id`
- `type`
- `severity`
- `status`
- `title`
- `description`
- `reported_at`
- `completed_at`
- `created_at`
- `updated_at`

### public.emergency_handling_logs

- `id`
- `emergency_report_id`
- `organization_id`
- `status`
- `memo`
- `contacted_guardian`
- `visit_required`
- `created_by`
- `created_by_name`
- `created_at`

## 3. DB 제약조건

`emergency_reports.severity` 허용값:

- `normal`
- `caution`
- `urgent`

`emergency_reports.status` 허용값:

- `received`
- `checking`
- `contacted`
- `visiting`
- `completed`

`emergency_handling_logs.status`도 같은 계열 값으로 저장한다.

## 4. 생성/수정된 API

### `/api/emergency-reports/create`

체커가 작성한 이상징후 보고를 Supabase `emergency_reports`에 저장한다. 보고 저장 성공 후 `emergency_handling_logs`에 초기 `received` 로그를 추가한다.

### `/api/emergency-reports/update-status`

관리자 상세 화면에서 변경한 처리 상태를 Supabase `emergency_reports.status`에 반영하고, `emergency_handling_logs`에 처리 로그를 추가한다.

## 5. `/api/emergency-reports/create` 정리

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "reportId": "..."
}
```

주요 처리:

- `emergency_reports` insert
- `emergency_handling_logs` 초기 `received` 로그 insert
- `organization_id`, `target_id`, `checker_id` 후보 resolve
- `checker_id`는 nullable 구조에 맞춰 찾지 못하면 `null` 허용
- `organization_id`, `target_id`는 필수로 확정

주요 payload:

- `organizationId`
- `targetId`
- `targetName`
- `checkerId`
- `checkerUsername`
- `checkerEmail`
- `type`
- `severity`
- `title`
- `description`
- `reportedAt`
- `status`
- `contactedGuardian`
- `visitRequired`

## 6. `/api/emergency-reports/update-status` 정리

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "reportId": "...",
  "status": "checking"
}
```

주요 처리:

- `reportId` 기준 `emergency_reports` row 조회
- `emergency_reports.status` 업데이트
- `emergency_reports.updated_at` 업데이트
- `completed` 상태일 때 `completed_at` 저장
- `completed`가 아닌 상태일 때 `completed_at`은 `null` 처리
- `emergency_handling_logs`에 처리 로그 insert

handling log insert가 실패해도 report status update가 성공했다면 API는 성공으로 응답하고 warning을 포함할 수 있다.

## 7. severity 정규화 기준

DB 제약조건에 맞게 API에서 최종 저장값을 정규화한다.

- `urgent`, `emergency`, `danger`, `high`, `critical` → `urgent`
- `caution`, `warning`, `need_check`, `issue`, `needed`, `abnormal`, `low`, `medium` → `caution`
- `normal`, `none`, `good`, `ok` → `normal`
- 그 외 → `caution`

## 8. status 정규화 기준

DB에는 반드시 허용된 status 값만 저장한다.

- `접수`, `접수됨`, `received` → `received`
- `확인중`, `확인 중`, `처리중`, `처리 중`, `checking` → `checking`
- `보호자 연락`, `연락 완료`, `contacted` → `contacted`
- `방문 필요`, `방문 예정`, `visiting` → `visiting`
- `완료`, `조치 완료`, `completed` → `completed`
- 그 외 → create 흐름에서는 `received`, status update 흐름에서는 `checking`

## 9. 수정된 주요 파일

| 파일 | 역할 |
| --- | --- |
| `api/emergency-reports/create.js` | 체커 이상징후 보고 Supabase 저장 API |
| `api/emergency-reports/update-status.js` | 관리자 처리 상태 Supabase 업데이트 API |
| `src/services/supabaseEmergencyReportsWriteService.js` | 체커 화면에서 create API 호출 |
| `src/services/supabaseEmergencyStatusUpdateService.js` | 관리자 상세에서 update-status API 호출 |
| `src/services/supabaseAdminEmergenciesService.js` | 관리자 이상징후 목록/상세 조회, handling logs 조회/normalize |
| `src/pages/checkerPages.jsx` | `EmergencyNew.handleSubmit`에 Supabase create 호출 연결 |
| `src/pages/adminPages.jsx` | `AdminEmergencyDetail.handleSave`에 Supabase update 호출 연결, 처리 이력 표시 보완 |

## 10. 체커 화면 반영 내용

- `EmergencyNew.handleSubmit`에서 기존 `actions.addEmergencyReport(...)` localStorage 저장을 유지했다.
- localStorage 저장 직후 Supabase create API를 추가 호출한다.
- Supabase 저장 실패 시 기존 화면 이동과 완료 안내 흐름은 깨지지 않는다.
- 실패 로그는 개인정보나 payload 전체 없이 `code` 정도만 `console.warn`으로 남긴다.

## 11. 관리자 화면 반영 내용

- `AdminEmergencyDetail.handleSave`에서 기존 `actions.addEmergencyHandlingLog(...)` localStorage 처리 흐름을 유지했다.
- Supabase `update-status` API를 추가 호출해 DB에도 처리 상태를 반영한다.
- 관리자 목록에는 Supabase `emergency_reports.status`와 최신 처리 상태가 반영된다.
- 관리자 상세 처리 이력에서 Supabase `emergency_handling_logs`를 조회해 표시한다.
- Supabase `handlingLogs`가 있으면 localStorage `handlingLogs`보다 우선 사용한다.

## 12. 처리 이력 표시 기준

관리자 상세 처리 이력은 `emergency_handling_logs`를 `emergency_report_id` 기준으로 조회한다.

- 정렬: `created_at desc`
- 표시 필드:
  - `status`
  - `statusLabel`
  - `memo`
  - `created_by_name`
  - `contacted_guardian`
  - `visit_required`
  - `created_at`

status 한글 라벨:

- `received` → `접수됨`
- `checking` → `확인중`
- `contacted` → `보호자 연락`
- `visiting` → `방문 필요`
- `completed` → `완료`

## 13. 테스트 완료 기준

실제 확인된 성공 기준:

- `curl`로 `/api/emergency-reports/create` 성공
- `emergency_reports` row 생성 확인
- `emergency_handling_logs` 초기 `received` 로그 생성 확인
- `warning` severity가 `caution`으로 저장되는 것 확인
- 체커 화면에서 이상징후 보고 작성 후 관리자 목록 반영 확인
- `curl`로 `/api/emergency-reports/update-status` 성공
- `emergency_reports.status = checking` 업데이트 확인
- `emergency_reports.updated_at` 최신 반영 확인
- `emergency_handling_logs`에 `checking` 로그 추가 확인
- 관리자 상세 처리 이력에 Supabase handling logs 표시 확인
- `npm run build` 성공

## 14. 현재 남은 주의사항

- localStorage fallback은 아직 유지 중이다.
- RLS/권한 정리는 마지막 단계에서 진행한다.
- 관리자 처리 상태 UI 문구/정렬은 후속 QA에서 조정 가능하다.
- 다음 write 전환 대상은 대상자 등록/수정/관리종료 기능이다.
- `package.json` 변경은 없었다.
