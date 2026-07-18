# PWA Push 운영 알림 규칙

## 문서 목적

이 문서는 해피통서비스의 운영용 PWA 푸시 알림에 대해 아래 항목을 미리 고정하기 위한 설계 문서입니다.

- 누구에게 보낼지
- 어떤 조건에서 보낼지
- 어떤 문구를 사용할지
- 같은 알림을 어떻게 중복 발송하지 않을지

이 문서는 구현 전 운영 규칙을 정리하는 목적이며, 실제 코드 구현·DB 변경·API 추가를 포함하지 않습니다.

## 현재 완료된 알림 기반 기능

현재까지 준비된 기반 기능은 아래와 같습니다.

- PWA service worker 등록 완료
- 브라우저 Push 구독 생성 완료
- `push_subscriptions` 저장 완료
- `/api/push/test-send` 테스트 발송 API 구현 완료
- 테스트 발송 성공 확인 완료

아직 구현되지 않은 항목은 아래와 같습니다.

- 운영용 cron 실행
- 체커 리마인드 자동 발송
- 관리자 신규 이상징후 자동 발송
- 관리자 미처리 이상징후 리마인드
- 운영용 알림 이력 저장 및 중복 방지 로그

## 1차 운영 알림 우선순위

### 우선순위 1. 체커 오늘 확인 기록 리마인드

**목적**

- 체커가 오늘 확인 예정 대상자의 생활 확인 기록을 빠뜨리지 않도록 돕습니다.

**발송 대상**

- `role = checker`
- 해당 체커에게 오늘 확인 예정 대상자가 있음
- 오늘 확인 완료 기록이 아직 없는 대상자가 있음
- active push subscription이 있는 체커

**발송 시점 후보**

- 매일 오후 5시
- 추후 기관별 설정 가능

**알림 문구 후보**

- 제목: `해피통서비스 확인 알림`
- 본문: `오늘 확인 기록이 아직 남아있어요. 확인 예정 대상자를 확인해주세요.`
- URL: `/checker/home`

**중복 방지 기준**

- 같은 체커에게 같은 날짜, 같은 알림 유형은 1회만 발송
- 추후 `push_notification_logs` 테이블로 기록 관리 필요

### 우선순위 2. 관리자 신규 이상징후 보고 알림

**목적**

- 체커가 이상징후를 보고했을 때 관리자가 빠르게 확인하도록 돕습니다.

**발송 대상**

- 해당 `organization_id`의 `role = admin`
- active push subscription이 있는 관리자

**발송 시점**

- 이상징후 보고 생성 직후

**알림 문구 후보**

- 제목: `새 이상징후 보고`
- 본문: `새로운 이상징후 보고가 접수되었습니다. 관리자 화면에서 확인해주세요.`
- URL: `/admin/emergencies`

**중복 방지 기준**

- 같은 `emergency_id` 기준으로 관리자별 1회 발송

### 우선순위 3. 관리자 미처리 이상징후 리마인드

**목적**

- `접수됨`, `처리중` 상태의 이상징후가 오래 방치되지 않도록 돕습니다.

**발송 대상**

- 해당 `organization_id`의 `role = admin`
- 미완료 이상징후가 있는 기관

**발송 시점 후보**

- 매일 오전 9시
- 또는 매일 오후 6시
- MVP에서는 보류 가능

**알림 문구 후보**

- 제목: `미처리 이상징후 알림`
- 본문: `아직 완료되지 않은 이상징후가 있습니다. 확인해주세요.`
- URL: `/admin/emergencies`

## 1차 구현 추천 순서

1. `push_notification_logs` 테이블 설계
   - 알림 중복 방지용
   - `notification_type`
   - `target_user_id`
   - `organization_id`
   - `related_entity_type`
   - `related_entity_id`
   - `sent_date`
   - `sent_at`
   - `status`

2. 체커 오늘 확인 기록 리마인드 대상 조회 로직 설계

3. `api/push/send-checker-reminders.js` 구현

4. Vercel Cron 연결

5. 관리자 신규 이상징후 알림 구현

## 필요한 DB 추가 계획

운영 알림의 중복 방지와 발송 이력 관리를 위해 `push_notification_logs` 테이블이 필요합니다.

### 테이블 초안 필드

| 필드 | 설명 |
| --- | --- |
| `id uuid primary key` | 로그 식별자 |
| `notification_type text` | 알림 유형 |
| `target_user_id uuid` | 알림 수신 사용자 |
| `organization_id uuid` | 기관 식별자 |
| `related_entity_type text nullable` | 연결된 엔티티 종류 |
| `related_entity_id uuid nullable` | 연결된 엔티티 ID |
| `sent_date date` | 일 단위 중복 방지 기준 |
| `title text` | 실제 발송 제목 |
| `body text` | 실제 발송 본문 |
| `url text` | 클릭 이동 경로 |
| `status text` | 발송 상태 |
| `error_code text nullable` | 실패 코드 저장용 |
| `created_at timestamptz` | 생성 시각 |
| `sent_at timestamptz nullable` | 실제 발송 시각 |

### 중복 방지 unique 후보

- `notification_type`
- `target_user_id`
- `related_entity_type`
- `related_entity_id`
- `sent_date`

주의 메모:

- `related_entity_id`가 없는 일일 리마인드는 위 조합만으로는 완전하지 않을 수 있습니다.
- 예를 들어 체커 일일 리마인드는 `notification_type + target_user_id + sent_date` 중심의 별도 unique 설계가 더 적합할 수 있습니다.

## 운영상 주의사항

- 푸시 알림은 보조 수단이며, 앱 내 목록과 대시보드가 원본입니다.
- 민감한 개인정보를 알림 본문에 직접 넣지 않습니다.
- 어르신 이름, 상세 주소, 건강 상태 등은 푸시 본문에서 제외합니다.
- 알림 클릭 후 앱 안에서 상세 내용을 확인하도록 유도합니다.
- 실패한 구독은 `is_active = false` 처리합니다.
- 한 사용자가 여러 기기에서 구독할 수 있으므로 `user_id` 기준 다중 subscription 발송을 고려합니다.

## MVP에서 하지 않을 것

- 알림 상세 설정 화면
- 기관별 발송 시간 설정
- 야간/휴일 정책
- SMS 연동
- 카카오톡 연동
- 관리자 대량 발송
- 마케팅 알림
- 개인정보 포함 알림

## 운영 규칙 요약 표

| 우선순위 | 알림 유형 | 대상 | 시점 | URL | 중복 기준 |
| --- | --- | --- | --- | --- | --- |
| 1 | 체커 오늘 확인 기록 리마인드 | 오늘 미작성 대상이 남은 체커 | 매일 오후 5시 후보 | `/checker/home` | 체커별 1일 1회 |
| 2 | 관리자 신규 이상징후 보고 | 해당 기관 관리자 | 보고 생성 직후 | `/admin/emergencies` | `emergency_id` 기준 관리자별 1회 |
| 3 | 관리자 미처리 이상징후 리마인드 | 미완료 이상징후가 있는 기관 관리자 | 오전 9시/오후 6시 후보 | `/admin/emergencies` | 일자별 또는 상태별 추가 설계 필요 |

## 다음 구현 단계

다음 단계는 아래 순서로 진행합니다.

1. `docs/pwa-push-notification-logs-schema-plan.md` 생성
2. `push_notification_logs` SQL 초안 작성
3. 체커 리마인드 API 구현

