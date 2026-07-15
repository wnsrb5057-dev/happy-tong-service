# 해피통서비스 PWA 클라이언트 상태 감지 유틸 설계 문서

## 1. 문서 목적

이 문서는 해피통서비스의 PWA 설치 및 알림 권한 온보딩 UX를 구현하기 전에, 프론트에서 먼저 감지해야 할 상태를 정리하는 **설계 문서**입니다.

이 문서의 목적:

- PWA 설치/알림 권한 UX 구현 전에 어떤 상태를 감지해야 하는지 명확히 정리한다.
- 체커와 관리자 화면에서 같은 기준으로 상태를 해석할 수 있게 한다.
- 실제 구현 전, 유틸 함수와 데이터 구조를 먼저 합의한다.

중요:

- 이 문서는 구현 코드가 아닙니다.
- 실제 React 코드, service worker, API 호출 코드는 포함하지 않습니다.
- 상태 감지와 UX 분기 기준만 설계 수준으로 정리합니다.

관련 문서:

- [docs/pwa-push-notification-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-notification-plan.md)
- [docs/pwa-push-subscriptions-schema-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-schema-plan.md)
- [docs/pwa-push-subscriptions-final-sql.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-final-sql.md)
- [docs/pwa-install-notification-onboarding-plan.md](C:/Users/user/Desktop/AI/docs/pwa-install-notification-onboarding-plan.md)

---

## 2. 감지해야 할 핵심 상태

아래 상태는 해피통서비스의 PWA 설치/알림 온보딩에서 우선 감지해야 하는 핵심 항목입니다.

| 항목 | 의미 | 감지 목적 | true일 때 UX 분기 | false일 때 UX 분기 | 주의사항 |
| --- | --- | --- | --- | --- | --- |
| `serviceWorker` 지원 여부 | 브라우저가 서비스워커를 지원하는지 | PWA/푸시 구현 가능성 판단 | 다음 단계 감지 진행 | 지원 불가 안내 | 지원 여부만으로 푸시 가능이 확정되지는 않음 |
| `PushManager` 지원 여부 | 브라우저가 Push API를 지원하는지 | Web Push 가능성 판단 | 푸시 가능 후보 | push 미지원 안내 | 일부 환경은 service worker는 되지만 push는 제한적일 수 있음 |
| `Notification` API 지원 여부 | 브라우저 알림 권한 API 지원 여부 | 알림 권한 요청 가능성 판단 | 권한 상태 확인 가능 | 알림 미지원 안내 | 브라우저마다 구현 차이 있음 |
| `Notification.permission = default` | 아직 사용자가 권한 결정을 하지 않음 | 설명 후 권한 요청 가능 상태 | 설명 카드 + 허용 버튼 | 해당 없음 | 첫 진입 즉시 요청 금지 |
| `Notification.permission = granted` | 사용자가 알림을 허용함 | 구독 생성/저장 단계로 이동 | subscription 확인/생성 | 해당 없음 | 허용 상태여도 구독 저장이 아직 없을 수 있음 |
| `Notification.permission = denied` | 사용자가 알림을 거부함 | 반복 요청 금지 판단 | 설정 안내만 표시 | 해당 없음 | `requestPermission()` 반복 호출 금지 |
| `display-mode: standalone` | 현재 PWA 설치형처럼 실행 중인지 | 설치 상태 추정 | 설치형 온보딩 단계로 이동 | 설치 유도 필요 | 일부 브라우저에서만 안정적 |
| `navigator.standalone` | iOS 홈 화면 추가 상태 후보 | iOS 설치 상태 판단 보조 | iOS 설치형으로 간주 가능 | 일반 Safari 접속 가능성 | iOS 전용 성격이 강함 |
| iOS Safari 여부 | iPhone/iPad Safari인지 | iOS 수동 설치 가이드 표시 | `홈 화면에 추가` 안내 | Android/PC 흐름으로 분기 | UA 기반 감지는 100% 정확하지 않음 |
| Android Chrome 여부 | Android Chrome 기반인지 | 설치 프롬프트/알림 UX 최적화 | 설치 유도 흐름 우선 | 일반 브라우저 흐름 | 일부 Chromium 계열과 구분 필요 |
| 설치 프롬프트 지원 여부 | PWA 설치 프롬프트를 띄울 수 있는지 | `앱 설치하기` 버튼 표시 여부 | 설치 CTA 적극 노출 | 수동 설치 안내 또는 일반 안내 | `beforeinstallprompt` 의존 |
| `beforeinstallprompt` 이벤트 사용 가능 여부 | 브라우저가 설치 프롬프트 이벤트를 주는지 | Android 설치 UX 구현 판단 | 이벤트 저장 후 CTA 연결 | 수동 안내 사용 | iOS에서는 일반적으로 기대하기 어려움 |
| 서버에 push subscription 저장 여부 | 현재 브라우저 구독이 서버 DB에 저장됐는지 | 저장 누락/재저장 판단 | 정상 상태로 볼 수 있음 | 재저장 시도 또는 오류 안내 | 브라우저 구독 존재와 서버 저장 여부는 다를 수 있음 |
| 현재 브라우저의 push subscription 존재 여부 | 브라우저에 이미 subscription이 생성되어 있는지 | subscribe 필요 여부 판단 | 서버 저장 여부 비교 | subscribe 유도 | `granted`여도 subscription이 없을 수 있음 |

---

## 3. 사용자 상태 분류 모델

상태 감지를 개별 값으로만 다루면 UI 분기가 복잡해질 수 있으므로, 최종적으로는 앱에서 사용할 상태 모델을 한 번 더 정리하는 것이 좋습니다.

### 상태 모델 제안

| 상태 | 의미 | 안내 문구 방향 | 버튼 | 다음 행동 |
| --- | --- | --- | --- | --- |
| `unsupported` | 현재 브라우저/환경에서 PWA 또는 푸시 지원이 충분하지 않음 | 현재 환경에서는 알림 기능이 제한될 수 있음 | 지원 브라우저 안내 | 대체 브라우저/기기 안내 |
| `browser_only` | 일반 브라우저 접속 상태, 설치되지 않음 | 업무용 사용을 위해 설치 권장 | 설치하기 / 설치 방법 보기 | 설치 흐름 진입 |
| `installable` | 설치 프롬프트 또는 수동 설치 안내가 가능한 상태 | 홈 화면에 추가 권장 | 앱 설치하기 / 설치 방법 보기 | 설치 진행 |
| `installed_no_permission` | 설치는 되었지만 알림 권한 정보가 아직 연결되지 않음 | 알림 허용이 필요함 | 알림 허용하기 | 권한 요청 흐름 시작 |
| `installed_permission_default` | 설치됨 + 권한 미결정 상태 | 알림 허용 필요 설명 | 알림 허용하기 / 나중에 하기 | `requestPermission()` 후보 |
| `installed_permission_granted` | 설치됨 + 권한 허용 완료 | 알림 준비 단계 안내 | 알림 설정 확인 | subscription 확인/생성 |
| `installed_permission_denied` | 설치됨 + 권한 거부 상태 | 브라우저 설정에서 다시 허용 필요 | 설정 방법 보기 | 수동 재설정 안내 |
| `subscribed` | 브라우저 구독도 있고 서버 저장도 완료 | 정상 상태 | 설정 보기 | 상태 유지 |
| `subscription_missing` | 권한은 허용됐지만 구독이 없거나 서버 저장이 없음 | 알림 연결이 아직 완료되지 않음 | 다시 연결하기 | subscription 생성 또는 재저장 |
| `subscription_error` | 구독 생성/저장 중 오류 발생 | 알림 연결에 실패함 | 다시 시도 / 나중에 하기 | 재시도 또는 오류 안내 |

### 상태 해석 메모

- `installed_permission_granted`는 “권한 허용” 상태일 뿐, 아직 `subscribed`가 아닐 수 있습니다.
- `subscribed`는 “브라우저 구독 존재 + 서버 저장 완료”까지 포함한 더 완성된 상태입니다.
- `subscription_missing`과 `subscription_error`를 분리하면 UX 문구를 더 정확히 다룰 수 있습니다.

---

## 4. 체커 화면에서의 상태 분기

체커는 `/checker/home` 기준으로 가장 강한 온보딩 대상입니다.

### 체커 상태별 권장 안내

| 상태 | 안내 문구 예시 | 버튼 | 다음 행동 |
| --- | --- | --- | --- |
| 미설치 상태 | `해피통서비스를 홈 화면에 추가해 주세요.` | 설치하기 / iPhone 설치 방법 보기 / 나중에 하기 | 설치 유도 |
| 설치됨 + 권한 미요청 | `알림을 허용하면 오늘 확인 기록을 놓치지 않을 수 있습니다.` | 알림 허용하기 / 나중에 하기 | 권한 요청 |
| 설치됨 + 권한 허용 | `알림 수신 준비가 거의 완료되었습니다.` | 알림 연결 확인 | subscription 생성/저장 |
| 설치됨 + 권한 거부 | `알림이 꺼져 있어 리마인드를 받을 수 없습니다.` | 브라우저 설정 방법 보기 | 수동 재허용 안내 |
| push 미지원 | `현재 브라우저에서는 알림 기능이 제한될 수 있습니다.` | 지원 브라우저 안내 | 브라우저 전환 안내 |
| subscription 저장 실패 | `알림 연결 중 문제가 발생했습니다. 다시 시도해 주세요.` | 다시 연결하기 / 나중에 하기 | 재저장 시도 |

### 체커 홈 안내 카드 문구 예시

- `해피통서비스를 홈 화면에 추가해 주세요.`
- `오늘 일정과 미작성 기록을 놓치지 않도록 알림을 받을 수 있습니다.`
- `알림을 허용하면 오늘 확인 기록이 남아 있을 때 알려드립니다.`
- `알림이 꺼져 있어 리마인드를 받을 수 없습니다. 브라우저 설정에서 다시 허용해 주세요.`

### 체커 UX 원칙

- 체커는 알림의 실효성이 가장 크므로 설치와 권한 허용을 가장 강하게 유도합니다.
- 다만 첫 화면 진입 즉시 시스템 권한 팝업을 띄우지 않고, 먼저 설명 카드로 맥락을 제공합니다.

---

## 5. 관리자 화면에서의 상태 분기

관리자는 `/admin/dashboard` 또는 `/admin/emergencies` 기준으로 온보딩을 안내합니다.

### 관리자 상태별 권장 안내

| 상태 | 안내 문구 예시 | 버튼 | 다음 행동 |
| --- | --- | --- | --- |
| PC 브라우저 사용자 | `새 이상징후 접수 알림을 받을 수 있습니다.` | 알림 허용하기 / 나중에 하기 | 권한 요청 |
| 모바일 PWA 미설치 사용자 | `모바일에 해피통서비스를 설치하면 더 빠르게 확인할 수 있습니다.` | 설치하기 / 설치 방법 보기 | 설치 유도 |
| 설치됨 + 권한 미허용 | `새 이상징후가 접수되면 바로 알 수 있도록 알림을 허용해 주세요.` | 알림 허용하기 | 권한 요청 |
| 권한 허용 완료 사용자 | `알림 수신 준비가 완료되었습니다.` | 설정 보기 | 상태 유지 |
| 권한 거부 사용자 | `알림이 꺼져 있어 새 이상징후 접수를 놓칠 수 있습니다.` | 설정 방법 보기 | 수동 재허용 안내 |

### 관리자 UX 원칙

- 관리자는 “이상징후 대응 속도”를 중심으로 설명합니다.
- PC 사용자는 설치보다 브라우저 알림 허용이 더 현실적인 경우가 많으므로, 안내 강도를 환경에 따라 조절합니다.

---

## 6. iOS 감지 정책

### 핵심 정책

- iOS에서는 일반 Safari 접속과 홈 화면 추가 상태를 구분해야 합니다.
- iOS에서는 `beforeinstallprompt`가 Android처럼 자연스럽게 동작하지 않을 수 있으므로 수동 안내가 필요합니다.
- iPhone 사용자는 `공유 버튼 → 홈 화면에 추가` 안내를 별도로 제공해야 합니다.

### 설치 상태 감지 후보

- `display-mode: standalone`
- `navigator.standalone`

### 권장 해석

| 상태 | 권장 해석 |
| --- | --- |
| iOS Safari + standalone 아님 | 일반 Safari 접속 상태로 간주 |
| iOS Safari + standalone 또는 `navigator.standalone = true` | 설치형 PWA 상태 후보 |

### 주의사항

- iOS의 설치 상태 감지는 Android보다 덜 직관적일 수 있습니다.
- 문구와 안내 흐름에서 “설치가 먼저, 알림은 그 다음” 순서를 명확히 하는 것이 중요합니다.

---

## 7. Android 감지 정책

### 핵심 정책

- Android Chrome에서는 `beforeinstallprompt` 이벤트 활용 가능성을 우선 검토합니다.
- 이벤트가 잡히면 `앱 설치하기` 버튼을 보여주는 흐름이 가장 자연스럽습니다.
- 이미 설치 상태라면 설치 유도 대신 알림 권한 허용 단계로 넘어갑니다.

### 권장 해석

| 상태 | 권장 해석 |
| --- | --- |
| Android Chrome + beforeinstallprompt 가능 | 설치 CTA 적극 노출 |
| Android Chrome + 설치됨 | 알림 권한 단계로 이동 |
| Android Chrome + 일반 브라우저 | 설치는 강하게 권장, 알림은 그 다음 |

### 주의사항

- 설치하지 않아도 브라우저 알림이 가능할 수 있지만, 해피통서비스는 업무앱 특성상 설치를 우선 유도하는 편이 적절합니다.

---

## 8. 알림 권한 요청 UX 원칙

반드시 지켜야 할 원칙:

- 첫 진입 즉시 `Notification.requestPermission()`을 호출하지 않습니다.
- 사용자가 설명을 읽고 `알림 허용하기` 버튼을 눌렀을 때만 권한 요청을 시작합니다.
- `denied` 상태에서는 반복 요청하지 않습니다.
- `denied` 상태에서는 브라우저 설정 안내만 표시합니다.
- `granted` 상태가 되면 push subscription 생성/저장 단계로 이동합니다.

### 권장 흐름

1. 상태 감지
2. 설명 카드 표시
3. 사용자가 CTA 클릭
4. 권한 요청
5. `granted / denied / error`에 따라 후속 분기

---

## 9. push subscription 상태 판단

### 기본 방향

- 브라우저에서는 `pushManager.getSubscription()`으로 현재 구독 여부를 확인하는 방향을 권장합니다.
- 서버에는 `push_subscriptions` 테이블 저장 여부를 별도로 확인해야 합니다.

### 상태 판단 원칙

| 상태 | 의미 | 권장 행동 |
| --- | --- | --- |
| 브라우저 구독 없음 | 아직 subscribe 필요 | 구독 생성 유도 |
| 브라우저 구독 있음 + 서버 저장 있음 | 정상 | `subscribed` 처리 |
| 브라우저 구독 있음 + 서버 저장 없음 | 저장 누락 | 재저장 시도 |
| 발송 실패로 서버 `is_active=false` | 비활성 구독 | 재연결/재저장 유도 |

### 정책 연결

- 서버는 `endpoint` 기준 upsert 정책과 연결됩니다.
- 브라우저 구독은 있지만 서버 저장이 없으면 다시 `/api/push/subscribe` 호출 후보가 됩니다.
- 발송 실패로 `is_active=false`가 된 구독은 재등록 유도 상태로 연결할 수 있습니다.

---

## 10. 추천 유틸 함수 설계

실제 코드는 작성하지 않고, 함수 이름과 역할만 제안합니다.

### 함수 목록

| 함수명 | 입력 | 출력 | 역할 | 주의사항 |
| --- | --- | --- | --- | --- |
| `detectPwaDisplayMode()` | 없음 | 설치형 실행 여부 정보 | `display-mode: standalone` 등 감지 | 브라우저별 차이 고려 |
| `detectDevicePlatform()` | 없음 | `ios / android / desktop / unknown` | 기기/플랫폼 구분 | UA 기반 감지 한계 있음 |
| `detectNotificationPermission()` | 없음 | `default / granted / denied / unsupported` | 알림 권한 상태 해석 | 지원 여부 먼저 확인 필요 |
| `detectPushSupport()` | 없음 | 지원 여부 묶음 | `serviceWorker`, `PushManager`, `Notification` 지원 감지 | 부분 지원 환경 구분 필요 |
| `detectInstallPromptSupport()` | 없음 또는 이벤트 상태 | 설치 프롬프트 사용 가능 여부 | Android 설치 CTA 노출 여부 판단 | `beforeinstallprompt` 의존 |
| `getCurrentPushSubscription()` | service worker registration 등 | 브라우저 구독 정보 또는 없음 | 현재 구독 존재 여부 확인 | 권한 granted여도 null 가능 |
| `getPwaOnboardingState()` | 역할, 감지 상태, 서버 저장 상태 | 온보딩 상태 모델 | 최종 UX 분기 계산 | 체커/관리자 정책 차이 반영 필요 |
| `getNotificationCtaForRole(role, state)` | 역할, 상태 | CTA 문구/버튼 정보 | 역할별 버튼 문구 결정 | 총관리자 1차 제외 정책 반영 필요 |

### 함수 설계 메모

- 감지 함수와 UX 계산 함수는 분리하는 것이 좋습니다.
- 브라우저 capability 감지와 “무슨 카드를 보여줄지” 결정 로직을 한 함수에 섞지 않는 편이 유지보수에 유리합니다.

---

## 11. 데이터 구조 제안

실제 타입 코드는 작성하지 않고, 구조 수준으로만 제안합니다.

### 11-1. `PwaCapabilityState`

필드 후보:

- `supportsServiceWorker`
- `supportsNotification`
- `supportsPushManager`
- `supportsInstallPrompt`
- `isStandalone`
- `isIosSafari`
- `isAndroidChrome`
- `platform`

### 11-2. `NotificationPermissionState`

필드 후보:

- `permission`
- `canRequestPermission`
- `isDenied`
- `isGranted`

### 11-3. `PwaOnboardingState`

필드 후보:

- `status`
- `role`
- `showInstallGuide`
- `showNotificationGuide`
- `showSettingsGuide`
- `primaryCtaLabel`
- `secondaryCtaLabel`
- `message`

### 11-4. `PushSubscriptionSyncState`

필드 후보:

- `hasBrowserSubscription`
- `hasServerSubscription`
- `isSyncing`
- `lastSyncSucceeded`
- `errorCode`
- `errorMessage`

### 구조 설계 메모

- `capability`, `permission`, `subscription sync`, `onboarding decision`을 분리하면 디버깅이 쉬워집니다.
- 화면에서는 가능한 한 `PwaOnboardingState`만 받아 렌더링하도록 설계하는 편이 단순합니다.

---

## 12. 구현 순서 제안

1. 상태 감지 유틸 파일 생성
2. iOS / Android / PWA 설치 상태 감지 구현
3. `Notification.permission` 감지 구현
4. Push API 지원 여부 감지 구현
5. 체커 홈 안내 카드에 상태 연결
6. 관리자 대시보드 안내 카드에 상태 연결
7. service worker 등록
8. push subscription 생성
9. `/api/push/subscribe` 저장
10. 실제 알림 발송 테스트

### 구현 순서 메모

- 먼저 감지 유틸만 안정화하면 UI 구현 시 분기가 단순해집니다.
- 체커 홈에 먼저 붙이고, 이후 관리자 대시보드로 확장하는 순서를 권장합니다.

---

## 13. 테스트 체크리스트

### 환경별 체크리스트

| 환경 | 확인 항목 |
| --- | --- |
| Windows Chrome | 설치 전/후 상태, 권한 default/granted/denied, 구독 저장 전/후 |
| Android Chrome | beforeinstallprompt 가능 여부, 설치 전/후, 권한 상태, 구독 저장 전/후 |
| iPhone Safari 일반 접속 | 일반 Safari 상태 감지, 설치 안내 노출 여부 |
| iPhone 홈 화면 추가 후 접속 | standalone 감지, 알림 허용 안내 흐름 |

### 상태별 체크리스트

- [ ] 권한 `default`
- [ ] 권한 `granted`
- [ ] 권한 `denied`
- [ ] PWA 설치 전
- [ ] PWA 설치 후
- [ ] subscription 저장 전
- [ ] subscription 저장 후
- [ ] 브라우저 구독 있음 + 서버 저장 없음
- [ ] 브라우저 구독 없음 + 권한 granted

---

## 14. 결론

해피통서비스의 PWA 온보딩은 단순히 “설치할까요?”를 묻는 수준이 아니라, 체커와 관리자에게 필요한 업무 도구 상태를 정확히 감지하고 안내하는 문제입니다.

따라서 1차 구현 전에는 다음이 먼저 정리되어야 합니다.

- 브라우저 capability 감지
- 설치 상태 감지
- 권한 상태 감지
- subscription 동기화 상태 감지
- 역할별 UX 분기 모델

이 문서를 기준으로 다음 단계에서는 실제 유틸 함수와 화면 연결 구조를 구현할 수 있습니다.
