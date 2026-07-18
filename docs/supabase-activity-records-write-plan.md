# Supabase Activity Records Write Plan

## 문서 목적

이 문서는 생활 확인 기록 작성 기능을 Supabase write로 전환하기 전에 현재 데이터 구조, 저장 흐름, fallback 전략을 정리하기 위한 계획 문서입니다.

중요:

- 이번 문서는 설계와 점검 준비용입니다.
- 아직 실제 `insert / update / delete` 구현을 하지 않습니다.
- 기존 `localStorage` 저장 흐름은 당장 제거하지 않습니다.

## 현재 localStorage 저장 구조

### localStorage key

- `happytong_activity_records`

### 저장 함수 위치

- 읽기 / 쓰기 서비스: [C:\Users\user\Desktop\AI\src\services\activityService.js](C:\Users\user\Desktop\AI\src\services\activityService.js)
- 실제 브라우저 저장 유틸: [C:\Users\user\Desktop\AI\src\utils\storage.js](C:\Users\user\Desktop\AI\src\utils\storage.js)

저장 흐름:

1. 체커 기록 작성 화면에서 `actions.addActivityRecord(...)` 호출
2. [C:\Users\user\Desktop\AI\src\App.jsx](C:\Users\user\Desktop\AI\src\App.jsx) 의 `setActivityRecords`
3. `usePersistentState`
4. `writeActivityRecords(...)`
5. `writeStorage(...)`
6. `localStorage.setItem("happytong_activity_records", ...)`

### 기록 작성 화면 위치

- [C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx](C:\Users\user\Desktop\AI\src\pages\checkerPages.jsx)
- 컴포넌트: `ActivityNew`
- 작성 함수: `handleSubmit()`

### 현재 기록 생성 시 필드 구조

현재 화면에서 생성되는 생활 확인 기록 payload 예시는 아래와 같습니다.

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

### 현재 확인된 필드

| 필드 | 현재 존재 여부 | 비고 |
| --- | --- | --- |
| `id` | 있음 | 로컬에서는 `record-${Date.now()}` 형식 |
| `targetId` | 있음 | 로컬 대상자 ID 기준 |
| `checkerId` | 있음 | 현재 로그인 사용자 ID |
| `date` | 있음 | `YYYY-MM-DD` 성격 |
| `type` | 있음 | `checkType`와 중복 성격 |
| `checkType` | 있음 | 확인 유형 |
| `checkItems` | 있음 | 항목별 선택값 객체 |
| `checklist` | 있음 | `checkItems`와 동일 데이터 중복 저장 |
| `healthStatus` | 있음 | 양호/주의/위험 계열 상태값 |
| `memo` | 있음 | 메모 |
| `hasIssue` | 있음 | 이상징후 여부 |
| `issueLevel` | 있음 | `none / need_check / urgent` 계열 |
| `issueSummary` | 있음 | 이상징후 요약 |
| `status` | 있음 | 현재는 `"completed"` 저장 |
| `createdAt` | 있음 | ISO 시각 |
| `updatedAt` | 있음 | ISO 시각 |

### 현재 없는 것으로 보이는 항목

| 항목 | 현재 상태 | 비고 |
| --- | --- | --- |
| 사진 첨부 | 확인되지 않음 | 현재 localStorage 구조에서 직접 확인되지 않음 |
| 별도 note 필드 | 명시적 필드는 없음 | `memo`, `issueSummary`가 대체 역할 |
| 별도 checked_at | 없음 | 현재는 `date`, `createdAt`, `updatedAt` 조합 |

### 관리자 활동 기록 / 통계 / 보고서 연계

현재 localStorage 생활 확인 기록은 아래 기능의 기초 데이터입니다.

- 관리자 활동 기록 화면
- 관리자 통계 화면
- 관리자 보고서 초안 생성
- 체커 개인 확인 이력
- 체커 홈 일부 요약 수치

즉, 생활 확인 기록 write 전환은 단일 화면 수정이 아니라 **통계 / 보고서 / 리마인드 / 관리자 조회 흐름 전체와 연결된 핵심 전환**입니다.

## 현재 기록 작성 UX 흐름

현재 UX 흐름은 아래와 같습니다.

1. 체커가 기록 작성 화면 진입
2. 대상자 선택
3. 확인 유형 선택
4. 항목별 상태 선택
5. 메모 및 이상징후 요약 입력
6. 저장
7. 체커 이력 화면으로 이동
8. 이후 체커 홈 / 관리자 활동 기록 / 통계 / 보고서에 반영

현재는 이 반영이 `localStorage` 데이터 기준으로 이루어집니다.

## Supabase write 전환 목표

목표는 아래와 같습니다.

1. 생활 확인 기록을 Supabase에 저장
2. 저장 성공 시 관리자 / 체커 화면에서 Supabase 기준으로 조회 가능
3. 기존 `localStorage` fallback은 초기 전환 단계에서 유지
4. 네트워크 실패 시 UX를 깨지 않음
5. 체커가 저장 실패로 입력 내용을 잃지 않도록 보호

## Supabase 테이블 후보 분석

현재 DB에서 활동 기록용 원본 테이블이 무엇인지 먼저 확인이 필요합니다.

후보 테이블 이름:

- `activity_records`
- `check_records`
- `visit_records`
- `care_records`
- `records`
- `activities`

중요:

- **실제 테이블명은 DB 점검 후 확정**합니다.
- 현재 read RPC가 어떤 실제 테이블을 원본으로 읽는지도 함께 확인해야 합니다.

관련 read 서비스 참고:

- [C:\Users\user\Desktop\AI\src\services\supabaseCheckerTargetsService.js](C:\Users\user\Desktop\AI\src\services\supabaseCheckerTargetsService.js)
- [C:\Users\user\Desktop\AI\src\services\supabaseAdminTargetsService.js](C:\Users\user\Desktop\AI\src\services\supabaseAdminTargetsService.js)
- [C:\Users\user\Desktop\AI\src\services\supabaseAdminEmergenciesService.js](C:\Users\user\Desktop\AI\src\services\supabaseAdminEmergenciesService.js)

특히 활동 기록 write 전환과 직접 관련해 추가 확인이 필요한 read/RPC 후보:

- 관리자 활동 기록 RPC
- 체커 활동 기록 이력 RPC
- 체커 홈 최근 활동 / 오늘 완료 여부 계산 RPC

## 필수 컬럼 후보

생활 확인 기록 저장용 Supabase 컬럼 후보는 아래와 같습니다.

| 컬럼 후보 | 설명 |
| --- | --- |
| `id uuid` | 기록 식별자 |
| `organization_id uuid` | 기관 식별자 |
| `target_id uuid` | 대상자 식별자 |
| `checker_id uuid` 또는 `checker_user_id uuid` | 체커 사용자 식별자 |
| `check_date date` | 확인 날짜 |
| `check_time timestamptz` 또는 `checked_at timestamptz` | 실제 확인 시각 |
| `check_type text` | 확인 유형 |
| `status text` | 결과 상태 |
| `memo text` | 메모 |
| `note text` | 보조 메모 또는 특이사항 |
| `risk_level text nullable` | 위험 수준 |
| `created_by uuid nullable` | 생성 사용자 |
| `created_at timestamptz` | 생성 시각 |
| `updated_at timestamptz` | 수정 시각 |

추가 검토 후보:

- `has_issue boolean`
- `issue_level text`
- `issue_summary text`
- `health_status text`
- `check_items jsonb`

특히 `checkItems`는 구조상 `jsonb`가 유력 후보입니다.

## localStorage 필드와 Supabase 컬럼 매핑표

| localStorage field | 의미 | Supabase column 후보 | 필수 여부 | 변환 필요 여부 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `id` | 로컬 기록 ID | `id` | 필수 | 예 | 로컬 문자열 ID → UUID 전략 필요 |
| `targetId` | 대상자 ID | `target_id` | 필수 | 예 | 로컬 ID / Supabase UUID 매핑 필요 |
| `checkerId` | 체커 ID | `checker_id` 또는 `checker_user_id` | 필수 | 예 | mock ID와 Supabase UUID 매핑 필요 |
| `date` | 확인 날짜 | `check_date` | 필수 | 보통 아니오 | 날짜 포맷만 맞추면 됨 |
| `type` | 확인 유형 | `check_type` | 선택 | 예 | `checkType`와 중복 정리 필요 |
| `checkType` | 확인 유형 | `check_type` | 필수 | 아니오 | 주 저장 후보 |
| `checkItems` | 세부 점검 항목 | `check_items` | 중요 | 예 | `jsonb` 후보 |
| `checklist` | `checkItems` 중복 | 없음 또는 `check_items` | 불필요 가능 | 예 | write 전환 시 중복 제거 검토 |
| `healthStatus` | 건강 상태 | `health_status` | 선택 | 아니오 | 문자열 매핑 점검 필요 |
| `memo` | 메모 | `memo` | 선택 | 아니오 | 현재 입력값 직접 매핑 가능 |
| `hasIssue` | 이상 유무 | `has_issue` | 중요 | 아니오 | boolean 매핑 가능 |
| `issueLevel` | 이상 수준 | `risk_level` 또는 `issue_level` | 중요 | 예 | read 모델과 명칭 통일 필요 |
| `issueSummary` | 이상 요약 | `note` 또는 `issue_summary` | 선택 | 예 | 별도 컬럼 여부 검토 |
| `status` | 완료 상태 | `status` | 필수 | 아니오 | 현재 `"completed"` 중심 |
| `createdAt` | 생성 시각 | `created_at` | 필수 | 아니오 | ISO → timestamptz |
| `updatedAt` | 수정 시각 | `updated_at` | 필수 | 아니오 | ISO → timestamptz |

## 저장 방식 후보

### A안: 프론트에서 Supabase client로 직접 insert

장점:

- 구현 경로가 짧음
- API 한 층이 줄어듦

단점:

- RLS 정책 설계가 먼저 필요
- mock 로그인과 Supabase Auth 로그인 혼재 상황에서 권한 제어가 까다로움
- 입력 검증이 프론트에 치우칠 수 있음

### B안: Vercel API에서 service_role로 insert

장점:

- 권한, 검증, 매핑을 서버에서 통제 가능
- mock 로그인 사용자 → 실제 Supabase user UUID resolve 전략을 재사용 가능
- 초기 MVP 안정성 확보가 쉬움

단점:

- API 추가 필요
- 서버 검증 로직을 별도로 관리해야 함

### 추천안

- **MVP 안정성 기준으로는 B안 우선 검토**
- 향후 RLS가 충분히 정리되면 프론트 직접 insert도 검토 가능

## 권장 전환 단계

1. DB 테이블 / 컬럼 점검
2. 생활 확인 기록 저장 API 설계
3. API 기반 Supabase insert 구현
4. 기존 localStorage 저장은 fallback으로 유지
5. 저장 성공 후 localStorage / Supabase 중복 및 동기화 정책 정리
6. 관리자 활동 기록 / 통계 / 보고서의 Supabase read 반영 확인

## 실패 / 예외 UX

권장 방침:

- Supabase 저장 실패 시 사용자에게 부드러운 실패 안내
- 기존 localStorage 임시 저장 유지 여부 검토
- 같은 대상자 / 같은 날짜 중복 기록 정책 결정 필요
- 중복 허용인지, 같은 날짜 최신 기록 업데이트인지 사전 결정 필요

추가 고려:

- 오프라인 또는 불안정 네트워크 환경
- mock 로그인 계정 유지 상태에서의 write 동작
- 체커가 저장 실패 후 재시도할 수 있는 UX

## 다음 구현 단계

다음 작업:

1. [docs/supabase-activity-records-db-checklist.md](C:\Users\user\Desktop\AI\docs\supabase-activity-records-db-checklist.md) 점검 SQL 실행
2. 실제 테이블 확인
3. 필요 시 `activity_records` 계열 final SQL 작성
4. 저장 API 설계
5. 생활 확인 기록 작성 Supabase write 구현
