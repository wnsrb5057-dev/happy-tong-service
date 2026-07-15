# 해피통서비스 push_subscriptions 최종 SQL 초안

## 1. 문서 목적

이 문서는 해피통서비스의 PWA Web Push 알림 기능을 위해 `push_subscriptions` 테이블을 생성할 때 사용할 **최종 검토용 SQL 초안**입니다.

중요:

- 이 문서는 **Supabase SQL Editor에서 실행할 수 있도록 정리한 최종 초안 문서**입니다.
- 하지만 **실행 전에는 반드시 현재 DB 구조와 권한 상태를 다시 확인**해야 합니다.
- 이번 SQL은 **`push_subscriptions` 신규 테이블 생성**만 대상으로 합니다.
- 기존 `users`, `organizations`, `emergencies`, `activities` 테이블은 수정하지 않습니다.

관련 문서:

- [docs/pwa-push-notification-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-notification-plan.md)
- [docs/pwa-push-subscriptions-schema-plan.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-schema-plan.md)
- [docs/pwa-push-subscriptions-sql-draft.md](C:/Users/user/Desktop/AI/docs/pwa-push-subscriptions-sql-draft.md)
- [docs/pwa-push-db-structure-checklist.md](C:/Users/user/Desktop/AI/docs/pwa-push-db-structure-checklist.md)

---

## 2. 실행 전 주의사항

- Supabase SQL Editor에는 **SQL 코드블록 안의 SQL만 복사해서 실행**하세요.
- ````sql` / ``` ```` 같은 마크다운 문자는 붙여넣지 마세요.
- 실행 전 백업 또는 현재 상태 확인을 권장합니다.
- 이미 `push_subscriptions` 테이블이 있다면 바로 실행하지 말고 먼저 존재 여부를 확인해야 합니다.

사전 확인 권장:

1. `push_subscriptions` 테이블 존재 여부 확인
2. `public.set_updated_at()` 함수 존재 여부 확인
3. `public.users.role` 값 확인

---

## 3. 사전 존재 여부 확인 SQL

### 3-1. push_subscriptions 테이블 존재 여부 확인

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'push_subscriptions';
```

### 3-2. public.set_updated_at 함수 존재 여부 확인

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

### 3-3. public.users role 값 확인

```sql
select distinct role
from public.users
order by role;
```

---

## 4. push_subscriptions 테이블 생성 SQL

### 설계 기준

- `user_id`는 `public.users.id`를 기준으로 연결합니다.
- `organization_id`는 `public.organizations.id`를 기준으로 연결합니다.
- `auth_user_id`는 **1차에서는 FK를 걸지 않습니다.**

### auth_user_id FK를 제외하는 이유

- `auth.users` 직접 FK 연결은 Supabase auth 스키마 참조 정책을 더 신중히 검토해야 합니다.
- `public.users.auth_user_id`를 FK 대상으로 삼으려면 unique/nullable 구조를 다시 확정해야 합니다.
- 1차 MVP에서는 조회/추적용으로 값만 저장하고, FK는 추후 정책 확정 후 붙이는 편이 더 안전합니다.

### 실행 SQL 초안

```sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  -- 도메인 사용자 기준
  user_id uuid not null
    references public.users(id)
    on delete cascade,

  -- 인증 계정 기준
  -- 1차에서는 FK를 걸지 않고 값만 저장
  auth_user_id uuid null,

  -- 기관 단위 관리자 알림 발송 필터용
  organization_id uuid null
    references public.organizations(id)
    on delete set null,

  -- users.role 값과 정합성 유지 필요
  role text not null,

  -- Web Push subscription 핵심 값
  endpoint text not null,
  p256dh text not null,
  auth text not null,

  -- 운영/디버깅 보조 메타데이터
  user_agent text null,
  browser_name text null,
  device_type text null,

  -- 활성 구독 여부
  is_active boolean not null default true,

  -- 최근 발송 성공 또는 최근 사용 시각
  last_used_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 같은 endpoint는 중복 생성하지 않음
  constraint push_subscriptions_endpoint_key unique (endpoint),

  -- role 정합성 체크
  constraint push_subscriptions_role_check
    check (role in ('admin', 'checker', 'super_admin'))
);
```

메모:

- `super_admin`은 1차 알림 대상은 아니지만, `public.users.role` 값 정합성을 위해 허용합니다.
- `inactive` 사용자는 role이 아니라 발송 대상 조회 조건(`is_active`, 사용자 상태)에서 제외합니다.

---

## 5. 인덱스 생성 SQL

### 인덱스 설계 원칙

- `endpoint`는 unique constraint로 중복 방지
- 관리자 발송 조회는 `organization_id + role + is_active`
- 체커 발송 조회는 `user_id + is_active`

### 실행 SQL 초안

```sql
-- 사용자 기준 구독 조회
create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

-- 인증 사용자 기준 추적/검증 보조
create index if not exists idx_push_subscriptions_auth_user_id
  on public.push_subscriptions (auth_user_id);

-- 기관 기준 관리자 조회
create index if not exists idx_push_subscriptions_organization_id
  on public.push_subscriptions (organization_id);

-- 기관 + 역할 + 활성 상태 기준 관리자 발송 대상 조회
create index if not exists idx_push_subscriptions_org_role_active
  on public.push_subscriptions (organization_id, role, is_active);

-- 특정 사용자 활성 구독 조회
create index if not exists idx_push_subscriptions_user_active
  on public.push_subscriptions (user_id, is_active);

-- 활성 구독 공통 필터
create index if not exists idx_push_subscriptions_is_active
  on public.push_subscriptions (is_active);
```

인덱스 용도 요약:

- `user_id`: 사용자별 구독 조회
- `auth_user_id`: 인증 계정 기준 점검
- `organization_id`: 기관 관리자 조회
- `organization_id, role, is_active`: 관리자 알림 대상 최적화
- `user_id, is_active`: 체커/개별 사용자 활성 구독 조회
- `is_active`: 발송 가능 구독만 빠르게 필터

주의:

- `endpoint unique`는 이미 constraint에서 처리하므로, 별도 중복 unique index를 또 만들지 않습니다.

---

## 6. updated_at trigger 생성 SQL

### 설계 기준

- 기존 `public.set_updated_at()` 함수를 재사용합니다.
- 새 함수를 만들지 않습니다.
- trigger 이름은 `set_push_subscriptions_updated_at`를 권장합니다.

### 실행 SQL 초안

```sql
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();
```

주의:

- 실행 전 `public.set_updated_at()`가 실제로 존재하는지 다시 확인해야 합니다.
- 이미 같은 이름의 trigger가 있으면 먼저 상태를 점검해야 합니다.

---

## 7. RLS 활성화 SQL

### 설계 기준

- `push_subscriptions`는 민감한 브라우저 구독 정보이므로 RLS를 활성화합니다.
- 다만 1차 MVP에서는 클라이언트 직접 저장/조회가 아니라 **Vercel API + service_role** 방식이므로, 과도한 client policy는 만들지 않습니다.

### 실행 SQL 초안

```sql
alter table public.push_subscriptions enable row level security;
```

---

## 8. 권한 처리 방향

### 1차 최종 추천

- `anon` 권한 부여하지 않음
- `authenticated`에 전체 select 권한 부여하지 않음
- 발송 대상 조회는 전부 Vercel API + `service_role`에서 처리

### revoke SQL 후보

아래 SQL은 **참고용**입니다. 새 테이블 기준으로는 안전하지만, 실행 전 현재 권한 상태를 다시 확인해야 합니다.

```sql
revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
```

주의:

- 새 테이블 기준으로는 안전한 초기화 방향이지만, 실행 전 현재 grant 상태를 다시 확인해야 합니다.
- 이 권한 처리 방향은 “클라이언트가 직접 subscription 목록을 읽지 않는다”는 전제를 깔고 있습니다.

---

## 9. RLS policy 최종 방향

### 1차 MVP 권장 방향

- 일반 클라이언트는 `push_subscriptions` 목록을 직접 조회하지 않음
- 구독 저장은 `/api/push/subscribe`에서 `service_role`로 처리
- 알림 발송 대상 조회도 서버에서 `service_role`로 처리
- 따라서 1차에서는 **client select policy를 만들지 않는 방향**을 권장

### 정리

이번 최종 SQL 초안에서는:

- `RLS enable`까지만 포함
- client용 `select / insert / update` policy는 생성하지 않음

이유:

- 1차는 보안 우선
- 클라이언트가 endpoint / p256dh / auth 목록을 직접 다룰 필요가 없음
- API 경유 방식이 더 단순하고 안전함

---

## 10. 검증 SQL

아래 SQL은 테이블 생성 후 구조를 확인하기 위한 **SELECT 전용 검증 SQL**입니다.

### 10-1. 테이블 컬럼 확인

```sql
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'push_subscriptions'
order by ordinal_position;
```

### 10-2. 인덱스 확인

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'push_subscriptions'
order by indexname;
```

### 10-3. RLS 상태 확인

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
  and c.relname = 'push_subscriptions';
```

### 10-4. 권한 확인

```sql
select
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'push_subscriptions'
order by grantee, privilege_type;
```

### 10-5. trigger 확인

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
  and event_object_table = 'push_subscriptions'
order by trigger_name;
```

---

## 11. 롤백 참고 SQL

아래 SQL은 **실행하지 말고 참고용으로만 보관**합니다.

```sql
drop table public.push_subscriptions;
```

강한 주의:

- 실제 운영/테스트 데이터가 들어간 뒤에는 `drop table`이 큰 영향을 줄 수 있습니다.
- 이 문서에서는 실행용이 아니라 “최악의 경우 어떤 명령이 롤백 성격인지”를 참고로만 남깁니다.

---

## 12. 실행 순서

추천 순서:

1. 사전 확인 SQL 실행
2. `create table` 실행
3. index 생성
4. trigger 생성
5. RLS enable
6. revoke 방향 확인/적용
7. 검증 SQL 실행
8. 결과 캡처

### 실행 순서 메모

- `auth_user_id` FK는 이번 1차에서 제외하므로 추가 검토 없이 바로 시작 가능성이 높습니다.
- `policy`는 API 방식 확정 후 최소 범위로 나중에 적용하는 것을 권장합니다.

---

## 13. 다음 단계

이 SQL 적용 후 이어질 작업:

- VAPID 키 생성 방식 결정
- Vercel 환경변수 등록
- `/api/push/subscribe` 설계
- service worker 등록 설계
- 프론트 알림 권한 UI 설계
- 관리자 새 이상징후 알림 구현
- 체커 오후 5시 미작성 리마인드 구현

---

## 14. 최종 정리

이번 최종 초안의 핵심은 아래와 같습니다.

- `push_subscriptions`는 신규 테이블로만 생성
- `user_id`는 `public.users.id` FK 연결
- `auth_user_id`는 1차에서는 FK 없이 값만 저장
- `endpoint unique`로 중복 방지
- `public.set_updated_at()` 재사용
- RLS는 enable만 하고, client policy는 1차에서 만들지 않음
- 권한/조회는 Vercel API + `service_role` 중심으로 처리
