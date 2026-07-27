# 높은 위험 RPC EXECUTE 권한 정리 완료

## 1. 작업 개요

높은 위험 `get_public_*` RPC 6개에 대해 `PUBLIC` / `anon` EXECUTE 권한 제거를 Supabase SQL Editor에서 실행했다.

이번 정리는 총관리자/기관성 RPC가 클라이언트 anon 상태에서 직접 실행되는 위험을 줄이기 위한 단계다.

## 2. 대상 RPC

- `get_public_health_counts()`
- `get_public_organization_summaries()`
- `get_public_organization_detail(uuid)`
- `get_public_recent_emergency_summaries()`
- `get_public_super_dashboard_kpis()`
- `get_public_super_status_summaries()`

## 3. 실행 SQL

```sql
revoke execute on function public.get_public_health_counts() from public, anon;
revoke execute on function public.get_public_organization_summaries() from public, anon;
revoke execute on function public.get_public_organization_detail(uuid) from public, anon;
revoke execute on function public.get_public_recent_emergency_summaries() from public, anon;
revoke execute on function public.get_public_super_dashboard_kpis() from public, anon;
revoke execute on function public.get_public_super_status_summaries() from public, anon;
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

배포 후 `/api/super` smoke test 결과는 정상이다.

- `POST /api/super {}` → `400 INVALID_ACTION` 정상
- `POST /api/super action=getDashboardKpis` → `200 success true` 정상
- `POST /api/super action=getStatusSummaries` → `200 success true` 정상
- `POST /api/super action=getOrganizationSummaries` → `200 success true` 정상
- `POST /api/super action=getOrganizationDetail` → `200 success true` 정상
- `POST /api/super action=getRecentEmergencySummaries` → `200 success true` 정상
- `POST /api/super action=getHealthCounts` → `200 success true` 정상

## 6. 화면 QA 결과

`super_admin / 1234` 로그인 후 화면 QA 결과:

- 총관리자 대시보드 정상
- 기관 목록 정상
- 기관 상세 정상
- 기관 상태 목록 정상
- 최근 이상징후 요약 정상
- 화면 이상 없음

mock 로그인 상태에서도 `/api/super` 서버 API를 통해 read 흐름이 유지되는 것으로 확인했다.

## 7. 현재 보안 상태 변화

이번 정리로 높은 위험 총관리자/기관성 RPC는 더 이상 `PUBLIC` 또는 `anon`이 직접 실행할 수 없다.

현재 의미:

- 클라이언트 anon 직접 RPC 실행 위험 감소
- mock 로그인 상태에서도 `/api/super` 서버 API를 통해 화면 read 유지
- service_role 기반 서버 API read 구조 정상 동작 확인
- 높은 위험 RPC 권한 정리의 1차 목표 달성

## 8. 남은 위험

아직 남은 위험:

- `authenticated` EXECUTE는 유지되어 있음
- RPC 내부 `auth.uid()` 기반 조직/역할 검증은 별도 확인 필요
- 관리자 조직 단위 RPC와 체커 단위 RPC는 아직 클라이언트 직접 RPC 경로가 남아 있음
- 직접 table SELECT 권한과 RLS policy 정리는 아직 후속 단계
- `users` 등 개인정보성 테이블 SELECT/RLS policy 설계 필요

## 9. 후속 과제

1. `authenticated` EXECUTE 유지 여부 검토
2. 관리자 조직 단위 RPC 서버 API 전환 계획
3. 체커 단위 RPC 서버 API 전환 계획
4. 직접 table SELECT 권한 정리 계획
5. `users` SELECT/RLS policy 설계
6. 전체 QA 체크리스트 재실행

## 10. 이번 단계에서 하지 않은 것

- `authenticated` EXECUTE 제거하지 않음
- 함수 정의 수정하지 않음
- RLS policy 추가하지 않음
- SELECT 권한 revoke하지 않음
- 코드 수정하지 않음
- API 수정하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
