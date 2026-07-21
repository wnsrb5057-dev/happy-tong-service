# 관리자 이상징후 처리 상태 Supabase write 전환 사전 점검

## 1. 작업 목적

이 문서는 관리자 이상징후 상세 화면의 처리 상태 변경 기능을 Supabase write로 전환하기 전, 현재 localStorage 처리 흐름과 Supabase DB 업데이트 대상을 점검하기 위한 문서다.

현재 상태:

- 체커 이상징후 보고 작성 시 `public.emergency_reports` 저장 성공
- 보고 생성 직후 `public.emergency_handling_logs` 초기 `received` 로그 생성 성공
- 관리자 이상징후 목록에서 Supabase 보고 반영 확인 완료
- 관리자 처리 상태 변경은 아직 localStorage 기반이다.

이번 단계에서는 코드 구현, API 생성, DB 변경을 하지 않는다.

## 2. 현재 관리자 처리 상태 변경 흐름

관리자 이상징후 상세 화면은 `AdminEmergencyDetail` 컴포넌트에서 처리한다.

- 파일: `src/pages/adminPages.jsx`
- 컴포넌트: `AdminEmergencyDetail`
- 저장 함수: `handleSave()`
- localStorage update action: `actions.addEmergencyHandlingLog(emergencyId, log)`

상세 화면 흐름:

1. `findAdminEmergencyForDetail(emergencyId, data.emergencyReports, data.targets)`로 localStorage 보고를 먼저 찾는다.
2. localStorage 보고가 없고 Supabase organization id가 있으면 `getSupabaseAdminEmergencyById(...)`로 Supabase 상세를 조회한다.
3. 화면 표시용 report는 `localReport || supabaseEmergencyState.report`이다.
4. 처리 저장 가능 여부는 `localEditableEmergencyId` 존재 여부로 결정된다.
5. Supabase 전용 상세 데이터만 있는 경우 현재는 "Supabase 읽기 전용 데이터"로 처리 기록 저장 버튼이 비활성화된다.
6. localStorage와 매칭되는 보고가 있으면 `handleSave()`가 처리 로그를 만들고 `actions.addEmergencyHandlingLog(...)`를 호출한다.

현재 처리 폼 입력값:

- 처리 상태: `form.status`
- 처리 메모: `form.memo`
- 보호자 연락 여부: `form.contactedGuardian`
- 방문 필요 여부: `form.visitRequired`

저장 후 화면 반영:

- `actions.addEmergencyHandlingLog(...)`가 해당 보고의 `status`, `statusLabel`, `adminMemo`, `handlingLogs`, `updatedAt`, `completedAt`을 갱신한다.
- 완료 상태(`completed`)인 경우 `completedAt`이 현재 시각으로 설정된다.
- 상세 화면의 처리 이력은 `report.handlingLogs`를 `createdAt` 최신순으로 정렬해 표시한다.

## 3. 관련 컴포넌트/함수

| 파일 | 컴포넌트/함수 | 역할 |
| --- | --- | --- |
| `src/pages/adminPages.jsx` | `AdminEmergencies` | 관리자 이상징후 목록 |
| `src/pages/adminPages.jsx` | `AdminEmergencyDetail` | 관리자 이상징후 상세/처리 기록 추가 |
| `src/pages/adminPages.jsx` | `handleSave()` | 상세 화면 처리 기록 저장 |
| `src/pages/adminPages.jsx` | `getEmergencyStatusValue(status)` | 화면/legacy 상태값을 내부 상태값으로 변환 |
| `src/pages/adminPages.jsx` | `getEmergencyStatusMeta(status)` | 상태값의 표시 라벨/tone 변환 |
| `src/pages/adminPages.jsx` | `isEmergencyCompleted(status)` | 완료 여부 판정 |
| `src/pages/adminPages.jsx` | `buildLatestHandlingLogByEmergency(...)` | localStorage 처리 로그 최신값 계산 |
| `src/pages/adminPages.jsx` | `normalizeLocalAdminEmergency(...)` | localStorage 이상징후 보고를 관리자 화면용으로 변환 |
| `src/App.jsx` | `actions.addEmergencyHandlingLog(...)` | localStorage 보고의 처리 상태/로그 갱신 |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencies(...)` | Supabase 관리자 이상징후 목록 조회 |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencyById(...)` | Supabase 관리자 이상징후 상세 조회 |

## 4. 현재 localStorage 데이터 구조

관리자 처리 저장 시 생성되는 `nextLog` 구조:

| 필드 | 현재 값/역할 |
| --- | --- |
| `id` | `log-${Date.now()}` 형식의 local id |
| `status` | 선택한 처리 상태. 예: `received`, `checking`, `contacted`, `visiting`, `completed` |
| `statusLabel` | 화면 표시 라벨. 예: `접수됨`, `확인중`, `보호자 연락`, `방문 필요`, `완료` |
| `memo` | 관리자 처리 메모 |
| `contactedGuardian` | 보호자 연락 여부 |
| `visitRequired` | 방문 필요 여부 |
| `createdAt` | 처리 기록 생성 시각 ISO 문자열 |
| `createdBy` | 현재 관리자 이름 또는 `관리자` |

`actions.addEmergencyHandlingLog(emergencyId, log)`가 localStorage 보고에 반영하는 값:

| 필드 | 반영 방식 |
| --- | --- |
| `status` | `log.status`로 갱신 |
| `statusLabel` | `log.statusLabel`로 갱신 |
| `adminMemo` | `log.memo`로 갱신 |
| `handlingLogs` | 기존 로그 배열 뒤에 `log` 추가 |
| `updatedAt` | 현재 시각으로 갱신 |
| `completedAt` | `log.status === "completed"`이면 현재 시각으로 갱신 |

현재 localStorage 기준으로 사용되는 처리 관련 후보 필드:

- `emergencyReportId` 또는 route의 `emergencyId`
- `status`
- `statusLabel`
- `memo`
- `adminMemo`
- `contactedGuardian`
- `visitRequired`
- `completedAt`
- `updatedAt`
- `createdBy`
- `handlingLogs`

## 5. Supabase 업데이트 대상

관리자 처리 상태 write 전환 시 업데이트 대상은 두 갈래로 나누는 것이 적절하다.

### emergency_reports update 대상

| 컬럼 | 역할 |
| --- | --- |
| `status` | 현재 처리 상태 |
| `completed_at` | `completed` 처리 시 완료 시각 |
| `updated_at` | 처리 상태 변경 시각 |

`status`는 DB 제약조건 때문에 반드시 아래 값 중 하나로 저장해야 한다.

- `received`
- `checking`
- `contacted`
- `visiting`
- `completed`

### emergency_handling_logs insert 대상

| 컬럼 | 역할 |
| --- | --- |
| `emergency_report_id` | 처리 대상 이상징후 보고 id |
| `organization_id` | 보고 소속 기관 id |
| `status` | 처리 상태 |
| `memo` | 처리 메모 |
| `contacted_guardian` | 보호자 연락 여부 |
| `visit_required` | 방문 필요 여부 |
| `created_by` | 처리한 관리자 user id 후보 |
| `created_by_name` | 처리한 관리자 이름 또는 이메일 |
| `created_at` | 처리 로그 생성 시각 |

`emergency_handling_logs.status`도 `received/checking/contacted/visiting/completed` 계열로 맞추는 것이 안전하다.

## 6. 상태값 매핑

현재 화면의 상태값 매핑 기준:

| 화면 문구/legacy 값 | DB 저장값 |
| --- | --- |
| `접수됨`, `접수`, `received` | `received` |
| `확인 중`, `확인중`, `처리 중`, `처리중`, `in_progress`, `checking` | `checking` |
| `보호자 연락`, `연락 완료`, `contacted` | `contacted` |
| `방문 필요`, `방문 예정`, `visiting` | `visiting` |
| `완료`, `조치 완료`, `resolved`, `completed` | `completed` |

구현 시에는 API에서 최종적으로 DB 허용값만 저장하도록 한 번 더 정규화해야 한다.

```text
allowed status = received | checking | contacted | visiting | completed
fallback status = received
```

## 7. 구현 단계 초안

1. `/api/emergency-reports/update-status` API 생성
   - POST 전용
   - service role Supabase client 사용
   - request body 전체 로그 금지

2. 요청 payload 후보 정의
   - `emergencyReportId` 또는 `emergency_report_id`
   - `organizationId` 또는 `organization_id`
   - `status`
   - `memo`
   - `contactedGuardian`
   - `visitRequired`
   - `createdBy` 또는 `created_by`
   - `createdByName` 또는 `created_by_name`

3. 서버에서 report resolve
   - `emergency_reports.id` 직접 조회
   - organization mismatch 방지
   - report의 `organization_id`를 로그 insert에 사용

4. `emergency_reports` update
   - `status`
   - `updated_at`
   - `completed_at`: status가 `completed`이면 현재 시각, 아니면 기존값 유지 또는 null 정책 별도 결정

5. `emergency_handling_logs` insert
   - 처리 상태 변경마다 로그 추가
   - memo는 필수로 유지하는 것이 현재 UX와 맞다.

6. 프론트 service 추가
   - 후보 파일: `src/services/supabaseEmergencyStatusUpdateService.js`
   - 함수 후보: `updateSupabaseEmergencyStatus(payload)`

7. 관리자 상세 화면 연결
   - 기존 `actions.addEmergencyHandlingLog(...)` localStorage 저장은 유지
   - localStorage 저장 직후 Supabase update API를 추가 호출
   - Supabase 실패 시 기존 UX는 깨지지 않게 처리

8. 목록/상세 반영 확인
   - `get_public_admin_emergencies`가 최신 `emergency_reports.status`와 최신 handling log를 반환하는지 확인
   - 필요 시 read RPC 반환 컬럼 보완은 별도 작업으로 분리

## 8. 주의사항

- 기존 localStorage 처리 흐름을 제거하지 않는다.
- `actions.addEmergencyHandlingLog(...)`를 삭제하지 않는다.
- Supabase update 실패가 관리자 화면 저장 UX를 깨지 않게 한다.
- status는 반드시 DB 허용값으로 정규화한다.
- 관리자 메모, 개인정보, request body 전체를 console에 출력하지 않는다.
- service role key는 프론트엔드에 노출하지 않는다.
- RLS/policy 변경은 이번 단계에서 하지 않는다.
- 관리자 목록/상세 read 로직 대규모 수정은 write 연결 후 필요한 범위에서만 진행한다.
- 처리 상태 변경은 activity_records와 무관하므로 관련 파일은 수정하지 않는다.

## 9. 이번 단계에서 하지 않는 것

- 코드 파일 수정
- API 파일 생성
- DB/SQL/RLS/Auth 수정
- `package.json`, `package-lock.json` 수정
- 기존 localStorage 흐름 변경
- 관리자 화면 수정
- 실제 Supabase status update 구현
- 실제 `emergency_handling_logs` 추가 insert 구현
- 처리 상태 변경 실패 UX 변경
