# Supabase RPC 권한 정리 계획

## 1. 작업 목적

`get_public_*` RPC 함수의 현재 EXECUTE 권한 위험과 정리 방향을 문서화한다.

이번 단계는 계획 문서 작성만 수행한다. 실제 `REVOKE`, 함수 수정, RLS policy 추가, 코드 수정은 하지 않는다.

## 2. 확인된 RPC 권한 상태

사용자 확인 결과, 대부분의 `get_public_*` RPC에 아래 grantee가 `EXECUTE` 권한을 가지고 있다.

- `PUBLIC`
- `anon`
- `authenticated`
- `postgres`
- `service_role`

또한 대부분의 `get_public_*` RPC가 `SECURITY DEFINER`로 생성되어 있다. 즉 호출자의 권한이 아니라 함수 소유자의 권한으로 실행될 수 있다.

현재 구조에서는 클라이언트가 anon key로 RPC를 직접 호출하는 경로가 남아 있다. 따라서 SELECT grants를 정리해도 RPC가 우회 조회 경로로 남을 수 있다.

## 3. RPC 위험도 분류

### A. 높은 위험: 전체/슈퍼 관리자성 RPC

대상:

- `get_public_health_counts()`
- `get_public_organization_summaries()`
- `get_public_organization_detail(p_organization_id uuid)`
- `get_public_recent_emergency_summaries()`
- `get_public_super_dashboard_kpis()`
- `get_public_super_status_summaries()`

위험 이유:

- 인자 없이 전체 기관 또는 전체 상태 요약을 반환할 수 있다.
- 슈퍼 관리자 화면용 데이터에 가까운 RPC가 anon에서 호출 가능하면 운영 데이터 노출 위험이 크다.
- `SECURITY DEFINER`이면 테이블 SELECT 권한을 줄여도 함수 경로가 남을 수 있다.

### B. 중간~높은 위험: 관리자 조직 단위 RPC

대상:

- `get_public_admin_dashboard(p_organization_id uuid)`
- `get_public_admin_targets(p_organization_id uuid)`
- `get_public_admin_emergencies(p_organization_id uuid)`
- `get_public_admin_activity_records(p_organization_id uuid)`
- `get_public_admin_statistics(p_organization_id uuid)`
- `get_public_admin_report_summary(p_organization_id uuid)`

위험 이유:

- `p_organization_id`만 알면 조직 단위 데이터를 조회할 수 있다.
- 함수 내부에서 `auth.uid()`와 `public.users`를 연결해 해당 사용자가 해당 조직의 관리자인지 검증하지 않으면 조직 간 조회 위험이 있다.

### C. 중간 위험: 체커 단위 RPC

대상:

- `get_public_checker_home(p_checker_id uuid)`
- `get_public_checker_targets(p_checker_id uuid)`
- `get_public_checker_activity_history(p_checker_id uuid)`
- `get_public_checker_activity_form_targets(p_checker_id uuid)`

위험 이유:

- `p_checker_id`만 알면 체커 배정 대상자와 기록을 조회할 수 있다.
- 함수 내부에서 `auth.uid()`와 `public.users.auth_user_id`를 매핑해 본인 체커인지 확인하지 않으면 타 체커 데이터 조회 위험이 있다.

## 4. 권한 정리 기본 원칙

- `PUBLIC EXECUTE`는 제거하는 방향을 기본으로 한다.
- `anon EXECUTE`는 원칙적으로 제거한다.
- `authenticated EXECUTE`는 역할/조직/본인 검증이 없는 RPC에서는 바로 유지하지 않는다.
- `service_role`과 `postgres` 권한은 유지한다.
- 화면이 깨지는 것을 막으려면 클라이언트 직접 RPC를 서버 API로 옮기거나, RPC 내부에 auth 검증을 추가한 뒤 권한을 제한해야 한다.
- mock 로그인은 Supabase Auth session이 없을 수 있으므로 anon EXECUTE 제거 시 영향이 크다.

## 5. 정리 방식 후보 비교

### A안: PUBLIC/anon EXECUTE 제거, authenticated 유지

장점:

- anon 공개 호출 위험을 빠르게 줄일 수 있다.

단점:

- authenticated 사용자가 다른 `organization_id` 또는 `checker_id`를 넣어 호출하는 문제는 남는다.
- RPC 내부 auth 검증이 없으면 충분하지 않다.

### B안: RPC 내부에 auth.uid() 기반 권한 검증 추가

장점:

- 역할, 조직, 본인 기준 제한이 가능하다.
- RLS와 유사한 수준의 접근 제한을 함수 내부에서 구현할 수 있다.

단점:

- 함수 정의 수정 범위가 크다.
- 모든 RPC별 검증 로직을 개별 확인해야 한다.

### C안: 주요 read를 서버 API로 전환하고 RPC EXECUTE는 service_role 중심으로 제한

장점:

- 권한 통제 위치를 서버 API로 일원화할 수 있다.
- 현재 write 구조와 일관성이 높다.

단점:

- API 구현 범위가 커질 수 있다.
- Vercel Hobby 플랜의 Serverless Function 개수 제한을 계속 고려해야 한다.

추천:

- 단계적으로 진행한다.
- 1차로 PUBLIC/anon EXECUTE 제거 후보를 문서화한다.
- 2차로 전체/슈퍼 관리자성 RPC부터 서버 API 전환 또는 authenticated 제한을 검토한다.
- 3차로 관리자/체커 RPC에 auth 검증 추가 또는 서버 API 전환을 검토한다.

## 6. 1단계 RPC 권한 정리 후보

가장 먼저 검토할 후보:

- `PUBLIC EXECUTE` 제거
- `anon EXECUTE` 제거

우선 검토 대상:

- 전체/슈퍼 관리자성 RPC
- 인자가 없거나 전체 요약을 반환하는 RPC

주의:

- 현재 mock 로그인은 Supabase Auth authenticated session이 없을 수 있다.
- mock 로그인 상태에서 클라이언트가 anon key로 RPC를 호출한다면 anon EXECUTE 제거 후 화면 read가 깨질 수 있다.
- 따라서 실제 적용 전 브라우저 세션과 네트워크 요청의 인증 상태를 먼저 확인해야 한다.

## 7. SQL 초안

아래 SQL은 실행하지 않는 초안이다. 실제 적용 전 함수 signature를 Supabase SQL Editor에서 다시 확인해야 한다.

### 높은 위험 RPC 우선 초안

```sql
revoke execute on function public.get_public_health_counts() from public, anon;
revoke execute on function public.get_public_organization_summaries() from public, anon;
revoke execute on function public.get_public_recent_emergency_summaries() from public, anon;
revoke execute on function public.get_public_super_dashboard_kpis() from public, anon;
revoke execute on function public.get_public_super_status_summaries() from public, anon;
revoke execute on function public.get_public_organization_detail(uuid) from public, anon;
```

### 관리자 조직 단위 RPC 초안

```sql
revoke execute on function public.get_public_admin_dashboard(uuid) from public, anon;
revoke execute on function public.get_public_admin_targets(uuid) from public, anon;
revoke execute on function public.get_public_admin_emergencies(uuid) from public, anon;
revoke execute on function public.get_public_admin_activity_records(uuid) from public, anon;
revoke execute on function public.get_public_admin_statistics(uuid) from public, anon;
revoke execute on function public.get_public_admin_report_summary(uuid) from public, anon;
```

### 체커 단위 RPC 초안

```sql
revoke execute on function public.get_public_checker_home(uuid) from public, anon;
revoke execute on function public.get_public_checker_targets(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_history(uuid) from public, anon;
revoke execute on function public.get_public_checker_activity_form_targets(uuid) from public, anon;
```

### 확인 SQL

```sql
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name like 'get_public_%'
order by routine_name, grantee;
```

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'get_public_%'
order by p.proname;
```

## 8. 적용 전 필수 확인

적용 전 반드시 확인할 항목:

- 현재 클라이언트가 anon 상태에서 RPC를 호출하는지
- 로그인 후 authenticated session으로 RPC를 호출하는지
- mock 로그인 사용 시 Supabase Auth session이 존재하는지
- anon EXECUTE 제거 시 관리자/체커/슈퍼 관리자 화면 read가 깨지는지
- 서버 API로 이미 대체된 read 경로와 아직 클라이언트 RPC에 의존하는 read 경로
- RPC 함수 내부에서 organization/user 권한 검증이 있는지

## 9. mock 로그인 영향

현재 프로젝트는 `admin / 1234` 같은 mock 로그인을 유지하고 있다.

mock 로그인은 Supabase Auth authenticated session이 없을 가능성이 있다. 이 경우 클라이언트 RPC 호출은 anon key 기반으로 실행될 수 있다.

따라서 anon EXECUTE를 제거하면 mock 로그인 화면의 RPC read가 깨질 수 있다.

해결 방향:

- read RPC를 서버 API로 감싼다.
- 또는 mock 로그인도 Supabase Auth session을 사용하도록 바꾼다.
- 또는 RLS/RPC 정리 전까지 anon EXECUTE 제거를 보류한다.

## 10. 추천 다음 단계

바로 SQL을 실행하지 않는다.

다음 단계:

1. 브라우저 로그인 상태에서 Supabase session 존재 여부를 확인한다.
2. 네트워크 탭에서 RPC 호출이 anon인지 authenticated인지 확인한다.
3. mock 로그인 상태에서 RPC read 의존 화면을 정리한다.
4. 높은 위험 RPC부터 서버 API 전환 또는 authenticated 제한 계획을 세운다.
5. 함수별 auth 검증 추가가 필요한지 검토한다.
6. 적용 전 QA 체크리스트를 만든 뒤 단계적으로 revoke한다.

## 11. 이번 단계에서 하지 않는 것

- RPC 권한 revoke 실행하지 않음
- 함수 정의 수정하지 않음
- 코드 수정하지 않음
- API 수정하지 않음
- DB/RLS/Auth 수정하지 않음
- package.json 수정하지 않음
- package-lock.json 수정하지 않음
- vercel.json 수정하지 않음
- 권한 정리를 완료했다고 판단하지 않음
