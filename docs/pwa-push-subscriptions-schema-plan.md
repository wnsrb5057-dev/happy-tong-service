# 해피통서비스 push_subscriptions 테이블 설계 초안

## 1. 문서 목적

이 문서는 해피통서비스의 PWA Web Push 알림 도입 전에, `push_subscriptions` 테이블을 어떤 기준으로 설계할지 정리하는 문서입니다.

이번 문서의 범위:

- 브라우저 Push Subscription 저장 구조 설계
- 사용자 식별 기준 정리
- 중복 구독 처리 정책 정리
- 권한/RLS 전제 정리
- 인덱스와 데이터 수명주기 초안 정리

이번 문서의 비범위:

- 실제 SQL 작성
- 실제 Supabase migration 실행
- 실제 API 구현
- 실제 서비스워커 구현
- 실제 RLS policy 적용

관련 문서:

- [docs/pwa-push-notification-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-notification-plan.md)

---

## 2. push_subscriptions 테이블 목적

`push_subscriptions` 테이블은 브라우저별 Push Subscription 정보를 저장하기 위한 테이블입니다.

이 테이블이 필요한 이유:

- Web Push는 사용자 1명당 1개가 아니라, 브라우저/기기별로 별도 구독이 생성될 수 있습니다.
- 같은 사용자가 휴대폰 Chrome, 데스크톱 Chrome, Edge 등 여러 환경에서 동시에 알림을 받을 수 있습니다.
- 브라우저 재설치, 권한 재허용, 서비스워커 재등록 등으로 구독 정보가 갱신될 수 있습니다.

### 핵심 설계 원칙

- 사용자(`public.users.id`) 1명 : 구독 N개 구조가 필요합니다.
- 구독 레코드는 “사람”이 아니라 “브라우저/기기 인스턴스”에 가깝게 다뤄야 합니다.
- 발송은 사용자 기준으로 하되, 실제 발송 대상은 그 사용자의 활성 구독 목록입니다.

---

## 3. 추천 테이블 구조 요약

추천 컬럼 후보는 아래와 같습니다.

| 컬럼 | 타입 후보 | 목적 요약 |
| --- | --- | --- |
| `id` | `uuid` | 구독 레코드 기본 키 |
| `user_id` | `uuid` | `public.users.id` 연결 |
| `auth_user_id` | `uuid` | `auth.users.id` 연결 |
| `organization_id` | `uuid` | 기관 단위 발송/조회 보조 |
| `role` | `text` | `admin`, `checker` 등 역할 저장 |
| `endpoint` | `text` | 브라우저 Push endpoint |
| `p256dh` | `text` | 브라우저 subscription key |
| `auth` | `text` | 브라우저 subscription auth |
| `user_agent` | `text` | 브라우저/기기 문자열 저장 |
| `browser_name` | `text nullable` | 사람이 보기 쉬운 브라우저명 |
| `device_type` | `text nullable` | mobile/desktop/tablet 등 구분 |
| `is_active` | `boolean` | 활성 구독 여부 |
| `last_used_at` | `timestamptz` | 최근 발송/성공 사용 시각 |
| `created_at` | `timestamptz` | 생성 시각 |
| `updated_at` | `timestamptz` | 수정 시각 |

---

## 4. 컬럼별 상세 설계

### 4-1. 컬럼 설계 표

| 컬럼 | 용도 | Nullable 추천 | 인덱스 추천 | 보안 주의사항 |
| --- | --- | --- | --- | --- |
| `id` | 구독 레코드 식별 | 불가 | PK | 외부 노출 최소화 |
| `user_id` | `public.users.id` 연결 | 불가 권장 | 필요 | 내부 사용자 식별용 |
| `auth_user_id` | `auth.users.id` 연결 | 가능 권장, 도입 구조에 따라 불가도 검토 | 필요 | Auth 연계 데이터이므로 직접 노출 주의 |
| `organization_id` | 기관 단위 필터링 | 가능 | 필요 | 기관 단위 발송 로직에 사용 |
| `role` | 관리자/체커 구분 | 불가 권장 | 필요 | 발송 대상 필터에 사용 |
| `endpoint` | 실제 Web Push 전송 주소 | 불가 | unique 강력 권장 | 민감 정보로 취급 |
| `p256dh` | Web Push 공개키 | 불가 | 일반 인덱스 불필요 | 민감 정보로 취급 |
| `auth` | Web Push auth 값 | 불가 | 일반 인덱스 불필요 | 민감 정보로 취급 |
| `user_agent` | 브라우저 식별 보조 | 가능 | 보통 불필요 | 원문 저장 시 개인정보 최소화 검토 |
| `browser_name` | 운영자 가독성용 | 가능 | 불필요 | 파생값이므로 서버 저장 시 정규화 여부 검토 |
| `device_type` | mobile/desktop 구분 | 가능 | 불필요 | 파생값 |
| `is_active` | 사용 가능 구독 여부 | 불가 | 필요 | 발송 대상 조회 핵심 조건 |
| `last_used_at` | 최근 정상 사용 시각 | 가능 | 필요 시 검토 | 정리 정책에 활용 |
| `created_at` | 생성 시각 | 불가 | 보통 불필요 | 감사용 |
| `updated_at` | 수정 시각 | 불가 | 보통 불필요 | 감사용 |

### 4-2. 컬럼 설계 메모

#### `endpoint`

- 브라우저 구독을 사실상 식별하는 핵심 값입니다.
- 같은 endpoint가 다시 들어오면 새 row를 무한정 추가하기보다 기존 row 업데이트가 더 적절합니다.
- unique 제약 후보로 가장 먼저 검토해야 합니다.

#### `p256dh`, `auth`

- 브라우저 PushSubscription에서 제공되는 민감한 구독 정보입니다.
- 일반 사용자에게 목록 조회를 허용하면 안 됩니다.
- 프론트에서 “내 구독 저장” 요청 시 전송될 수는 있지만, 저장 후에는 서버 측에서만 안전하게 다뤄야 합니다.

#### `role`, `organization_id`

- 발송 대상을 좁히기 위한 운영 필드입니다.
- 이 값들은 `public.users`에서 유도 가능하지만, 발송 시 조인 비용과 운영 추적성을 줄이기 위해 저장하는 방식을 검토할 수 있습니다.
- 다만 사용자 역할/기관 변경 시 동기화 정책이 필요합니다.

---

## 5. user_id / auth_user_id 기준 정리

### 5-1. 연결 기준

- `user_id`는 `public.users.id`와 연결합니다.
- `auth_user_id`는 `auth.users.id`와 연결합니다.

### 5-2. 해피통서비스 현재 구조에서의 권장안

해피통서비스는 현재 `public.users`와 `auth.users` 연결을 이미 사용하고 있으므로, **`user_id`와 `auth_user_id`를 모두 저장하는 구조를 권장**합니다.

권장 이유:

1. **앱 내부 도메인 기준 유지**
   - 화면, 역할, 기관, 업무 데이터는 대부분 `public.users` 관점에서 연결됩니다.
   - 따라서 `user_id`는 운영 기능과 조인이 쉽습니다.

2. **Auth 세션 추적 보조**
   - 실제 로그인 주체는 `auth.users`이므로, `auth_user_id`가 있으면 인증 계정 기준 추적이 쉬워집니다.

3. **향후 데이터 정합성 점검에 유리**
   - `public.users.id`와 `auth.users.id`를 둘 다 보관하면 매핑 오류나 비정상 구독을 점검하기 쉽습니다.

### 5-3. 최종 추천

| 항목 | 추천 |
| --- | --- |
| 기본 도메인 연결 기준 | `user_id = public.users.id` |
| 인증 계정 연결 보조 기준 | `auth_user_id = auth.users.id` |
| 저장 여부 | 둘 다 저장 권장 |

---

## 6. 중복 구독 처리 정책

### 6-1. 기본 원칙

- 같은 `endpoint`가 다시 들어오면 새로 insert하지 않고 기존 row를 update하는 방향을 권장합니다.

### 6-2. 검토 포인트

| 항목 | 권장 방향 |
| --- | --- |
| endpoint unique 여부 | unique 강력 권장 |
| 같은 사용자의 다중 기기 | 허용 |
| 같은 사용자의 다중 브라우저 | 허용 |
| 재구독 발생 시 | 기존 endpoint row 업데이트 |
| 로그아웃 시 처리 | 즉시 삭제보다 `is_active=false` 우선 검토 |

### 6-3. 로그아웃/재로그인 정책 메모

- 브라우저 알림은 로그인 상태와 완전히 동일하지 않을 수 있으므로, 구독을 즉시 물리 삭제하기보다 비활성화 후 재활성화하는 방식이 운영상 더 안전할 수 있습니다.
- 단, 보안 정책상 로그아웃 즉시 알림을 끊어야 한다면 `is_active=false`를 우선 적용하고, 정리 배치에서 삭제 여부를 별도 검토할 수 있습니다.

---

## 7. 알림 발송 대상 조회 기준

### 7-1. 관리자 알림

새 이상징후 접수 시 관리자 알림 대상 조회 기준 초안:

- `organization_id`가 같은 관리자
- `role = admin`
- `is_active = true`
- 해당 사용자의 유효 구독 존재

권장 해석:

- 1차 MVP는 “해당 기관 관리자” 수준으로 좁히는 것이 안전합니다.
- 이후 담당 관리자 1명만 보낼지, 기관 관리자 전체로 보낼지는 정책 결정이 필요합니다.

### 7-2. 체커 알림

체커 미작성 리마인드 발송 대상 조회 기준 초안:

- 해당 체커의 `user_id` 또는 `auth_user_id`
- `role = checker`
- `is_active = true`

권장 해석:

- 체커 리마인드는 특정 개인에게 보내는 알림이므로 `user_id` 중심 조회가 가장 명확합니다.
- `auth_user_id`는 인증 계정 검증 및 세션 일치 점검 보조 기준으로 활용할 수 있습니다.

---

## 8. RLS / 권한 설계 전제

### 8-1. 기본 전제

- 브라우저 클라이언트가 전체 subscription 목록을 직접 읽으면 안 됩니다.
- 구독 저장은 API 또는 제한된 RPC로 처리하는 방식을 권장합니다.
- 발송 대상 조회는 `service_role` 서버 함수에서만 수행해야 합니다.

### 8-2. 권한 방향 정리

| 항목 | 권장 방향 |
| --- | --- |
| 전체 subscription 조회 | 금지 |
| 본인 구독 저장 | API/RPC 경유 권장 |
| 발송 대상 목록 조회 | 서버 전용 |
| 전체 endpoint 목록 노출 | 금지 |
| `SUPABASE_SERVICE_ROLE_KEY` 사용 위치 | 서버 전용 |

### 8-3. 중요 보안 원칙

- `service_role key`는 절대 프론트로 노출하면 안 됩니다.
- `anon`에게 `push_subscriptions` 전체 `select` 권한을 주면 안 됩니다.
- `endpoint`, `p256dh`, `auth`는 일반 프로필 정보보다 민감하게 다뤄야 합니다.

---

## 9. 인덱스 설계 초안

실제 SQL은 이 문서에 작성하지 않고, 설계 수준으로만 정리합니다.

### 9-1. 인덱스 후보

| 인덱스 후보 | 목적 |
| --- | --- |
| `endpoint unique` | 중복 구독 방지 |
| `user_id` | 사용자 기준 구독 조회 |
| `auth_user_id` | 인증 계정 기준 조회/검증 |
| `organization_id` | 기관 단위 관리자 조회 |
| `role` | 관리자/체커 발송 대상 필터 |
| `is_active` | 활성 구독만 빠르게 조회 |
| `organization_id + role + is_active` | 관리자 기관별 활성 구독 조회 최적화 |

### 9-2. 추천 우선순위

1. `endpoint unique`
2. `user_id`
3. `is_active`
4. `organization_id + role + is_active`
5. `auth_user_id`

메모:

- 체커 알림은 개인 기준이므로 `user_id + is_active` 축이 중요합니다.
- 관리자 알림은 기관 단위이므로 `organization_id + role + is_active` 조합이 유용합니다.

---

## 10. 데이터 수명주기

### 10-1. 수명주기 흐름

1. 구독 생성
2. 재구독
3. 알림 발송
4. 발송 실패 또는 권한 변경
5. 비활성화 또는 정리

### 10-2. 상태별 처리 초안

| 상황 | 권장 처리 |
| --- | --- |
| 최초 구독 생성 | 새 row 생성 |
| 같은 endpoint 재구독 | 기존 row update |
| 브라우저 권한 거부 | 새 구독 생성 안 함 |
| 로그아웃 | 즉시 삭제보다 `is_active=false` 우선 검토 |
| 발송 실패(만료/무효) | `is_active=false` 처리 검토 |
| 정상 발송 성공 | `last_used_at` 갱신 |
| 장기간 미사용 | 정리 배치 대상 검토 |

### 10-3. 오래된 구독 정리 정책 초안

- 장기간 `last_used_at`이 갱신되지 않은 구독은 정리 후보로 볼 수 있습니다.
- `is_active=false` 상태가 오래 유지된 구독은 추후 배치 정리 대상으로 둘 수 있습니다.
- 삭제 전 유예기간을 두는 편이 운영상 안전합니다.

---

## 11. 보안 주의사항

### 11-1. 민감 정보 취급 기준

- `endpoint`, `p256dh`, `auth`는 민감한 구독 정보로 취급합니다.
- 일반 프론트 화면에서 전체 목록 조회는 금지합니다.
- 관리자 화면이라고 해도 endpoint 원문 노출은 지양합니다.

### 11-2. 환경변수/키 관리 기준

- `service_role key`는 절대 노출하면 안 됩니다.
- `VITE_` 접두사에는 private key를 넣으면 안 됩니다.
- `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`은 서버 전용입니다.

### 11-3. 운영상 주의점

- 구독 정보는 “사용자 연락 수단”에 가까운 민감 데이터로 취급해야 합니다.
- 디버깅 로그에 endpoint 전체를 그대로 남기지 않는 것이 좋습니다.
- 사용자 탈퇴/권한 변경 시 구독 처리 정책도 별도 검토가 필요합니다.

---

## 12. 추천 설계안 요약

### 추천안 한 줄 요약

`push_subscriptions`는 **`public.users.id` 기준 1:N 구조**로 설계하고, **`auth_user_id`를 함께 저장**하며, **`endpoint unique + is_active 관리`**를 기본 원칙으로 삼는 방식을 권장합니다.

### 핵심 추천안

| 항목 | 추천안 |
| --- | --- |
| 사용자 기준 | `user_id = public.users.id` 중심 |
| 인증 연결 | `auth_user_id`도 함께 저장 |
| 중복 처리 | `endpoint` 기준 update |
| 다중 기기 | 허용 |
| 로그아웃 처리 | 삭제보다 `is_active=false` 우선 검토 |
| 발송 대상 조회 | 서버 전용, `service_role` 기반 |
| 전체 목록 조회 | 금지 |

---

## 13. 다음 단계

1. 이 문서 확정
2. 실제 migration SQL 초안 작성
3. 알림 권한 UI 설계
4. subscribe API 설계
5. service worker 설계
6. 관리자 이상징후 알림 구현
7. 체커 리마인드 cron 설계

### 다음 단계 메모

- 가장 먼저 해야 할 실제 구현 준비는 `push_subscriptions` migration 초안 작성입니다.
- 그다음 권한 요청 UX와 subscribe API 설계를 함께 보는 것이 자연스럽습니다.
- 관리자 이상징후 알림 1개 시나리오를 먼저 end-to-end로 붙인 뒤, 체커 리마인드로 확장하는 순서를 권장합니다.
