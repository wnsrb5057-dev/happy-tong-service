# Supabase Auth Current User Server API Plan

## 1. 작업 목적

`authService.js`에 마지막으로 남은 `public.users` / `public.organizations` 직접 SELECT를 서버 API로 전환하기 위한 계획을 정리한다.

이번 단계는 문서 작성만 수행하며, 코드 수정, API 생성, DB/RLS/Auth 수정, SELECT 권한 revoke는 하지 않는다.

## 2. 현재 direct select 잔여 상태

direct table SELECT 정리 후 `src` 클라이언트 직접 table SELECT는 `src/services/authService.js`만 남아 있다.

남은 직접 SELECT:

- `public.users`
- `public.organizations`

용도:

- 이메일 Supabase Auth 로그인 후 `currentUser` 구성
- `organizationName` 보강

mock 로그인은 이 직접 SELECT를 사용하지 않는다.

## 3. 이메일 Auth currentUser 흐름

관련 파일:

- `src/pages/LoginPage.jsx`
- `src/services/authService.js`
- `src/services/supabaseClient.js`
- `src/App.jsx`

흐름:

1. `LoginPage.handleSubmit`에서 로그인 ID가 이메일 형식인지 확인한다.
2. 이메일 형식이면 `authenticateSupabaseUser(trimmedLoginId, password)`를 호출한다.
3. `authenticateSupabaseUser`는 `supabase.auth.signInWithPassword({ email, password })`를 호출한다.
4. `authData.user.id`를 `authUserId`로 사용한다.
5. `public.users.auth_user_id = authUserId` 조건으로 user row를 조회한다.
6. user row가 없거나 inactive면 `supabase.auth.signOut()` 후 실패 처리한다.
7. `userRow.organization_id`가 있으면 `public.organizations.id = organization_id` 조건으로 기관명을 조회한다.
8. `normalizeSupabaseCurrentUser(userRow, organizationName)`으로 currentUser를 구성한다.
9. `App.handleLogin`이 `saveCurrentUser(user)`를 호출한다.
10. `saveCurrentUser`는 `authUserId` 또는 `email`이 있으면 currentUser 객체 전체를 `happytong_current_user`에 저장한다.

현재 `users` SELECT:

```js
supabase
  .from("users")
  .select("id, auth_user_id, username, role, name, organization_id, status, email")
  .eq("auth_user_id", authUserId)
  .maybeSingle()
```

현재 `organizations` SELECT:

```js
supabase
  .from("organizations")
  .select("name")
  .eq("id", userRow.organization_id)
  .maybeSingle()
```

## 4. mock 로그인 흐름

대상 계정:

- `admin / 1234`
- `checker / 1234`
- `super_admin / 1234`

흐름:

1. `LoginPage.handleSubmit`에서 로그인 ID가 이메일 형식이 아니면 mock 로그인으로 처리한다.
2. `authenticateUser(trimmedLoginId, password)`를 호출한다.
3. `authenticateUser`는 `readAllUsers()`의 local/mock 사용자 목록에서 username/id와 password를 비교한다.
4. `readAllUsers()`는 `superAdminUser`, `mockData.users`, `registeredUsers`를 합친다.
5. `enrichBaseUser`가 local `defaultUserOrganizations`와 `organizations` seed로 `organizationId`, `organizationName`을 보강한다.
6. 로그인 성공 시 `App.handleLogin`이 `saveCurrentUser(user)`를 호출한다.

확인 결과:

- mock 로그인은 Supabase Auth `signInWithPassword`를 호출하지 않음
- mock 로그인은 `public.users` SELECT를 사용하지 않음
- mock 로그인은 `public.organizations` SELECT를 사용하지 않음
- mock 로그인은 Supabase Auth session을 생성하지 않음
- 기본 mock currentUser는 `happytong_current_user`에 username/id 문자열로 저장됨

mock currentUser와 이메일 Auth currentUser 차이:

- mock currentUser는 local seed 기반이며 `authUserId`가 없음
- 이메일 Auth currentUser는 `public.users.id`, `auth_user_id`, `email`, `organization_id`를 포함하는 객체임
- mock currentUser는 local seed와 Supabase public.users row가 불일치할 수 있음

## 5. 서버 API 전환 후보

### 후보 A: 기존 도메인 API에 흩어 넣지 않음

예:

- `api/checkers.js`
- `api/admin-read.js`
- `api/super.js`

판단:

- 권장하지 않음

이유:

- auth/currentUser는 모든 역할 공통 흐름이다.
- 특정 도메인 API에 넣으면 책임이 섞인다.
- 장기 유지보수와 권한 감사에서 혼동 가능성이 크다.

### 후보 B: `api/auth.js` 신규 생성

권장 action:

- `resolveCurrentUser`

대안 action:

- `getCurrentUserByAuthUserId`
- `getOrganizationName`

장점:

- auth/currentUser 책임이 명확함
- `public.users`와 `organizations` 직접 SELECT를 서버 service_role 경로로 이동 가능
- password/password_hash 반환 금지 규칙을 한 곳에서 통제 가능

단점:

- Vercel Hobby Serverless Functions 개수 제한을 다시 확인해야 함
- 현재 API 파일 수가 제한에 근접해 있어 신규 함수 추가가 배포 실패를 유발할 수 있음

### 후보 C: 기존 API 중 하나에 통합

검토 조건:

- Vercel 함수 개수 제한 때문에 `api/auth.js` 신규 생성이 불가능할 때

장점:

- Serverless Function 개수를 늘리지 않음

단점:

- 책임 혼동 위험
- auth/currentUser가 특정 도메인 API에 묶임
- 장기적으로 다시 통합 API를 재정리해야 할 수 있음

## 6. 추천 API 구조

책임 기준으로는 `api/auth.js` 신규 생성이 가장 명확하다.

다만 Vercel Hobby 함수 개수 제한을 이미 경험했으므로 구현 전 현재 함수 수를 반드시 확인해야 한다.

권장 설계:

```http
POST /api/auth
Content-Type: application/json

{
  "action": "resolveCurrentUser",
  "authUserId": "...",
  "email": "optional@example.com"
}
```

동작:

1. `action`이 `resolveCurrentUser`인지 확인한다.
2. `authUserId`가 없으면 `MISSING_AUTH_USER_ID` 반환.
3. service_role으로 `public.users` 조회.
4. 조건은 `auth_user_id = authUserId`.
5. `status`, `role`, `organization_id`, `name`, `email`, `username` 등 currentUser에 필요한 필드만 선택.
6. `organization_id`가 있으면 `organizations.name`을 서버에서 조회하거나 join한다.
7. currentUser 응답 객체를 반환한다.

응답 예:

```json
{
  "success": true,
  "user": {
    "id": "...",
    "authUserId": "...",
    "username": "...",
    "email": "...",
    "name": "...",
    "role": "...",
    "organizationId": "...",
    "organizationName": "...",
    "status": "active"
  }
}
```

실패 응답 후보:

- `METHOD_NOT_ALLOWED`
- `INVALID_ACTION`
- `MISSING_AUTH_USER_ID`
- `USER_NOT_FOUND`
- `USER_INACTIVE`
- `AUTH_USER_RESOLVE_FAILED`

## 7. 보안 주의사항

반드시 지킬 사항:

- `password_hash` 반환 금지
- `password` 관련 필드 반환 금지
- service_role key 클라이언트 노출 금지
- request body 전체 console.log 금지
- email/role 입력값을 과도하게 신뢰하지 않기
- `authUserId` 기준으로 public.users를 조회하기
- 응답 currentUser는 화면에 필요한 최소 필드만 포함
- localStorage에는 최소 currentUser 정보만 저장

추가 주의:

- 클라이언트에서 Supabase Auth `signInWithPassword`는 계속 필요하다.
- 서버 API는 Auth 로그인 이후 public profile/currentUser resolve만 담당한다.
- 서버 API 호출 시 auth session 검증을 강화할지, `authUserId`만 받을지 별도 보안 판단이 필요하다.

## 8. SELECT 권한 정리와의 관계

서버 API 전환 후 가능해지는 것:

- `authService.js`의 `public.users` 직접 SELECT 제거 가능
- `authService.js`의 `public.organizations` 직접 SELECT 제거 가능
- `src` 직접 table SELECT 0개 상태 달성 가능
- 이후 `public.users` / `public.organizations` anon SELECT 제거 검토 가능

단:

- authenticated SELECT 제거는 RLS policy와 이메일 Auth 흐름을 함께 검토해야 한다.
- `users_select_own_profile` policy가 현재 어떤 역할을 하는지 재확인해야 한다.
- mock 로그인은 Supabase Auth session이 없으므로 RLS 기반 currentUser 조회와 별도 흐름으로 남는다.

## 9. Vercel 함수 제한 고려

현재 `api` 폴더에는 여러 Serverless Function 후보가 존재한다.

확인된 주요 API 파일:

- `api/admin-read.js`
- `api/checkers.js`
- `api/reports.js`
- `api/super.js`
- `api/targets.js`
- `api/activity-records/create.js`
- `api/cron/checker-reminders.js`
- `api/emergency-reports/create.js`
- `api/emergency-reports/update-status.js`
- `api/push/send-checker-reminders.js`
- `api/push/subscribe.js`
- `api/push/test-send.js`

주의:

- `_checkerReminderService.js`는 helper 성격 파일이지만 배포 함수 카운트는 Vercel 산정 방식 확인이 필요하다.
- 실제 함수 수는 배포 전 Vercel 빌드/배포 결과로 확인해야 하며, 이 문서에서는 확정하지 않는다.
- `api/auth.js` 신규 생성 전 현재 함수 수를 반드시 확인해야 한다.
- 신규 API가 제한에 걸릴 경우 기존 API 재통합 또는 적절한 통합 API 후보를 정해야 한다.

책임 기준 추천:

- 가능하면 `api/auth.js` 신규 생성

함수 제한이 걸릴 경우:

- 기존 API 중 범용 read 성격에 통합할지 검토
- 또는 기존 함수 재통합으로 여유를 만든 뒤 `api/auth.js` 생성

## 10. 구현 단계 초안

1. 현재 Vercel Serverless Function 수를 확인한다.
2. `api/auth.js` 신규 생성 가능 여부를 판단한다.
3. 불가능하면 기존 API 통합 후보를 결정한다.
4. `resolveCurrentUser` action 설계를 확정한다.
5. `authService.js`의 이메일 Auth currentUser 조회를 서버 API 호출로 전환한다.
6. mock 로그인 흐름은 유지한다.
7. `npm run build`를 실행한다.
8. 이메일 Auth 로그인 QA를 수행한다.
9. mock 로그인 QA를 수행한다.
10. `src` 직접 table SELECT 재검색을 수행한다.
11. SELECT grants 정리 계획을 수립한다.

## 11. 테스트 계획

mock 로그인:

- `admin / 1234` 로그인 정상
- `checker / 1234` 로그인 정상
- `super_admin / 1234` 로그인 정상

이메일 Auth 로그인:

- `admin-eunpyeong@happy-tong.local` 로그인 정상
- `checker-kim@happy-tong.local` 로그인 정상

검증 항목:

- `currentUser.id`가 public.users.id인지 확인
- `currentUser.authUserId`가 auth_user_id인지 확인
- `currentUser.organizationId` 정상
- `currentUser.organizationName` 정상
- `happytong_current_user` 저장/복원 정상
- 로그아웃 정상
- 로그인 실패/비활성 사용자 실패 처리 정상
- password/password_hash가 응답과 localStorage에 포함되지 않는지 확인

## 12. 이번 단계에서 하지 않는 것

- 코드 수정하지 않음
- API 생성하지 않음
- DB/RLS/Auth 수정하지 않음
- SELECT 권한 revoke하지 않음
- `package.json`, `package-lock.json`, `vercel.json` 수정하지 않음
- 함수 수를 확정하지 않음
- 권한 정리가 완료됐다고 판단하지 않음
