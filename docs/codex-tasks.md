# 해피통서비스 Codex 작업 지시서

## 공통 원칙

모든 작업은 아래 원칙을 지킨다.

- 한 번에 한 기능만 수정한다.
- 기존 라우팅과 로그인 흐름을 깨지 않는다.
- 한글 인코딩이 깨지지 않도록 한다.
- npm run build를 반드시 실행한다.
- 수정 파일과 테스트 방법을 요약한다.
- localStorage 기반 MVP 동작은 유지한다.
- 대규모 디자인 변경은 하지 않는다.

---

## 1. CSS/레이아웃 안정화

목표:
- styles.css 중복 override 정리
- 관리자 filter-tabs 공통 스타일 정리
- 체커/관리자 카드 스타일 유지
- 모바일/PC 반응형 유지
- 보고서 날짜 입력칸과 PDF 출력 유지

확인 화면:
- /checker/home
- /checker/targets
- /checker/activity
- /checker/history
- /admin/dashboard
- /admin/emergencies
- /admin/targets
- /admin/checkers
- /admin/activities
- /admin/stats
- /admin/reports
- /admin/reports/preview

---

## 2. 데이터 계층 정리

목표:
- localStorage 접근을 service 계층으로 모은다.
- users, organizations, targets, activityRecords, emergencyReports, adminReports, signupRequests 읽기/쓰기 함수를 분리한다.
- UI 컴포넌트가 localStorage를 직접 다루지 않게 한다.
- Supabase 전환이 쉬운 구조로 만든다.
- 기존 기능은 유지한다.

---

## 3. 대상자 등록/수정/관리종료

목표:
- /admin/targets에 대상자 등록 버튼 추가
- 대상자 등록 화면 또는 모달 추가
- 대상자 상세에 정보 수정 버튼 추가
- 삭제가 아니라 관리종료 기능 추가
- 관리종료된 대상자는 기본 목록에서 제외
- 필요 시 필터로 관리종료 대상자 확인 가능
- 체커 화면에서는 관리중 대상자만 노출

필수 필드:
- 이름
- 나이
- 성별
- 주소
- 위험도
- 기본 확인 유형
- 확인 요일
- 확인 시간
- 담당 체커
- 건강상태
- 주의사항
- 복약 메모
- 보호자 이름
- 보호자 연락처

---

## 4. 총관리자 기본 구조

목표:
- super_admin 역할 추가
- 테스트 계정 superadmin / 1234 추가
- /super/dashboard 추가
- /super/organizations 추가
- 총관리자 전용 레이아웃 추가
- 기관별 관리자 수, 체커 수, 대상자 수, 운영 상태 표시

메뉴:
- 대시보드
- 기관 관리
- 계정 승인
- 전체 통계
- 시스템 설정

---

## 5. 내부 알림/마감관리 구조

목표:
- notifications 데이터 구조 추가
- 체커 본인 알림 조회
- 관리자 기관 알림 조회
- 대시보드 미확인 알림 카운트 표시
- 실제 푸시 알림은 구현하지 않음

알림 유형:
- today_schedule
- activity_due
- activity_overdue
- emergency_received
- emergency_urgent
- record_revision_requested

---

## 6. Supabase 전환

기준 문서:
- docs/supabase-plan.md

목표:
- 먼저 설계에 맞춰 dataService를 Supabase로 교체 가능한 구조로 만든다.
- 실제 Supabase 연결은 단계적으로 진행한다.