# 해피통서비스 public.users 스키마 초안

## 1. 목적

이 문서는 해피통서비스에서 `Supabase Auth`를 실제로 도입하기 전에 `public.users` 테이블 구조와 시범 Auth 계정 생성 계획을 정리하기 위한 설계 문서다.

이번 문서의 범위:

- `public.users` 권장 스키마 초안 정리
- `auth.users` 연결 방식 비교
- 시범 Auth 계정 생성 계획 정리
- `currentUser` 로딩 기준 정리
- RLS 적용 전 준비 사항 정리

이번 문서의 비범위:

- 실제 Auth 구현
- 실제 로그인 로직 변경
- 실제 RLS 적용
- 기존 화면 코드 수정
- localStorage 제거

## 2. public.users 권장 스키마 초안

권장 컬럼:

- `id uuid primary key`
- `auth_user_id uuid unique`
- `organization_id uuid nullable`
- `role text not null`
- `name text not null`
- `status text not null default 'active'`
- `phone text nullable`
- `email text nullable`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz nullable`

### role 후보

- `super_admin`
- `admin`
- `checker`

### status 후보

- `active`
- `inactive`
- `pending`

## 3. id 설계 비교

### 방식 A

- `public.users.id = auth.users.id`

장점:

- 구조가 단순하다
- 조인과 `auth.uid()` 비교가 직관적이다

단점:

- 기존 localStorage/mock id와 Supabase seed id, 임시 UUID 매핑 구조와 충돌 가능성이 있다
- 이관 과정에서 유연성이 떨어질 수 있다

### 방식 B

- `public.users.id`는 앱 도메인 user id로 유지
- `public.users.auth_user_id`로 `auth.users.id` 연결

장점:

- 기존 데이터 전환 과정에서 더 안전하다
- 앱 도메인 id와 인증 id를 분리할 수 있다
- localStorage 기반 MVP에서 운영 구조로 넘어갈 때 충돌을 줄이기 좋다

단점:

- `id`와 `auth_user_id`를 함께 관리해야 한다

### 권장 결론

해피통서비스 현재 상태에서는 방식 B를 권장한다.

이유:

- 기존 localStorage id가 별도로 존재한다
- Supabase seed UUID가 이미 존재한다
- 현재 임시 UUID 매핑 구조도 함께 존재한다
- 전환 과정에서 식별자 충돌 가능성을 줄이는 편이 안전하다

## 4. organization_id 매핑 원칙

- `super_admin`은 `organization_id = null` 허용
- `admin`은 반드시 자신의 소속 `organization_id`를 가져야 한다
- `checker`도 반드시 자신의 소속 `organization_id`를 가져야 한다
- `admin / checker`의 조회 및 쓰기 범위는 `organization_id` 기준으로 제한한다
- `checker`의 실제 활동 범위는 `organization_id`에 더해 본인 `checker id`와 배정 대상자 관계를 기준으로 제한한다

## 5. 시범 Auth 계정 생성 계획

아래는 개발 / 점검용 예시 계정 계획이다.

### super_admin

- email: `super_admin@happy-tong.local`
- role: `super_admin`
- organization_id: `null`
- name: `총관리자`

### 은평 admin

- email: `admin-eunpyeong@happy-tong.local`
- role: `admin`
- organization_id: `11111111-1111-1111-1111-111111111111`
- name: `박서연 관리자`

### 은평 checker

- email: `checker-kim@happy-tong.local`
- role: `checker`
- organization_id: `11111111-1111-1111-1111-111111111111`
- name: `김민정 체커`
- 참고 seed checker id: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3`

### 충주 admin

- email: `admin-chungju@happy-tong.local`
- role: `admin`
- organization_id: `22222222-2222-2222-2222-222222222222`
- name: `충주 관리자`

주의:

- 실제 비밀번호는 문서에 고정하지 않는다
- 로컬 / 개발 / 운영 환경별 이메일 규칙은 별도 관리가 필요하다
- 운영 단계에서는 실제 기관 관리자와 체커 이메일을 사용해야 한다

## 6. 검토용 SQL 초안

아래 SQL은 실제 실행용이 아니라 검토용 초안이다.

```sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  role text not null check (role in ('super_admin', 'admin', 'checker')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

주의 문구:

- 이 SQL은 아직 실행하지 않는다
- 실제 적용 전 기존 `public.users` 존재 여부를 먼저 확인해야 한다
- 컬럼명, FK 구조, seed 데이터 충돌 여부를 먼저 점검해야 한다
- 실제 배포 전에는 migration 전략과 기존 seed 구조를 함께 검토해야 한다

## 7. currentUser 로딩 기준

로그인 후 앱이 로딩해야 하는 최소 정보:

- `authUser.id`
- `public.users.id`
- `public.users.auth_user_id`
- `role`
- `name`
- `organization_id`
- `organization_name`
- `status`

권장 `currentUser` 형태:

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

## 8. RLS 적용 전 준비 사항

- `public.users`와 `auth.users` 연결 확인
- `role / organization_id / status`가 정상 로딩되는지 확인
- `admin`이 자기 `organization_id`만 조회하는지 테스트
- `checker`가 자기 배정 대상자만 조회하는지 테스트
- `super_admin`이 전체 조회 가능한지 테스트
- anon grant 제거와 authenticated grant, RPC 권한 정리 계획 확인
- `auth.uid()` 기반 RPC 전환 계획 확인

## 9. 기존 임시 UUID 매핑 제거 조건

아래 조건이 충족된 뒤에만 현재 임시 UUID 매핑 제거를 진행한다.

- Supabase Auth 로그인 성공
- 로그인 후 `currentUser` Supabase 기준 로딩 성공
- `admin / checker / super_admin` 역할 분기 성공
- `organization_id` 기준 데이터 조회 성공
- `checker id` 기준 배정 대상자 조회 성공
- localStorage 쓰기 기능과 Supabase 읽기 데이터 간 id 혼용 위험 정리 완료
- RLS 테스트 완료

## 10. 다음 작업 제안

1. `public.users` 스키마 설계 문서 확정
2. 실제 Supabase 테이블 상태 점검
3. Auth 시범 계정 생성
4. `public.users` seed 연결
5. 로그인 후 `currentUser` 로딩 시범 적용
6. 기존 mock 로그인과 병행 테스트
7. RPC를 `auth.uid()` 기반으로 순차 전환
8. RLS 적용
9. 쓰기 기능 전환
