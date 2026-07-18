# PWA 테스트 푸시 발송 가이드

## 문서 목적

이 문서는 해피통서비스의 PWA Web Push 연결 상태를 점검하기 위해 `/api/push/test-send`를 어떻게 호출하는지 정리한 가이드입니다.

- 목적: 저장된 `push_subscriptions` 구독 1건에 테스트 알림을 보내 브라우저 수신 여부를 확인합니다.
- 범위: 테스트 발송만 다룹니다.
- 제외: 실제 운영 자동 발송, 체커 리마인드 cron, 관리자 이상징후 자동 알림은 이번 범위에 포함하지 않습니다.

## 사전 조건

아래 조건이 모두 준비되어 있어야 합니다.

| 항목 | 확인 내용 |
| --- | --- |
| 구독 데이터 | `public.push_subscriptions`에 `is_active = true`인 행이 최소 1건 있어야 합니다. |
| VAPID 환경변수 | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`가 서버 환경에 등록되어 있어야 합니다. |
| Supabase 서버 환경변수 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 Vercel 서버 환경에 등록되어 있어야 합니다. |
| 보호용 시크릿 | `CRON_SECRET`가 등록되어 있어야 합니다. |
| 브라우저 준비 | 테스트 대상 브라우저에서 알림 권한이 허용되어 있어야 합니다. |

## API 개요

- 경로: `/api/push/test-send`
- 메서드: `POST`
- 인증: 아래 둘 중 하나
  - `x-cron-secret` 헤더
  - `Authorization: Bearer ...` 헤더

## 요청 방식

### 1. 특정 subscriptionId 기준 테스트

```json
{
  "subscriptionId": "YOUR_SUBSCRIPTION_ID",
  "title": "해피통서비스 알림 테스트",
  "body": "알림 수신 설정이 정상적으로 연결되었습니다.",
  "url": "/checker/home"
}
```

권장 상황:

- 이미 저장된 특정 체커/관리자 구독 1건을 정확히 테스트하고 싶을 때

### 2. role 기준 테스트

```json
{
  "role": "checker",
  "title": "해피통서비스 알림 테스트",
  "body": "알림 수신 설정이 정상적으로 연결되었습니다.",
  "url": "/checker/home"
}
```

동작 방식:

- `role = checker | admin | super_admin`
- `is_active = true` 조건의 첫 번째 구독 1건을 대상으로 테스트 발송합니다.

## curl 예시

아래 예시는 Windows `cmd`/PowerShell에서 참고할 수 있는 형태입니다.
실제 키 값이나 구독 ID는 문서에 적지 말고 각자 환경값으로 바꿔 넣어야 합니다.

```bash
curl -X POST https://YOUR_DOMAIN/api/push/test-send ^
  -H "Content-Type: application/json" ^
  -H "x-cron-secret: YOUR_CRON_SECRET" ^
  -d "{\"subscriptionId\":\"YOUR_SUBSCRIPTION_ID\",\"title\":\"해피통서비스 알림 테스트\",\"body\":\"알림 수신 설정이 정상적으로 연결되었습니다.\",\"url\":\"/checker/home\"}"
```

role 기준 예시:

```bash
curl -X POST https://YOUR_DOMAIN/api/push/test-send ^
  -H "Content-Type: application/json" ^
  -H "x-cron-secret: YOUR_CRON_SECRET" ^
  -d "{\"role\":\"checker\",\"title\":\"해피통서비스 알림 테스트\",\"body\":\"알림 수신 설정이 정상적으로 연결되었습니다.\",\"url\":\"/checker/home\"}"
```

## 응답 예시

성공:

```json
{
  "success": true,
  "sent": 1
}
```

실패:

```json
{
  "success": false,
  "error": "Failed to send test push notification.",
  "code": "WEB_PUSH_SEND_FAILED"
}
```

주요 에러 코드:

| code | 의미 |
| --- | --- |
| `METHOD_NOT_ALLOWED` | `POST`가 아닌 방식으로 호출한 경우 |
| `UNAUTHORIZED` | `CRON_SECRET` 인증이 실패한 경우 |
| `MISSING_SUPABASE_ENV` | 서버의 Supabase 환경변수가 누락된 경우 |
| `MISSING_VAPID_ENV` | 서버의 VAPID 환경변수가 누락된 경우 |
| `INVALID_JSON` | 요청 body 형식이 잘못된 경우 |
| `SUBSCRIPTION_NOT_FOUND` | 대상 구독을 찾지 못한 경우 |
| `WEB_PUSH_SEND_FAILED` | Web Push 전송이 실패한 경우 |
| `INTERNAL_ERROR` | 그 외 서버 내부 오류 |

## 브라우저에서 수신 확인하는 방법

1. 테스트 대상 브라우저에서 해피통서비스에 접속합니다.
2. 알림 권한이 허용된 상태인지 확인합니다.
3. 해당 브라우저가 실제로 구독 저장까지 완료한 상태인지 확인합니다.
4. 위 API를 호출합니다.
5. 브라우저 또는 설치된 PWA 앱에서 알림이 표시되는지 확인합니다.
6. 알림 클릭 시 `url`로 전달한 경로로 이동하는지 확인합니다.

## 만료된 구독 처리

테스트 발송 중 Web Push 응답이 `404` 또는 `410`이면, 서버는 해당 `push_subscriptions` 행을 `is_active = false`로 비활성화합니다.

이유:

- 브라우저가 더 이상 유효하지 않은 구독 endpoint를 들고 있을 수 있기 때문입니다.
- 이후에는 해당 브라우저에서 다시 권한/구독 연결 과정을 거쳐 새 구독을 저장해야 합니다.

## 보안 주의사항

다음 값들은 문서, 화면, 콘솔, 공유 캡처에 노출하지 않습니다.

- `endpoint`
- `p256dh`
- `auth`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`

또한 테스트 중에도 아래 원칙을 유지합니다.

- `push_subscriptions` 전체 목록을 외부에 공유하지 않습니다.
- endpoint 원문이 들어간 요청/응답/로그를 남기지 않습니다.
- 테스트 발송 API는 내부 운영 점검용으로만 사용합니다.

## 확인 순서 권장

1. 체커 홈에서 알림 권한 허용 및 구독 저장까지 완료
2. `push_subscriptions`에 active 행 존재 확인
3. Vercel 환경변수 등록 상태 확인
4. `/api/push/test-send` 호출
5. 브라우저 수신 여부 확인
6. 실패 시 Vercel Function Logs에서 에러 코드만 확인

## 이번 단계에서 하지 않는 것

- 관리자 새 이상징후 자동 푸시 발송
- 체커 오후 5시 리마인드 cron
- 테스트 발송 이후 자동 재시도 정책
- 운영용 대량 발송 API
