# 해피통서비스 Supabase 설정 가이드

이 문서는 해피통서비스의 `localStorage` 기반 MVP를 이후 Supabase 기반 구조로 전환하기 전에,
Supabase 프로젝트 생성부터 SQL 실행, 환경변수 설정까지의 준비 단계를 정리한 가이드입니다.

현재 단계에서는 앱 코드를 Supabase로 전환하지 않습니다.  
기존 `localStorage` 기반 기능은 그대로 유지됩니다.

## 1. 현재 준비된 파일

- `docs/supabase-schema.md`: 테이블 설계 설명 문서
- `docs/supabase-schema.sql`: 초기 테이블 생성 SQL
- `docs/supabase-seed.sql`: 데모 seed 데이터 SQL
- `docs/supabase-rls-policies.sql`: RLS 정책 초안 SQL
- `docs/supabase-plan.md`: Supabase 전환 계획 문서
- `.env.example`: 환경변수 예시
- `src/services/supabaseClient.js`: Supabase client 준비 파일

## 2. Supabase 프로젝트 생성 안내

1. [Supabase](https://supabase.com/)에 로그인합니다.
2. `New project`를 선택합니다.
3. 프로젝트 이름을 입력합니다.
   - 예: `happytong-service`
4. 데이터베이스 비밀번호를 설정합니다.
5. 리전을 선택합니다.
   - 국내 사용자가 많다면 Northeast Asia 계열 리전을 우선 검토합니다.
   - 실제 선택 가능한 리전은 Supabase 콘솔에서 확인합니다.
6. 프로젝트 생성이 완료될 때까지 기다립니다.
7. 생성 후 `Project Settings` → `API`로 이동합니다.

### 주의사항

- 데이터베이스 비밀번호는 GitHub에 커밋하지 않습니다.
- Supabase URL과 ANON KEY는 `.env.local`과 Vercel 환경변수에만 넣습니다.
- `.env.example`에는 실제 값을 넣지 않습니다.

## 3. SQL 실행 순서

Supabase SQL Editor에서 아래 순서로 진행하는 것을 권장합니다.

1. `docs/supabase-schema.sql` 실행
2. Table Editor에서 테이블 생성 확인
3. `docs/supabase-seed.sql` 실행
4. Table Editor에서 seed 데이터 확인
5. `docs/supabase-rls-policies.sql` 내용 검토
6. Supabase Auth / `users.id` 매핑 구조 확인
7. RLS 정책 적용 여부 결정 후 `docs/supabase-rls-policies.sql` 실행
8. RLS 적용 후 정책 동작 테스트

### 중요한 주의사항

- `schema.sql`에는 테이블, 인덱스, `RLS enable`까지만 포함되어 있습니다.
- `seed.sql`에는 시연용 가상 데이터만 포함되어 있습니다.
- `rls-policies.sql`은 `auth.uid() = public.users.id`를 전제로 작성되었습니다.
- 현재 앱 로그인은 `localStorage` 기반이라 RLS를 바로 적용하면 실제 연결 시 조회가 막힐 수 있습니다.
- 앱 연결 전에 Auth/RLS 전제를 먼저 확정해야 합니다.

## 4. schema.sql 실행 후 확인 체크리스트

- [ ] `organizations` 테이블 생성
- [ ] `users` 테이블 생성
- [ ] `targets` 테이블 생성
- [ ] `activity_records` 테이블 생성
- [ ] `emergency_reports` 테이블 생성
- [ ] `emergency_handling_logs` 테이블 생성
- [ ] `admin_reports` 테이블 생성
- [ ] `signup_requests` 테이블 생성
- [ ] 각 테이블 `id`가 `uuid default gen_random_uuid()`인지 확인
- [ ] 주요 foreign key 연결 확인
- [ ] 주요 check constraint 확인
- [ ] 주요 index 생성 확인
- [ ] RLS enable 상태 확인

## 5. seed.sql 실행 후 확인 체크리스트

- [ ] `행복복지관` 기관 데이터 확인
- [ ] `충주돌봄센터` 기관 데이터 확인
- [ ] `super_admin` 사용자 확인
- [ ] `admin` 사용자 확인
- [ ] `checker`, `checker_paused`, `checker_left` 사용자 확인
- [ ] 대상자 6명 확인
- [ ] 확인 기록 데이터 확인
- [ ] 이상징후 데이터 확인
- [ ] 이상징후 처리 이력 확인
- [ ] 관리자 보고서 샘플 확인
- [ ] 가입 신청 샘플 확인
- [ ] 실제 개인정보가 아닌 가상 데이터인지 확인

## 6. 로컬 개발용 환경변수 설정

파일:

- `.env.local`

예시:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

### 환경변수 위치 확인

- Supabase Dashboard
- `Project Settings`
- `API`
- `Project URL`
- `Project API keys`
- `anon public key`

### 주의사항

- `.env.local`은 Git에 커밋하지 않습니다.
- `.env.example`에는 실제 값을 넣지 않습니다.
- Vite에서는 `VITE_` 접두사가 있어야 클라이언트에서 읽을 수 있습니다.

## 7. Vercel 환경변수 설정

Vercel Dashboard에서 아래 값을 추가합니다.

위치:

- 해당 프로젝트 선택
- `Settings`
- `Environment Variables`

추가할 값:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

적용 대상:

- Production
- Preview
- Development

### 주의사항

- 환경변수 추가 후 재배포가 필요합니다.
- GitHub에는 실제 키를 올리지 않습니다.
- `anon key`는 공개 키지만 RLS 정책이 전제되어야 안전합니다.
- `service_role key`는 프론트엔드용 Vercel 환경변수에 넣지 않습니다.

## 8. RLS 적용 전 주의사항

- 현재 RLS 정책 초안은 `auth.uid() = public.users.id` 전제를 사용합니다.
- 현재 로그인 구조는 `localStorage` 기반이라 바로 연결되지 않습니다.
- Supabase Auth를 사용할지, 기존 `users` 테이블과 어떻게 매핑할지 먼저 결정해야 합니다.
- 정책 적용 전 SQL Editor에서 helper function과 정책 조건을 다시 검토하는 것이 좋습니다.
- RLS를 켠 상태에서 policy가 부정확하면 앱에서 모든 조회가 막힐 수 있습니다.
- 초기 연결 테스트는 읽기 전용 조회부터 단계적으로 진행하는 것을 권장합니다.

## 9. 앱 연결 전 체크리스트

- [ ] `docs/supabase-schema.sql` 실행 완료
- [ ] `docs/supabase-seed.sql` 실행 완료
- [ ] 테이블/데이터 확인 완료
- [ ] `.env.local` 설정 완료
- [ ] Vercel 환경변수 설정 완료
- [ ] RLS 적용 여부 결정
- [ ] Supabase Auth / `users.id` 매핑 구조 결정
- [ ] 읽기 전용 조회부터 연결할 화면 결정
- [ ] `localStorage` fallback 유지 여부 결정
- [ ] `npm run build` 성공 확인

## 10. 권장 연결 순서

1. Supabase client 설정 확인
2. `organizations` 읽기 테스트
3. `targets` 읽기 테스트
4. `users` / `checkers` 읽기 테스트
5. `activity_records` 읽기 테스트
6. `emergency_reports` 읽기 테스트
7. 관리자 대시보드 읽기 데이터 전환
8. 대상자 목록 읽기 데이터 전환
9. 체커 화면 읽기 데이터 전환
10. 쓰기 기능 전환
11. 이상징후 처리 이력 쓰기 전환
12. 보고서 저장 전환
13. RLS 정책 적용/검증
14. `localStorage` fallback 제거 여부 결정

### 권장 원칙

- 처음부터 전체 서비스를 Supabase로 바꾸지 않습니다.
- 화면별 읽기 전용부터 전환합니다.
- 각 단계마다 `npm run build`와 수동 QA를 함께 진행합니다.

## 11. 문제 발생 시 되돌리기 기준

- 코드가 깨졌다면 마지막 정상 커밋으로 되돌립니다.
- Supabase SQL은 테스트 프로젝트에서 먼저 실행하는 것을 권장합니다.
- RLS 적용 후 접근이 막히면 바로 policy 조건을 점검합니다.
- 필요하면 일시적으로 정책을 제거하고 원인을 먼저 확인합니다.
- GitHub에는 실제 환경변수나 비밀번호를 커밋하지 않습니다.
