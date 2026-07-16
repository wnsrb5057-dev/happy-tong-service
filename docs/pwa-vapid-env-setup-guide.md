# 해피통서비스 PWA VAPID / 환경변수 설정 가이드

## 1. 문서 목적

이 문서는 해피통서비스의 PWA Web Push 알림 기능을 준비하기 위해 `VAPID 키 생성`과 `환경변수 등록 절차`를 정리한 안내서입니다.

중요한 전제:

- 이 문서는 **설정 가이드 문서**입니다.
- 실제 키 값을 이 문서에 적지 않습니다.
- 실제 private key를 Git에 커밋하지 않습니다.
- 이번 단계에서는 코드 구현, API 구현, DB 저장을 진행하지 않습니다.

VAPID 키가 필요한 이유:

- 브라우저에서 Push 구독을 만들 때 `public key`가 필요합니다.
- 서버에서 실제 푸시 알림을 발송할 때는 `public key + private key`가 모두 필요합니다.
- 따라서 프론트와 서버가 사용하는 키 범위가 다릅니다.

정리하면:

- 프론트: `VITE_VAPID_PUBLIC_KEY`
- 서버: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

특히 `private key`는 절대 브라우저에 노출되면 안 됩니다.

---

## 2. 필요한 환경변수 목록

### 2-1. 프론트 / Vite 환경변수

| 변수명 | 용도 | 등록 위치 | 브라우저 노출 가능 여부 | 주의사항 |
| --- | --- | --- | --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | 브라우저에서 `PushManager.subscribe()` 호출 시 사용하는 VAPID public key | 로컬 `.env.local`, Vercel Environment Variables | 가능 | `VITE_` 접두사가 있으므로 프론트 코드에서 읽힙니다. public key만 넣어야 합니다. |

### 2-2. 서버 / Vercel 환경변수

| 변수명 | 용도 | 등록 위치 | 브라우저 노출 가능 여부 | 주의사항 |
| --- | --- | --- | --- | --- |
| `VAPID_PUBLIC_KEY` | 서버 푸시 발송 로직에서 사용하는 public key | Vercel Environment Variables | 불가 | 서버 함수에서만 사용합니다. 프론트에서는 `VITE_VAPID_PUBLIC_KEY`를 사용합니다. |
| `VAPID_PRIVATE_KEY` | 서버 푸시 발송 서명용 private key | Vercel Environment Variables | 절대 불가 | 절대 `VITE_` 접두사를 붙이면 안 됩니다. |
| `VAPID_SUBJECT` | Web Push 발송자 정보. 보통 `mailto:` 형태 사용 | Vercel Environment Variables | 불가 | 예: `mailto:team@example.com` 형식. 실제 운영 연락처 기준으로 정합니다. |
| `SUPABASE_URL` | 서버에서 Supabase 접근 시 사용하는 프로젝트 URL | Vercel Environment Variables | 불가 | 서버 함수에서 push subscription 저장/조회 시 사용 예정입니다. |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버에서 RLS 우회가 필요한 저장/조회 작업용 키 | Vercel Environment Variables | 절대 불가 | 절대 프론트 코드로 가져오면 안 됩니다. |
| `CRON_SECRET` | 예약 실행 또는 내부 API 보호용 비밀값 | Vercel Environment Variables | 절대 불가 | cron endpoint 보호용으로 사용 예정입니다. |

---

## 3. 절대 노출 금지 변수

아래 변수는 **절대 `VITE_` 접두사를 붙이면 안 됩니다.**

- `VAPID_PRIVATE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

이유:

- `VITE_` 접두사가 붙은 변수는 브라우저 번들에 포함될 수 있습니다.
- 위 3개 값은 모두 서버 전용 민감정보입니다.
- 브라우저에서 접근 가능해지면 보안 사고로 이어질 수 있습니다.

---

## 4. VAPID 키 생성 방법 후보

이번 문서에서는 실제 키 값을 만들지 않고, 어떤 방식으로 생성할지 후보만 정리합니다.

### 방법 A. `web-push` CLI 사용

예시 명령:

```bash
npx web-push generate-vapid-keys
```

설명:

- 가장 많이 쓰는 방식입니다.
- 일회성 `npx` 실행으로 public/private key 쌍을 생성할 수 있습니다.
- 프로젝트에 패키지를 영구 설치하지 않아도 됩니다.

주의:

- 생성된 결과를 터미널에서 복사할 때 private key를 안전하게 보관해야 합니다.
- 출력 결과를 채팅, 문서, Git 커밋에 그대로 남기지 않습니다.

### 방법 B. 별도 로컬 Node 스크립트 사용

설명:

- Node 환경에서 임시 스크립트로 키를 생성하는 방식입니다.
- 팀 내부 보안 정책상 CLI 출력 대신 통제된 방식이 필요할 때 검토할 수 있습니다.

주의:

- 이번 단계에서는 실제 스크립트를 만들지 않습니다.
- 프로젝트 코드에 생성 스크립트를 추가할 필요는 없습니다.

### 방법 C. 별도 안전한 로컬 도구 사용

설명:

- 팀에서 이미 사용 중인 비밀정보 관리 도구가 있다면 그 도구를 통해 생성/보관하는 방식도 가능합니다.

주의:

- 핵심은 `public key`와 `private key`를 한 쌍으로 정확히 보관하는 것입니다.

---

## 5. `.env.local` 등록 예시

로컬 개발 환경에서는 `.env.local`에 **public key만** 등록합니다.

```bash
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

주의:

- 프론트에는 `public key`만 넣습니다.
- `private key`는 `.env.local`에 넣지 않는 것을 권장합니다.
- 로컬 서버 함수를 별도로 테스트하지 않는다면 `private key`는 Vercel 서버 환경에만 두는 편이 안전합니다.

---

## 6. Vercel Environment Variables 등록 예시

Vercel에 등록할 변수 목록:

- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

등록 위치:

1. Vercel Project 열기
2. `Settings`
3. `Environment Variables`
4. 환경별 값 등록
   - `Production`
   - `Preview`
   - `Development`

예시 표:

| 변수명 | Production | Preview | Development | 비고 |
| --- | --- | --- | --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | 등록 | 등록 | 등록 | 프론트 구독 생성용 |
| `VAPID_PUBLIC_KEY` | 등록 | 등록 | 등록 | 서버 발송용 public key |
| `VAPID_PRIVATE_KEY` | 등록 | 등록 | 등록 | 서버 전용 |
| `VAPID_SUBJECT` | 등록 | 등록 | 등록 | `mailto:` 형식 권장 |
| `SUPABASE_URL` | 등록 | 등록 | 등록 | 서버 저장/조회용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 등록 | 등록 | 등록 | 서버 전용 |
| `CRON_SECRET` | 등록 | 필요 시 등록 | 필요 시 등록 | cron/API 보호용 |

주의:

- `VAPID_PRIVATE_KEY`는 서버 함수에서만 사용합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 함수에서만 사용합니다.
- 값 등록 후에는 **재배포(redeploy)** 가 필요합니다.

---

## 7. 로컬 개발 환경과 배포 환경 구분

| 구분 | 등록 위치 | 주로 사용하는 값 |
| --- | --- | --- |
| 로컬 개발 | `.env.local` | `VITE_VAPID_PUBLIC_KEY` |
| 배포 환경 | Vercel Environment Variables | public/private key 전체 + 서버 전용 키 |

설명:

- 로컬에서는 브라우저 구독 생성 테스트가 우선이므로 `VITE_VAPID_PUBLIC_KEY`가 가장 먼저 필요합니다.
- 실제 푸시 발송은 서버 환경이 필요하므로, 배포 환경에서는 public/private key와 서버 전용 키를 함께 등록해야 합니다.

같은 public key 사용 여부:

- 일반적으로 로컬/배포에서 **같은 VAPID public key를 써도 됩니다.**
- 다만 운영 정책상 환경별 분리가 필요하면 별도 키 쌍을 운영할 수 있습니다.

운영 전에는 아래를 정해야 합니다.

- 개발/운영 키를 같은 쌍으로 유지할지
- 운영 키를 별도로 분리할지
- 키 교체 주기를 둘지

---

## 8. 다음 구현 단계

권장 순서:

1. VAPID 키 생성
2. `.env.local`에 `VITE_VAPID_PUBLIC_KEY` 등록
3. Vercel 환경변수 등록
4. 로컬에서 `getVapidPublicKey()` 동작 확인
5. `/checker/home` 또는 알림 설정 화면에서 권한 허용 후 `createAndSerializePushSubscription()` 연결
6. `/api/push/subscribe` 구현
7. Supabase `push_subscriptions` 저장 연결
8. 테스트 푸시 발송 API 구현

현재 단계에서는 1~4 준비까지만 완료해도 충분합니다.

---

## 9. 보안 체크리스트

- [ ] `VAPID_PRIVATE_KEY`를 Git에 커밋하지 않았는지 확인
- [ ] `.env.local`이 Git에 올라가지 않는지 확인
- [ ] `VAPID_PRIVATE_KEY`에 `VITE_` 접두사를 붙이지 않았는지 확인
- [ ] `SUPABASE_SERVICE_ROLE_KEY`에 `VITE_` 접두사를 붙이지 않았는지 확인
- [ ] `CRON_SECRET`에 `VITE_` 접두사를 붙이지 않았는지 확인
- [ ] 프론트 코드에서 `SUPABASE_SERVICE_ROLE_KEY`를 import/참조하지 않았는지 확인
- [ ] 프론트 코드에서 `VAPID_PRIVATE_KEY`를 import/참조하지 않았는지 확인
- [ ] Vercel 환경변수 등록 후 재배포했는지 확인
- [ ] Preview / Production 환경을 구분해서 값이 들어갔는지 확인

---

## 10. 빠른 요약

### 프론트에서 필요한 것

- `VITE_VAPID_PUBLIC_KEY`

### 서버에서 필요한 것

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 가장 중요한 보안 원칙

- public key만 브라우저에 노출 가능
- private key / service role key / cron secret은 서버 전용
- 실제 키 값은 문서나 Git에 남기지 않기

