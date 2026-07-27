# Supabase 권한 정리 1단계 완료

## 1. 작업 개요

Supabase RLS/권한 정리 1단계로, 주요 write 테이블에서 anon/authenticated role의 직접 write 권한을 제거했다.

이번 단계의 목적:

- 클라이언트 anon/authenticated role의 직접 write 가능성 축소
- 기존 Vercel serverless API + service_role 기반 write 구조 유지
- SELECT 권한은 유지하여 기존 read 화면 영향 최소화

이번 문서는 적용 결과를 기록하는 완료 문서이며, 추가 권한 변경이나 2단계 정리를 수행하지 않는다.

## 2. 적용 대상 테이블

1단계 권한 정리 대상:

- `public.activity_records`
- `public.admin_reports`
- `public.emergency_handling_logs`
- `public.emergency_reports`
- `public.organizations`
- `public.targets`

## 3. 제거한 권한

대상 role:

- `anon`
- `authenticated`

제거한 권한:

- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

의미:

- 브라우저 클라이언트에서 anon/authenticated 권한으로 위 테이블에 직접 write하는 경로를 차단했다.
- 현재 앱의 주요 write는 서버 API에서 service_role로 수행하므로 기존 write 구조와 맞는다.

## 4. 유지한 권한

이번 단계에서 유지한 권한:

- `service_role` 권한 유지
- `postgres` 권한 유지
- SELECT 권한 유지

SELECT 권한을 유지한 이유:

- read 화면 영향 최소화
- 클라이언트 Supabase read service와 RPC 사용 경로가 아직 남아 있음
- SELECT 최소화는 RLS policy 설계 후 별도 단계에서 진행해야 함

## 5. 실행 SQL

실행한 SQL:

```sql
revoke insert, update, delete, truncate on table public.activity_records from anon, authenticated;
revoke insert, update, delete, truncate on table public.admin_reports from anon, authenticated;
revoke insert, update, delete, truncate on table public.emergency_handling_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.emergency_reports from anon, authenticated;
revoke insert, update, delete, truncate on table public.organizations from anon, authenticated;
revoke insert, update, delete, truncate on table public.targets from anon, authenticated;
```

## 6. 적용 후 확인 SQL 결과 요약

확인 결과:

- anon/authenticated write 권한 확인 SQL 결과, 대상 테이블에서 write 권한 제거 확인
- service_role 권한 확인 결과, 대상 테이블에서 service_role 권한 유지 확인

service_role 권한 유지 확인 대상:

- `activity_records`
- `admin_reports`
- `emergency_handling_logs`
- `emergency_reports`
- `organizations`
- `targets`

확인된 service_role 권한:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`

이번 단계에서는 SELECT 권한을 별도로 제거하지 않았다.

## 7. API smoke test 결과

확인한 API:

```text
POST /api/targets {}
```

결과:

- `400 INVALID_ACTION`
- 정상

확인한 API:

```text
POST /api/reports action=listReports
```

결과:

- `200 OK`
- 정상

의미:

- 통합 API route가 정상 동작한다.
- service_role 기반 read/write API 구조가 유지되고 있다.

## 8. 현재 보안 상태 변화

개선된 점:

- 주요 write 대상 테이블에서 anon/authenticated 직접 write 권한이 제거됨
- 클라이언트가 실수로 직접 insert/update/delete/truncate를 수행할 가능성이 낮아짐
- 앱의 write 경로가 Vercel serverless API + service_role 구조로 더 명확해짐

유지된 점:

- 기존 서버 API write 기능 유지
- localStorage fallback 유지
- SELECT 권한 유지
- 기존 read 화면 영향 최소화

## 9. 남은 위험과 주의사항

아직 남은 위험:

- `users` SELECT 권한은 아직 anon/authenticated에 열려 있음
- `targets`, `admin_reports` 등 SELECT 권한도 아직 열려 있음
- RLS policy는 `users_select_own_profile` 외 대부분 미설계 상태
- `push_subscriptions`, `push_notification_logs` 권한 정리는 별도 단계로 분리됨
- service_role API와 클라이언트 read 경로가 혼재되어 있음

주의사항:

- SELECT 권한 최소화는 read 경로와 RLS policy를 확인한 뒤 진행해야 한다.
- RLS policy 없이 SELECT를 먼저 제거하면 화면 read가 깨질 수 있다.
- 2단계 권한 정리는 아직 완료되지 않았다.

## 10. 후속 과제

권장 후속 과제:

1. `users`, `targets`, `admin_reports` SELECT 권한 및 policy 설계
2. `push_subscriptions`, `push_notification_logs` 권한 정리
3. authenticated 조직/역할 기반 read policy 설계
4. RLS 적용 후 전체 QA 재실행
5. 운영 배포 전 보안 점검 문서화

후속 단계 전 확인:

- 클라이언트 Supabase read service 목록
- RPC별 반환 범위
- 조직/역할 기준 데이터 격리 정책
- Vercel serverless API가 사용하는 service_role 경로
- `docs/supabase-read-write-qa-checklist.md` 기준 전체 QA
