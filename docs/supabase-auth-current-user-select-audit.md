# Supabase Auth Current User SELECT Audit

## 1. 작업 목적

`authService.js`의 `public.users` / `public.organizations` 직접 SELECT 흐름을 확인하고, 로그인 후 `currentUser` 구성 방식과 SELECT 권한 정리 가능성을 정리한다.

이번 단계는 감사/문서화 단계이며, 코드 수정, API 생성, DB/RLS/Auth 수정, SELECT 권한 revoke는 하지 않는다.

## 2. 현재 로그인 구조 요약

로그인 화면은 입력한 아이디가 이메일 형식인지에 따라 두 흐름으로 나뉜다.

- 이메일 형식 로그인: Supabase Auth `signInWithPassword` 사용
- 이메일이 아닌 로그인: mock/local 사용자 인증 사용

`App.jsx`는 `readCurrentUser()`로 초기 로그인 상태를 복원하고, 로그인 성공 시 `saveCurrentUser(user)`로 `happytong_current_user`에 저장한다.

스토리지 키:

- 현재 키: `happytong_current_user`
- legacy 키: `happy-tong-current-user`

## 3. mock 로그인 흐름

대상 계정:

- `admin / 1234`
- `checker / 1234`
- `super_admin / 1234`

관련 파일:

- `src/pages/LoginPage.jsx`
- `src/services/authService.js`
- `src/data/mockData.js`
- `src/data/organizations.js`

흐름:

1. `LoginPage.handleSubmit`에서 로그인 ID가 이메일 형식인지 확인한다.
2. 이메일이 아니면 `authenticateUser(trimmedLoginId, password)`를 호출한다.
3. `authenticateUser`는 `readAllUsers()`의 local/mock 사용자 목록에서 username/id와 password를 비교한다.
4. `readAllUsers()`는 `superAdminUser`, `mockData.users`, `registeredUsers`를 합친다.
5. `enrichBaseUser`가 `defaultUserOrganizations`와 local organizations 데이터로 `organizationId`, `organizationName`을 보강한다.
6. 로그인 성공 시 `App.handleLogin`이 `saveCurrentUser(user)`를 호출한다.

확인 결과:

- mock 로그인은 Supabase Auth `signInWithPassword`를 호출하지 않음
- mock 로그인은 `public.users` SELECT를 호출하지 않음
- mock 로그인은 `public.organizations` SELECT를 호출하지 않음
- mock 로그인에서는 Supabase Auth session이 생성되지 않음
- mock 사용자는 localStorage/currentUser와 local seed 데이터에 의존함

mock currentUser 저장 방식:

- `saveCurrentUser(user)`는 `authUserId` 또는 `email`이 없으면 `user.username || user.id` 문자열만 저장한다.
- 따라서 기본 mock 계정은 `happytong_current_user`에 `"admin"`, `"checker"`, `"super_admin"` 같은 문자열로 저장된다.
- 복원 시 `readCurrentUser()`가 해당 문자열로 `readAllUsers()`에서 다시 사용자 객체를 찾는다.

## 4. 이메일 Supabase Auth 로그인 흐름

관련 함수:

- `authenticateSupabaseUser(email, password)`

흐름:

1. `LoginPage.handleSubmit`에서 로그인 ID에 `@`가 있으면 이메일 로그인으로 판단한다.
2. `authenticateSupabaseUser(email, password)`를 호출한다.
3. `supabase.auth.signInWithPassword({ email, password })`로 Supabase Auth session을 만든다.
4. `authData.user.id`를 `authUserId`로 사용한다.
5. `public.users.auth_user_id = authUserId` 조건으로 public user row를 조회한다.
6. user row가 없거나 inactive면 `supabase.auth.signOut()`을 호출하고 실패 처리한다.
7. `organization_id`가 있으면 `public.organizations.id = userRow.organization_id`로 기관명을 조회한다.
8. `normalizeSupabaseCurrentUser(userRow, organizationName)`으로 currentUser를 구성한다.
9. `App.handleLogin`이 `saveCurrentUser(user)`로 currentUser 객체를 localStorage에 저장한다.

확인 결과:

- 이메일 Auth 로그인은 Supabase Auth session을 생성함
- 이메일 Auth 로그인은 `public.users` 직접 SELECT를 사용함
- 이메일 Auth 로그인은 기관명 보강을 위해 `public.organizations` 직접 SELECT를 사용함
- 이메일 Auth currentUser는 객체 형태로 `happytong_current_user`에 저장됨

## 5. 로그아웃 흐름

관련 파일:

- `src/App.jsx`
- `src/services/authService.js`

흐름:

1. `App.handleLogout`이 `signOutSupabaseAuth()`를 호출한다.
2. `signOutSupabaseAuth()`는 Supabase 설정이 있으면 `supabase.auth.signOut()`을 호출한다.
3. 실패해도 mock 로그인 흐름에 영향이 없도록 오류를 무시한다.
4. `clearCurrentUser()`로 `happytong_current_user`와 legacy currentUser key를 삭제한다.
5. `setCurrentUser(null)` 후 `/login`으로 이동한다.

mock 로그인과 이메일 Auth 로그인 모두 같은 logout handler를 사용한다.

## 6. public.users 직접 SELECT 현황

파일:

- `src/services/authService.js`

함수:

- `authenticateSupabaseUser`

쿼리:

```js
supabase
  .from("users")
  .select("id, auth_user_id, username, role, name, organization_id, status, email")
  .eq("auth_user_id", authUserId)
  .maybeSingle()
```

호출 시점:

- 이메일 Supabase Auth 로그인 직후

where 조건:

- `auth_user_id = authData.user.id`

select 필드:

- `id`
- `auth_user_id`
- `username`
- `role`
- `name`
- `organization_id`
- `status`
- `email`

반환 목적:

- Supabase Auth user와 `public.users` profile 매핑
- role 확인
- status active 확인
- currentUser 구성

mock 로그인에서 사용 여부:

- 사용하지 않음

이메일 Auth 로그인에서 사용 여부:

- 사용함

SELECT 권한 제거 시 영향:

- `authenticated`가 자기 `public.users` row를 읽을 수 없으면 이메일 Auth 로그인 후 currentUser 구성이 실패함
- `anon` 제거 자체는 이메일 Auth session이 정상 적용된다면 영향이 제한적일 수 있으나, session 전달/복원 상태에 따라 확인 필요

## 7. public.organizations 직접 SELECT 현황

파일:

- `src/services/authService.js`

함수:

- `authenticateSupabaseUser`

쿼리:

```js
supabase
  .from("organizations")
  .select("name")
  .eq("id", userRow.organization_id)
  .maybeSingle()
```

호출 시점:

- 이메일 Supabase Auth 로그인에서 user row 조회 성공 후

where 조건:

- `id = userRow.organization_id`

select 필드:

- `name`

반환 목적:

- currentUser의 `organizationName` 보강

currentUser 구성에 필요한지:

- 필수 인증값은 아니지만 화면/조직 매핑에서 사용될 수 있음

SELECT 권한 제거 시 영향:

- organizations SELECT가 막히면 이메일 Auth currentUser의 `organizationName`이 빈 값이 될 수 있음
- 일부 관리자 화면의 organization resolve 보조 로직에 영향 가능

## 8. currentUser 구조와 출처

### mock currentUser

주요 필드:

- `id`: `mockData.users` 또는 `superAdminUser`
- `username`: mock user 또는 `superAdminUser`
- `loginId`: super admin 또는 가입 승인 사용자 일부
- `password`: local/mock data
- `role`: mock user
- `name`: mock user
- `phone`: mock user
- `status`: mock user
- `assignedTargetIds`: mock user
- `organizationId`: `defaultUserOrganizations` 또는 user 원본
- `organizationName`: local `organizations` seed

출처:

- `src/data/mockData.js`
- `src/data/organizations.js`
- `happytong_registered_users`

저장:

- 기본 mock 사용자는 currentUser 전체 객체가 아니라 username/id 문자열로 저장됨

### 이메일 Auth currentUser

`normalizeSupabaseCurrentUser`가 구성하는 필드:

- `id`: `public.users.id`
- `authUserId`: `public.users.auth_user_id`
- `username`: `public.users.username` 또는 `login_id` 또는 `email`
- `role`: `public.users.role`
- `name`: `public.users.name`
- `organizationId`: `public.users.organization_id`
- `organizationName`: `public.organizations.name`
- `status`: `public.users.status`
- `email`: `public.users.email`

출처:

- Supabase Auth: `authData.user.id`
- `public.users`
- `public.organizations`

저장:

- `authUserId` 또는 `email`이 있으므로 currentUser 객체 전체가 `happytong_current_user`에 저장됨

## 9. SELECT 권한 제거 시 영향

### anon SELECT 제거 시 mock 로그인 영향

- mock 로그인은 `public.users`/`organizations` SELECT를 사용하지 않음
- mock 로그인 자체는 anon SELECT 제거의 직접 영향이 적음
- 단, mock 로그인 후 화면 read는 다른 direct SELECT 경로의 영향을 받을 수 있음

### anon SELECT 제거 시 이메일 Auth 로그인 영향

- 이메일 Auth 로그인은 정상적으로 authenticated session이 붙으면 anon 권한에 의존하지 않는 것이 목표
- 다만 세션 적용 전후 타이밍 또는 클라이언트 상태에 따라 확인 필요

### authenticated SELECT 제거 시 이메일 Auth 로그인 영향

- 영향 큼
- `public.users` SELECT가 막히면 Auth 로그인 후 public profile 매핑이 실패함
- `organizations` SELECT가 막히면 organizationName 보강 실패 가능

### users_select_own_profile policy만 있을 때 영향

- `auth.uid() = public.users.auth_user_id` 형태의 own profile policy가 있으면 이메일 Auth 로그인은 유지 가능성이 있음
- mock 로그인은 Supabase Auth session이 없으므로 이 policy로는 public.users 조회가 불가능함
- 현재 mock 로그인은 public.users 조회를 하지 않으므로 로그인 자체는 유지 가능

### organizations SELECT 의존

- 이메일 Auth currentUser의 `organizationName`은 organizations SELECT에 의존함
- organizationName을 서버에서 함께 내려주거나, organizations RLS를 조직 사용자에게 제한적으로 허용해야 함

## 10. 대응 방향 후보

### A안: auth/currentUser 조회를 서버 API로 전환

예상 API:

- `api/auth-user.js`
- 또는 기존 통합 API에 action 추가

예상 action:

- `getCurrentUserByAuthUserId`
- `getMockUserByUsername`

장점:

- `public.users` SELECT 권한을 줄이기 쉬움
- mock 로그인 유지와 충돌이 적음
- 서버에서 service_role로 users/organizations를 안전하게 조합 가능

단점:

- 로그인 관련 API 설계 필요
- 사용자 식별값과 응답 필드 최소화가 필요
- 민감 정보가 응답에 포함되지 않도록 주의 필요

### B안: authenticated RLS policy로 유지

장점:

- Supabase Auth 로그인에는 자연스러움
- `auth.uid()` 기반 own profile 조회 설계 가능

단점:

- mock 로그인과는 별개 흐름으로 남음
- organizations join/조회 policy까지 설계해야 함
- 테스트 복잡도 증가

### C안: mock 로그인은 local seed만 사용하고, 이메일 Auth만 users SELECT 사용

장점:

- 현재 구조와 가장 유사함
- mock 로그인과 이메일 Auth를 명확히 분리 가능

단점:

- local seed와 Supabase 데이터 불일치 가능
- 운영 전 mock 로그인 의존도를 줄이는 별도 계획 필요

추천:

- 단기 MVP에서는 C안을 유지하면서 이메일 Auth에 필요한 `users` own profile RLS와 organizations 제한 read를 설계한다.
- 운영 보안 강화 단계에서는 A안을 검토해 currentUser 조회를 서버 API로 감싸는 방향이 안전하다.
- mock 로그인은 운영 전 제거 또는 개발 전용으로 제한하는 정책을 별도로 세우는 것이 좋다.

## 11. 보안 주의사항

확인 결과:

- `authService.js`의 Supabase SELECT는 `password_hash`를 가져오지 않음
- `authService.js`의 Supabase SELECT는 password 필드를 가져오지 않음
- `supabaseClient.js`는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 기반 client만 생성함
- service_role key는 클라이언트 파일에 노출되지 않음

주의 필요:

- mock user와 signup request/registered user 흐름에는 password 값이 local data/localStorage에 존재할 수 있음
- 이메일 Auth currentUser 객체는 localStorage에 저장되며 `id`, `authUserId`, `email`, `role`, `organizationId`를 포함함
- currentUser에는 password/password_hash는 포함되지 않지만, 운영에서는 localStorage 저장 필드 최소화 검토가 필요함

## 12. 추천 다음 단계

1. `users` own profile SELECT RLS policy 초안을 작성한다.
2. `organizations.name` 조회를 어떻게 제한할지 결정한다.
3. currentUser 조회를 서버 API로 전환할지, authenticated RLS로 유지할지 선택한다.
4. mock 로그인 운영 제한 또는 제거 계획을 세운다.
5. localStorage에 저장되는 currentUser 필드 최소화 가능성을 검토한다.
6. 변경 전후 로그인 QA 기준을 만든다.

## 13. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 생성하지 않음
- DB/RLS/Auth 수정하지 않음
- SELECT 권한 revoke하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- 권한 정리를 완료했다고 판단하지 않음
