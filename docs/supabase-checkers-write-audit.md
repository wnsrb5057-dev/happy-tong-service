# Supabase 체커 Write 전환 사전 점검

## 1. 작업 목적

관리자 체커 등록, 수정, 상태 변경 기능을 Supabase write로 전환하기 전에 현재 localStorage 저장 흐름과 Supabase `users` 테이블 연동 지점을 점검한다.

이번 단계는 조사/문서화 단계이며 코드 구현, API 생성, DB 변경은 하지 않는다.

## 2. 현재 관리자 체커 관리 흐름

관리자 체커 관리는 `src/pages/adminPages.jsx` 안의 관리자 페이지 컴포넌트에서 처리된다.

- 체커 목록: `AdminCheckers`
- 체커 등록: `AdminCheckerNew`
- 체커 상세: `AdminCheckerDetail`
- 체커 수정: `AdminCheckerEdit`
- 담당 대상자 배정: `AdminCheckerDetail` 내부 `handleAssignmentSave`

현재 저장 흐름:

- 신규 체커 등록 시 `AdminCheckerNew.handleSubmit`에서 `actions.addUser(newChecker)` 호출
- 체커 수정 시 `AdminCheckerEdit.handleSubmit`에서 `actions.updateUser(checker.id, updates)` 호출
- 이용 신청 승인 시 `App.jsx`의 `actions.approveSignupRequest`가 `buildApprovedCheckerFromRequest`로 체커를 생성하고 `registeredUsers`에 저장
- 담당 대상자 배정 저장 시 `actions.updateCheckerAssignments(checkerId, draftAssignments)` 호출
- 위 흐름은 모두 localStorage 기반 상태에 반영된다.

## 3. 관련 컴포넌트/함수

`src/pages/adminPages.jsx`:

- `AdminCheckers`: 체커 목록, 이용 신청 승인/반려 카드, 체커 요약 카드 표시
- `AdminCheckerNew`: 체커 등록 폼 및 `handleSubmit`
- `AdminCheckerDetail`: 체커 상세, 담당 대상자 배정 UI, `handleAssignmentSave`
- `AdminCheckerEdit`: 체커 수정 폼 및 `handleSubmit`
- `getCheckerStatus`: 체커 자체 상태와 미완료 기록/미처리 이상징후를 합쳐 표시 상태 계산
- `getCheckerPhoneValue`: `phone`, `phoneNumber`, `contactPhone` 후보 사용
- `getCheckerAreaValue`: `area`, `region`, `assignedArea` 후보 사용
- `renderCheckerStatusBadge`: 체커 상태 배지 표시

`src/App.jsx`:

- `registeredUsers` 상태: `readRegisteredUsers`, `writeRegisteredUsers`
- `signupRequests` 상태: `readSignupRequests`, `writeSignupRequests`
- `actions.addUser`
- `actions.updateUser`
- `actions.approveSignupRequest`
- `actions.rejectSignupRequest`
- `actions.updateCheckerAssignments`

`src/services/authService.js`:

- `readRegisteredUsers`
- `writeRegisteredUsers`
- `readAllUsers`
- `authenticateSupabaseUser`
- `buildApprovedCheckerFromRequest`

`src/services/signupRequestService.js`:

- `readSignupRequests`
- `writeSignupRequests`
- `appendSignupRequest`

## 4. 현재 localStorage 체커 데이터 구조

확인한 localStorage key:

- `happytong_registered_users`: 관리자 등록 또는 승인된 사용자 저장
- `signupRequests`: 체커 이용 신청 목록 저장
- `happytong_current_user`: 현재 로그인 사용자 저장

체커 등록 시 `AdminCheckerNew`가 생성하는 구조:

- `id`: `checker-${Date.now()}`
- `role`: `checker`
- `type`: `checker`
- `username`
- `loginId`
- `password`
- `name`
- `phone`
- `phoneNumber`
- `region`
- `area`
- `status`
- `activityStatus`
- `createdAt`
- `updatedAt`

체커 이용 신청 승인 시 `buildApprovedCheckerFromRequest`가 생성하는 구조:

- `id`: `user-${request.loginId}`
- `username`
- `loginId`
- `password`
- `name`
- `phone`
- `role`: `checker`
- `organizationId`
- `organizationName`
- `status`: `active`
- `assignedTargetIds`: `[]`

체커 수정 시 변경되는 주요 필드:

- `name`
- `phone`
- `area`
- `status`
- `updatedAt`

화면에서 참조하는 추가 후보 필드:

- `email`
- `organizationId`
- `organizationName`
- `phoneNumber`
- `contactPhone`
- `region`
- `assignedArea`
- `activityStatus`
- `pausedAt`
- `leftAt`
- `memo`

## 5. 관리자 Read 흐름

현재 관리자 체커 목록/상세는 `data.users`를 사용한다. `data.users`는 `App.jsx`에서 mock `users`와 localStorage `registeredUsers`를 `mergeById`로 합친 값이다.

현재 확인된 흐름:

- 관리자 체커 목록: `data.users.filter((user) => user.role === "checker")`
- 관리자 체커 상세: `data.users.find((user) => user.role === "checker" && user.id === checkerId)`
- 담당 대상자 수: `data.targets.filter((target) => target.assignedCheckerId === checker.id).length`
- 오늘 완료/보완 필요: `data.activityRecords`에서 `checkerId` 기준 계산
- 이상징후 관련 건수: `data.emergencyReports`에서 `checkerId` 기준 계산

현재 관리자 체커 전용 Supabase read service/RPC는 확인되지 않았다. Supabase `users` 직접 조회는 로그인용 `authenticateSupabaseUser`에서 사용 중이다.

## 6. Supabase Users/Checker 관련 서비스/RPC 후보

확인된 관련 파일:

- `src/services/authService.js`: 로그인 시 Supabase Auth 후 `public.users` 조회
- `src/services/supabaseCheckerTargetsService.js`: 체커 대상자 목록 RPC 사용
- `src/services/supabaseCheckerHomeService.js`: 체커 홈 RPC 사용
- `src/services/supabaseCheckerActivityFormTargetsService.js`: 체커 기록 작성 대상자 RPC 사용
- `src/services/supabaseHealthService.js`: `users` table count 확인

확인된 RPC 후보:

- `get_public_checker_targets`
- `get_public_checker_home`
- `get_public_checker_activity_form_targets`

관리자 체커 목록/상세용으로 보이는 `supabaseAdminCheckersService.js` 또는 `get_public_admin_checkers` RPC는 현재 코드에서 확인되지 않았다.

## 7. `targets.assigned_checker_id` 연결 영향

대상자 write 전환 이후 `targets.assigned_checker_id`는 Supabase `users.id` FK로 연결된다. 따라서 체커 write 전환 시 다음 영향을 확인해야 한다.

- 체커는 실제 삭제보다 `status` 변경으로 처리하는 것이 안전하다.
- 체커가 `paused`, `left`, `inactive` 상태가 되더라도 담당 대상자 FK를 자동 삭제하면 안 된다.
- 관리자 대상자 목록의 재배정 필요 판단은 담당 체커 누락 또는 체커 상태 변경에 영향을 받는다.
- `AdminCheckerDetail`의 담당 대상자 배정 저장은 현재 localStorage `targets.assignedCheckerId`만 바꾸므로, 후속 구현 때 Supabase `targets.assigned_checker_id` update 전략이 필요하다.
- 기존 대상자 write API는 담당 체커를 UUID-like id, email, username, name으로 resolve하므로 `public.users.id`와 localStorage id 간 차이를 계속 고려해야 한다.

## 8. SQL 점검 체크리스트

아래 SQL은 Supabase SQL Editor에서 확인용으로만 실행한다. 모두 SELECT 계열이며 DB 변경을 하지 않는다.

### users 컬럼 구조 조회

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
order by ordinal_position;
```

### users FK 조회

```sql
select
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'users'
order by tc.constraint_name, kcu.ordinal_position;
```

### users CHECK 제약조건 조회

```sql
select
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.users'::regclass
  and contype = 'c'
order by conname;
```

### users RLS 활성화 여부 조회

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'users';
```

### users policy 조회

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
  and tablename = 'users'
order by policyname;
```

### users grants 조회

```sql
select
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'users'
order by grantee, privilege_type;
```

### 최근 checker users 샘플 조회

```sql
select
  id,
  auth_user_id,
  organization_id,
  username,
  email,
  role,
  name,
  phone,
  status,
  created_at,
  updated_at
from public.users
where role = 'checker'
order by created_at desc nulls last
limit 20;
```

### checker 관련 RPC 조회

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%checker%'
    or p.proname ilike '%user%'
  )
order by p.proname;
```

### targets.assigned_checker_id 기준 담당 대상자 수 조회

```sql
select
  u.id as checker_id,
  u.name as checker_name,
  u.username,
  u.status,
  count(t.id) as assigned_target_count
from public.users u
left join public.targets t
  on t.assigned_checker_id = u.id
where u.role = 'checker'
group by u.id, u.name, u.username, u.status
order by assigned_target_count desc, u.name;
```

## 9. 예상 Write 전환 범위

예상 API:

- `public.users` insert
- `public.users` update
- `public.users.status` update
- 필요 시 `public.targets.assigned_checker_id` update

예상 서버 API route:

- `/api/checkers/create`
- `/api/checkers/update`
- `/api/checkers/update-status`

담당 대상자 배정 저장까지 Supabase write로 전환한다면 별도 API가 필요할 수 있다.

- `/api/checkers/update-assignments`
- 또는 `/api/targets/update-assigned-checker`

## 10. 상태값 매핑 초안

DB 제약조건 확인 전 초안이다.

- 활동중 / `active` → `active`
- 일시중지 / `paused` → `paused`
- 퇴사 / 활동종료 / `left` → `left`
- 비활성 / `inactive` → `inactive`
- 지원 필요 / `needs_attention` → 화면 계산 상태로 유지하거나 별도 저장 상태로 둘지 검토 필요

주의: 현재 `getCheckerStatus`는 저장된 `checker.status`뿐 아니라 미완료 확인 기록과 미처리 이상징후를 함께 보고 `needs_attention`을 계산한다. `needs_attention`을 DB 상태로 저장할지, 화면 계산값으로만 유지할지 분리해야 한다.

## 11. Auth 연동 주의사항

체커 등록은 두 계층을 구분해야 한다.

- `public.users`: 앱에서 쓰는 사용자 프로필/역할/기관/상태 row
- `auth.users`: Supabase Auth 로그인 계정

현재 로그인 흐름은 Supabase Auth 로그인 후 `auth_user_id`로 `public.users`를 조회하는 구조가 있다. 반면 기존 mock/localStorage 로그인은 `username/password` 기반으로 동작한다.

MVP 전환 제안:

- 1차: 기존 localStorage 로그인 흐름은 유지하고 `public.users` write부터 병행 저장한다.
- 2차: Supabase Auth 계정 생성/초기 비밀번호/초대 메일/비밀번호 재설정 정책을 별도 설계한다.
- Auth 계정 생성은 민감한 영역이므로 체커 write 전환과 분리하는 것이 안전하다.

## 12. 구현 단계 초안

1. Supabase `users` 구조와 제약조건 확인
2. 상태값 허용 범위와 필수 컬럼 확인
3. `/api/checkers/create` 구현
4. `/api/checkers/update` 구현
5. `/api/checkers/update-status` 구현
6. 관리자 체커 등록 화면에 Supabase create 추가 호출
7. 관리자 체커 수정 화면에 Supabase update 추가 호출
8. 체커 상태 변경을 Supabase update-status로 연결
9. 기존 localStorage 저장 흐름 유지
10. 관리자 체커 목록/상세에 Supabase read 또는 merge 반영
11. `targets.assigned_checker_id` 담당 대상자 수와 재배정 필요 표시 확인
12. 체커 로그인/Auth 계정 생성은 후속 과제로 분리

## 13. 주의사항

- 기존 localStorage 흐름은 제거하지 않는다.
- `password`를 `public.users`에 평문으로 저장할지 여부는 별도 검토가 필요하다.
- service role key는 서버 API에서만 사용한다.
- 체커 삭제는 FK 영향 때문에 피하고 상태 변경으로 처리한다.
- `targets.assigned_checker_id`와 연결된 체커의 UUID가 화면 local id와 다를 수 있으므로 normalize/merge 기준이 필요하다.
- `needs_attention`은 저장 상태가 아니라 화면 계산 상태일 가능성이 높다.
- 관리자 체커 목록 read를 Supabase로 전환할 경우 담당 대상자 수, 미완료 기록 수, 이상징후 수 계산 출처를 함께 맞춰야 한다.

## 14. 이번 단계에서 하지 않는 것

- 코드 파일 수정
- API 파일 생성
- DB/SQL/RLS/Auth 수정
- package 파일 수정
- 기존 localStorage 흐름 변경
- 관리자/체커 화면 수정
