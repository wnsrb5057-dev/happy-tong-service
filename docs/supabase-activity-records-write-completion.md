# Supabase activity_records write completion

## 1. 작업 개요

생활 확인 기록 작성 기능을 기존 localStorage 중심 흐름에서 Supabase 병행 저장 구조로 전환했다.

기존 `actions.addActivityRecord`와 localStorage 저장 흐름은 제거하지 않고 유지했다. Supabase 저장이 실패해도 기존 기기 저장과 화면 이동 흐름이 깨지지 않도록 fallback 구조를 유지했다.

## 2. 변경된 DB 구조

`public.activity_records` 기존 컬럼:

- `id`
- `organization_id`
- `target_id`
- `checker_id`
- `check_type`
- `checked_at`
- `condition_summary`
- `memo`
- `created_at`

추가 컬럼:

- `has_issue`: 이상징후 여부
- `issue_level`: `none`, `caution`, `warning`, `urgent` 등 위험도 또는 확인 필요 수준
- `check_items`: 확인 유형별 세부 선택값 JSON
- `status`: `completed` 등 작성 상태

## 3. API 정리

API 경로:

- `/api/activity-records/create`

역할:

- 체커 생활 확인 기록을 service role 기반으로 `activity_records`에 저장한다.
- UUID-like seed id를 PostgreSQL uuid 문자열 형식 기준으로 처리한다.
- 운영 정리 후 `debugVersion`과 `debug` 응답은 제거했다.

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "recordId": "..."
}
```

주요 에러 code:

- `METHOD_NOT_ALLOWED`
- `CHECKER_NOT_FOUND`
- `TARGET_NOT_FOUND`
- `ORGANIZATION_NOT_FOUND`
- `TARGET_QUERY_FAILED`
- `ORGANIZATION_QUERY_FAILED`
- `TARGET_ORGANIZATION_MISMATCH`
- `CHECKER_TARGET_ORGANIZATION_MISMATCH`
- `ACTIVITY_RECORD_INSERT_FAILED`

## 4. 저장 payload 구조

프론트에서 보내는 주요 값:

- `organizationId`
- `targetId`
- `targetName`
- `checkerId`
- `checkerUsername`
- `checkerEmail`
- `checkType`
- `checkedAt`
- `checkItems`
- `conditionSummary`
- `memo`
- `hasIssue`
- `issueLevel`
- `status`

## 5. 수정된 주요 파일

- `api/activity-records/create.js`: Supabase service role 기반 activity record insert API
- `src/pages/checkerPages.jsx`: 체커 기록작성 Supabase 저장 호출, 확인기록 표시 정규화
- `src/pages/adminPages.jsx`: 관리자 확인기록 Supabase record 반영, 표시 정규화
- `src/services/supabaseActivityRecordsWriteService.js`: 프론트에서 `/api/activity-records/create` 호출
- `src/services/supabaseCheckerActivityHistoryService.js`: 체커 확인기록 Supabase 조회 및 activity_records 보강 조회
- `src/services/supabaseAdminActivityRecordsService.js`: 관리자 확인기록 Supabase 조회 및 activity_records 보강 조회

## 6. 체커 화면 반영 내용

- 기록작성 시 기존 localStorage 저장을 유지했다.
- Supabase 저장 API를 추가 호출한다.
- Supabase 저장 실패 시 기존 localStorage 저장 성공 흐름과 화면 이동은 유지된다.
- 확인기록에서는 Supabase activity_records 값을 우선 표시한다.
- `has_issue`, `issue_level` 기준으로 이상징후 있음/없음을 표시한다.
- `memo`, `conditionSummary`, `checkItems`는 사용자용 문구로 정규화해 표시한다.
- Supabase `targets.address`를 우선 사용해 주소 표시 source를 통일했다.

## 7. 관리자 화면 반영 내용

- 관리자 확인기록에서 Supabase `activity_records`가 반영된다.
- `has_issue`, `issue_level` 기준으로 이상징후 배지를 표시한다.
- `check_type`은 한글 라벨로 표시한다.
- `check_items`는 코드값 대신 한글 문구로 치환해 표시한다.
- 체커 화면과 동일하게 Supabase `targets.address`를 우선 사용한다.

## 8. 라벨 정규화 기준

`check_type`:

- `call` -> 전화 확인
- `phone` -> 전화 확인
- `visit` -> 방문 확인
- `home_visit` -> 방문 확인
- `external`, `external_check`, `outside` -> 외부 확인
- `intensive` -> 집중 모니터링
- `trash_check`, `door_check` -> 문전 확인

`issue_level`:

- `none` -> 이상 없음 또는 표시 생략
- `caution`, `need_check`, `issue`, `needed` -> 확인 필요 또는 주의
- `warning` -> 경고
- `urgent`, `danger`, `high`, `emergency` -> 긴급

`check_items` 치환 예시:

- `lifeTrace:issue` -> 생활 흔적 확인 필요
- `contactAvailable:unknown` -> 연락 가능 여부 미확인
- `adminNeed:needed` -> 관리자 확인 필요
- `faceToFace:absent` -> 대면 확인 불가
- `livingDiscomfort:issue` -> 생활 불편 징후 있음
- `helpRequest:issue` -> 지원 요청 있음
- `callStatus:completed` -> 통화 완료
- `welfareStatus:normal` -> 생활상태 양호
- `supportNeed:none` -> 지원 불필요

## 9. 테스트 완료 기준

실제 확인된 성공 기준:

- 체커가 생활 확인 기록을 작성한다.
- `activity_records`에 row가 생성된다.
- `has_issue=true`, `issue_level=urgent` 저장을 확인했다.
- `check_items` 저장을 확인했다.
- 체커 확인기록에서 이상징후 있음으로 표시된다.
- 관리자 확인기록에서 이상징후 있음으로 표시된다.
- 메모가 정상 표시된다.
- 주소 표시가 체커/관리자 화면에서 동일하다.
- `debugVersion` 응답 제거를 확인했다.
- `npm run build`가 성공했다.
- `package.json`은 변경하지 않았다.

## 10. 현재 남은 주의사항

- localStorage fallback은 아직 유지 중이다.
- RLS/권한 정리는 마지막 단계에서 진행한다.
- 전체 통계/대시보드 수치는 후속 점검이 필요하다.
- 다음 write 전환 대상은 이상징후 보고 작성 기능이다.
