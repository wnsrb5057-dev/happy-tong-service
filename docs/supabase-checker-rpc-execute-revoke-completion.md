# Supabase Checker RPC EXECUTE Revoke Completion

## 1. 작업 개요

체커 단위 `get_public_checker_*` RPC 4개에 대해 `PUBLIC`/`anon` `EXECUTE` 권한 제거를 완료했다.

이번 문서는 Supabase SQL Editor에서 권한 제거 SQL을 실행한 결과와 API/화면 검증 결과를 기록한다.

## 2. 대상 RPC

- `get_public_checker_home(uuid)`
- `get_public_checker_targets(uuid)`
- `get_public_checker_activity_history(uuid)`
- `get_public_checker_activity_form_targets(uuid)`

## 3. 실행 SQL

```sql
revoke execute on function public.get_public_checker_home(uuid) from public, anon;
revoke execute on function public.get_public_checker_targets(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_history(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_form_targets(uuid) from public, anon;
```

## 4. 권한 확인 결과

위 4개 RPC에 대해 남은 `EXECUTE` grantee:

- `authenticated`
- `postgres`
- `service_role`

제거된 grantee:

- `PUBLIC`
- `anon`

## 5. API smoke test 결과

- `POST /api/checkers {}` → 400 계열 JSON 응답 정상
- `POST /api/checkers action=getHome` → 200 `success: true` 정상
- `POST /api/checkers action=getTargets` → 200 `success: true` 정상
- `POST /api/checkers action=getActivityHistory` → 200 `success: true` 정상
- `POST /api/checkers action=getActivityFormTargets` → 200 `success: true` 정상

## 6. 화면 QA 결과

`checker / 1234` 로그인 후 아래 화면 흐름이 정상 동작함을 확인했다.

- 체커 홈 정상
- 담당 대상자 목록 정상
- 대상자 상세 진입 정상
- 기록 작성 대상자 선택 정상
- 생활 확인 기록 작성 화면 정상
- 체커 활동 이력 정상
- 이상징후 보고 작성 진입 정상

## 7. Vercel 함수 제한 대응 기록

처음 체커 read 서버 API 전환은 `api/checker-read.js` 신규 API로 구현되었다.

하지만 Vercel Hobby 플랜의 Serverless Functions 12개 제한으로 배포가 실패했다.

최종 대응:

- `api/checker-read.js` 삭제
- 기존 `api/checkers.js`에 read action 통합
- `/api/checkers`에서 기존 write action과 체커 read action을 함께 처리
- 최종 smoke test는 `/api/checkers` 기준으로 통과

현재 `api/checkers.js` read action:

- `getHome`
- `getTargets`
- `getActivityHistory`
- `getActivityFormTargets`

## 8. 현재 보안 상태 변화

- 체커 단위 RPC는 더 이상 `PUBLIC`/`anon`이 직접 실행할 수 없음
- mock 로그인 상태에서도 `/api/checkers` 서버 API를 통해 체커 read 유지 가능
- service_role 기반 서버 API 구조가 정상 동작함
- 클라이언트의 직접 RPC 실행 의존도를 줄임

## 9. 남은 위험

- `authenticated` `EXECUTE`는 아직 유지됨
- 함수 정의 자체는 수정하지 않음
- RLS policy는 추가하지 않음
- SELECT 권한은 revoke하지 않음
- 체커 활동 이력 service에는 후속 점검이 필요한 직접 table select 경로가 남아 있음

## 10. 후속 과제

1. 체커 활동 이력 service의 직접 table select 후속 점검
2. 직접 table SELECT 권한 정리 계획 수립
3. `users` SELECT/RLS policy 설계
4. `authenticated` EXECUTE 유지 여부 검토
5. 전체 QA 체크리스트 재실행
6. 운영 배포 전 보안 점검 문서화

## 11. 이번 단계에서 하지 않은 것

- `authenticated` EXECUTE 제거하지 않음
- 함수 정의 수정하지 않음
- RLS policy 추가하지 않음
- SELECT 권한 revoke하지 않음
- 코드 수정하지 않음
- API 수정하지 않음
- DB/SQL/RLS/Auth 직접 수정하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
