# Vercel Function Count and Auth API Decision

## 1. 현재 API 파일 목록

현재 확인된 `api` 파일 구조:

- `api/admin-read.js`
- `api/checkers.js`
- `api/reports.js`
- `api/super.js`
- `api/targets.js`
- `api/activity-records/create.js`
- `api/cron/checker-reminders.js`
- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`
- `api/push/send-checker-reminders.js`
- `api/push/subscribe.js`
- `api/push/test-send.js`
- `api/push/_checkerReminderService.js`

주의:

- `api/push/_checkerReminderService.js`는 helper 파일로 API route가 아닐 가능성이 높다.
- 실제 Vercel Serverless Function 산정 방식은 배포 결과에서 최종 확인해야 한다.

## 2. Serverless Function 수 추정

`_checkerReminderService.js`를 helper로 보면 실제 함수 후보는 12개로 추정된다.

함수 후보:

1. `admin-read`
2. `checkers`
3. `reports`
4. `super`
5. `targets`
6. `activity-records/create`
7. `cron/checker-reminders`
8. `emergency-reports/create`
9. `emergency-reports/update-status`
10. `push/send-checker-reminders`
11. `push/subscribe`
12. `push/test-send`

이전 이력:

- `api/checker-read.js`를 추가했을 때 Vercel Hobby 플랜의 Serverless Functions 12개 제한을 초과해 배포가 실패했다.
- 이후 `api/checker-read.js`를 삭제하고 기존 `api/checkers.js`에 read action을 통합해 해결했다.

## 3. api/auth.js 신규 생성 위험

`api/auth.js`를 바로 신규 생성하면 함수 후보가 13개가 될 가능성이 높다.

위험:

- Vercel Hobby 플랜 제한 초과 가능성 높음
- 배포 단계에서 `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.` 오류 재발 가능
- auth/currentUser 전환 작업 자체는 작아도 배포가 막히면 운영 반영이 불가능함

판단:

- `api/auth.js` 신규 생성 전 함수 수를 1개 이상 줄이는 작업이 먼저 필요하다.

## 4. 함수 수를 줄이기 위한 통합 후보 비교

### A. emergency-reports 통합

대상:

- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`

목표:

- `api/emergency-reports.js` 단일 파일로 통합

예상 action:

- `create`
- `updateStatus`

추천도:

- 높음

이유:

- 같은 emergency reports 도메인
- create와 updateStatus action 분기가 자연스러움
- 기존 checkers/targets/reports 통합 API 패턴과 일관됨
- 함수 수를 1개 줄이는 효과가 있음
- 이후 `api/auth.js`를 신규 생성할 여지를 만들 수 있음

### B. activity-records 통합

대상:

- `api/activity-records/create.js`

목표:

- `api/activity-records.js`로 이동

추천도:

- 중간

이유:

- 현재 파일이 1개뿐이라 함수 수 감소 효과가 없음
- 폴더 구조 정리 효과는 있지만 Vercel 함수 제한 해결에는 직접 도움이 적음

### C. push API 통합

대상:

- `api/push/subscribe.js`
- `api/push/test-send.js`
- `api/push/send-checker-reminders.js`

추천도:

- 낮음

이유:

- subscribe, test-send, reminder 발송 성격이 서로 다름
- cron/push 운영 영향이 커서 통합 리스크가 큼
- push는 endpoint, subscription, reminder job 흐름이 섞여 있어 QA 범위가 커짐

### D. auth를 기존 api/checkers.js 또는 api/admin-read.js에 넣기

추천도:

- 낮음

이유:

- auth/currentUser는 역할 공통 책임
- checkers/admin-read 같은 도메인 API와 섞이면 유지보수성이 떨어짐
- 향후 권한 감사와 보안 설계에서 책임 경계가 흐려짐

## 5. 추천 방향

추천 순서:

1. 먼저 emergency-reports API를 통합해 함수 수를 1개 줄인다.
2. 이후 `api/auth.js`를 신규 생성한다.
3. `authService.js`의 `users`/`organizations` direct select를 `api/auth.js` `action=resolveCurrentUser`로 전환한다.

이 방식은 도메인 책임을 유지하면서 Vercel Hobby 함수 제한을 피하는 가장 안전한 경로다.

## 6. emergency-reports 통합 계획 초안

새 파일:

- `api/emergency-reports.js`

기존 파일:

- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`

통합 후 action:

- `create`
- `updateStatus`

기존 endpoint:

- `POST /api/emergency-reports/create`
- `POST /api/emergency-reports/update-status`

변경 endpoint:

- `POST /api/emergency-reports`

요청 body 예:

```json
{
  "action": "create"
}
```

```json
{
  "action": "updateStatus"
}
```

수정 대상 service 후보:

- `src/services/supabaseEmergencyReportsWriteService.js`
- `src/services/supabaseEmergencyStatusUpdateService.js`

유지해야 할 것:

- 기존 localStorage fallback
- 기존 화면 UX
- 기존 create 성공 응답 형태
- 기존 updateStatus 성공 응답 형태
- severity/status 정규화
- emergency_handling_logs 초기/처리 로그 insert 흐름
- 민감값 없는 warn/log 정책

삭제 대상:

- 기존 분리 API 파일 2개는 통합 완료 후 삭제

## 7. auth API 후속 계획

emergency-reports 통합으로 함수 수 여유를 만든 뒤:

- `api/auth.js` 신규 생성
- `action=resolveCurrentUser`
- service_role으로 `public.users`와 `organizations` 조회
- `password_hash`/password 관련 필드 반환 금지
- `authService.js` 이메일 Auth 흐름에서 직접 SELECT 제거
- mock 로그인 흐름은 유지

## 8. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 통합하지 않음
- 파일 삭제하지 않음
- `api/auth.js` 생성하지 않음
- DB/SQL/RLS/Auth 수정하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- Vercel 함수 수를 확정하지 않음

## 9. Emergency Reports API 통합 완료 기록

이번 구현에서 `api/emergency-reports/create.js`와 `api/emergency-reports/update-status.js`를 `api/emergency-reports.js` 단일 통합 API로 정리했다.

통합 후 endpoint:

- `POST /api/emergency-reports`

지원 action:

- `create`
- `updateStatus`

클라이언트 서비스 변경:

- `src/services/supabaseEmergencyReportsWriteService.js`는 `action: "create"`를 포함해 `/api/emergency-reports`로 요청한다.
- `src/services/supabaseEmergencyStatusUpdateService.js`는 `action: "updateStatus"`를 포함해 `/api/emergency-reports`로 요청한다.

예상 효과:

- Vercel Serverless Function 후보 수가 12개에서 11개로 1개 감소한다.
- 이후 `api/auth.js` 신규 생성을 위한 함수 슬롯을 확보할 수 있을 것으로 예상한다.
- 최종 함수 수와 배포 가능 여부는 Vercel Production Deployment 결과로 다시 확인해야 한다.
