# Supabase 체커 Write 전환 완료 문서

## 1. 작업 개요

관리자 체커 등록, 수정, 상태 변경 기능을 Supabase write 병행 구조로 전환했다.

기존 localStorage 저장 흐름은 제거하지 않고 유지했다. Supabase write가 실패해도 기존 화면 UX가 깨지지 않도록 했고, 실패 원인은 민감값 없이 `code`, `message`, `status`만 `console.warn`에 남기도록 했다.

이번 단계에서는 Supabase Auth 계정 생성은 제외했다. 구현 범위는 `public.users` write에 한정했다.

Vercel Hobby 플랜의 Serverless Function 개수 제한 때문에 체커 create/update/updateStatus API를 각각 만들지 않고, 하나의 통합 API인 `POST /api/checkers`로 구성했다.

## 2. DB 구조

`public.users` 주요 컬럼:

- `id`
- `organization_id`
- `username`
- `password_hash`
- `name`
- `role`
- `phone`
- `region`
- `activity_status`
- `created_at`
- `updated_at`
- `auth_user_id`
- `email`
- `status`

## 3. FK/제약조건

- `organization_id` → `organizations.id`
- `auth_user_id` → `auth.users.id`
- `role`: `super_admin`, `admin`, `checker`
- `activity_status`: `active`, `paused`, `left`
- `username` unique

## 4. 구현 API

- `POST /api/checkers`

## 5. Action 분기

`POST /api/checkers`는 request body의 `action` 값으로 분기한다.

- `action=create`
- `action=update`
- `action=updateStatus`
- 그 외 값 또는 누락은 `INVALID_ACTION` 처리

## 6. Create 동작

`action=create`는 `public.users`에 체커 row를 insert한다.

주요 처리:

- `role`은 `checker`로 고정
- `username`, `name` 필수
- `organization_id` 저장
- `status`, `activity_status` 정규화
- `auth_user_id`는 생성하지 않음
- password 원문은 저장하지 않음
- `password_hash`는 명시 payload가 있을 때만 후보로 사용
- `username` unique 충돌 시 `CHECKER_USERNAME_DUPLICATED`

성공 응답:

```json
{
  "success": true,
  "saved": true,
  "checkerId": "..."
}
```

## 7. Update 동작

`action=update`는 `checkerId` 기준으로 `public.users` row를 update한다.

주요 처리:

- `checkerId`로 기존 체커 조회
- `role`이 `checker`인지 확인
- `role`은 수정하지 않음
- `auth_user_id`는 수정하지 않음
- `password_hash`는 수정하지 않음
- `username`, `name`, `phone`, `region`, `email`, `status`, `activity_status` 수정
- `updated_at` 갱신
- `username` unique 충돌 시 `CHECKER_USERNAME_DUPLICATED`

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "checkerId": "..."
}
```

## 8. UpdateStatus 동작

`action=updateStatus`는 `checkerId` 기준으로 체커 상태만 변경한다.

주요 처리:

- `status` 변경
- `activity_status` 변경
- `updated_at` 갱신
- 체커 row 삭제하지 않음
- `targets.assigned_checker_id`는 자동 변경하지 않음
- 담당 대상자 재배정 정책은 후속 과제로 분리

성공 응답:

```json
{
  "success": true,
  "updated": true,
  "checkerId": "...",
  "status": "inactive",
  "activityStatus": "paused"
}
```

## 9. 상태값 정규화

`activity_status` 정규화:

- `active`: `active`, `활동중`, `활동 중`, `정상`, `운영중`, `운영 중`, `재개`, `활동재개`, `활동 재개`
- `paused`: `paused`, `pause`, `일시중지`, `일시 중지`, `중지`, `보류`, `휴면`, `비활성`, `inactive`
- `left`: `left`, `leave`, `resigned`, `quit`, `활동종료`, `활동 종료`, `퇴사`, `탈퇴`, `종료`

`status` 정규화:

- `activity_status = active` → `status = active`
- `activity_status = paused` → `status = inactive`
- `activity_status = left` → `status = inactive`

## 10. 관리자 화면 연결

관리자 화면 연결 위치:

- `AdminCheckerNew.handleSubmit`: `createSupabaseChecker` 호출
- `AdminCheckerEdit.handleSubmit`: `updateSupabaseChecker` 호출
- `AdminCheckerDetail` 상태 변경 버튼: `updateSupabaseCheckerStatus` 호출

주요 처리:

- 기존 localStorage 저장 흐름 유지
- `currentUser` 기반으로 `organizationId` resolve
- fallback organizationId는 TODO 주석으로 남김
- Supabase 실패 시 `console.warn`에 `code`, `message`, `status`만 출력
- 전체 payload 로그 금지
- password 로그 금지

## 11. Vercel 이슈와 해결

처음에는 체커 API를 아래 3개 Serverless Function으로 만들었다.

- `/api/checkers-create`
- `/api/checkers-update`
- `/api/checkers-update-status`

하지만 Vercel Hobby 플랜의 Serverless Function 12개 제한으로 Production Deployment가 실패했다.

확인된 오류:

```text
No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.
Create a team (Pro plan) to deploy more.
```

해결:

- 체커 API 3개를 `/api/checkers` 하나로 통합
- request body의 `action` 기반 분기 사용
- 체커 관련 Serverless Function 수를 3개에서 1개로 축소
- 기존 crons 설정 유지

## 12. 테스트 완료 기준

API 단독 테스트:

- `POST /api/checkers` body `{}` → `INVALID_ACTION` 확인
- `action=create` 성공
- `action=update` 성공
- `action=updateStatus` 일시중지 성공
- `action=updateStatus` 활동재개 성공

화면 테스트:

- 관리자 화면 새 체커 등록 성공
- `public.users` 신규 row 생성 확인
- 관리자 화면 체커 수정 성공
- `public.users` 수정 반영 확인
- 일시중지 정상 확인
- 활동재개 정상 확인
- 활동종료 정상 확인

## 13. 확인된 테스트 데이터

API 테스트:

- `username`: `checker_api_test_01`

화면 테스트:

- `username`: `checker_ui_test_01`
- `name`: `화면체커테스트`
- `phone`: `010-9999-4001` → `010-9999-4002`
- `region`: `은평구 화면동` → `은평구 화면수정동`
- `status`, `activity_status` 정상 반영
- `auth_user_id`는 `null` 유지

## 14. 남은 주의사항

- Supabase Auth 계정 생성은 후속 과제
- 체커 로그인 계정 발급 정책 별도 설계 필요
- `paused`, `left` 체커의 담당 대상자 재배정 정책은 후속 과제
- RLS/권한 정리는 마지막 단계에서 진행
- localStorage fallback은 아직 유지
- 테스트 데이터 정리 필요
