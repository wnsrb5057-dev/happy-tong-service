# Supabase write 전환 완료 요약

## 1. 문서 목적

이 문서는 해피통서비스 React/Vite/Supabase 프로젝트에서 현재까지 완료한 Supabase write 전환 범위와 아직 남은 범위를 한 번에 확인하기 위한 요약 문서다.

정리 기준은 실제 `docs`, `api`, `src/services`, `src/pages`에 존재하는 파일과 지금까지 확인된 완료 작업이다. 존재하지 않는 문서는 임의로 생성하거나 완료된 것으로 가정하지 않는다.

## 2. 전체 진행 요약

기존 MVP의 localStorage 흐름은 유지한 상태에서, 주요 write 기능을 Supabase 병행 저장 구조로 전환했다.

현재 구조:

- 기존 localStorage 저장 흐름 유지
- Supabase write는 서버 API route에서 service_role client로 수행
- 클라이언트는 write service를 통해 API 호출
- Supabase 저장 실패 시 기존 UX가 깨지지 않도록 fallback 유지
- 일부 read/merge는 적용되었지만 전체 read 전환은 아직 완료 범위가 아님
- RLS, policy, grants 정리는 마지막 단계로 보류
- Supabase Auth 계정 자동 생성은 아직 하지 않음

## 3. 완료된 write 전환 목록

| 기능 | DB 테이블 | API | service 파일 | 화면 연결 | localStorage 유지 | 테스트 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| 생활 확인 기록 작성 | `activity_records` | `api/activity-records/create.js` | `supabaseActivityRecordsWriteService.js` | 체커 기록작성 | 유지 | 저장 및 표시 확인 |
| 이상징후 보고 작성 | `emergency_reports`, `emergency_handling_logs` | `api/emergency-reports/create.js` | `supabaseEmergencyReportsWriteService.js` | 체커 이상징후 보고 | 유지 | 저장 및 관리자 목록 반영 확인 |
| 이상징후 처리 상태 변경 | `emergency_reports`, `emergency_handling_logs` | `api/emergency-reports/update-status.js` | `supabaseEmergencyStatusUpdateService.js` | 관리자 이상징후 상세 | 유지 | status update 및 처리 이력 확인 |
| 대상자 등록/수정/상태 변경 | `targets` | `api/targets.js` | `supabaseTargetsWriteService.js` | 관리자 대상자 관리 | 유지 | 등록/수정/관리종료/재관리시작 확인 |
| 체커 등록/수정/상태 변경 | `users` | `api/checkers.js` | `supabaseCheckersWriteService.js` | 관리자 체커 관리 | 유지 | 등록/수정/상태 변경 확인 |
| 보고서 초안/최종 저장 | `admin_reports` | `api/reports.js` | `supabaseReportsWriteService.js` | 관리자 보고서 작성 | 유지 | 초안/최종/update 확인 |

## 4. 기능별 상세 정리

### 4-1. 생활 확인 기록 작성

주요 파일:

- `api/activity-records/create.js`
- `src/services/supabaseActivityRecordsWriteService.js`
- `src/pages/checkerPages.jsx`
- `src/pages/adminPages.jsx`

DB 테이블:

- `public.activity_records`

저장 데이터:

- `organization_id`
- `target_id`
- `checker_id`
- `check_type`
- `checked_at`
- `condition_summary`
- `memo`
- `has_issue`
- `issue_level`
- `check_items`
- `status`

완료 내용:

- 체커 생활 확인 기록 작성 시 Supabase 저장 추가
- 기존 localStorage 저장 유지
- UUID-like seed id 처리 유지
- `has_issue`, `issue_level`, `check_items`, `status` 기반 이상징후 표시 정상화
- 체커/관리자 확인기록에서 Supabase row 우선 표시
- check type, issue level, check items 한글 라벨 정규화
- 체커/관리자 주소 source를 Supabase targets address 기준으로 통일

주의사항:

- localStorage fallback은 아직 유지 중
- 전체 통계/대시보드 read 전환은 후속 점검 대상

### 4-2. 이상징후 보고 작성

주요 파일:

- `api/emergency-reports/create.js`
- `src/services/supabaseEmergencyReportsWriteService.js`
- `src/pages/checkerPages.jsx`
- `src/pages/adminPages.jsx`

DB 테이블:

- `public.emergency_reports`
- `public.emergency_handling_logs`

완료 내용:

- 체커 이상징후 보고 작성 시 `emergency_reports` 저장
- 초기 `received` 처리 로그를 `emergency_handling_logs`에 생성
- `severity`와 `status`를 DB CHECK 제약조건에 맞게 정규화
- 관리자 이상징후 목록에 새 보고 반영 확인
- 기존 localStorage 보고 흐름 유지

정규화 기준:

- `severity`: `normal`, `caution`, `urgent`
- `status`: `received`, `checking`, `contacted`, `visiting`, `completed`

주의사항:

- Supabase Auth 계정 생성과는 분리
- 처리 상태 변경은 별도 API에서 수행

### 4-3. 이상징후 처리 상태 변경

주요 파일:

- `api/emergency-reports/update-status.js`
- `src/services/supabaseEmergencyStatusUpdateService.js`
- `src/services/supabaseAdminEmergenciesService.js`
- `src/pages/adminPages.jsx`

DB 테이블:

- `public.emergency_reports`
- `public.emergency_handling_logs`

완료 내용:

- 관리자 상세 화면에서 처리 상태 변경 시 Supabase update 수행
- `emergency_reports.status` 업데이트
- `completed` 상태일 때 `completed_at` 저장
- `emergency_handling_logs`에 처리 로그 추가
- 관리자 상세 처리 이력에서 Supabase handling logs 조회/표시
- 기존 localStorage 처리 이력 fallback 유지

주의사항:

- 처리 이력 정렬/문구 QA는 후속으로 더 다듬을 수 있음
- RLS/권한 정리는 아직 보류

### 4-4. 대상자 등록/수정/상태 변경

주요 파일:

- `api/targets.js`
- `src/services/supabaseTargetsWriteService.js`
- `src/pages/adminPages.jsx`

DB 테이블:

- `public.targets`

통합 API action:

- `create`
- `update`
- `updateStatus`

완료 내용:

- 기존 분리 API 3개를 `api/targets.js` 단일 API로 통합
- 대상자 등록/수정/관리종료/재관리시작 Supabase write 완료
- `risk_level`, `lifecycle_status`, `check_days`, `age` 정규화
- 담당 체커 resolve 후 `assigned_checker_id` 저장
- 수정 시 담당 체커 값이 비어 있으면 기존 `assigned_checker_id` 유지
- 관리종료/재관리시작 시 `assigned_checker_id`를 변경하지 않음
- Supabase-only 대상자 목록/상세/수정 지원
- 기존 localStorage 대상자 흐름 유지

주의사항:

- 체커 상태 변경에 따른 담당 대상자 자동 재배정은 후속 과제
- targets read/merge는 필요한 범위에서 보완되었지만 전체 read 전환 완료로 보지는 않음

### 4-5. 체커 등록/수정/상태 변경

주요 파일:

- `api/checkers.js`
- `src/services/supabaseCheckersWriteService.js`
- `src/pages/adminPages.jsx`

DB 테이블:

- `public.users`

통합 API action:

- `create`
- `update`
- `updateStatus`

완료 내용:

- 체커 등록/수정/상태 변경을 `api/checkers.js` 단일 API로 구현
- `public.users` 중 `role = checker` row 생성/수정
- `status`, `activity_status` 정규화
- 관리자 체커 등록/수정/상태 변경 화면 연결
- 기존 localStorage 사용자 흐름 유지
- Supabase Auth 계정 생성은 제외

상태 매핑:

- `activity_status = active` → `status = active`
- `activity_status = paused` 또는 `left` → `status = inactive`

주의사항:

- Auth 계정 발급 정책은 별도 설계 필요
- paused/left 체커의 담당 대상자 재배정 정책은 후속 과제

### 4-6. 보고서 초안/최종 저장

주요 파일:

- `api/reports.js`
- `src/services/supabaseReportsWriteService.js`
- `src/pages/adminPages.jsx`
- `docs/supabase-admin-reports-schema-plan.md`
- `docs/supabase-admin-reports-write-completion.md`

DB 테이블:

- `public.admin_reports`

스키마 보완:

- `status` 컬럼 추가
- `status default 'draft'`
- `admin_reports_status_check` 제약조건 추가
- 허용 status: `draft`, `saved`, `completed`, `published`
- `report_data default '{}'::jsonb`

통합 API action:

- `saveDraft`
- `saveReport`
- `updateReport`

완료 내용:

- 관리자 보고서 초안 저장 Supabase write 연결
- 관리자 보고서 최종 저장 Supabase write 연결
- 화면에서 생성된 보고서 payload를 `report_data` JSONB로 보존
- 기존 `saveReportDraft`, `actions.addAdminReport` localStorage 흐름 유지
- `/api/reports` 단일 API로 구현

주의사항:

- 화면 저장 row에서 `created_by`가 null로 저장되는 사례가 있음
- `created_by`는 nullable이라 저장 자체에는 문제가 없지만 후속 보완 가능
- 보고서 Supabase read/merge는 아직 후속 과제

## 5. 통합 API 원칙

Vercel Hobby 플랜 Serverless Function 개수 제한 때문에, 신규 API는 가능한 한 단일 API + action 분기 방식을 우선한다.

현재 통합 API:

- `POST /api/checkers`
- `POST /api/targets`
- `POST /api/reports`

공통 원칙:

- `req.method !== "POST"`는 `METHOD_NOT_ALLOWED`
- `body.action`으로 기능 분기
- 잘못된 action은 `INVALID_ACTION`
- API 내부에서 service_role Supabase client 사용
- request body 전체 로그 금지
- service role key 노출 금지

후속 신규 API도 기능별 파일을 여러 개 만들기보다 통합 API + action 분기를 우선 검토한다.

## 6. 유지 중인 localStorage 흐름

실제 코드 기준 주요 localStorage key:

- `happytong_current_user`
- `happytong_targets`
- `happytong_activity_records`
- `happytong_emergency_reports`
- `happytong_admin_reports`
- `happytong_report_drafts`
- `signupRequests`
- `happytong_registered_users`

legacy migration key:

- `happy-tong-targets`
- `happy-tong-activity-records`
- `happy-tong-emergency-reports`
- `happy-tong-admin-reports`
- `happytong_admin_report_draft`
- `happy-tong-admin-report-draft`

현재 정책:

- 기존 localStorage 저장은 제거하지 않음
- Supabase write는 병행 저장으로 추가
- Supabase 실패 시 기존 UX를 깨지 않음
- read/merge는 기능별로 필요한 범위에서만 적용

## 7. 아직 완료되지 않은 범위

명확히 후속 과제로 남은 범위:

- 전체 read/merge 완전 전환
- 보고서 Supabase read/merge
- 보고서 `created_by` null 보완
- Supabase Auth 계정 자동 생성
- 체커 로그인 계정 발급 정책
- paused/left 체커의 담당 대상자 재배정 정책
- RLS/policy/grants 정리
- anon/authenticated broad grants 정리
- 테스트 데이터 정리
- 운영 배포 후 QA 체크리스트 작성

## 8. RLS/권한 정리 전 주의사항

현재 write는 service_role 기반 서버 API에서 수행한다.

중요 원칙:

- 클라이언트에서 직접 insert/update하지 않는 구조를 유지한다.
- service_role key는 서버 API에서만 사용한다.
- 프론트에는 `VITE_SUPABASE_ANON_KEY`만 노출 가능하다.
- RLS, policy, grants 정리는 모든 read/write 경로 QA 후 마지막 단계에서 별도 감사로 진행한다.

RLS 정리 전 확인할 것:

- 관리자/체커 화면 read 경로
- 서버 API write 경로
- localStorage fallback 경로
- anon/authenticated 권한 범위
- 조직별 데이터 격리 기준

## 9. 배포/운영 관련 주의사항

Vercel 관련:

- Hobby 플랜 Serverless Function 개수 제한에 주의
- API 파일 추가 시 함수 수 증가 여부 확인
- 신규 write API는 통합 API 방식 우선
- `vercel.json` 변경은 최소화
- cron 설정 유지 필요

환경 변수:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CRON_SECRET`
- VAPID 관련 push 환경 변수

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출 금지
- 전체 request body console.log 금지
- 개인정보 상세 로그 금지

## 10. 테스트 완료 기준

각 write 전환 기능은 아래 기준으로 확인한다.

- API 단독 curl 테스트
- SQL row 생성/수정 확인
- 화면 저장/수정 테스트
- 기존 localStorage 흐름 유지 확인
- Supabase 실패 시 기존 UX 유지 확인
- `npm run build` 성공
- Vercel Production Deployment Ready 확인
- 배포 URL에서 API route가 index.html fallback으로 빠지지 않는지 확인

기능별 확인된 기준:

- 생활 확인 기록: `activity_records` row 저장 및 체커/관리자 표시 확인
- 이상징후 보고: `emergency_reports` row 및 초기 handling log 저장 확인
- 이상징후 처리 상태: status update 및 handling log 추가 확인
- 대상자 관리: create/update/updateStatus 및 lifecycle 전환 확인
- 체커 관리: create/update/updateStatus 및 status/activity_status 정규화 확인
- 보고서 저장: `admin_reports` saveDraft/saveReport/updateReport 확인

## 11. 후속 추천 순서

추천 순서:

1. 보고서 `created_by` null 보완 여부 판단
2. 보고서 Supabase read/merge 보완
3. 전체 read/write QA
4. 테스트 데이터 정리
5. RLS/권한 정리 전 최종 감사
6. 운영 배포 후 QA 체크리스트 작성

## 12. 이번 문서에서 하지 않는 것

이번 문서는 요약 문서 작성만 수행한다.

하지 않는 것:

- 코드 수정
- API 수정
- DB/SQL/RLS/Auth 수정
- package.json 수정
- package-lock.json 수정
- vercel.json 수정
- 기존 문서 삭제
