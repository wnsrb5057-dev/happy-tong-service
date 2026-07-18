# Supabase Write Transition Audit

## 문서 목적

이 문서는 해피통서비스에서 아직 `localStorage` 기반으로 남아 있는 쓰기 기능을 파악하고, Supabase write 전환 우선순위를 정리하기 위한 감사 문서입니다.

중요:

- 이번 문서는 **조사와 전환 계획 정리용**입니다.
- 실제 `insert / update / delete` 구현은 포함하지 않습니다.
- 기존 mock / `localStorage` 흐름은 당분간 유지하는 전제를 둡니다.

## 조사 범위

주요 확인 파일:

- [C:\Users\user\Desktop\AI\src\App.jsx](C:\Users\user\Desktop\AI\src\App.jsx)
- [C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx](C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx)
- [C:\Users\user\Desktop\AI\src\pages\adminPages.jsx](C:\Users\user\Desktop\AI\src\pages\adminPages.jsx)
- [C:\Users\user\Desktop\AI\src\pages\superAdminPages.jsx](C:\Users\user\Desktop\AI\src\pages\superAdminPages.jsx)
- [C:\Users\user\Desktop\AI\src\pages\LoginPage.jsx](C:\Users\user\Desktop\AI\src\pages\LoginPage.jsx)
- [C:\Users\user\Desktop\AI\src\services\activityService.js](C:\Users\user\Desktop\AI\src\services\activityService.js)
- [C:\Users\user\Desktop\AI\src\services\emergencyService.js](C:\Users\user\Desktop\AI\src\services\emergencyService.js)
- [C:\Users\user\Desktop\AI\src\services\targetService.js](C:\Users\user\Desktop\AI\src\services\targetService.js)
- [C:\Users\user\Desktop\AI\src\services\adminReportDataService.js](C:\Users\user\Desktop\AI\src\services\adminReportDataService.js)
- [C:\Users\user\Desktop\AI\src\services\authService.js](C:\Users\user\Desktop\AI\src\services\authService.js)
- [C:\Users\user\Desktop\AI\src\services\signupRequestService.js](C:\Users\user\Desktop\AI\src\services\signupRequestService.js)
- [C:\Users\user\Desktop\AI\src\utils\report.js](C:\Users\user\Desktop\AI\src\utils\report.js)
- [C:\Users\user\Desktop\AI\src\utils\storage.js](C:\Users\user\Desktop\AI\src\utils\storage.js)

## 현재 쓰기 기능 요약

### A. 생활 확인 기록 작성

현재 상태:

- 화면: `CheckerHome`에서 이동하는 확인 기록 작성 화면
- 파일: [src/pages/checkerPages.jsx](C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx)
- 작성 함수: `ActivityNew.handleSubmit()`
- 저장 호출: `actions.addActivityRecord(...)`
- 실제 저장 흐름:
  - `App.jsx`의 `actions.addActivityRecord`
  - `setActivityRecords`
  - `usePersistentState`
  - `writeActivityRecords`
  - `localStorage` key `happytong_activity_records`

관련 서비스:

- [src/services/activityService.js](C:\Users\user\Desktop\AI\src\services\activityService.js)

현재 판단:

- 현재는 **localStorage 저장**
- 읽기 화면은 일부 Supabase read와 병행 중이지만, 작성은 아직 로컬 저장
- 체커 핵심 업무 데이터이므로 **Supabase write 1순위**

### B. 이상징후 보고 작성

현재 상태:

- 화면: 체커 이상징후 보고 작성
- 파일: [src/pages/checkerPages.jsx](C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx)
- 작성 함수: `EmergencyNew.handleSubmit()`
- 저장 호출: `actions.addEmergencyReport(...)`
- 실제 저장 흐름:
  - `App.jsx`의 `actions.addEmergencyReport`
  - `setEmergencyReports`
  - `writeEmergencyReports`
  - `localStorage` key `happytong_emergency_reports`

관련 서비스:

- [src/services/emergencyService.js](C:\Users\user\Desktop\AI\src\services\emergencyService.js)

현재 판단:

- 현재는 **localStorage 저장**
- 관리자 이상징후 목록/상세는 Supabase read와 fallback 구조를 이미 갖고 있음
- 향후 관리자 신규 이상징후 푸시 알림과 직접 연결되므로 **Supabase write 2순위**

### C. 이상징후 처리 상태 변경

현재 상태:

- 화면: 관리자 이상징후 상세
- 파일: [src/pages/adminPages.jsx](C:\Users\user\Desktop\AI\src\pages\adminPages.jsx)
- 처리 함수: `AdminEmergencyDetail.handleSave()`
- 저장 호출: `actions.addEmergencyHandlingLog(localEditableEmergencyId, nextLog)`
- 실제 저장 흐름:
  - `App.jsx`의 `actions.addEmergencyHandlingLog`
  - `emergencyReports[].handlingLogs` 갱신
  - `status`, `adminMemo`, `completedAt`, `updatedAt` 함께 갱신
  - 최종적으로 `writeEmergencyReports`

현재 판단:

- 현재는 **localStorage 저장**
- 미처리/처리중/완료 통계와 관리자 운영 흐름에 직접 영향
- **Supabase write 3순위**

### D. 대상자 등록 / 수정 / 관리종료

현재 상태:

- 대상자 등록:
  - 파일: [src/pages/adminPages.jsx](C:\Users\user\Desktop\AI\src\pages\adminPages.jsx)
  - 함수: `AdminTargetNew.handleSubmit()`
  - 호출: `actions.addTarget(newTarget)`
- 대상자 수정:
  - 파일: 같은 파일
  - 호출: `actions.updateTarget(...)`
- 관리종료:
  - 파일: 같은 파일
  - `actions.updateTarget(target.id, { lifecycleStatus: "ended", ... })` 형태 사용

관련 서비스:

- [src/services/targetService.js](C:\Users\user\Desktop\AI\src\services\targetService.js)

현재 판단:

- 현재는 **localStorage 저장**
- 관리자 운영 데이터로 중요하지만, 기록/이상징후보다 후순위
- **Supabase write 4순위**

### E. 체커 등록 / 수정 / 상태 변경

현재 상태:

- 체커 등록:
  - 파일: [src/pages/adminPages.jsx](C:\Users\user\Desktop\AI\src\pages\adminPages.jsx)
  - 함수: `AdminCheckerNew.handleSubmit()`
  - 호출: `actions.addUser(newChecker)`
- 체커 수정:
  - 호출: `actions.updateUser(checker.id, updates)`
- 체커 배정 변경:
  - 호출: `actions.updateCheckerAssignments(checkerId, draftAssignments)`
  - 실제로는 `targets[].assignedCheckerId`를 갱신

관련 서비스:

- [src/services/authService.js](C:\Users\user\Desktop\AI\src\services\authService.js)
- [src/services/targetService.js](C:\Users\user\Desktop\AI\src\services\targetService.js)

현재 판단:

- 현재는 `registeredUsers`와 `targets`를 통해 **localStorage 저장**
- 사용자/배정 구조까지 같이 다뤄야 하므로 전환 난이도 높음
- **Supabase write 5순위**

### F. 보고서 저장 / 초안 / 출력

현재 상태:

- 보고서 저장:
  - 파일: [src/pages/adminPages.jsx](C:\Users\user\Desktop\AI\src\pages\adminPages.jsx)
  - 함수: `AdminReportNew.handleGenerate()`
  - 호출: `actions.addAdminReport(report)`
- 보고서 draft 저장:
  - `saveReportDraft(report)`
- PDF/인쇄:
  - `handlePrint()`에서 `saveReportDraft(report)` 후 `window.print()`

관련 서비스 / 유틸:

- [src/services/adminReportDataService.js](C:\Users\user\Desktop\AI\src\services\adminReportDataService.js)
- [src/utils/report.js](C:\Users\user\Desktop\AI\src\utils\report.js)

현재 판단:

- 현재는 **localStorage 저장**
- 운영상 중요하지만 원천 데이터는 활동기록/이상징후/대상자 쪽
- 출력 흐름과 분리해서 봐야 하므로 **Supabase write 6순위**

## 기타 확인된 localStorage 기반 쓰기

도메인 write는 아니지만 함께 확인된 항목:

- 현재 로그인 사용자 저장
  - `saveCurrentUser`
  - key: `happytong_current_user`
- 회원가입 요청 저장
  - `appendSignupRequest`
  - key: `signupRequests`
- 등록 사용자 저장
  - `writeRegisteredUsers`
  - key: `happytong_registered_users`
- 체커 PWA 안내 배너 숨김
  - `window.localStorage.setItem(CHECKER_PWA_NOTICE_DISMISSED_KEY, "true")`
  - PWA UX용 상태이며 Supabase write 전환 대상은 아님

## localStorage key 목록

| key | 사용 파일 | 읽기/쓰기 여부 | 관련 기능 | Supabase 전환 필요 여부 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `happytong_current_user` | `src/services/authService.js`, `src/utils/storage.js` | 읽기/쓰기 | 현재 로그인 유지 | 낮음 | 세션 성격 |
| `happytong_targets` | `src/services/targetService.js`, `src/App.jsx` | 읽기/쓰기 | 대상자 등록/수정/배정/관리종료 | 높음 | 4순위 |
| `happytong_activity_records` | `src/services/activityService.js`, `src/App.jsx` | 읽기/쓰기 | 생활 확인 기록 작성/히스토리/통계 | 매우 높음 | 1순위 |
| `happytong_emergency_reports` | `src/services/emergencyService.js`, `src/App.jsx` | 읽기/쓰기 | 이상징후 보고/처리 상태 변경 | 매우 높음 | 2~3순위 |
| `happytong_admin_reports` | `src/services/adminReportDataService.js`, `src/App.jsx` | 읽기/쓰기 | 보고서 저장 | 중간 | 6순위 |
| `happytong_report_drafts` | `src/utils/report.js`, `src/utils/storage.js` | 읽기/쓰기 | 보고서 draft 임시 저장 | 중간 | 보고서 write와 연계 |
| `signupRequests` | `src/services/signupRequestService.js`, `src/pages/LoginPage.jsx` | 읽기/쓰기 | 회원가입 요청 | 낮음 | 운영 정책 이후 검토 |
| `happytong_registered_users` | `src/services/authService.js`, `src/App.jsx` | 읽기/쓰기 | 체커 등록/수정 | 높음 | 5순위 |
| `happy-tong-current-user` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 legacy currentUser | 낮음 | 레거시 키 |
| `happy-tong-activity-records` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 legacy 활동기록 | 높음 | 레거시 키 |
| `happy-tong-emergency-reports` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 legacy 이상징후 | 높음 | 레거시 키 |
| `happy-tong-admin-reports` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 legacy 보고서 | 중간 | 레거시 키 |
| `happytong_admin_report_draft` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 draft | 중간 | 레거시 키 |
| `happy-tong-admin-report-draft` | `src/utils/storage.js` | 읽기(마이그레이션) | 구 draft | 중간 | 레거시 키 |
| `CHECKER_PWA_NOTICE_DISMISSED_KEY` 상수값 | `src/pages/checkerPages.jsx` | 쓰기 | PWA 안내 배너 숨김 | 없음 | 도메인 write 아님 |

## Supabase write 전환 추천 순서

### 1순위: 생활 확인 기록 작성

이유:

- 체커의 핵심 업무 데이터
- 통계, 보고서, 리마인드의 기초 데이터
- “오늘 확인 완료 여부” 판단의 기준 데이터
- 현재 체커 write 전환에서 가장 큰 운영 가치가 있음

### 2순위: 이상징후 보고 작성

이유:

- 관리자 신규 이상징후 알림과 직접 연결
- 관리자 대시보드 / 목록 / 상세와 연결
- 서비스 핵심 가치와 직결

### 3순위: 이상징후 처리 상태 변경

이유:

- 관리자 조치 이력의 핵심
- 미처리 / 처리중 / 완료 통계에 필요
- 이상징후 운영 흐름 완성에 필수

### 4순위: 대상자 등록 / 수정 / 관리종료

이유:

- 운영 데이터이지만 기록/이상징후보다 우선도는 낮음
- 담당 배정, 상태, lifecycle 연계 검토가 필요

### 5순위: 체커 등록 / 수정 / 상태 변경

이유:

- 사용자와 배정 데이터가 함께 묶여 있음
- mock 로그인 유지 정책과 충돌 없이 단계적 전환이 필요

### 6순위: 보고서 저장

이유:

- 상위 원천 데이터가 먼저 Supabase write로 옮겨져야 의미가 커짐
- draft / 출력 / 최종 저장을 분리해서 설계하는 편이 안전함

## 1순위 전환 대상 상세 분석

### 대상 기능

- 생활 확인 기록 작성

### 현재 기록 작성 화면 파일

- [C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx](C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx)

### 현재 기록 작성 함수명

- `ActivityNew.handleSubmit()`

### 현재 저장 흐름

1. `ActivityNew.handleSubmit()`
2. `actions.addActivityRecord(...)`
3. `App.jsx`의 `setActivityRecords`
4. `writeActivityRecords(...)`
5. `localStorage`의 `happytong_activity_records`

### 저장되는 데이터 구조 예시

현재 화면에서 확인되는 기록 payload 예시는 아래 구조입니다.

```js
{
  id: `record-${Date.now()}`,
  targetId: selectedTarget.localDetailTargetId,
  checkerId: user.id,
  date: getToday(),
  type: form.checkType,
  checkType: form.checkType,
  checkItems,
  checklist: checkItems,
  healthStatus,
  memo,
  hasIssue,
  issueLevel,
  issueSummary,
  status: "completed",
  createdAt: now,
  updatedAt: now
}
```

### 필수 필드 후보

- `targetId`
- `checkerId`
- `date`
- `checkType`
- `checkItems`
- `status`
- `createdAt`
- `updatedAt`

상황에 따라 필수 검토:

- `hasIssue`
- `issueLevel`
- `issueSummary`
- `memo`
- `healthStatus`

### Supabase 테이블 후보

후보:

- 활동기록 전용 테이블 (`activity_records` 또는 유사 이름)

현재 확인 필요:

- 실제 Supabase에 활동기록 테이블이 이미 있는지
- RPC read에서 어떤 원본 테이블을 읽고 있는지
- `checkerId`, `targetId`, `date`, `status`, `checkType`에 대응하는 컬럼이 무엇인지

### 현재 Supabase 관련 확인 필요 사항

- admin / checker 활동기록 read RPC가 어떤 실제 테이블을 원본으로 쓰는지 확인 필요
- `get_public_admin_activity_records`
- `get_public_checker_activity_history`
- 관련 테이블명과 컬럼명 점검 SQL 필요

### 기존 localStorage fallback 유지 필요 여부

- **유지 필요**

이유:

- mock 로그인 계정이 계속 유지되어야 함
- 단계적 전환 중 네트워크 실패나 권한 이슈가 있을 수 있음
- 초기 write 전환 시 fallback 없이 바로 전환하면 운영 리스크가 큼

권장 방향:

- Supabase write 우선 시도
- 실패 시 로컬 fallback 또는 명확한 저장 실패 UX 검토
- 전환 초기에 이중 검증 전략 필요

### 실패 시 UX 방침

권장:

- 저장 실패 시 화면 내 에러 문구 제공
- 민감 데이터 `console.log` 금지
- 오프라인/네트워크 실패 시 재시도 가능성 검토
- 체커가 입력 내용을 잃지 않도록 draft 유지 또는 임시 보존 정책 검토

## 주의사항

- 한 번에 모든 쓰기를 Supabase로 바꾸지 않습니다.
- 기존 mock / `localStorage` 테스트 계정은 유지합니다.
- Supabase write 전환 후에도 fallback 또는 단계적 전환이 필요합니다.
- RLS / 권한 정책은 write 전환 전에 반드시 확인해야 합니다.
- 체커 기록 작성은 오프라인 / 네트워크 실패 UX를 함께 고려해야 합니다.
- 민감 개인정보를 `console.log`로 출력하지 않습니다.

## 다음 구현 단계

다음 작업:

1. `docs/supabase-activity-records-write-plan.md` 생성
2. 생활 확인 기록 작성 데이터 구조 확인
3. Supabase 관련 테이블 / 컬럼 점검 SQL 작성
4. 이후 생활 확인 기록 작성 Supabase write 구현
