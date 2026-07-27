# 높은 위험 Supabase RPC 서버 API 전환 완료

## 1. 작업 개요

PUBLIC/anon EXECUTE가 열려 있던 높은 위험 `get_public_*` RPC 6개를 클라이언트 직접 RPC 호출에서 `/api/super` 서버 API 호출로 전환했다.

이번 전환은 mock 로그인 상태에서 화면 read를 유지하면서도, 향후 높은 위험 RPC의 PUBLIC/anon EXECUTE 제거를 검토할 수 있도록 하기 위한 기반 작업이다.

## 2. 전환 대상 RPC

- `get_public_health_counts()`
- `get_public_organization_summaries()`
- `get_public_organization_detail(p_organization_id uuid)`
- `get_public_recent_emergency_summaries()`
- `get_public_super_dashboard_kpis()`
- `get_public_super_status_summaries()`

## 3. 생성/수정 파일

생성:

- `api/super.js`

수정:

- `src/services/supabaseHealthService.js`
- `src/services/supabaseOrganizationSummaryService.js`
- `src/services/supabaseOrganizationDetailService.js`
- `src/services/supabaseRecentEmergencyService.js`
- `src/services/supabaseSuperDashboardKpiService.js`
- `src/services/supabaseSuperStatusService.js`
- `vercel.json`

## 4. `api/super.js` action 목록

`POST /api/super` 단일 API에서 `body.action`으로 분기한다.

- `getHealthCounts`
- `getOrganizationSummaries`
- `getOrganizationDetail`
- `getRecentEmergencySummaries`
- `getDashboardKpis`
- `getStatusSummaries`

잘못된 action 요청은 아래 형태로 응답한다.

```json
{
  "success": false,
  "code": "INVALID_ACTION",
  "message": "Invalid super action."
}
```

## 5. service 전환 내용

아래 service에서 클라이언트 `supabase.rpc("get_public_*")` 직접 호출을 제거하고, `fetch("/api/super")` 호출로 전환했다.

- `supabaseHealthService.js`
- `supabaseOrganizationSummaryService.js`
- `supabaseOrganizationDetailService.js`
- `supabaseRecentEmergencyService.js`
- `supabaseSuperDashboardKpiService.js`
- `supabaseSuperStatusService.js`

각 service의 기존 normalize 함수와 화면 반환 계약은 유지했다.

유지한 반환 구조:

- `ok`
- `source`
- `message`
- `organizations`
- `organization`
- `emergencies`
- `kpis`
- `statuses`
- health count 관련 필드

## 6. fallback 유지 방식

Supabase/API 호출 실패 시 service는 기존처럼 `ok: false`, `source: "error"` 또는 `source: "not_configured"` 형태를 반환한다.

`src/pages/superAdminPages.jsx`의 기존 localStorage/mock fallback 흐름은 유지되므로, API 실패 시에도 총관리자 화면은 로컬 데이터 기준으로 표시될 수 있다.

## 7. Vercel rewrite 문제와 수정 내용

기존 `vercel.json`에는 전체 catch-all rewrite가 있었다.

기존:

```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

문제:

- `POST /api/super` 요청까지 SPA fallback rewrite에 걸림
- 응답이 API JSON이 아니라 `index.html`로 떨어짐
- 증상: `Content-Disposition: inline; filename="index.html"`와 함께 `405 Method Not Allowed`

변경:

```json
{
  "source": "/((?!api/).*)",
  "destination": "/index.html"
}
```

수정 후 `/api/*` 요청은 SPA fallback 대상에서 제외되어 API 함수로 처리된다.

`crons` 설정은 유지했다.

## 8. 배포 후 API smoke test 결과

확인된 결과:

- `POST /api/super {}` → `400 INVALID_ACTION` 정상
- `POST /api/super action=getDashboardKpis` → `200 success true` 정상
- `POST /api/reports {}` → `400 INVALID_ACTION` 정상

로컬 확인:

- `node --check api/super.js` 성공
- `npm run build` 성공
- `package.json` 변경 없음

## 9. 현재 보안 상태 변화

이번 작업으로 총관리자/기관성 높은 위험 RPC 6개는 클라이언트 anon 직접 RPC 호출 경로에서 제거되었다.

현재 의미:

- mock 로그인 상태에서도 `/api/super` 서버 API를 통해 화면 read 유지 가능
- service_role 기반 서버 API read 구조 추가
- 향후 해당 RPC의 PUBLIC/anon EXECUTE 제거를 검토할 수 있는 기반 마련

단, 이번 작업은 RPC 권한 정리 자체를 수행한 것은 아니다.

## 10. 남은 작업

1. 지정된 6개 service 외 클라이언트 `get_public_*` RPC 잔여 확인
2. 높은 위험 RPC의 PUBLIC/anon EXECUTE 제거 전 최종 확인
3. 총관리자 화면 QA
4. 관리자/체커 조직 단위 RPC 서버 API 전환 계획
5. RLS/SELECT 권한 정리 후속 단계

## 11. 후속 권한 정리 가능성

다음 조건이 충족되면 높은 위험 RPC의 PUBLIC/anon EXECUTE 제거를 검토할 수 있다.

- 클라이언트에서 해당 6개 RPC를 직접 호출하지 않는 상태 확인
- `/api/super` 배포 및 smoke test 정상 확인
- 총관리자 화면 QA 완료
- mock 로그인과 Supabase Auth 로그인 양쪽에서 read 흐름 확인

권한 정리 시에도 `service_role`과 `postgres` 권한은 유지해야 한다.

이번 문서는 전환 완료 내용을 정리한 문서이며, RPC 권한 revoke 완료 문서가 아니다.
