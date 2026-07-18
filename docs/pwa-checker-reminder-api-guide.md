# 체커 확인 리마인드 API 가이드

## API 목적

`/api/push/send-checker-reminders`는 체커의 오늘 확인 기록 리마인드를 **수동으로 발송**하기 위한 서버 API입니다.

현재 단계의 목적은 아래와 같습니다.

- 체커 리마인드 발송 구조 검증
- `push_subscriptions` 기반 푸시 발송 확인
- `push_notification_logs` 기반 중복 방지 및 이력 기록 확인

이번 단계에는 아래 항목이 포함되지 않습니다.

- Vercel Cron 자동 실행
- 관리자 신규 이상징후 알림
- 관리자 미처리 이상징후 리마인드
- 실제 “오늘 확인 예정 / 미완료 기록” DB 필터 연결

## 호출 전제 조건

아래 조건이 준비되어 있어야 합니다.

- `public.push_subscriptions`에 active checker 구독이 있어야 함
- `public.push_notification_logs` 테이블이 생성되어 있어야 함
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 서버 환경에 등록되어 있어야 함
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`가 서버 환경에 등록되어 있어야 함
- `CRON_SECRET`가 서버 환경에 등록되어 있어야 함

## 보호 방식

이 API는 아래 둘 중 하나로 보호합니다.

- `x-cron-secret` 헤더
- `Authorization: Bearer ...` 헤더

시크릿이 일치하지 않으면 `401 UNAUTHORIZED`를 반환합니다.

## 요청 방식

- 메서드: `POST`

요청 body 예시:

```json
{
  "date": "2026-07-18",
  "dryRun": false
}
```

설명:

- `date`: 선택값. 없으면 서버 기준 오늘 날짜 사용
- `dryRun`: `true`면 실제 푸시는 보내지 않고 대상 수만 계산

## dryRun 사용법

`dryRun: true`일 때는 아래만 계산합니다.

- 대상 checker 수
- active subscription 수
- 이미 발송된 로그 수
- 발송 예정 수

이 경우 아래 동작은 하지 않습니다.

- `webpush.sendNotification()` 호출
- `push_notification_logs` 기록 추가/수정

예시:

```bash
curl -X POST https://YOUR_DOMAIN/api/push/send-checker-reminders ^
  -H "Content-Type: application/json" ^
  -H "x-cron-secret: YOUR_CRON_SECRET" ^
  -d "{\"date\":\"2026-07-18\",\"dryRun\":true}"
```

## 실제 발송 사용법

`dryRun: false`일 때는 실제 푸시 발송을 시도합니다.

예시:

```bash
curl -X POST https://YOUR_DOMAIN/api/push/send-checker-reminders ^
  -H "Content-Type: application/json" ^
  -H "x-cron-secret: YOUR_CRON_SECRET" ^
  -d "{\"date\":\"2026-07-18\",\"dryRun\":false}"
```

## 현재 1차 MVP 대상 조회 기준

현재 API는 안전한 1차 구조만 먼저 구현합니다.

대상 기준:

- `public.users`에서 `role = 'checker'`
- `status`가 있으면 `active`
- active `push_subscriptions`가 있는 checker
- 해당 날짜에 `checker_daily_reminder` 로그가 아직 `sent` 또는 `pending`이 아닌 checker

즉, 아직 아래 조건은 **연결되지 않았습니다**.

- 실제 오늘 확인 예정 대상자가 있는지
- 실제 오늘 확인 완료 기록이 없는지

현재는 **active checker subscription 기반 리마인드 구조 검증 단계**입니다.

## 중복 방지 기준

중복 방지는 `push_notification_logs`를 기준으로 판단합니다.

조회 조건:

- `notification_type = 'checker_daily_reminder'`
- `target_user_id = checker user id`
- `sent_date = 요청 date`
- `status in ('sent', 'pending')`

위 조건에 해당하면 이미 발송된 것으로 보고 다시 보내지 않습니다.

## 발송 payload

민감 개인정보 없이 아래 고정 문구를 사용합니다.

- 제목: `해피통서비스 확인 알림`
- 본문: `오늘 확인 기록이 아직 남아있어요. 확인 예정 대상자를 확인해주세요.`
- URL: `/checker/home`

## 발송 로그 기록 방식

성공 시:

- `notification_type = checker_daily_reminder`
- `target_user_id = checker user id`
- `organization_id = checker.organization_id`
- `sent_date = 요청 date`
- `title`, `body`, `url` 기록
- `status = sent`
- `subscription_id = 대표 subscription id`
- `sent_at = now()`

실패 시:

- `status = failed`
- `error_code = WEB_PUSH_SEND_FAILED` 등
- `error_message = 민감값 없는 요약`

주의:

- 여러 기기가 있어도 로그는 사용자 기준 1건만 남깁니다.
- 구독 상세값 자체는 로그 테이블에 저장하지 않습니다.

## 만료 구독 처리

`web-push` 발송 실패 중 `404` 또는 `410`이 나오면 해당 `push_subscriptions` 행을 `is_active = false`로 비활성화합니다.

## 응답 예시

성공:

```json
{
  "success": true,
  "date": "2026-07-18",
  "targetUsers": 1,
  "sent": 1,
  "skipped": 0,
  "failed": 0,
  "dryRun": false
}
```

dryRun:

```json
{
  "success": true,
  "date": "2026-07-18",
  "targetUsers": 2,
  "activeSubscriptions": 3,
  "alreadyLogged": 1,
  "scheduled": 1,
  "sent": 0,
  "skipped": 1,
  "failed": 0,
  "dryRun": true
}
```

## 에러 코드

- `METHOD_NOT_ALLOWED`
- `UNAUTHORIZED`
- `MISSING_SUPABASE_ENV`
- `MISSING_VAPID_ENV`
- `INVALID_JSON`
- `USER_QUERY_FAILED`
- `SUBSCRIPTION_QUERY_FAILED`
- `LOG_QUERY_FAILED`
- `WEB_PUSH_SEND_FAILED`
- `INTERNAL_ERROR`

## 현재 MVP 한계

현재 API는 아래 한계를 갖습니다.

1. 아직 “오늘 확인 예정 대상자” 테이블과 연결되지 않음
2. 아직 “오늘 확인 완료 기록 없음”을 실제 DB에서 판별하지 않음
3. 현재는 active checker subscription 기반으로 리마인드 구조를 먼저 검증하는 단계

## 향후 계획

다음 단계에서는 아래 순서로 확장합니다.

1. 체커 대상자/기록 테이블과 실제 미완료 판별 로직 연결
2. 수동 호출 검증 완료
3. Vercel Cron 연결

## Vercel Cron 연결

- Cron 경로: `/api/cron/checker-reminders`
- schedule: `0 8 * * *`
- 의미: 매일 UTC 08:00, 한국시간 오후 5시 실행

주의:

- Vercel Cron은 production deployment 기준으로 동작합니다.
- 기존 수동 테스트는 계속 `POST /api/push/send-checker-reminders`를 사용합니다.

## Cron 배포 후 확인 방법

1. Vercel deployment가 Ready 상태인지 확인
2. Vercel Logs에서 `/api/cron/checker-reminders` 호출 확인
3. `push_notification_logs`에 `checker_daily_reminder` 기록이 생성되는지 확인
4. 같은 날짜 재실행 시 `skipped`가 증가하는지 확인
