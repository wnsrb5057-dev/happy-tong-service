# 해피통서비스 PWA Push DB 구조 확인 체크리스트

## 1. 문서 목적

이 문서는 `push_subscriptions` 테이블을 실제로 만들기 전에, 현재 Supabase DB 구조가 기존 SQL 초안과 맞는지 확인하기 위한 **조회 전용 체크리스트**입니다.

중요:

- 이 문서는 **DB 변경용이 아니라 확인용**입니다.
- 이 문서의 SQL은 모두 **SELECT 또는 정보 조회용**입니다.
- 이 문서의 실행 결과를 바탕으로, 이후 `push_subscriptions` 실제 SQL 초안을 수정할 예정입니다.

실행 전 주의:

- Supabase SQL Editor에는 이 문서 전체를 붙여넣지 말고, **각 항목의 SQL 코드블록 안 내용만 실행**하세요.
- 이 문서에는 `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`가 포함되지 않습니다.

관련 문서:

- [docs/pwa-push-notification-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-notification-plan.md)
- [docs/pwa-push-subscriptions-schema-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-schema-plan.md)
- [docs/pwa-push-subscriptions-sql-draft.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-sql-draft.md)
- [docs/supabase-users-schema-plan.md](C:/Users/user/Desktop/AI/docs/supabase-users-schema-plan.md)
- [docs/supabase-auth-user-mapping-strategy.md](C:/Users/user/Desktop/AI/docs/supabase-auth-user-mapping-strategy.md)

---

## 2. public.users 컬럼 확인 SQL

### 무엇을 확인하는가

- `id` 컬럼 타입
- `auth_user_id` 컬럼 존재 여부와 타입
- `organization_id` 컬럼 존재 여부와 타입
- `role` 컬럼 존재 여부와 타입
- `email`, `status`, `name`, `username` 등 기존 사용자 컬럼 구조

### 실행 SQL

```sql
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
order by ordinal_position;
```

---

## 3. public.users role 값 확인 SQL

### 무엇을 확인하는가

- 현재 `role` 컬럼에 어떤 값이 들어있는지
- `admin`, `checker`, `super_admin` 값이 실제로 존재하는지
- 향후 `push_subscriptions.role` check 조건과 맞는지

### 실행 SQL

```sql
select distinct role
from public.users
order by role;
```

---

## 4. public.users auth_user_id 매핑 상태 확인 SQL

### 무엇을 확인하는가

- `auth_user_id`가 `null`인 사용자가 있는지
- active 사용자들의 `auth_user_id` 매핑 상태
- `email`, `status`, `role`, `organization_id`를 함께 볼 때 구조가 맞는지

### 실행 SQL

```sql
select
  id,
  username,
  name,
  role,
  organization_id,
  auth_user_id,
  email,
  status
from public.users
order by role, username;
```

### 추가 확인용 SQL

```sql
select
  role,
  status,
  count(*) as user_count,
  count(auth_user_id) as mapped_auth_user_count
from public.users
group by role, status
order by role, status;
```

---

## 5. public.organizations 테이블 확인 SQL

### 무엇을 확인하는가

- `public.organizations` 테이블 존재 여부
- `id` 컬럼 타입
- `name` 또는 `organization_name` 관련 컬럼 구조

### 테이블 존재 여부 확인 SQL

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'organizations';
```

### 컬럼 구조 확인 SQL

```sql
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'organizations'
order by ordinal_position;
```

---

## 6. 기존 updated_at 함수 확인 SQL

### 무엇을 확인하는가

- `public.set_updated_at` 함수가 이미 있는지
- `updated_at` 자동 갱신용 함수가 다른 이름으로 존재하는지

### 특정 함수명 확인 SQL

```sql
select
  routine_schema,
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'set_updated_at';
```

### updated_at 관련 함수 후보 넓게 확인 SQL

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%updated_at%'
    or p.proname ilike '%set_updated%'
    or p.proname ilike '%touch%'
  )
order by p.proname;
```

---

## 7. 기존 trigger 확인 SQL

### 무엇을 확인하는가

- `public.users` 또는 다른 테이블에 `updated_at` 관련 trigger가 이미 있는지
- 기존 함수명을 재사용할 수 있는지

### information_schema.triggers 기준 확인 SQL

```sql
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name;
```

### pg_trigger 기준 상세 확인 SQL

```sql
select
  n.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_catalog.pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c
  on c.oid = t.tgrelid
join pg_namespace n
  on n.oid = c.relnamespace
join pg_proc p
  on p.oid = t.tgfoid
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;
```

---

## 8. 현재 RLS 상태 확인 SQL

### 무엇을 확인하는가

- `public.users`의 RLS 활성화 여부
- 향후 `push_subscriptions`에도 RLS를 적용할 때 참고할 현재 상태

### public.users RLS 상태 확인 SQL

```sql
select
  schemaname,
  tablename,
  rowsecurity,
  hasrules
from pg_tables
where schemaname = 'public'
  and tablename = 'users';
```

### public 스키마 전체 RLS 상태 참고 SQL

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
```

---

## 9. 현재 public.users 권한 확인 SQL

### 무엇을 확인하는가

- `anon`, `authenticated` 권한 상태
- 향후 `push_subscriptions`에 어떤 권한을 주면 안 되는지 판단할 기준
- `service_role`은 일반적으로 여기서 직접 보이지 않을 수 있으므로 참고 수준으로 확인

### 실행 SQL

```sql
select
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'users'
order by grantee, privilege_type;
```

### public 스키마 전체 권한 참고 SQL

```sql
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;
```

---

## 10. auth.users 직접 참조 가능성 주의사항

### 정리

- `auth.users`는 Supabase 내부 `auth` 스키마에 속합니다.
- 따라서 FK를 `auth.users.id`로 직접 거는 설계는 실행 전에 신중히 확인해야 합니다.
- 현재 해피통서비스는 `public.users.auth_user_id`를 이미 사용하고 있으므로, `push_subscriptions`에서는 우선 `public.users.auth_user_id`와 비교/검증하는 방식이 더 안전할 수 있습니다.

### 확인용 참고 SQL

아래 SQL은 `auth.users`를 직접 수정하지 않고, 접근 가능 여부를 확인하는 참고용입니다.

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'auth'
  and table_name = 'users';
```

주의:

- 이 결과가 보인다고 해서 바로 FK를 걸어도 된다는 뜻은 아닙니다.
- 실제 참조 가능성, 권한, 운영 정책은 별도 검토가 필요합니다.

---

## 11. 실행 결과를 복사해올 때 필요한 항목

Supabase SQL Editor에서 실행 후 아래 결과를 공유하면, 다음 단계에서 `push_subscriptions` 실제 SQL 초안을 더 안전하게 수정할 수 있습니다.

공유 필요 결과:

- `public.users` 컬럼 목록
- `distinct role` 값
- `users / auth_user_id` 매핑 결과
- `organizations` 테이블 존재 여부와 컬럼 결과
- `updated_at` 함수 존재 여부
- trigger 목록
- RLS 상태
- `public.users` 권한 상태

권장 공유 방식:

- SQL 실행 결과 표를 그대로 복사
- 또는 캡처 이미지 + 핵심 컬럼명/값 텍스트 정리

---

## 12. 주의사항

- 이 문서의 SQL은 **SELECT만 포함**합니다.
- `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`는 포함하지 않습니다.
- Supabase SQL Editor에 붙여넣을 때는 **마크다운 제목/설명은 제외하고 SQL 코드블록 안 내용만 실행**하세요.
- 이 결과를 바탕으로 다음 단계에서 실제 `push_subscriptions` SQL을 수정할 예정입니다.

---

## 13. 실행 순서 제안

초보자도 따라가기 쉽게, 아래 순서대로 실행하는 것을 권장합니다.

1. `public.users` 컬럼 확인
2. `public.users` role 값 확인
3. `public.users`의 `auth_user_id` 매핑 상태 확인
4. `public.organizations` 존재 여부 및 컬럼 확인
5. `updated_at` 함수 확인
6. trigger 확인
7. RLS 상태 확인
8. `public.users` 권한 확인
9. 필요 시 `auth.users` 존재 여부 참고 확인

이 순서로 보면:

- 사용자 구조 확인
- 기관 구조 확인
- 트리거/함수 재사용 가능성 확인
- 권한/RLS 전제 확인

까지 한 번에 점검할 수 있습니다.
