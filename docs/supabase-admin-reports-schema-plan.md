# Supabase Admin Reports Schema Plan

## 1. 작업 목적

`public.admin_reports` 테이블에서 관리자 보고서의 초안, 저장, 완료 상태를 명확하게 관리할 수 있도록 최소 스키마 보완 계획을 정리한다.

이번 문서는 계획 문서이며 SQL은 실행하지 않는다.

## 2. 현재 admin_reports 구조

현재 확인된 `public.admin_reports` 컬럼:

- `id uuid not null default gen_random_uuid()`
- `organization_id uuid not null`
- `title text not null`
- `period_start date nullable`
- `period_end date nullable`
- `summary text nullable`
- `action_note text nullable`
- `report_data jsonb nullable`
- `created_by uuid nullable`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## 3. 현재 구조의 부족한 점

- `status` 컬럼이 없어 보고서 상태를 직접 구분하기 어렵다.
- 초안(`draft`), 저장(`saved`), 완료(`completed`) 상태를 목록/필터/쿼리에서 안정적으로 다루기 어렵다.
- `report_data` JSONB 내부 값만으로 상태를 관리하면 쿼리 조건과 인덱싱, 운영 점검이 불편하다.
- 보고서 작성 화면에서 임시 저장과 최종 저장을 구분하기 위한 명시 필드가 필요하다.

## 4. 추천 구조

- `public.admin_reports` 단일 테이블을 유지한다.
- `report_drafts` 별도 테이블은 만들지 않는다.
- `status text not null default 'draft'` 컬럼을 추가한다.
- `status` CHECK 제약조건을 추가해 허용 상태값을 제한한다.
- `report_data` 기본값을 `'{}'::jsonb`로 설정하는 방안을 검토한다.
- `saved_at`, `generated_at`은 MVP 단계에서는 추가하지 않고 `updated_at`, `report_data`로 대체한다.

## 5. 추가 컬럼 제안

추가 제안 컬럼:

- `status text not null default 'draft'`

검토 제안:

- `report_data jsonb default '{}'::jsonb`

MVP에서는 추가하지 않는 컬럼:

- `saved_at`
- `generated_at`
- `published_at`

## 6. status 값 후보

허용 후보:

- `draft`: 초안 상태
- `saved`: 저장된 보고서
- `completed`: 완료 처리된 보고서
- `published`: 발행 또는 제출 완료 상태

초기 구현에서는 `draft`, `saved`, `completed` 중심으로 사용하고, `published`는 후속 확장용으로 열어둔다.

## 7. SQL 초안

```sql
alter table public.admin_reports
add column if not exists status text not null default 'draft';

alter table public.admin_reports
drop constraint if exists admin_reports_status_check;

alter table public.admin_reports
add constraint admin_reports_status_check
check (status = any (array['draft'::text, 'saved'::text, 'completed'::text, 'published'::text]));

alter table public.admin_reports
alter column report_data set default '{}'::jsonb;
```

## 8. 적용 후 확인 SQL

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'admin_reports'
order by ordinal_position;
```

```sql
select
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.admin_reports'::regclass
order by conname;
```

```sql
select
  id,
  organization_id,
  title,
  status,
  period_start,
  period_end,
  summary,
  action_note,
  report_data,
  created_by,
  created_at,
  updated_at
from public.admin_reports
order by created_at desc
limit 10;
```

## 9. 다음 구현 단계

1. Supabase SQL Editor에서 SQL 초안을 검토 후 적용한다.
2. 적용 후 확인 SQL로 컬럼, 제약조건, 최근 row 조회를 확인한다.
3. `/api/reports` 단일 통합 API 설계를 진행한다.
4. `action=createDraft`, `action=updateDraft`, `action=saveReport`, `action=completeReport` 분기를 검토한다.
5. 관리자 보고서 작성 화면에서 기존 localStorage 저장을 유지하면서 Supabase write를 추가한다.
6. 보고서 목록/미리보기에서 `status` 기준 표시와 필터링을 검토한다.
7. 완료 후 별도 완료 문서를 작성한다.

## 10. 이번 단계에서 하지 않는 것

- SQL 실행
- DB/RLS/Auth 직접 수정
- API 파일 생성
- 코드 파일 수정
- `docs/supabase-reports-write-audit.md` 수정
- `package.json` 수정
- `package-lock.json` 수정
- `vercel.json` 수정
