# 해피통서비스 Supabase Schema 설계

## 1. 전환 목적

- localStorage MVP에서 실제 기관 운영이 가능한 DB 기반 구조로 전환
- 기관별 데이터 분리
- 관리자/체커/총관리자 권한 구조 준비
- 생활 확인 기록, 이상징후, 처리 이력, 보고서 데이터 저장
- 추후 Supabase Auth 및 Row Level Security 적용 준비

## 2. 핵심 권한 구조

- `super_admin`: 전체 기관 관리
- `admin`: 소속 기관 데이터 관리
- `checker`: 본인 배정 대상자 확인/기록

## 3. 주요 테이블 목록

- `organizations`
- `users`
- `targets`
- `activity_records`
- `emergency_reports`
- `emergency_handling_logs`
- `admin_reports`
- `signup_requests`

## 4. organizations 테이블 설계

기관/복지관/센터 단위 정보를 저장하는 테이블입니다.

예상 필드:

- `id uuid primary key`
- `name text not null`
- `region text`
- `address text`
- `phone text`
- `admin_name text`
- `status text default 'pilot'`
- `memo text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

`status` 값:

- `active`: 운영중
- `pilot`: 파일럿
- `paused`: 일시중지
- `ended`: 운영종료

## 5. users 테이블 설계

총관리자, 기관 관리자, 체커 계정을 저장하는 테이블입니다.

예상 필드:

- `id uuid primary key`
- `organization_id uuid references organizations(id)`
- `username text unique not null`
- `password_hash text`
- `name text not null`
- `role text not null`
- `phone text`
- `region text`
- `activity_status text default 'active'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

`role` 값:

- `super_admin`
- `admin`
- `checker`

`activity_status` 값:

- `active`: 활동중
- `paused`: 일시중지
- `left`: 활동종료

주의사항:

- 초기 MVP에서는 `username` 기반 로그인 구조를 사용하지만, 실서비스에서는 비밀번호를 평문 저장하지 않습니다.
- 추후 Supabase Auth 또는 안전한 password hash 구조로 전환해야 합니다.

## 6. targets 테이블 설계

생활 확인 대상자 정보를 저장하는 테이블입니다.

예상 필드:

- `id uuid primary key`
- `organization_id uuid references organizations(id) not null`
- `assigned_checker_id uuid references users(id)`
- `name text not null`
- `age int`
- `gender text`
- `phone text`
- `address text`
- `risk_level text`
- `default_check_type text`
- `check_days text[]`
- `check_time text`
- `health_note text`
- `caution_note text`
- `medication_note text`
- `guardian_name text`
- `guardian_phone text`
- `lifecycle_status text default 'active'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

`risk_level` 값:

- `normal`: 정상
- `caution`: 주의
- `danger`: 위험

`lifecycle_status` 값:

- `active`: 운영중
- `paused`: 일시중지
- `hospitalized`: 입원
- `transferred`: 이관
- `ended`: 관리종료
- `deceased`: 사망
- `unknown_address`: 소재불명

## 7. activity_records 테이블 설계

체커가 작성한 생활 확인 기록을 저장하는 테이블입니다.

예상 필드:

- `id uuid primary key`
- `organization_id uuid references organizations(id) not null`
- `target_id uuid references targets(id) not null`
- `checker_id uuid references users(id) not null`
- `check_type text`
- `checked_at timestamptz`
- `condition_summary text`
- `memo text`
- `created_at timestamptz default now()`

`check_type` 예시:

- 외부 확인
- 전화 확인
- 방문 확인
- 집중 모니터링

## 8. emergency_reports 테이블 설계

체커가 보고하거나 관리자가 확인하는 이상징후 정보를 저장합니다.

예상 필드:

- `id uuid primary key`
- `organization_id uuid references organizations(id) not null`
- `target_id uuid references targets(id) not null`
- `checker_id uuid references users(id)`
- `type text`
- `severity text`
- `status text default 'received'`
- `title text`
- `description text`
- `reported_at timestamptz default now()`
- `completed_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

`status` 값:

- `received`: 접수됨
- `checking`: 확인중
- `contacted`: 보호자 연락
- `visiting`: 방문 필요
- `completed`: 완료

`severity` 값:

- `normal`: 일반
- `caution`: 주의
- `urgent`: 긴급

## 9. emergency_handling_logs 테이블 설계

이상징후 처리 이력을 누적 저장하는 테이블입니다. 하나의 이상징후에 여러 처리 기록이 연결될 수 있습니다.

예상 필드:

- `id uuid primary key`
- `emergency_report_id uuid references emergency_reports(id) not null`
- `organization_id uuid references organizations(id) not null`
- `status text not null`
- `memo text not null`
- `contacted_guardian boolean default false`
- `visit_required boolean default false`
- `created_by uuid references users(id)`
- `created_by_name text`
- `created_at timestamptz default now()`

## 10. admin_reports 테이블 설계

관리자가 생성한 운영 보고서 초안과 출력용 데이터를 저장합니다.

예상 필드:

- `id uuid primary key`
- `organization_id uuid references organizations(id) not null`
- `title text not null`
- `period_start date`
- `period_end date`
- `summary text`
- `action_note text`
- `report_data jsonb`
- `created_by uuid references users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## 11. signup_requests 테이블 설계

기관 도입 문의 또는 가입 신청을 관리합니다.

예상 필드:

- `id uuid primary key`
- `organization_name text`
- `requester_name text`
- `phone text`
- `email text`
- `region text`
- `memo text`
- `status text default 'pending'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

`status` 값:

- `pending`: 대기
- `approved`: 승인
- `rejected`: 반려

## 12. RLS 정책 방향 정리

Row Level Security는 다음 방향을 기준으로 설계합니다.

- `super_admin`은 모든 `organizations/users/targets/records` 접근 가능
- `admin`은 본인 `organization_id` 데이터만 접근 가능
- `checker`는 본인 `organization_id` 중 `assigned_checker_id`가 본인인 `targets`만 접근 가능
- `checker`는 본인이 작성한 `activity_records`와 `emergency_reports`만 생성/조회 가능
- `emergency_handling_logs`는 `admin` 이상만 작성 가능
- `admin_reports`는 `admin` 이상만 작성 가능

이번 문서에서는 정책 방향만 정리하고, 실제 SQL 정책은 다음 단계에서 작성합니다.

## 13. 인덱스 설계

권장 인덱스:

- `targets.organization_id`
- `targets.assigned_checker_id`
- `users.organization_id`
- `users.role`
- `activity_records.organization_id`
- `activity_records.target_id`
- `activity_records.checker_id`
- `activity_records.checked_at`
- `emergency_reports.organization_id`
- `emergency_reports.target_id`
- `emergency_reports.status`
- `emergency_reports.reported_at`
- `emergency_handling_logs.emergency_report_id`
- `admin_reports.organization_id`
- `admin_reports.period_start`
- `admin_reports.period_end`

## 14. localStorage → Supabase 전환 순서

권장 순서:

1. Supabase 프로젝트 생성
2. `organizations` 테이블 생성
3. `users` 테이블 생성
4. `targets` 테이블 생성
5. `activity_records` 테이블 생성
6. `emergency_reports` 테이블 생성
7. `emergency_handling_logs` 테이블 생성
8. `admin_reports` 테이블 생성
9. `signup_requests` 테이블 생성
10. Supabase 클라이언트 설치
11. `supabaseClient.js` 생성
12. 읽기 전용 조회 기능부터 Supabase로 전환
13. 쓰기 기능 전환
14. Supabase Auth 또는 안전한 인증 구조 검토
15. RLS 정책 적용
