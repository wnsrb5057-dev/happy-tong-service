# 체커 단위 RPC 서버 API 전환 계획

## 1. 작업 목적

체커 단위 `get_public_*` RPC를 클라이언트 직접 RPC 호출에서 서버 API 호출로 전환하기 위한 감사와 계획을 정리한다.

이번 단계는 문서 작성만 수행한다. 코드, API, DB, SQL, RLS, Auth 설정은 수정하지 않는다.

## 2. 현재 보안 정리 상태

현재까지 완료된 보안 정리:

1. 주요 테이블 `anon` / `authenticated` write 권한 제거
2. 높은 위험 총관리자/기관성 RPC 6개 `/api/super` 전환
3. 높은 위험 RPC 6개 `PUBLIC` / `anon` EXECUTE 제거
4. 관리자 조직 단위 RPC 6개 `/api/admin-read` 전환
5. 관리자 RPC 6개 `PUBLIC` / `anon` EXECUTE 제거

다음 보안 정리 대상은 체커 단위 RPC다.

## 3. 체커 단위 RPC 후보

- `get_public_checker_home(p_checker_id uuid)`
- `get_public_checker_targets(p_checker_id uuid)`
- `get_public_checker_activity_history(p_checker_id uuid)`
- `get_public_checker_activity_form_targets(p_checker_id uuid)`

현재 위험:

- 대부분 `SECURITY DEFINER` 함수일 가능성이 있다.
- `PUBLIC` / `anon` / `authenticated` EXECUTE가 열려 있을 가능성이 있다.
- `p_checker_id`만 알면 체커 배정 대상자, 활동 이력, 기록 작성 대상자 데이터를 조회할 수 있다.
- 함수 내부에서 `auth.uid()` 기반으로 호출자가 해당 checker인지 검증하지 않으면 타 체커 데이터 조회 위험이 있다.
- mock 로그인은 Supabase Auth session이 없으므로 anon EXECUTE 제거 시 체커 화면 read가 깨질 수 있다.

## 4. RPC별 사용 위치

| RPC | 호출 파일 | 호출 함수 | 사용 화면 | 전달 인자 | 반환 데이터 용도 | fallback | 화면 영향 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get_public_checker_home` | `src/services/supabaseCheckerHomeService.js` | `getSupabaseCheckerHome` | 체커 홈 | `p_checker_id` | 체커 홈 요약, 오늘 확인, 최근 활동/이상징후 등 | local/mock home fallback | 높음. 체커 첫 화면 최신 데이터 영향 |
| `get_public_checker_targets` | `src/services/supabaseCheckerTargetsService.js` | `getSupabaseCheckerTargets`, `getSupabaseCheckerTargetById` | 담당 대상자 목록, 대상자 상세 | `p_checker_id` | 체커 담당 대상자 목록/상세 | localStorage fallback | 높음. Supabase-only 대상자 표시 영향 |
| `get_public_checker_activity_history` | `src/services/supabaseCheckerActivityHistoryService.js` | `getSupabaseCheckerActivityHistory` | 체커 활동 이력 | `p_checker_id` | 체커 확인기록 목록 | localStorage fallback | 높음. Supabase activity_records 표시 영향 |
| `get_public_checker_activity_form_targets` | `src/services/supabaseCheckerActivityFormTargetsService.js` | `getSupabaseCheckerActivityFormTargets` | 생활 확인 기록 작성 화면 대상자 선택 | `p_checker_id` | 기록 작성용 대상자 목록 | localStorage fallback | 높음. 기록작성 대상자 선택 영향 |

추가 확인:

- `src/pages/checkerPages.jsx` 자체에는 직접 `supabase.rpc` 호출이 없다.
- 체커 화면은 위 service 함수를 import해 사용한다.
- `supabaseCheckerActivityHistoryService.js`는 RPC 외에 `targets`, `activity_records` 직접 select 보강이 있다.

## 5. 체커 화면 read 흐름

확인된 화면/함수 흐름:

- `CheckerHome` → `getSupabaseCheckerHome`
- `CheckerTargets` → `getSupabaseCheckerTargets`
- `CheckerTargetDetail` → `getSupabaseCheckerTargetById`
- `ActivityNew` → `getSupabaseCheckerActivityFormTargets`
- `ActivityHistory` → `getSupabaseCheckerActivityHistory`

각 화면은 `resolveCheckerSupabaseId(...)`로 체커 id를 구한 뒤 service에 전달한다.

연결되는 화면/기능:

- 체커 홈
- 체커 담당 대상자 목록
- 대상자 상세
- 생활 확인 기록 작성 화면
- 기록 작성 대상자 선택
- 체커 활동 이력
- 이상징후 보고 작성 진입 흐름

## 6. 이미 서버 API 전환된 기능과 아직 남은 read 구분

이미 서버 API를 사용하는 체커 관련 write:

- 생활 확인 기록 작성: `/api/activity-records/create`
- 이상징후 보고 작성: `/api/emergency-reports/create`
- push subscription/reminder 관련 API

아직 클라이언트 RPC read가 남은 체커 read:

- 체커 홈
- 체커 담당 대상자 목록
- 체커 대상자 상세
- 체커 활동 이력
- 기록 작성 대상자 선택

혼동하지 말아야 할 점:

- write 전환은 이미 상당 부분 완료되었지만, 체커 화면 read는 아직 클라이언트 RPC에 의존한다.
- 권한 정리 전 read 경로를 서버 API로 옮겨야 mock 로그인 화면이 깨지지 않는다.

## 7. 서버 API 후보 비교

### A안: `api/checker-read.js` 통합 API

action 후보:

- `getHome`
- `getTargets`
- `getActivityHistory`
- `getActivityFormTargets`

장점:

- 체커 본인 read 책임이 명확하다.
- Vercel Hobby 플랜 Serverless Function 개수 제한에 맞춰 API 파일 1개로 통합할 수 있다.
- 기존 관리자용 `api/checkers.js` write API와 책임을 분리할 수 있다.

단점:

- action이 늘어나므로 응답 구조와 에러 코드를 명확히 유지해야 한다.

### B안: 기존 `api/checkers.js` 재사용

판단:

- `api/checkers.js`는 관리자 체커 등록/수정/상태 변경 write API 성격이다.
- 체커 본인 read를 추가하면 책임이 섞일 수 있다.
- 추천하지 않는다.

### C안: 기존 `api/activity-records/create.js` 재사용

판단:

- 생활 확인 기록 작성 write API다.
- 체커 read 통합에는 부적절하다.
- 추천하지 않는다.

## 8. 추천 API 구조

추천은 `api/checker-read.js` 단일 통합 API다.

기본 구조:

- POST 전용
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `body.action` 기반 분기
- `body.checkerId` 또는 `body.checker_id` 필수
- 잘못된 action은 `INVALID_ACTION`
- checker id 누락은 `MISSING_CHECKER_ID`
- request body 전체 로그 금지
- service_role key 노출 금지

응답 후보:

- `getHome` → `{ success: true, home }`
- `getTargets` → `{ success: true, targets }`
- `getActivityHistory` → `{ success: true, activityRecords }`
- `getActivityFormTargets` → `{ success: true, targets }`

초기 구현은 기존 RPC를 서버에서 service_role으로 호출하고, 기존 service normalize 함수가 화면 반환 형태를 유지하도록 한다.

## 9. service 전환 대상 후보

| 파일 | 현재 상태 | 전환 action | 반환 형태 유지 방식 | fallback |
| --- | --- | --- | --- | --- |
| `src/services/supabaseCheckerHomeService.js` | `supabase.rpc("get_public_checker_home")` 직접 호출 | `getHome` | 기존 `normalizeHome` 유지 | 기존 local/mock fallback 유지 |
| `src/services/supabaseCheckerTargetsService.js` | `supabase.rpc("get_public_checker_targets")` 직접 호출 | `getTargets` | 기존 `normalizeTarget` 유지 | 기존 localStorage fallback 유지 |
| `src/services/supabaseCheckerActivityHistoryService.js` | `supabase.rpc("get_public_checker_activity_history")`, `targets`/`activity_records` 직접 select 보강 | `getActivityHistory` | 기존 `normalizeRecord` 및 보강 로직 유지 | 기존 localStorage fallback 유지 |
| `src/services/supabaseCheckerActivityFormTargetsService.js` | `supabase.rpc("get_public_checker_activity_form_targets")` 직접 호출 | `getActivityFormTargets` | 기존 `normalizeTarget` 유지 | 기존 localStorage fallback 유지 |

주의:

- `supabaseCheckerActivityHistoryService.js`의 직접 table select는 SELECT 권한 정리와도 연결된다.
- 서버 API 전환 시 해당 보강 조회를 서버 API 내부로 같이 옮길지 검토해야 한다.

## 10. 전환 후 권한 정리 가능성

서버 API 전환과 QA가 완료되면 아래 RPC의 `PUBLIC` / `anon` EXECUTE 제거를 검토할 수 있다.

- `get_public_checker_home`
- `get_public_checker_targets`
- `get_public_checker_activity_history`
- `get_public_checker_activity_form_targets`

권한 정리 기준:

- `src`에서 해당 RPC 직접 호출 없음
- 체커 read service가 `/api/checker-read` fetch로 전환됨
- `api/checker-read.js` 내부에서만 service_role으로 RPC 호출
- 체커 화면 fallback 유지
- API smoke test 통과
- 체커 화면 QA 통과

주의:

- `authenticated` EXECUTE 제거는 별도 단계다.
- `postgres`와 `service_role` 권한은 유지해야 한다.
- 화면 QA 후 권한 제거를 진행한다.

## 11. 구현 단계 초안

1. 체커 RPC 사용 위치 최종 확인
2. `api/checker-read.js` 통합 API 생성
3. 체커 read service를 fetch 기반으로 전환
4. 기존 normalize/fallback 유지
5. `npm run build`
6. 로컬/배포 API smoke test
7. 체커 화면 QA
8. `src` 직접 RPC 제거 확인
9. `PUBLIC` / `anon` EXECUTE 제거 준비 문서 작성
10. Supabase SQL Editor에서 revoke 실행

## 12. 테스트 계획

API smoke test:

- `POST /api/checker-read {}` → `400 INVALID_ACTION` 또는 `MISSING_CHECKER_ID`
- `POST /api/checker-read action=getHome checkerId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3` → `200 success true`
- `POST /api/checker-read action=getTargets checkerId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3` → `200 success true`
- `POST /api/checker-read action=getActivityHistory checkerId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3` → `200 success true`
- `POST /api/checker-read action=getActivityFormTargets checkerId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3` → `200 success true`

화면 QA:

- `checker / 1234` 로그인
- 체커 홈 정상
- 담당 대상자 목록 정상
- 대상자 상세 진입 정상
- 기록 작성 대상자 선택 정상
- 생활 확인 기록 작성 화면 정상
- 체커 활동 이력 정상
- 이상징후 보고 작성 진입 정상

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 생성하지 않음
- DB/SQL/RLS/Auth 수정하지 않음
- RPC 권한 revoke하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
- 아직 완료되지 않은 전환을 완료했다고 판단하지 않음
