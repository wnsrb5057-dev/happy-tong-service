# 해피통서비스 PWA VAPID 환경변수 인식 확인 체크리스트

## 1. 문서 목적

이 문서는 VAPID 환경변수 등록 후, 프론트에서 `VITE_VAPID_PUBLIC_KEY`가 정상적으로 인식되는지 확인하기 위한 점검 문서입니다.

중요:

- 이 문서는 **확인 절차용 문서**입니다.
- 실제 public key 전체 값을 화면이나 채팅에 공유하지 않습니다.
- private key는 프론트에서 확인하지 않습니다.
- 브라우저에서 확인할 때도 가능하면 `exists` 여부만 확인합니다.

즉, 이번 점검의 목표는 다음 한 가지입니다.

- `VITE_VAPID_PUBLIC_KEY`가 프론트 번들에서 읽히는지 확인

---

## 2. 확인 대상 변수

### 프론트에서 확인 가능한 변수

| 변수명 | 프론트 확인 여부 | 설명 |
| --- | --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | 가능 | 브라우저에서 Push 구독 생성 시 사용하는 public key입니다. |

### 프론트에서 확인하면 안 되는 변수

| 변수명 | 프론트 확인 금지 이유 |
| --- | --- |
| `VAPID_PRIVATE_KEY` | private key이므로 브라우저에 노출되면 안 됩니다. |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 관리자 권한 키입니다. |
| `CRON_SECRET` | 내부 API/cron 보호용 비밀값입니다. |

정리:

- 프론트에서는 `VITE_VAPID_PUBLIC_KEY`만 확인합니다.
- 나머지 서버 전용 값은 브라우저에서 확인 대상이 아닙니다.

---

## 3. 로컬 확인 절차

### 3-1. `.env.local` 파일 확인

먼저 로컬 환경에 아래 변수가 있는지 확인합니다.

```bash
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

체크 포인트:

- 변수명이 정확히 `VITE_VAPID_PUBLIC_KEY`인지
- 값 앞뒤에 불필요한 공백이 없는지
- 줄바꿈이 값 안에 들어가지 않았는지

### 3-2. 개발 서버 재시작

Vite 환경변수는 개발 서버 시작 시 읽히므로, 값을 추가/수정했다면 개발 서버를 다시 시작해야 합니다.

예:

```bash
npm run dev
```

이미 dev 서버가 떠 있었다면:

1. 서버 종료
2. 다시 실행

### 3-3. 브라우저에서 안전하게 확인하는 방법

가능하면 실제 key 전체를 출력하지 말고, `exists` 여부만 확인합니다.

확인 방향 예시:

1. 앱을 로컬에서 실행
2. 브라우저 개발자 도구 열기
3. 해당 유틸 함수가 반환하는 `exists` 값만 확인

권장 확인 기준:

- `exists === true` 이면 정상
- key 전체 문자열은 콘솔에 출력하지 않기

선택적으로 확인 가능한 항목:

- `exists`
- `error`
- `key` 길이만 확인

비권장:

- key 전체 문자열 복사
- key 전체 화면 캡처
- key 값을 채팅에 붙여넣기

---

## 4. 배포 확인 절차

### 4-1. Vercel 환경변수 등록 확인

Vercel Project Settings에서 다음을 확인합니다.

1. `Settings`
2. `Environment Variables`
3. `VITE_VAPID_PUBLIC_KEY` 등록 여부
4. 대상 환경
   - `Production`
   - `Preview`
   - 필요 시 `Development`

### 4-2. Redeploy 여부 확인

환경변수 등록 후에는 반드시 재배포가 필요합니다.

확인 포인트:

- 환경변수 등록 후 redeploy를 했는지
- 배포가 완료된 최신 배포본을 열었는지

### 4-3. 배포 사이트에서 간접 확인

배포 사이트 접속 후, 프론트에서 `getVapidPublicKey()`가 정상적으로 값을 읽는지 간접 확인합니다.

안전한 확인 기준:

- `exists === true`
- `error === null`

여기서도 public key 전체 문자열은 직접 공유하지 않는 것을 권장합니다.

---

## 5. 안전한 확인 기준

`getVapidPublicKey()` 확인 시 아래 기준으로 판단합니다.

| 항목 | 기대값 | 의미 |
| --- | --- | --- |
| `exists` | `true` | 프론트 환경변수 인식 성공 |
| `error` | `null` | 키 누락/오류 없음 |
| `key` | 직접 공유하지 않음 | 값 자체는 숨기고 존재 여부만 확인 |

권장 방식:

- `exists`만 확인
- 필요하면 `key.length` 정도만 확인

비권장 방식:

- `key` 전체 값 콘솔 출력
- key 전체 스크린샷 공유
- key 값을 채팅/문서에 붙여넣기

---

## 6. 실패 시 체크리스트

아래 항목을 순서대로 확인합니다.

- [ ] Vercel에 `VITE_VAPID_PUBLIC_KEY`가 등록되어 있는지
- [ ] 환경이 `Production` 또는 `Preview`에 올바르게 지정되어 있는지
- [ ] 환경변수 등록 후 redeploy를 했는지
- [ ] 로컬에서는 dev 서버를 재시작했는지
- [ ] 변수명이 정확히 `VITE_VAPID_PUBLIC_KEY`인지
- [ ] `VITE_` 접두사가 빠지지 않았는지
- [ ] public key 값에 줄바꿈이 들어가지 않았는지
- [ ] 값 앞뒤에 공백이 들어가지 않았는지
- [ ] 브라우저가 최신 배포본을 보고 있는지

---

## 7. 브라우저 콘솔 확인 시 주의사항

브라우저 개발자 도구에서 확인할 때는 아래 원칙을 지킵니다.

### 권장

- `exists` 확인
- `error` 확인
- 필요 시 `key` 길이만 확인

### 금지

- private key 관련 값 확인 시도
- `SUPABASE_SERVICE_ROLE_KEY` 확인 시도
- `CRON_SECRET` 확인 시도
- public key 전체 문자열 공유

---

## 8. 다음 구현 단계

환경변수 인식 확인이 끝나면 다음 순서로 진행합니다.

1. `VITE_VAPID_PUBLIC_KEY` 인식 확인
2. `/checker/home`에서 알림 권한 `granted` 이후 `createAndSerializePushSubscription()` 연결
3. `/api/push/subscribe` 구현
4. Supabase `push_subscriptions` 저장
5. 테스트 푸시 발송 API 구현

---

## 9. 빠른 요약

### 이번 단계에서 확인할 것

- 프론트에서 `VITE_VAPID_PUBLIC_KEY`가 읽히는지

### 이번 단계에서 확인하면 안 되는 것

- `VAPID_PRIVATE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 정상 판단 기준

- `getVapidPublicKey()` 결과에서 `exists === true`

### 가장 중요한 보안 원칙

- public key 전체 값도 불필요하게 공유하지 않기
- private key는 절대 프론트에서 확인하지 않기

