# Supabase Activity Records DB Checklist

## 문서 목적

이 문서는 생활 확인 기록 write 전환 전에 Supabase SQL Editor에서 실행할 **SELECT 전용 점검 SQL**을 정리한 체크리스트입니다.

중요:

- 이 문서의 SQL은 **SELECT / 조회 전용**입니다.
- `create / alter / insert / update / delete / drop`는 포함하지 않습니다.
- 실행 결과를 보고 다음 단계에서 테이블 생성 또는 수정 여부를 결정합니다.

## 1. 활동 기록 후보 테이블 확인

활동 기록성 테이블이 이미 있는지 먼저 점검합니다.

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'check_records',
    'visit_records',
    'care_records',
    'records',
    'activities'
  )
order by table_name;
```

## 2. 관련 테이블 목록 확인

`users`, `organizations`, `targets`, `seniors`, `checkers`, `activity` 계열 테이블을 함께 봅니다.

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name in ('users', 'organizations', 'targets', 'seniors', 'checkers')
    or table_name like '%activity%'
    or table_name like '%record%'
    or table_name like '%check%'
    or table_name like '%visit%'
    or table_name like '%care%'
  )
order by table_name;
```

## 3. 후보 테이블 컬럼 확인

후보 테이블이 존재하는 경우 컬럼 구조를 확인합니다.

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'check_records',
    'visit_records',
    'care_records',
    'records',
    'activities'
  )
order by table_name, ordinal_position;
```

## 4. FK 확인

활동 기록 후보 테이블에 어떤 외래 키가 연결되어 있는지 확인합니다.

```sql
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in (
    'activity_records',
    'check_records',
    'visit_records',
    'care_records',
    'records',
    'activities'
  )
order by tc.table_name, kcu.column_name;
```

## 5. 권한 확인

후보 테이블의 권한 상태를 확인합니다.

```sql
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'activity_records',
    'check_records',
    'visit_records',
    'care_records',
    'records',
    'activities'
  )
order by table_name, grantee, privilege_type;
```

## 6. RLS 확인

후보 테이블에 row level security가 이미 켜져 있는지 확인합니다.

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'activity_records',
    'check_records',
    'visit_records',
    'care_records',
    'records',
    'activities'
  )
order by tablename;
```

## 7. 함수 / RPC 확인

활동 기록 관련 함수나 RPC가 이미 있는지 검색합니다.

```sql
select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and (
    routine_name ilike '%activity%'
    or routine_name ilike '%record%'
    or routine_name ilike '%visit%'
    or routine_name ilike '%check%'
  )
order by routine_name;
```

## 실행 결과에서 확인할 핵심 포인트

아래 항목을 중심으로 결과를 읽습니다.

1. 활동 기록 원본 테이블이 이미 존재하는지
2. 대상자 / 체커 / 기관과 연결할 FK 컬럼이 이미 있는지
3. `date`, `checked_at`, `status`, `memo`, `check_type` 성격 컬럼이 있는지
4. 기존 read RPC가 어떤 테이블을 원본으로 읽고 있을지 추정 가능한지
5. RLS와 권한 상태가 write 전환에 바로 쓸 수 있는 수준인지

## 주의사항

- 이 체크리스트는 **SELECT 전용**입니다.
- 결과를 확인한 뒤 다음 단계에서만 테이블 생성 또는 컬럼 수정 여부를 결정합니다.
- 실제 write 구현 전에는 반드시 현재 read RPC 원본 테이블과 컬럼 매핑을 다시 확인해야 합니다.
