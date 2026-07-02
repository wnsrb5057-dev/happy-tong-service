# 해피통서비스 Supabase 전환 계획

## 1. 목적

현재 해피통서비스는 `localStorage` 기반 MVP로 동작합니다.  
다음 단계에서는 기존 화면과 역할 구조를 유지하면서 Supabase 기반 데이터 저장 구조로 천천히 전환합니다.

이 문서의 목표는 전환 순서와 범위를 정리하는 것입니다.

## 2. 현재 단계

- `localStorage` 기반 기능 유지
- 로그인 구조 유지
- 관리자 / 체커 / 총관리자 화면 유지
- 기존 CRUD 및 보고서 기능 유지
- Supabase는 아직 실제 조회/저장에 사용하지 않음

## 3. Supabase 클라이언트 준비

- 준비 파일 위치: `src/services/supabaseClient.js`
- 환경변수:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

현재 단계에서는 위 파일만 준비하고, 앱의 기존 데이터 흐름은 바꾸지 않습니다.

## 4. 전환 원칙

1. 기존 `localStorage` 기능을 한 번에 제거하지 않음
2. 읽기 전용 조회부터 단계적으로 Supabase 전환
3. 쓰기 기능은 조회 안정화 후 전환
4. 전환 중에도 기존 관리자/체커/총관리자 화면은 계속 동작해야 함
5. 인증 전환은 마지막 단계에서 검토

## 5. 실제 데이터 전환 순서

1. `organizations` 조회
2. `users` 조회
3. `targets` 조회
4. `activity_records` 조회
5. `emergency_reports` 조회
6. 쓰기 기능 전환
7. RLS 적용
8. Supabase Auth 검토

## 6. 권장 구현 순서

### 1단계

- Supabase 프로젝트 생성
- 환경변수 설정
- `src/services/supabaseClient.js` 준비
- 앱에서 아직 import하지 않음

### 2단계

- 읽기 전용 서비스부터 별도 추가
- 기존 `localStorage` 서비스와 병행 가능 구조 유지
- 기관, 사용자, 대상자 조회를 우선 연결

### 3단계

- 활동기록, 이상징후, 보고서 조회 전환
- 관리자 대시보드 집계 데이터 전환

### 4단계

- 대상자/체커/이상징후 쓰기 기능 전환
- 보고서 저장 전환

### 5단계

- 기관별 권한 분리를 위한 RLS 적용
- 로그인 구조를 Supabase Auth 기반으로 검토

## 7. 주의사항

- 현재 기본 계정(`checker / 1234`, `admin / 1234`, `super_admin / 1234`)은 그대로 유지해야 합니다.
- 전환 초기에는 화면 로직보다 데이터 접근 계층부터 교체하는 것이 안전합니다.
- 인증, 권한, RLS는 데이터 조회/저장 전환이 안정화된 뒤 적용하는 것이 좋습니다.
- 실서비스 단계에서는 비밀번호를 `localStorage` 방식으로 유지하지 않고 안전한 인증 구조로 전환해야 합니다.
- Supabase 연결 확인은 `/super/dashboard`의 읽기 전용 상태 카드에서만 진행합니다. RLS 정책 적용 전에는 anon key 조회가 제한될 수 있으므로, 연결 오류가 나더라도 기존 localStorage MVP 동작에는 영향을 주지 않도록 유지합니다.
- 현재 `schema.sql`은 RLS enable 상태이므로, RLS policy 적용 전 anon key 기반 count 조회는 0건으로 표시될 수 있습니다. 이는 연결 실패가 아니라 접근 정책 미적용 상태일 수 있습니다.

## 8. 참고 문서

- 스키마 설계: `docs/supabase-schema.md`
- 데모 seed 데이터: `docs/supabase-seed.sql`
- RLS 정책 초안: `docs/supabase-rls-policies.sql`
- 프로젝트 생성 / 환경변수 설정 가이드: `docs/supabase-setup-guide.md`
- 수동 QA 체크리스트: `docs/manual-test-checklist.md`

## 9. RLS 적용 순서

1. `docs/supabase-schema.sql` 실행
2. `docs/supabase-seed.sql` 실행
3. `docs/supabase-rls-policies.sql` 검토
4. `docs/supabase-rls-policies.sql` 적용
5. Supabase Auth 또는 `users.id` 매핑 구조 확인
6. 읽기 전용 조회부터 연결
7. 쓰기 기능 연결

## 10. Health Check RPC 메모

- Supabase 연결 상태 카드는 테이블 row를 직접 공개하지 않기 위해 `docs/supabase-health-rpc.sql`의 `get_public_health_counts()` RPC를 우선 사용합니다.
- 이 RPC는 `organizations`, `users`, `targets`의 count만 반환합니다.
- RPC가 아직 적용되지 않았거나 실행 오류가 나면 앱은 기존 direct count 방식으로 fallback합니다.

## 11. 기관 요약 읽기 전용 전환 메모

- 읽기 전용 전환 1단계에서는 총관리자 기관 요약 화면만 `docs/supabase-organization-summary-rpc.sql`의 `get_public_organization_summaries()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 12. 최근 이상징후 요약 읽기 전용 전환 메모

- 읽기 전용 전환 2단계에서는 총관리자 최근 이상징후 요약만 `docs/supabase-recent-emergencies-rpc.sql`의 `get_public_recent_emergency_summaries()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.

## 13. 총관리자 KPI 읽기 전용 전환 메모

- 읽기 전용 전환 3단계에서는 총관리자 대시보드 상단 KPI가 `docs/supabase-super-dashboard-kpi-rpc.sql`의 `get_public_super_dashboard_kpis()` RPC를 우선 사용합니다.
- RPC 호출이 실패하면 기존 localStorage/mock 데이터로 fallback합니다.
