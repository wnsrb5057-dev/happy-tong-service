# PWA Push Notification Logs 최종 SQL

## 문서 목적

이 문서는 Supabase SQL Editor에 붙여넣어 실행할 수 있도록 정리한 `push_notification_logs` 최종 SQL 문서입니다.

용도:

- `public.push_notification_logs` 테이블 생성
- 일반 인덱스 생성
- partial unique index 생성
- RLS 활성화
- `anon`, `authenticated` 권한 제한

중요:

- 이 문서는 **실행 전 검토본**입니다.
- 실제 실행 전 현재 DB 구조와 외래 키 참조 대상이 맞는지 다시 확인해야 합니다.

## 실행 전 확인사항

아래 테이블이 이미 존재해야 합니다.

- `public.users`
- `public.organizations`
- `public.push_subscriptions`

특히 아래 항목을 다시 확인합니다.

- `public.users.id`
- `public.organizations.id`
- `public.push_subscriptions.id`
- `gen_random_uuid()` 사용 가능 여부

## 최종 실행 SQL

아래 블록은 설명 없이 SQL Editor에 바로 붙여넣을 수 있는 순수 SQL입니다.

```sql
create table if not exists public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  target_user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  related_entity_type text null,
  related_entity_id uuid null,
  sent_date date not null,
  title text not null,
  body text not null,
  url text null,
  status text not null,
  error_code text null,
  error_message text null,
  subscription_id uuid null references public.push_subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint push_notification_logs_notification_type_check
    check (
      notification_type in (
        'checker_daily_reminder',
        'admin_new_emergency',
        'admin_unresolved_emergency_reminder'
      )
    ),
  constraint push_notification_logs_status_check
    check (
      status in (
        'pending',
        'sent',
        'failed',
        'skipped'
      )
    )
);

create index if not exists idx_push_notification_logs_target_user_id
  on public.push_notification_logs (target_user_id);

create index if not exists idx_push_notification_logs_organization_id
  on public.push_notification_logs (organization_id);

create index if not exists idx_push_notification_logs_notification_type
  on public.push_notification_logs (notification_type);

create index if not exists idx_push_notification_logs_sent_date
  on public.push_notification_logs (sent_date);

create index if not exists idx_push_notification_logs_status
  on public.push_notification_logs (status);

create index if not exists idx_push_notification_logs_related_entity
  on public.push_notification_logs (related_entity_type, related_entity_id);

create index if not exists idx_push_notification_logs_created_at_desc
  on public.push_notification_logs (created_at desc);

create unique index if not exists uq_push_notification_logs_checker_daily_reminder
  on public.push_notification_logs (notification_type, target_user_id, sent_date)
  where notification_type = 'checker_daily_reminder';

create unique index if not exists uq_push_notification_logs_admin_new_emergency
  on public.push_notification_logs (
    notification_type,
    target_user_id,
    related_entity_type,
    related_entity_id
  )
  where notification_type = 'admin_new_emergency'
    and related_entity_type is not null
    and related_entity_id is not null;

create unique index if not exists uq_push_notification_logs_admin_unresolved_reminder
  on public.push_notification_logs (notification_type, target_user_id, sent_date)
  where notification_type = 'admin_unresolved_emergency_reminder';

alter table public.push_notification_logs enable row level security;

revoke all on public.push_notification_logs from anon;
revoke all on public.push_notification_logs from authenticated;
```

## 실행 후 확인 SQL

아래 SQL은 실행 후 상태를 점검하기 위한 확인용 SQL입니다.

### 1. 테이블 존재 확인

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'push_notification_logs';
```

### 2. 컬럼 목록 확인

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'push_notification_logs'
order by ordinal_position;
```

### 3. 인덱스 확인

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'push_notification_logs'
order by indexname;
```

### 4. RLS 활성화 확인

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'push_notification_logs';
```

### 5. 권한 확인

```sql
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'push_notification_logs'
order by grantee, privilege_type;
```

## 주의사항

- 이 문서의 SQL은 Supabase SQL Editor에서 수동 실행합니다.
- 실행 전 전체 SQL을 검토합니다.
- 실행 중 실패하면 에러 메시지를 캡처해서 원인을 확인합니다.
- 이 작업은 운영용 알림 이력 테이블 추가이며, 기존 서비스 운영 데이터에 영향을 주지 않아야 합니다.
- 이 테이블은 `push_subscriptions`와 별개이며, `endpoint`, `p256dh`, `auth` 같은 구독 민감값을 직접 저장하지 않습니다.
