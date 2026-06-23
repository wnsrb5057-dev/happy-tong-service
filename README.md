# 해피통서비스 MVP

React + Vite 기반 모바일 PWA 형태의 동네 기반 확인 서비스 MVP입니다. 체커는 대상자 생활 주변 확인, 확인 기록, 이상징후 보고를 작성하고 관리자는 운영 현황, 이상징후, 확인 기록, 통계, 행정 보고서를 확인합니다.

## 실행 방법

```bash
npm install
npm run dev
```

빌드 확인:

```bash
npm run build
```

## 테스트 계정

- 체커: `checker` / `1234`
- 체커 2: `checker2` / `1234`
- 체커 3: `checker3` / `1234`
- 관리자: `admin` / `1234`

## 주요 라우트

- 공통: `/login`
- 체커: `/checker/home`, `/checker/targets`, `/checker/targets/:id`, `/checker/activity/new`, `/checker/activity/history`, `/checker/emergency/new`
- 관리자: `/admin/dashboard`, `/admin/emergencies`, `/admin/emergencies/:id`, `/admin/checkers`, `/admin/targets`, `/admin/targets/:id`, `/admin/activities`, `/admin/statistics`, `/admin/reports/new`, `/admin/reports/preview`, `/admin/exports`

## 인증/권한

- 로그인 상태는 `localStorage`에 저장됩니다.
- 미로그인 상태에서 `/checker/*`, `/admin/*` 접근 시 `/login`으로 이동합니다.
- 체커는 관리자 화면에 접근할 수 없고, 관리자는 체커 화면에 접근할 수 없습니다.
- 로그아웃 시 현재 사용자 저장값이 삭제됩니다.

## localStorage 키

- `happytong_current_user`
- `happytong_activity_records`
- `happytong_emergency_reports`
- `happytong_admin_reports`
- `happytong_report_drafts`

이전 MVP에서 사용한 `happy-tong-*`, `happytong_admin_report_draft` 키는 읽은 뒤 새 키로 마이그레이션됩니다.

## mock data 구조

- `User`: `id`, `username`, `password`, `name`, `role`, `phone`, `status`, `assignedTargetIds`
- `Target`: `id`, `name`, `age`, `gender`, `address`, `healthStatus`, `cautionNote`, `guardianName`, `guardianPhone`, `assignedCheckerId`, `riskLevel`, `lastVisitDate`, `todayScheduled`
- `ActivityRecord`: `id`, `targetId`, `checkerId`, `date`, `type`, `checklist`, `healthStatus`, `memo`, `hasIssue`, `issueSummary`, `status`, `createdAt`, `updatedAt`
- `EmergencyReport`: `id`, `targetId`, `checkerId`, `date`, `issueType`, `description`, `urgency`, `needGuardianContact`, `needAdminAlert`, `status`, `adminMemo`, `createdAt`, `updatedAt`
- `AdminReport`: 기간 통계, 주요 특이사항, 조치 내용, 추가 지원 대상자, 관리자 의견, 생성/수정일을 포함합니다.

현재 기본 데이터는 체커 3명, 대상자 8명, 확인 기록 10건, 이상징후 보고 5건, 관리자 보고서 1건입니다.

## 저장 방식

- 확인 기록, 이상징후 보고, 관리자 보고서, 보고서 초안은 mock data와 localStorage를 병합해 표시합니다.
- 새로 작성한 확인 기록과 이상징후 보고는 새로고침 후에도 유지됩니다.
- 실제 서버나 DB 연동은 아직 없습니다.

## 최종 시연 시나리오

1. `/login`에서 `checker / 1234`로 로그인합니다.
2. 체커 홈에서 오늘 예정 방문과 긴급 버튼을 확인합니다.
3. `/checker/targets`에서 대상자 목록을 열고 상세 화면으로 이동합니다.
4. 상세 화면에서 확인 기록 작성으로 이동해 확인 항목과 메모를 입력한 뒤 저장합니다.
5. `/checker/activity/history?saved=1`에서 저장 완료 메시지와 새 기록을 확인합니다.
6. `/checker/emergency/new`에서 이상징후 보고를 저장하고 체커 홈 알림을 확인합니다.
7. 로그아웃 후 `admin / 1234`로 로그인합니다.
8. 관리자 대시보드, 긴급보고, 활동기록, 통계, 보고서 작성, 데이터 내보내기를 확인합니다.

## 아직 구현하지 않은 기능

- 실제 API/DB 연동
- 실제 사진 업로드와 음성 녹음
- 관리자 보고서 서버 저장/PDF 파일 생성
- 사용자 계정 생성/비밀번호 변경
- 서비스 워커 캐시 전략 고도화
