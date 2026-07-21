# 이상징후 보고 Supabase write 전환 사전 점검

## 1. 작업 목적

이 문서는 이상징후 보고 작성 기능을 Supabase write 구조로 전환하기 전에, 현재 `localStorage` 저장 흐름과 Supabase DB/RPC 구조를 점검하기 위한 사전 감사 문서다.

생활 확인 기록 작성은 이미 Supabase 병행 저장 구조로 전환되었지만, 이상징후 보고 작성은 아직 기존 `localStorage` 저장 흐름을 사용한다. 다음 단계에서는 기존 저장과 UX를 유지하면서 Supabase 저장을 추가하는 방식으로 전환하는 것이 목표다.

이번 단계에서는 코드 구현, API 생성, DB 변경을 하지 않는다.

## 2. 현재 localStorage 저장 흐름

현재 이상징후 보고 작성은 체커 화면의 `EmergencyNew` 컴포넌트에서 처리된다.

- 파일: `src/pages/checkerPages.jsx`
- 컴포넌트: `EmergencyNew`
- submit 함수: `handleSubmit(event)`
- 저장 액션: `actions.addEmergencyReport(report)`
- 저장 후 이동: `/checker/home?emergency=sent`

`handleSubmit`은 대상자와 상세 내용 입력 여부를 검증한 뒤, 현재 시각을 기준으로 이상징후 보고 payload를 만들고 `actions.addEmergencyReport`를 호출한다.

`actions.addEmergencyReport`는 `src/App.jsx`에서 정의되어 있으며, `emergencyReports` 상태 배열 맨 앞에 새 보고를 추가한다.

```js
addEmergencyReport(report) {
  setEmergencyReports((current) => [report, ...current]);
}
```

`emergencyReports` 상태는 `usePersistentState(readEmergencyReports, writeEmergencyReports)`로 관리된다.

- 읽기: `src/services/emergencyService.js`의 `readEmergencyReports()`
- 쓰기: `src/services/emergencyService.js`의 `writeEmergencyReports(reports)`
- 현재 key: `happytong_emergency_reports`
- legacy key: `happy-tong-emergency-reports`

기존 UX는 저장 성공 후 체커 홈으로 이동하고, 쿼리스트링 `emergency=sent`를 통해 보고 완료 안내를 보여주는 흐름이다.

## 3. 관련 화면/컴포넌트

### 체커 작성 화면

- 라우트: `/checker/emergency/new`
- 파일: `src/pages/checkerPages.jsx`
- 컴포넌트: `EmergencyNew`
- 주요 form 상태:
  - `targetId`
  - `issueType`
  - `issueLevel`
  - `description`
  - `urgency`
  - `needGuardianContact`
  - `needAdminAlert`

### 관리자 이상징후 목록 화면

- 라우트: `/admin/emergencies`
- 파일: `src/pages/adminPages.jsx`
- 컴포넌트: `AdminEmergencies`
- localStorage fallback: `data.emergencyReports`
- Supabase 조회 후보: `getSupabaseAdminEmergencies(adminSupabaseOrganizationId)`

관리자 목록은 Supabase 조회가 성공하면 `result.emergencies`를 사용하고, Supabase 설정이 없거나 조회 실패 시 localStorage 기반 보고 목록을 fallback으로 사용한다.

### 관리자 이상징후 상세 화면

- 라우트: `/admin/emergencies/:id`
- 파일: `src/pages/adminPages.jsx`
- 컴포넌트: `AdminEmergencyDetail`
- localStorage 상세 후보: `findAdminEmergencyForDetail(...)`
- Supabase 상세 후보: `getSupabaseAdminEmergencyById(adminSupabaseOrganizationId, emergencyId)`

상세 화면에서도 Supabase 상세 조회 결과가 있으면 해당 report를 사용하고, 없으면 localStorage report를 사용한다. 처리 로그 추가는 현재 `actions.addEmergencyHandlingLog(...)` 기반 localStorage 흐름이다.

## 4. 현재 데이터 구조

체커 작성 화면에서 현재 생성하는 localStorage payload 구조는 다음과 같다.

| 필드 | 현재 값/역할 |
| --- | --- |
| `id` | `emergency-${Date.now()}` 형식의 local id |
| `targetId` | 보고 대상자 id |
| `checkerId` | 현재 체커 user id |
| `date` | `getToday()` 결과 |
| `issueType` | 이상 유형. 기본값 `연락 지연` |
| `issueLevel` | 확인 필요 수준. 기본값 `need_check` |
| `description` | 체커가 입력한 상세 내용 |
| `urgency` | 긴급도. 기본값 `medium` |
| `needGuardianContact` | 보호자 연락 필요 여부 |
| `needAdminAlert` | 관리자 알림 필요 여부 |
| `status` | 기본값 `received` |
| `adminMemo` | 관리자 메모. 기본값 빈 문자열 |
| `createdAt` | 작성 시각 ISO 문자열 |
| `updatedAt` | 갱신 시각 ISO 문자열 |

`emergencyService.normalizeEmergencyReport(report)`는 과거 status 값을 현재 코드값으로 보정하고, 누락된 `issueLevel`, `handlingLogs`, `createdAt`, `updatedAt` 기본값을 보완한다.

관리자 화면에서 Supabase report는 `supabaseAdminEmergenciesService.js`의 normalize 과정을 거쳐 다음 형태로 변환된다.

| 화면용 필드 | Supabase 후보 |
| --- | --- |
| `id` | `id` |
| `organizationId` | `organization_id` |
| `targetId` | `target_id` |
| `targetName` | `target_name`, `senior_name`, `name` |
| `targetAddress` | `target_address`, `address` |
| `checkerId` | `checker_id` |
| `checkerName` | `checker_name`, `checker` |
| `title` | `title`, `type`, `emergency_type`, `issue_type` |
| `issueType` | `issue_type`, `emergency_type`, `title` |
| `description` | `description`, `content`, `note`, `memo`, `detail` |
| `severity` | `severity` |
| `status` | `status` |
| `reportedAt` | `reported_at` |
| `lastHandlingStatus` | `last_handling_status` |
| `lastHandlingMemo` | `last_handling_memo` |
| `handledAt` | `handled_at` |
| `createdAt` | `created_at`, `reported_at` |

## 5. Supabase 관련 서비스/RPC 추정

현재 코드에서 확인된 이상징후 관련 Supabase service/RPC 후보는 다음과 같다.

| 파일 | 함수/RPC | 용도 |
| --- | --- | --- |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencies(organizationId)` | 관리자 이상징후 목록 조회 |
| `src/services/supabaseAdminEmergenciesService.js` | `getSupabaseAdminEmergencyById(organizationId, emergencyId)` | 관리자 이상징후 상세 조회 |
| `src/services/supabaseAdminEmergenciesService.js` | RPC `get_public_admin_emergencies` | organization 기준 관리자 목록 조회 |
| `src/services/supabaseRecentEmergencyService.js` | `getSupabaseRecentEmergencySummaries()` | 총관리자/요약성 최근 이상징후 조회 |
| `src/services/supabaseRecentEmergencyService.js` | RPC `get_public_recent_emergency_summaries` | 최근 이상징후 요약 조회 |

관련 DB 객체 후보:

- `public.emergency_reports`
- `public.emergency_handling_logs`

현재 `docs/supabase-schema.sql` 기준 `public.emergency_reports` 주요 컬럼 후보:

- `id`
- `organization_id`
- `target_id`
- `checker_id`
- `type`
- `severity`
- `status`
- `title`
- `description`
- `reported_at`
- `completed_at`
- `created_at`
- `updated_at`

현재 `public.emergency_handling_logs` 주요 컬럼 후보:

- `id`
- `emergency_report_id`
- `organization_id`
- `status`
- `memo`
- `contacted_guardian`
- `visit_required`
- `created_by`
- `created_by_name`
- `created_at`

## 6. SQL 점검 체크리스트

아래 SQL은 Supabase SQL Editor에서 확인용으로 실행할 수 있는 `SELECT` 전용 점검 쿼리다. 이번 문서에는 DB를 변경하는 SQL을 포함하지 않는다.

### emergency 관련 테이블 목록

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%emergency%'
    or table_name ilike '%incident%'
    or table_name ilike '%alert%'
  )
order by table_name;
```

### emergency 관련 컬럼

```sql
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('emergency_reports', 'emergency_handling_logs')
order by table_name, ordinal_position;
```

### emergency 관련 FK

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
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('emergency_reports', 'emergency_handling_logs')
order by tc.table_name, kcu.column_name;
```

### emergency 관련 RPC

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname ilike '%emergency%'
order by p.proname;
```

### emergency 관련 RPC grants

```sql
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name ilike '%emergency%'
order by routine_name, grantee, privilege_type;
```

### RLS 활성화 여부

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('emergency_reports', 'emergency_handling_logs')
order by tablename;
```

### RLS policy 목록

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('emergency_reports', 'emergency_handling_logs')
order by tablename, policyname;
```

### 최근 이상징후 보고 샘플

```sql
select
  id,
  organization_id,
  target_id,
  checker_id,
  type,
  severity,
  status,
  title,
  description,
  reported_at,
  completed_at,
  created_at,
  updated_at
from public.emergency_reports
order by reported_at desc nulls last, created_at desc nulls last
limit 20;
```

### 최근 처리 로그 샘플

```sql
select
  id,
  emergency_report_id,
  organization_id,
  status,
  memo,
  contacted_guardian,
  visit_required,
  created_by,
  created_by_name,
  created_at
from public.emergency_handling_logs
order by created_at desc
limit 20;
```

## 7. 전환 단계 초안

1. DB 구조 확인
   - 위 SELECT 점검 SQL로 `emergency_reports`, `emergency_handling_logs`, RPC, RLS, grants를 확인한다.

2. 필요 컬럼/테이블 보완 여부 판단
   - 기존 localStorage payload의 `issueType`, `issueLevel`, `description`, `urgency`, `needGuardianContact`, `needAdminAlert`를 현재 Supabase 컬럼에 어떻게 매핑할지 결정한다.
   - DB 변경이 필요하면 별도 단계에서 검토한다.

3. write API 구현
   - 후보 경로: `/api/emergency-reports/create`
   - 역할: 체커 이상징후 보고를 service_role 기반으로 `public.emergency_reports`에 저장한다.
   - activity record create API처럼 organization, target, checker resolve를 서버에서 검증한다.

4. 체커 이상징후 보고 작성 화면 연결
   - 기존 `actions.addEmergencyReport(...)`와 localStorage 저장은 유지한다.
   - localStorage 저장 직후 Supabase 저장 API를 추가 호출한다.
   - Supabase 저장 실패 시 기존 UX를 깨지 않고 조용히 fallback한다.

5. 관리자 이상징후 목록/상세 반영 확인
   - 기존 `get_public_admin_emergencies` RPC가 새 write row를 표시하는지 확인한다.
   - 필요하면 read RPC 반환 컬럼과 normalize 매핑을 보완한다.

6. 처리 상태 변경은 다음 단계로 분리
   - `emergency_handling_logs` write, status update, resolved/completed 처리 흐름은 이상징후 보고 작성 전환 이후 별도 작업으로 진행한다.

## 8. 구현 시 주의사항

- 기존 `localStorage` 저장과 `actions.addEmergencyReport`를 제거하지 않는다.
- 저장 성공 UX와 이동 경로 `/checker/home?emergency=sent`를 유지한다.
- Supabase 저장 실패가 사용자 화면을 깨지 않게 한다.
- 개인정보, 상세 주소, 보호자 연락처, 상세 보고 내용은 console에 출력하지 않는다.
- request body 전체 로그를 남기지 않는다.
- service role key는 프론트엔드에 노출하지 않는다.
- 관리자 목록/상세는 Supabase row가 있으면 Supabase 값을 우선하고, 없으면 localStorage fallback을 유지한다.
- 처리 상태 변경, 처리 로그 작성, 관리자 대응 메모 저장은 이번 write 전환과 분리한다.

## 9. 이번 단계에서 하지 않는 것

- 코드 파일 수정
- API 파일 생성
- SQL 파일 생성
- DB 변경 SQL 작성
- Supabase SQL 실행
- RLS/권한 변경
- Auth 구조 변경
- 기존 localStorage 흐름 변경
- 관리자 처리 상태 변경 write 전환
- `package.json`, `package-lock.json` 수정
