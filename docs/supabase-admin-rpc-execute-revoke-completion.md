# 관리자 RPC EXECUTE 권한 정리 완료

## 1. 작업 개요

관리자 조직 단위 `get_public_admin_*` RPC 6개에 대해 `PUBLIC` / `anon` EXECUTE 권한 제거를 Supabase SQL Editor에서 실행했다.

이번 정리는 관리자 조직 단위 RPC가 클라이언트 anon 상태에서 직접 실행되는 위험을 줄이기 위한 단계다.

## 2. 대상 RPC

- `get_public_admin_dashboard(uuid)`
- `get_public_admin_targets(uuid)`
- `get_public_admin_emergencies(uuid)`
- `get_public_admin_activity_records(uuid)`
- `get_public_admin_statistics(uuid)`
- `get_public_admin_report_summary(uuid)`

## 3. 실행 SQL

```sql
revoke execute on function public.get_public_admin_dashboard(uuid) from public, anon;
revoke execute on function public.get_public_admin_targets(uuid) from public, anon;
revoke execute on function public.get_public_admin_emergencies(uuid) from public, anon;
revoke execute on function public.get_public_admin_activity_records(uuid) from public, anon;
revoke execute on function public.get_public_admin_statistics(uuid) from public, anon;
revoke execute on function public.get_public_admin_report_summary(uuid) from public, anon;
```

## 4. 권한 확인 결과

확인 SQL 결과, 위 6개 RPC에 대해 남은 EXECUTE grantee는 아래와 같다.

- `authenticated`
- `postgres`
- `service_role`

제거된 grantee:

- `PUBLIC`
- `anon`

이번 단계에서는 `authenticated` EXECUTE를 제거하지 않았다.

## 5. API smoke test 결과

배포 후 `/api/admin-read` smoke test 결과는 정상이다.

- `POST /api/admin-read {}` → `400 INVALID_ACTION` 또는 `MISSING_ORGANIZATION_ID` 정상
- `POST /api/admin-read action=getDashboard` → `200 success true` 정상
- `POST /api/admin-read action=getTargets` → `200 success true` 정상
- `POST /api/admin-read action=getEmergencies` → `200 success true` 정상
- `POST /api/admin-read action=getActivityRecords` → `200 success true` 정상
- `POST /api/admin-read action=getStatistics` → `200 success true` 정상
- `POST /api/admin-read action=getReportSummary` → `200 success true` 정상

## 6. 현재 보안 상태 변화

이번 정리로 관리자 조직 단위 RPC는 더 이상 `PUBLIC` 또는 `anon`이 직접 실행할 수 없다.

현재 의미:

- 클라이언트 anon 직접 관리자 RPC 실행 위험 감소
- mock 로그인 상태에서도 `/api/admin-read` 서버 API를 통해 관리자 read 유지 가능
- service_role 기반 서버 API read 구조 정상 동작 확인
- 관리자 조직 단위 RPC 권한 정리의 1차 목표 달성

## 7. 남은 위험

아직 남은 위험:

- `authenticated` EXECUTE는 유지되어 있음
- RPC 내부 `auth.uid()` 기반 조직/역할 검증은 별도 확인 필요
- 체커 단위 RPC는 아직 후속 정리 대상
- 직접 table SELECT 권한과 RLS policy 정리는 아직 후속 단계
- `users` 등 개인정보성 테이블 SELECT/RLS policy 설계 필요

## 8. 후속 과제

1. 관리자 화면 브라우저 QA 결과 최종 기록
2. 체커 단위 RPC 서버 API 전환 계획
3. 체커 단위 RPC `PUBLIC` / `anon` EXECUTE 제거 준비
4. 직접 table SELECT 권한 정리 계획
5. `users` SELECT/RLS policy 설계
6. `authenticated` EXECUTE 유지 여부 검토
7. 전체 QA 체크리스트 재실행

## 9. 이번 단계에서 하지 않은 것

- `authenticated` EXECUTE 제거하지 않음
- 함수 정의 수정하지 않음
- RLS policy 추가하지 않음
- SELECT 권한 revoke하지 않음
- 코드 수정하지 않음
- API 수정하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
