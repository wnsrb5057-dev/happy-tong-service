# 해피통서비스 Supabase Auth / Users 매핑 전략

## 1. 목적

이 문서는 해피통서비스 React/Vite MVP에서 현재 사용 중인 임시 UUID 매핑을 제거하고, 이후 `Supabase Auth + public.users + organization + RLS` 구조로 전환하기 위한 설계 기준을 정리한다.

이번 문서의 범위는 구현이 아니라 설계다.

- Supabase Auth 실제 구현 없음
- 로그인 화면 / 로그인 로직 변경 없음
- 기존 localStorage 기반 쓰기 흐름 변경 없음
- RLS 실제 적용 없음
- 기존 화면 코드 변경 없음

## 2. 현재 인증 / 사용자 구조 요약

현재 해피통서비스는 localStorage/mock 로그인 기반 MVP다.

기본 계정:

- `admin / 1234` = 박서연 관리자
- `checker / 1234` = 김민정 체커
- `super_admin / 1234`

현재 상태:

- Supabase Auth 미도입
- 앱의 `currentUser`는 localStorage/mock 로그인 결과를 사용
- Supabase 읽기 전환 1차는 임시 UUID 매핑으로 동작
- 모든 쓰기 기능은 여전히 localStorage 기준 유지

## 3. 현재 임시 매핑 구조

현재 읽기 전용 전환은 로컬 계정 신호를 Supabase seed UUID에 연결하는 방식으로 동작한다.

### 관리자 organization 매핑

- `admin`
- `박서연`
- `행복복지관`
- `은평`
- seed organization id:
  - `11111111-1111-1111-1111-111111111111`

### 충주 organization 매핑

- 충주 계열 로컬 신호
- seed organization id:
  - `22222222-2222-2222-2222-222222222222`

### 체커 user 매핑

- `checker`
- `김민정`
- seed checker id:
  - `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3`

## 4. 임시 매핑을 제거해야 하는 이유

현재 방식은 읽기 전용 MVP 전환에는 유효하지만, 실제 운영 구조로는 한계가 분명하다.

주요 이유:

1. 실제 사용자 계정과 데이터 소유 관계가 분리되어 있다.
2. 기관별 접근 제어를 하드코딩 신호에 의존하게 된다.
3. localStorage id와 Supabase id가 다를 수 있어 읽기/쓰기 혼합 시 mismatch가 생긴다.
4. 관리자/체커 추가 시 매핑 규칙이 계속 늘어나 유지보수가 어려워진다.
5. RLS 정책을 역할과 소속 기준으로 일관되게 적용하기 어렵다.
6. `p_organization_id`, `p_checker_id`를 프론트에서 직접 넘기는 구조는 최종 권한 모델로 적합하지 않다.

## 5. 권장 Auth / Users 구조

권장 방향은 `Supabase Auth`를 실제 로그인 계정 기준으로 사용하고, 앱 도메인 사용자 정보는 `public.users`에서 관리하는 구조다.

기본 원칙:

- `auth.users`는 인증 주체
- `public.users`는 앱 도메인 사용자 정보
- `organization_id`, `role`, `status`는 `public.users`에서 관리
- 화면 접근과 데이터 접근은 `role + organization_id + assignment` 기준으로 제어

## 6. public.users 설계안

권장 필드:

- `id uuid`
- `auth_user_id uuid`
- `organization_id uuid`
- `role text`
- `name text`
- `status text`
- `phone text` 또는 `phone_number text`
- `created_at timestamptz`

role 후보:

- `super_admin`
- `admin`
- `checker`

status 예시:

- `active`
- `paused`
- `left`

상세 스키마 초안과 검토용 SQL은 `docs/supabase-users-schema-plan.md` 문서를 기준으로 관리한다.

## 7. auth.users 와 public.users 연결 방식

두 가지 설계가 가능하다.

### 방식 A. `public.users.id = auth.users.id`

특징:

- 앱 사용자 id와 인증 id를 같은 UUID로 사용
- 조인이 단순하다
- 초기 설계가 가장 단순하다

장점:

- 구조가 직관적이다
- `auth.uid()`와 `public.users.id` 비교가 단순하다
- 새 프로젝트라면 적용이 편하다

주의:

- 기존 데이터 이관이나 별도 도메인 user id 체계가 있으면 유연성이 떨어질 수 있다

### 방식 B. `public.users.id` 별도 유지 + `auth_user_id`로 연결

특징:

- 앱 도메인 user id와 인증 id를 분리
- `public.users.auth_user_id = auth.users.id`

장점:

- 기존 도메인 데이터와의 호환성이 좋다
- 이후 외부 시스템 연계나 데이터 이관에 유연하다
- 앱 사용자 식별자와 인증 식별자의 역할을 분리할 수 있다

주의:

- 조인과 정책 조건이 조금 더 길어진다

### 권장 결론

해피통서비스는 기존 localStorage MVP 이후 운영 전환을 고려해야 하므로, 기본 권장안은 아래와 같다.

- `Supabase Auth`는 실제 로그인 계정 기준으로 사용
- `public.users`는 별도 앱 사용자 테이블로 유지
- `public.users.auth_user_id` 컬럼으로 `auth.users.id`와 연결

단, 아직 데이터 이관 부담이 작고 단순성을 우선하면 `public.users.id = auth.users.id` 방식도 가능하다. 문서상 기본 추천은 분리형 `auth_user_id` 방식으로 둔다.

## 8. 로그인 후 currentUser 구조 제안

로그인 후 앱 전역에서 사용하는 사용자 컨텍스트는 최소한 아래 정보를 포함하는 것이 좋다.

```js
{
  id,
  authUserId,
  role,
  name,
  organizationId,
  organizationName,
  status
}
```

필수 이유:

- `authUserId`: Auth 기준 사용자 식별
- `id`: 앱 도메인 사용자 식별
- `role`: 화면 분기와 권한 제어
- `organizationId`: 기관 범위 데이터 접근 제어
- `organizationName`: 화면 표시
- `status`: 활동 중지 / 종료 처리

## 9. 역할별 접근 범위

### super_admin

- 전체 기관 조회
- 전체 요약 조회
- 기관별 상태 조회

### admin

- 자신의 `organization_id`에 속한 대상자 / 체커 / 이상징후 / 기록 / 보고서만 조회 및 관리

### checker

- 자신에게 배정된 대상자만 조회
- 자신의 확인기록 조회
- 자신이 담당한 대상자에 대한 생활 확인 기록 작성
- 자신이 담당한 대상자에 대한 이상징후 보고 작성

## 10. RLS 설계 원칙

Auth 적용 후에는 RLS 정책도 함께 실제 적용되어야 한다.

기본 원칙:

- `super_admin`은 전체 접근
- `admin`은 자신의 `organization_id` 기준 접근
- `checker`는 자신의 `checker id` 또는 배정 대상자 기준 접근
- 프론트가 임의의 `organization_id`, `checker_id`를 넘겨도 최종 권한은 DB 정책이 판별

예상 정책 방향:

- `targets`: admin은 같은 organization만, checker는 자신에게 assigned 된 항목만
- `activity_records`: admin은 같은 organization만, checker는 자신이 작성했거나 자신 담당 대상자에 연결된 항목만
- `emergency_reports`: admin은 같은 organization만, checker는 자신 담당 대상자에 대한 작성/조회만

## 11. 현재 public RPC와 Auth 이후 전환 방향

현재 구조:

- `public.get_public_*` RPC
- anon grant
- 프론트에서 `p_organization_id`, `p_checker_id`를 전달

Auth 이후 권장 방향:

- `get_my_*` 형태 또는 `auth.uid()` 기반 RPC로 전환
- anon grant 제거 검토
- authenticated grant 기준 재정리
- 가능하면 프론트에서 `organization_id`를 직접 넘기지 않고, RPC/DB 내부에서 `auth.uid()`를 기준으로 사용자와 기관을 계산

예시 방향:

- `get_public_admin_dashboard(p_organization_id uuid)` -> `get_my_admin_dashboard()`
- `get_public_checker_targets(p_checker_id uuid)` -> `get_my_checker_targets()`

## 12. 단계별 전환 계획

1. Auth / users 매핑 전략 문서 확정
2. `public.users` 스키마 문서와 SQL 초안 검토
3. Supabase Auth 시범 계정 생성
4. `public.users`와 `auth.users` 연결
5. 로그인 후 `currentUser`를 Supabase 기준으로 로드
6. 기존 임시 매핑 제거 준비
7. 읽기 RPC를 `auth.uid()` 기반으로 순차 전환
8. RLS 정책 적용
9. 쓰기 기능 전환 시작

## 13. 쓰기 전환 전 체크리스트

- Auth 로그인 정상
- `currentUser` Supabase 기준 로딩 정상
- `role`, `organization_id`, `status` 로딩 정상
- `admin / checker / super_admin` 화면 분기 정상
- 읽기 RPC의 `auth.uid()` 전환 완료
- RLS 테스트 완료
- localStorage id와 Supabase id 혼용 제거 계획 완료

## 14. 권장 결론

해피통서비스의 운영 전환 방향은 아래 조합을 권장한다.

1. `Supabase Auth`를 실제 로그인 계정 기준으로 사용
2. `public.users`에서 `role`, `organization_id`, `status`, `name`을 관리
3. 기본 추천 구조는 `public.users.id` 별도 유지 + `auth_user_id`로 `auth.users.id` 연결
4. 읽기 RPC는 점진적으로 `auth.uid()` 기반 `get_my_*` 형태로 전환
5. 이후 RLS를 역할과 소속 기준으로 적용
6. 마지막에 쓰기 기능을 Supabase로 전환

즉, 해피통서비스 MVP 이후 운영 구조의 권장 조합은 `Supabase Auth + public.users role/organization_id + auth.uid() 기반 RPC + RLS`다.
