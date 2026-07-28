# Supabase Checker RPC EXECUTE Revoke Readiness

## 1. 작업 목적

체커 단위 `get_public_checker_*` RPC 4개에 대해 `PUBLIC`/`anon` `EXECUTE` 권한을 제거하기 전, 클라이언트 직접 RPC 호출이 남아 있는지 최종 확인한다.

이번 단계는 확인/문서화 단계이며, 코드 수정, DB/RLS/Auth 수정, 실제 권한 revoke 실행은 하지 않는다.

## 2. 확인 대상 RPC

- `get_public_checker_home(p_checker_id uuid)`
- `get_public_checker_targets(p_checker_id uuid)`
- `get_public_checker_activity_history(p_checker_id uuid)`
- `get_public_checker_activity_form_targets(p_checker_id uuid)`

현재 이 4개 RPC는 별도 `api/checker-read.js`가 아니라 기존 `api/checkers.js` read action으로 통합되어 있다.

`api/checkers.js` read action:

- `getHome`
- `getTargets`
- `getActivityHistory`
- `getActivityFormTargets`

## 3. src 직접 호출 잔여 확인

검색 대상:

- `get_public_checker_home`
- `get_public_checker_targets`
- `get_public_checker_activity_history`
- `get_public_checker_activity_form_targets`

확인 결과:

- `src` 내부에 위 RPC 문자열 잔여 없음
- `src/pages/checkerPages.jsx`에 직접 `supabase.rpc(...)` 호출 없음
- 대상 RPC 문자열은 `api/checkers.js` 내부 service_role RPC 호출에만 존재함

확인된 RPC 문자열 위치:

- `api/checkers.js`: `get_public_checker_home`
- `api/checkers.js`: `get_public_checker_targets`
- `api/checkers.js`: `get_public_checker_activity_history`
- `api/checkers.js`: `get_public_checker_activity_form_targets`

위 위치는 서버 API 내부 호출이므로 정상이다.

## 4. 지정 service 직접 RPC 제거 확인

확인 대상 파일:

- `src/services/supabaseCheckerHomeService.js`
- `src/services/supabaseCheckerTargetsService.js`
- `src/services/supabaseCheckerActivityHistoryService.js`
- `src/services/supabaseCheckerActivityFormTargetsService.js`

확인 결과:

- 위 4개 service에서 `.rpc(` 호출 없음
- 위 4개 service에서 `get_public_checker_` 문자열 없음
- 위 4개 service는 `/api/checkers`로 `POST` 요청을 보냄

서비스별 action:

- `supabaseCheckerHomeService.js` → `/api/checkers`, `action: "getHome"`
- `supabaseCheckerTargetsService.js` → `/api/checkers`, `action: "getTargets"`
- `supabaseCheckerActivityHistoryService.js` → `/api/checkers`, `action: "getActivityHistory"`
- `supabaseCheckerActivityFormTargetsService.js` → `/api/checkers`, `action: "getActivityFormTargets"`

주의:

- `supabaseCheckerActivityHistoryService.js`에는 RPC가 아닌 보강용 직접 table select가 남아 있다.
- 대상 테이블은 `targets`, `activity_records`이며, 이는 이번 RPC `EXECUTE` revoke 판단 대상은 아니지만 후속 SELECT/RLS 정리에서 별도 점검이 필요하다.

## 5. api/checkers 내부 RPC 호출 확인

`api/checkers.js`는 service_role 기반 Supabase client를 사용한다.

read action 처리:

- `getHome` → `supabase.rpc("get_public_checker_home", { p_checker_id: checkerId })`
- `getTargets` → `supabase.rpc("get_public_checker_targets", { p_checker_id: checkerId })`
- `getActivityHistory` → `supabase.rpc("get_public_checker_activity_history", { p_checker_id: checkerId })`
- `getActivityFormTargets` → `supabase.rpc("get_public_checker_activity_form_targets", { p_checker_id: checkerId })`

확인 결과:

- `api/checkers.js` 내부 RPC 호출은 정상
- `SUPABASE_SERVICE_ROLE_KEY`는 환경변수에서만 읽음
- service_role key를 응답이나 로그로 출력하지 않음
- request body 전체를 console에 출력하지 않음
- 오류 로그는 code/message 수준으로 제한됨

## 6. checkerPages 화면 흐름 확인

`src/pages/checkerPages.jsx`는 직접 `supabase.rpc(...)`를 호출하지 않고 아래 service 함수를 사용한다.

- `getSupabaseCheckerHome`
- `getSupabaseCheckerTargets`
- `getSupabaseCheckerActivityFormTargets`
- `getSupabaseCheckerActivityHistory`

확인된 호출 위치:

- 체커 홈: `getSupabaseCheckerHome(checkerSupabaseId)`
- 체커 담당 대상자 목록: `getSupabaseCheckerTargets(checkerSupabaseId)`
- 기록 작성 대상자 선택: `getSupabaseCheckerActivityFormTargets(checkerSupabaseId)`
- 체커 활동 이력: `getSupabaseCheckerActivityHistory(checkerSupabaseId)`

따라서 체커 화면은 `/api/checkers` 서버 API 경유 read로 전환된 상태다.

## 7. 권한 제거 가능성 판단

판단: `PUBLIC`/`anon` `EXECUTE` 제거 가능.

근거:

- `src`에서 대상 체커 RPC 직접 호출 없음
- 지정 4개 service에서 `.rpc(` 및 `get_public_checker_` 제거 확인
- 지정 4개 service가 `/api/checkers` fetch 기반으로 전환됨
- `api/checkers.js`에서만 service_role으로 대상 RPC 호출
- `checkerPages.jsx`에 직접 RPC 호출 없음
- 체커 화면 localStorage fallback 유지
- 배포 후 `/api/checkers` read action smoke test 통과 기록 있음
- `checker / 1234` 화면 QA 정상 기록 있음

보류가 필요한 조건은 현재 확인되지 않았다.

단, 직접 table select 잔여는 후속 SELECT/RLS 정리 단계에서 별도로 다뤄야 한다.

## 8. 실행 예정 SQL 초안

아래 SQL은 초안이며 이번 단계에서는 실행하지 않는다.

대상은 `PUBLIC`/`anon`만이다. `authenticated`, `postgres`, `service_role` 권한은 이번 단계에서 건드리지 않는다.

```sql
revoke execute on function public.get_public_checker_home(uuid) from public, anon;
revoke execute on function public.get_public_checker_targets(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_history(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_form_targets(uuid) from public, anon;
```

## 9. 확인 SQL 초안

실행 후 아래 SELECT로 권한 상태를 확인한다.

기대 결과:

- 위 4개 RPC에 대해 `PUBLIC`/`anon` `EXECUTE` 없음
- `authenticated`, `service_role`, `postgres`는 아직 남아 있을 수 있음

```sql
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_public_checker_home',
    'get_public_checker_targets',
    'get_public_checker_activity_history',
    'get_public_checker_activity_form_targets'
  )
order by routine_name, grantee;
```

함수 signature 확인용:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_public_checker_home',
    'get_public_checker_targets',
    'get_public_checker_activity_history',
    'get_public_checker_activity_form_targets'
  )
order by p.proname;
```

## 10. 롤백 SQL 초안

문제 발생 시 임시 복구용 SQL이다.

주의:

- 이 롤백은 화면 긴급 복구용 임시 조치다.
- 운영 전에는 다시 `PUBLIC`/`anon` 권한을 제거해야 한다.

```sql
grant execute on function public.get_public_checker_home(uuid) to public, anon;
grant execute on function public.get_public_checker_targets(uuid) to public, anon;
grant execute on function public.get_public_checker_activity_history(uuid) to public, anon;
grant execute on function public.get_public_checker_activity_form_targets(uuid) to public, anon;
```

## 11. Vercel 함수 개수 제한 대응 기록

처음 체커 read 전환은 `api/checker-read.js` 신규 API로 구현되었다.

하지만 Vercel Hobby 플랜의 Serverless Functions 12개 제한으로 배포가 실패했다.

해결:

- `api/checker-read.js` 삭제
- 기존 `api/checkers.js`에 read action 통합
- `/api/checkers` 단일 함수에서 create/update/updateStatus/read action을 함께 처리
- 4개 체커 read service는 `/api/checker-read` 대신 `/api/checkers`를 호출하도록 변경

이 구조로 추가 Serverless Function 없이 체커 read 서버 API 전환을 유지한다.

## 12. 권장 다음 단계

1. 이 문서를 검토한다.
2. 사용자가 승인하면 Supabase SQL Editor에서 `PUBLIC`/`anon` `EXECUTE` revoke SQL을 실행한다.
3. 실행 직후 확인 SQL을 수행한다.
4. `/api/checkers` smoke test를 재수행한다.
5. `checker / 1234` 로그인 후 화면 QA를 수행한다.
6. 문제가 없으면 완료 문서를 작성한다.
7. 후속으로 체커 read service의 직접 table select 잔여와 SELECT/RLS 정책을 별도 점검한다.

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 수정하지 않음
- DB/RLS/Auth 수정하지 않음
- 실제 RPC 권한 revoke 실행하지 않음
- `authenticated` EXECUTE 제거하지 않음
- `postgres`/`service_role` 권한 변경하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- 권한 정리를 완료했다고 판단하지 않음
