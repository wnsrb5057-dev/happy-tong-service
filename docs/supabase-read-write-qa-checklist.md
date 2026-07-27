# Supabase read/write QA 체크리스트

## 1. 문서 목적

이 문서는 해피통서비스의 Supabase read/write 전환 이후 운영 전 QA 기준을 정리한다.

목적:

- 기능별로 확인해야 할 화면, API, SQL 기준을 정리
- localStorage fallback 유지 여부 확인
- Vercel 배포 및 API 응답 상태 확인
- RLS/권한 정리 전 기능 정상 여부 확인

이번 문서는 QA 기준만 정리하며 코드, API, DB, 설정 파일은 수정하지 않는다.

## 2. QA 전 준비사항

배포 확인:

- Vercel 최신 Production Deployment가 `Ready`인지 확인
- 테스트 중인 URL이 최신 배포본인지 확인
- API 응답이 `index.html` fallback이 아니라 JSON인지 확인

환경변수 확인:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CRON_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

테스트 계정:

- `admin / 1234`
- `checker / 1234`
- `super_admin / 1234`
- 이메일 Auth 계정이 별도로 있는 경우 해당 계정도 함께 기록

기준 organization id:

- `11111111-1111-1111-1111-111111111111`

## 3. 공통 QA 기준

각 기능마다 아래 항목을 확인한다.

- 화면 진입 및 버튼 동작 정상
- API 응답이 기대한 JSON 형태인지 확인
- 성공 API는 `success: true`
- 실패 API는 기대 가능한 `400` 또는 명확한 error code 반환
- Supabase row 생성/수정 확인
- localStorage fallback 유지 확인
- 새로고침 후 화면 유지 여부 확인
- Vercel Function log에 주요 오류가 없는지 확인
- `npm run build` 성공

## 4. 생활 확인 기록 작성 QA

화면 경로:

- 체커 로그인
- 생활 확인 기록 작성 화면
- 저장 후 체커 활동 이력 확인

Supabase 테이블:

- `public.activity_records`

주요 확인 필드:

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

확인 SQL:

```sql
select
  id,
  organization_id,
  target_id,
  checker_id,
  check_type,
  checked_at,
  condition_summary,
  memo,
  has_issue,
  issue_level,
  check_items,
  status,
  created_at
from public.activity_records
order by created_at desc
limit 10;
```

화면 확인:

- 체커 활동 이력에 저장 기록 표시
- 관리자 확인기록/대시보드/통계에 필요한 범위로 반영
- `check_type`, `issue_level`, `check_items` 코드값이 사용자 문구로 표시
- 이상징후 있음/없음 배지가 DB 값과 일치

실패 시 확인 파일/API:

- `api/activity-records/create.js`
- `src/services/supabaseActivityRecordsWriteService.js`
- `src/pages/checkerPages.jsx`
- `src/pages/adminPages.jsx`

## 5. 이상징후 보고 작성 QA

화면 경로:

- 체커 로그인
- 이상징후 보고 작성
- 관리자 이상징후 목록/상세 확인

Supabase 테이블:

- `public.emergency_reports`
- `public.emergency_handling_logs`

주요 확인 필드:

- `organization_id`
- `target_id`
- `checker_id`
- `type`
- `severity`
- `status`
- `title`
- `description`
- `reported_at`
- 초기 handling log 생성 여부

확인 SQL:

```sql
select
  id,
  organization_id,
  target_id,
  checker_id,
  type,
  severity,
  status,
  title,
  description,
  reported_at,
  created_at
from public.emergency_reports
order by created_at desc
limit 10;
```

```sql
select
  id,
  emergency_report_id,
  organization_id,
  status,
  memo,
  created_by,
  created_by_name,
  created_at
from public.emergency_handling_logs
order by created_at desc
limit 10;
```

화면 확인:

- 관리자 이상징후 목록에 새 보고 표시
- 상세 화면에서 보고 내용 표시
- severity/status 라벨 표시 정상

실패 시 확인 파일/API:

- `api/emergency-reports/create.js`
- `src/services/supabaseEmergencyReportsWriteService.js`
- `src/pages/checkerPages.jsx`
- `src/pages/adminPages.jsx`

## 6. 이상징후 처리 상태 변경 QA

화면 경로:

- 관리자 이상징후 상세
- 처리 상태 변경
- 처리 이력 확인

Supabase 테이블:

- `public.emergency_reports`
- `public.emergency_handling_logs`

주요 확인 필드:

- `emergency_reports.status`
- `emergency_reports.completed_at`
- `emergency_reports.updated_at`
- `emergency_handling_logs.status`
- `emergency_handling_logs.memo`
- `emergency_handling_logs.created_by_name`

확인 SQL:

```sql
select
  id,
  status,
  completed_at,
  updated_at
from public.emergency_reports
order by updated_at desc
limit 10;
```

```sql
select
  id,
  emergency_report_id,
  status,
  memo,
  contacted_guardian,
  visit_required,
  created_by,
  created_by_name,
  created_at
from public.emergency_handling_logs
order by created_at desc
limit 10;
```

화면 확인:

- 상태 배지가 변경됨
- 처리 이력에 새 log 표시
- `completed` 상태일 때 완료 시각 반영

실패 시 확인 파일/API:

- `api/emergency-reports/update-status.js`
- `src/services/supabaseEmergencyStatusUpdateService.js`
- `src/services/supabaseAdminEmergenciesService.js`
- `src/pages/adminPages.jsx`

## 7. 대상자 등록/수정/관리종료/재관리 QA

화면 경로:

- 관리자 대상자 등록
- 대상자 상세
- 대상자 수정
- 관리종료
- 재관리시작

Supabase 테이블:

- `public.targets`

API:

- `POST /api/targets`

action:

- `create`
- `update`
- `updateStatus`

주요 확인 필드:

- `organization_id`
- `assigned_checker_id`
- `name`
- `phone`
- `address`
- `risk_level`
- `lifecycle_status`
- `check_days`
- `updated_at`

확인 SQL:

```sql
select
  id,
  organization_id,
  assigned_checker_id,
  name,
  phone,
  address,
  risk_level,
  lifecycle_status,
  check_days,
  created_at,
  updated_at
from public.targets
order by updated_at desc
limit 10;
```

화면 확인:

- 대상자 목록에 신규/수정 대상자 표시
- 대상자 상세 진입 가능
- lifecycle badge 표시 정상
- 수정/관리종료/재관리시작 후 `assigned_checker_id` 유지

실패 시 확인 파일/API:

- `api/targets.js`
- `src/services/supabaseTargetsWriteService.js`
- `src/pages/adminPages.jsx`

## 8. 체커 등록/수정/상태 변경 QA

화면 경로:

- 관리자 체커 등록
- 체커 상세
- 체커 수정
- 상태 변경

Supabase 테이블:

- `public.users`

API:

- `POST /api/checkers`

action:

- `create`
- `update`
- `updateStatus`

주요 확인 필드:

- `organization_id`
- `username`
- `name`
- `phone`
- `region`
- `role = checker`
- `status`
- `activity_status`
- `auth_user_id`

확인 SQL:

```sql
select
  id,
  organization_id,
  username,
  name,
  phone,
  region,
  role,
  status,
  activity_status,
  auth_user_id,
  created_at,
  updated_at
from public.users
where role = 'checker'
order by updated_at desc
limit 10;
```

화면 확인:

- 체커 목록에 신규 체커 표시
- 체커 상세/수정 진입 가능
- 일시중지/활동재개/활동종료 상태 badge 정상
- Supabase Auth 계정은 자동 생성되지 않는 것이 현재 기준

실패 시 확인 파일/API:

- `api/checkers.js`
- `src/services/supabaseCheckersWriteService.js`
- `src/pages/adminPages.jsx`

## 9. 보고서 초안/최종 저장 QA

화면 경로:

- 관리자 보고서 작성
- 초안 저장/PDF 내보내기
- 보고서 생성/저장
- 미리보기

Supabase 테이블:

- `public.admin_reports`

API:

- `POST /api/reports`

action:

- `saveDraft`
- `saveReport`
- `updateReport`

주요 확인 필드:

- `organization_id`
- `title`
- `status`
- `period_start`
- `period_end`
- `summary`
- `action_note`
- `report_data`
- `created_by`
- `updated_at`

확인 SQL:

```sql
select
  r.id,
  r.organization_id,
  r.title,
  r.status,
  r.period_start,
  r.period_end,
  r.summary,
  r.action_note,
  r.created_by,
  u.name as created_by_name,
  u.role as created_by_role,
  r.created_at,
  r.updated_at
from public.admin_reports r
left join public.users u on u.id = r.created_by
order by r.updated_at desc
limit 10;
```

화면 확인:

- 미리보기 표시 정상
- localStorage draft fallback 유지
- `created_by`가 가능한 경우 public.users id로 저장
- `report_data`에 화면 보고서 payload 저장

실패 시 확인 파일/API:

- `api/reports.js`
- `src/services/supabaseReportsWriteService.js`
- `src/pages/adminPages.jsx`

## 10. 보고서 read/merge QA

확인 대상:

- `/api/reports action=listReports`
- `/api/reports action=getReport`
- `AdminReportPreview` fallback

API 테스트 예시:

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/reports" \
  -H "Content-Type: application/json" \
  --data "{\"action\":\"listReports\",\"organizationId\":\"11111111-1111-1111-1111-111111111111\"}"
```

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/reports" \
  -H "Content-Type: application/json" \
  --data "{\"action\":\"getReport\",\"reportId\":\"REPORT_ID\"}"
```

확인 기준:

- `listReports` 200 OK
- `count >= 1`
- `getReport` 200 OK
- `report.id` 일치
- `/admin/reports/preview?reportId=...` 화면이 깨지지 않음
- Supabase 실패 시 기존 `readReportDraft()` fallback 유지

실패 시 확인 파일:

- `api/reports.js`
- `src/services/supabaseAdminReportsReadService.js`
- `src/pages/adminPages.jsx`

## 11. PWA push/리마인더 QA

확인 대상:

- service worker 등록
- push subscription 저장
- test-send API
- checker reminder dryRun
- checker reminder actual send

Supabase 테이블 후보:

- `public.push_subscriptions`
- `public.push_notification_logs`

API:

- `api/push/subscribe.js`
- `api/push/test-send.js`
- `api/push/send-checker-reminders.js`
- `api/cron/checker-reminders.js`

관련 문서:

- `docs/pwa-checker-reminder-api-guide.md`
- `docs/pwa-push-operational-rules.md`
- `docs/pwa-test-send-guide.md`
- `docs/pwa-vapid-env-setup-guide.md`

확인 SQL:

```sql
select
  id,
  user_id,
  endpoint,
  created_at,
  updated_at
from public.push_subscriptions
order by updated_at desc
limit 10;
```

```sql
select
  id,
  user_id,
  notification_type,
  status,
  error_message,
  created_at
from public.push_notification_logs
order by created_at desc
limit 20;
```

확인 기준:

- 구독 row 생성
- test notification 수신
- reminder send/log 생성
- cron endpoint가 `CRON_SECRET` 검증을 통과

## 12. API 단독 테스트 모음

민감한 env 값이나 service_role key는 curl에 넣지 않는다.

기본 action 분기 확인:

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/targets" \
  -H "Content-Type: application/json" \
  --data "{}"
```

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/checkers" \
  -H "Content-Type: application/json" \
  --data "{}"
```

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/reports" \
  -H "Content-Type: application/json" \
  --data "{}"
```

기대:

- 통합 API는 `INVALID_ACTION` 또는 명확한 400 JSON 응답
- `Content-Disposition: inline; filename="index.html"`이면 API fallback 문제 의심

생활 확인 기록 API 예시:

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/activity-records/create" \
  -H "Content-Type: application/json" \
  --data "{}"
```

이상징후 보고 API 예시:

```bash
curl -i -X POST "https://happy-tong-service-copy.vercel.app/api/emergency-reports/create" \
  -H "Content-Type: application/json" \
  --data "{}"
```

## 13. SQL 확인 쿼리 모음

최근 row 확인:

```sql
select * from public.activity_records order by created_at desc limit 10;
select * from public.emergency_reports order by created_at desc limit 10;
select * from public.emergency_handling_logs order by created_at desc limit 10;
select * from public.targets order by updated_at desc limit 10;
select * from public.users where role = 'checker' order by updated_at desc limit 10;
select * from public.admin_reports order by updated_at desc limit 10;
select * from public.push_subscriptions order by updated_at desc limit 10;
select * from public.push_notification_logs order by created_at desc limit 20;
```

보고서 작성자 join:

```sql
select
  r.id,
  r.title,
  r.status,
  r.created_by,
  u.name as created_by_name,
  u.role as created_by_role,
  r.created_at,
  r.updated_at
from public.admin_reports r
left join public.users u on u.id = r.created_by
order by r.updated_at desc
limit 10;
```

## 14. localStorage fallback 확인

브라우저 DevTools > Application > Local Storage에서 확인할 key:

- `happytong_activity_records`
- `happytong_emergency_reports`
- `happytong_targets`
- `happytong_admin_reports`
- `happytong_report_drafts`
- `happytong_current_user`
- `happytong_registered_users`
- `signupRequests`

확인 기준:

- Supabase 저장이 성공해도 기존 localStorage 흐름이 깨지지 않음
- Supabase read 실패 시 localStorage fallback 표시
- 새로고침 후 기존 화면 상태가 유지됨

## 15. 실패 시 공통 점검 순서

1. Vercel 최신 배포가 Ready인지 확인
2. 최신 커밋이 Production에 반영됐는지 확인
3. API 응답이 JSON인지 index.html fallback인지 확인
4. `INVALID_ACTION`이면 action 이름과 body 구조 확인
5. 400이면 필수값/UUID-like/조직 id 확인
6. 500이면 Vercel Function log 확인
7. Supabase FK/CHECK constraint 오류 확인
8. env var 누락 확인
9. RLS/권한 오류 여부 확인
10. localStorage fallback이 유지되는지 확인

## 16. QA 완료 판정 기준

QA 완료 기준:

- 각 기능별 화면 테스트 1회 이상
- 각 기능별 SQL row 확인 1회 이상
- 통합 API의 expected 200/400 JSON 응답 확인
- localStorage fallback 유지 확인
- `npm run build` 성공
- Vercel Production Deployment Ready
- 주요 콘솔/API 오류 없음

## 17. 다음 단계

QA 완료 후 추천 순서:

1. 테스트 데이터 정리 계획 수립
2. RLS/권한 정리 전 DB 권한 감사
3. 운영 배포 전 사용자 시나리오 QA
4. 사용자 기관/Auth 정책 정리
5. 문서 최종 정리

## 18. 이번 문서에서 하지 않는 것

이번 문서는 QA 체크리스트 작성만 수행한다.

하지 않는 것:

- 코드 수정
- API 수정
- DB/SQL/RLS/Auth 수정
- package.json 수정
- package-lock.json 수정
- vercel.json 수정
- 테스트 데이터 삭제
- 기존 문서 삭제
