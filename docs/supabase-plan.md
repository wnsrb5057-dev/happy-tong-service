# 해피통서비스 Supabase 전환 설계

## 1. 전환 목적

현재 해피통서비스는 localStorage 기반 MVP로 동작한다.  
향후 실사용을 위해 Supabase 기반의 서버 DB/Auth 구조로 전환한다.

전환 목표는 다음과 같다.

- PC/모바일/사용자 간 데이터 동기화
- 기관별 데이터 분리
- 역할 기반 권한 관리
- 체커별 대상자 배정 관리
- 이상징후 보고 및 조치 이력 관리
- 행정 보고서 근거 데이터 관리
- 감사 로그 및 알림 구조 확장

---

## 2. 역할 정의

### super_admin

해피통서비스 운영자.

권한:
- 전체 기관 목록 조회
- 기관 생성/중지/관리
- 기관 관리자 계정 승인
- 전체 운영 통계 조회
- 시스템 설정 관리

주의:
- 전체 민감정보 접근은 제한 가능하게 설계한다.

### admin

지자체, 복지관, 행정복지센터 등 기관 담당자.

권한:
- 자기 기관 대상자 관리
- 자기 기관 체커 관리
- 자기 기관 확인기록 조회
- 자기 기관 이상징후 보고 처리
- 자기 기관 보고서 생성
- 자기 기관 운영 설정 관리

### checker

현장 확인자.

권한:
- 본인에게 배정된 대상자만 조회
- 본인 확인 기록 작성
- 본인 이상징후 보고 작성
- 본인 활동 이력 조회

---

## 3. 핵심 테이블

### organizations

기관 정보.

주요 컬럼:
- id
- name
- organization_type
- region
- address
- phone
- status
- created_at
- updated_at

status 예시:
- active
- pending
- suspended
- closed

---

### profiles

사용자 프로필.

Supabase Auth의 auth.users와 연결한다.

주요 컬럼:
- id
- auth_user_id
- organization_id
- name
- role
- login_id
- email
- phone
- status
- created_at
- updated_at

role:
- super_admin
- admin
- checker

status:
- active
- pending
- suspended
- left

---

### targets

대상자 정보.

주요 컬럼:
- id
- organization_id
- name
- age
- gender
- address
- area
- risk_level
- default_check_type
- check_days
- check_time
- health_status
- caution_note
- medication_note
- guardian_name
- guardian_phone
- lifecycle_status
- created_at
- updated_at

risk_level:
- normal
- caution
- danger

lifecycle_status:
- active
- paused
- hospitalized
- transferred
- ended
- deceased
- unknown_address

주의:
- 대상자는 삭제하지 않고 관리 상태로 처리한다.

---

### target_assignments

체커와 대상자 배정 관계.

주요 컬럼:
- id
- organization_id
- target_id
- checker_id
- assigned_at
- unassigned_at
- status

status:
- active
- ended

---

### activity_records

확인 기록.

주요 컬럼:
- id
- organization_id
- target_id
- checker_id
- check_type
- check_date
- check_time
- result_status
- mood
- meal_status
- medication_status
- note
- issue_detected
- created_at
- updated_at

result_status:
- normal
- need_attention
- no_response
- skipped

---

### emergency_reports

이상징후 보고.

주요 컬럼:
- id
- organization_id
- target_id
- checker_id
- issue_type
- urgency
- description
- status
- reported_at
- resolved_at
- created_at
- updated_at

urgency:
- normal
- caution
- urgent

status:
- received
- checking
- resolved
- closed

---

### emergency_actions

이상징후 조치 이력.

주요 컬럼:
- id
- organization_id
- emergency_report_id
- admin_id
- action_type
- action_note
- created_at

action_type:
- phone_call
- guardian_contact
- visit_requested
- welfare_center_linked
- resolved
- memo

---

### admin_reports

행정 보고서.

주요 컬럼:
- id
- organization_id
- created_by
- title
- period_start
- period_end
- summary
- issue_summary
- action_summary
- evidence_snapshot
- status
- created_at
- updated_at

status:
- draft
- finalized
- exported

주의:
- 보고서 문장은 AI가 생성할 수 있으나, 근거 데이터는 evidence_snapshot에 저장한다.

---

### notifications

앱 내부 알림.

주요 컬럼:
- id
- organization_id
- recipient_id
- recipient_role
- type
- title
- message
- related_entity_type
- related_entity_id
- read_at
- created_at

type:
- today_schedule
- activity_due
- activity_overdue
- emergency_received
- emergency_urgent
- record_revision_requested

---

### audit_logs

감사 로그.

주요 컬럼:
- id
- organization_id
- actor_id
- actor_role
- action
- entity_type
- entity_id
- before_data
- after_data
- created_at

기록 대상:
- 대상자 정보 수정
- 위험도 변경
- 체커 배정 변경
- 이상징후 상태 변경
- 보고서 생성
- 관리 종료 처리
- 계정 상태 변경

---

### organization_settings

기관별 운영 설정.

주요 컬럼:
- id
- organization_id
- default_check_days
- default_check_deadline
- default_check_time
- emergency_notification_enabled
- overdue_notification_enabled
- report_template_type
- created_at
- updated_at

---

## 4. 권한 정책 방향

### super_admin

- organizations 전체 조회 가능
- profiles 전체 운영 현황 조회 가능
- 민감정보 상세 접근은 제한 가능
- 기관 생성/상태 변경 가능

### admin

- organization_id가 본인과 같은 데이터만 조회 가능
- 자기 기관의 targets, checkers, records, reports 관리 가능
- 자기 기관의 organization_settings 수정 가능

### checker

- 본인 profile 조회 가능
- target_assignments에서 본인에게 active로 배정된 대상자만 조회 가능
- 본인 activity_records 작성 가능
- 본인 emergency_reports 작성 가능
- 다른 체커의 기록과 대상자는 조회 불가

---

## 5. 전환 순서

### 1단계: 현재 localStorage 데이터 계층 정리

- UI에서 localStorage 직접 접근 제거
- dataService 계층으로 분리
- actions는 dataService를 통해 데이터 처리

### 2단계: Supabase 프로젝트 생성

- organizations
- profiles
- targets
- target_assignments
- activity_records
- emergency_reports
- admin_reports

핵심 테이블부터 생성한다.

### 3단계: Auth 연결

- 이메일/비밀번호 기반 로그인
- 소셜 로그인은 초기에는 사용하지 않는다
- profiles 테이블에서 role과 organization_id 확인

### 4단계: 관리자 화면부터 DB 연결

- admin dashboard
- admin targets
- admin emergencies
- admin activities

### 5단계: 체커 화면 DB 연결

- checker home
- checker targets
- checker activity
- checker history

### 6단계: 보고서/통계 DB 연결

- 기간별 집계
- 이상징후 근거 데이터
- PDF 출력용 보고서 저장

### 7단계: RLS 적용 강화

- 기관별 데이터 분리
- 체커별 배정 대상자 제한
- 감사 로그 기록

---

## 6. AI 보고서 방향

AI는 판단자가 아니라 문장 작성 보조자로 사용한다.

처리 흐름:
1. DB에서 기간별 근거 데이터 집계
2. 구조화된 보고서 데이터 생성
3. AI에 근거 데이터만 전달
4. AI가 행정 문장 초안 작성
5. 관리자가 검토/수정
6. 최종 보고서 저장 및 PDF 출력

금지:
- AI가 위험도를 임의 판단
- AI가 없는 조치 내용을 생성
- AI가 근거 없는 결론 작성

---

## 7. 비고

해피통서비스는 소셜 로그인 기반 소비자 서비스가 아니라, 기관 승인 기반 업무 계정 서비스로 설계한다.

초기 인증 방식:
- 이메일/비밀번호
- 기관 코드 또는 관리자 승인
- role 기반 라우팅

향후 필요 시:
- 승인된 계정에 한해 Google/Kakao 계정 연동 가능
## 참고

자세한 테이블 구조는 `docs/supabase-schema.md`를 기준으로 합니다.
