# Supabase 대상자 Write 전환 완료 문서

## 1. 작업 개요

관리자 대상자 등록, 수정, 관리종료 기능을 Supabase write 병행 구조로 전환했다. 관리종료된 대상자를 다시 운영 대상자로 되돌리는 재관리시작 기능도 추가했다.

기존 localStorage 저장 흐름은 제거하지 않고 유지했다. 화면은 기존 UX를 먼저 보존하고, Supabase 저장은 서버 API route를 통해 추가 호출하는 방식으로 연결했다. Supabase write API는 브라우저에 service role key를 노출하지 않도록 Vercel 서버 API에서 service_role 기반으로 실행한다.

## 2. DB 구조

`public.targets` 주요 컬럼:

- `id`: 대상자 ID
- `organization_id`: 소속 기관 ID
- `assigned_checker_id`: 담당 체커 사용자 ID
- `name`: 대상자 이름
- `age`: 나이
- `gender`: 성별
- `phone`: 대상자 연락처
- `address`: 주소
- `risk_level`: 위험도
- `default_check_type`: 기본 확인 유형
- `check_days`: 확인 요일
- `check_time`: 확인 시간
- `health_note`: 건강 메모
- `caution_note`: 주의사항
- `medication_note`: 복약 메모
- `guardian_name`: 보호자 이름
- `guardian_phone`: 보호자 연락처
- `lifecycle_status`: 관리 상태
- `created_at`: 생성 시각
- `updated_at`: 수정 시각

## 3. FK/제약조건

- `organization_id` → `organizations.id`
- `assigned_checker_id` → `users.id`
- `risk_level`: `normal`, `caution`, `danger`
- `lifecycle_status`: `active`, `paused`, `ended`, `hospitalized`, `transferred`, `deceased`, `unknown_address`

## 4. 생성된 API

- `/api/targets/create`
- `/api/targets/update`
- `/api/targets/update-status`

## 5. Create API 정리

`/api/targets/create`는 관리자 대상자 등록 화면에서 생성한 대상자 payload를 받아 `public.targets`에 insert한다.

주요 처리:

- `targets` insert
- 기관 ID 확인 후 `organization_id` 저장
- 담당 체커 resolve 후 `assigned_checker_id` 저장
- `risk_level` 정규화
- `lifecycle_status` 정규화
- `check_days` 배열 정규화
- `age` 숫자 정규화

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "targetId": "..."
}
```

## 6. Update API 정리

`/api/targets/update`는 관리자 대상자 수정 화면에서 변경한 값을 받아 기존 `targets` row를 update한다.

주요 처리:

- `targets` update
- `assigned_checker_id`가 비어 있거나 누락되면 기존 값 유지
- 명시적으로 `null`이 전달된 경우에만 미배정 처리
- 담당 체커를 id, email, username, name 후보로 resolve
- `risk_level`, `lifecycle_status`, `check_days`, `age` 정규화

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "targetId": "..."
}
```

## 7. Update Status API 정리

`/api/targets/update-status`는 대상자 관리 상태만 변경한다.

주요 처리:

- `lifecycle_status` 변경
- 관리종료: `ended`
- 재관리시작: `active`
- `updated_at` 갱신
- `assigned_checker_id`는 변경하지 않음

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "targetId": "...",
  "lifecycleStatus": "active"
}
```

## 8. 담당 체커 Resolve 기준

담당 체커는 프론트에서 전달되는 값이 로컬 id일 수도 있고 Supabase UUID일 수도 있어 서버 API에서 보강 resolve한다.

지원 기준:

- UUID-like id
- email
- username
- name
- `김하나 체커` 같은 표시명

조회 시 `organization_id`가 같은 체커를 우선하고, `role = checker` 조건을 사용한다. 같은 기관의 active 체커가 있으면 해당 row를 우선 사용한다.

## 9. 관리자 화면 반영

반영된 화면 흐름:

- `AdminTargetNew`: 기존 localStorage 등록 유지, Supabase create API 추가 호출
- `AdminTargetEdit`: 기존 localStorage 수정 유지, Supabase update API 추가 호출
- `AdminTargetDetail`: 관리종료와 재관리시작 시 Supabase update-status API 호출
- Supabase-only 대상자도 목록, 상세, 수정 화면에서 표시 및 수정 가능
- localStorage fallback 유지

Supabase 저장 실패 시에도 기존 localStorage 흐름과 화면 이동은 깨지지 않도록 처리했다.

## 10. 카드 UI 개선 내용

관리자 대상자 목록 카드의 표시 품질을 보완했다.

- 대상자 이름, 연령, 성별, 지역, 연락처 정보 위계 정리
- 담당 체커, 기본 확인 유형, 확인 요일, 최근 확인일 메타 정보 정리
- 재배정 필요 배지는 담당 체커가 없는 경우에만 표시
- 관리종료 대상자에 비활성 톤 적용
- 모바일에서 카드 레이아웃이 한 줄로 무리하게 눌리지 않도록 보완

## 11. 테스트 완료 기준

확인된 기준:

- `/api/targets/create` 성공
- `/api/targets/update` 성공
- `/api/targets/update-status` 성공
- 관리자 화면 대상자 등록 정상
- 관리자 대상자 목록 반영 정상
- 대상자 상세 진입 정상
- 대상자 정보 수정 정상
- 관리종료 정상
- 재관리시작 정상
- `assigned_checker_id` 저장 확인
- 대상자 수정 후 `assigned_checker_id` 유지 확인
- 관리종료 후 `assigned_checker_id` 유지 확인
- 재관리시작 후 `assigned_checker_id` 유지 확인
- `lifecycle_status`가 `ended`에서 `active`로 전환되는 것 확인
- `package.json` 변경 없음
- `npm run build` 성공

## 12. 남은 주의사항

- RLS/권한 정리는 마지막 단계에서 진행한다.
- localStorage fallback은 아직 유지 중이다.
- 체커 등록, 수정, 상태 변경 기능이 다음 write 전환 대상이다.
- 추후 seed/test 데이터 정리가 필요하다.
