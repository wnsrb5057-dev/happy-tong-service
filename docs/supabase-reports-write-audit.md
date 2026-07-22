# Supabase 보고서 Write 전환 사전 점검

## 1. 작업 목적

관리자 보고서 저장/초안 저장 기능을 Supabase write로 전환하기 전에 현재 localStorage 저장 흐름, 보고서 데이터 구조, Supabase DB 후보 구조를 점검한다.

이번 단계는 조사/문서화 단계이며 코드 구현, API 생성, DB 변경은 하지 않는다.

## 2. 현재 관리자 보고서 관리 흐름

관리자 보고서 기능은 `src/pages/adminPages.jsx`의 보고서 작성/미리보기 컴포넌트와 report service 유틸을 중심으로 동작한다.

현재 주요 흐름:

- `/admin/reports`, `/admin/reports/new` → `AdminReportNew`
- `/admin/reports/preview` → `AdminReportPreview`
- 보고서 작성 화면 진입 시 `generateReportDraft(data, "2026-06-10", getTodayFromStats())`로 기본 초안 생성
- `readReportDraft(defaultDraft)`로 localStorage 초안이 있으면 form에 병합
- 보고 기간/본문/관리자 의견 등을 form state로 편집
- `handleAutoGenerate`에서 현재 통계 기반 보고서 본문 자동 생성
- `handleGenerate`에서 보고서 payload 검증 후 `actions.addAdminReport(report)`와 `saveReportDraft(report)` 실행
- `handlePrint`에서 `saveReportDraft(report)` 후 `window.print()` 실행
- `AdminReportPreview`는 `readReportDraft(defaultDraft)`를 다시 읽어 출력용 보고서를 구성

현재 Supabase는 저장용이 아니라 `getSupabaseAdminReportSummary`를 통해 보고서 요약 통계를 읽는 데만 사용된다.

## 3. 관련 컴포넌트/함수

`src/pages/adminPages.jsx`:

- `AdminReportNew`: 보고서 작성/초안/미리보기 생성 화면
- `AdminReportPreview`: 저장된 초안 기반 출력 미리보기 화면
- `ReportDocument`: 보고서 출력 문서 렌더링
- `buildReportInsights`: 활동/이상징후/재배정 통계 계산
- `buildReportNarrative`: 통계 기반 서술 문장 생성
- `toReportPayload`: form 값과 통계 값을 결합해 최종 report payload 생성
- `getValidatedReportPayload`: 제목/기간 검증 후 payload 생성
- `handleAutoGenerate`: 본문 자동작성
- `handleGenerate`: 보고서 생성 및 localStorage 저장
- `handlePrint`: 초안 저장 후 PDF 출력

`src/App.jsx`:

- `adminReports` 상태를 `readAdminReports`, `writeAdminReports`로 관리
- `actions.addAdminReport(report)`로 보고서 목록 저장/갱신

`src/services/adminReportDataService.js`:

- `readAdminReports`
- `writeAdminReports`

`src/services/reportService.js`:

- `generateReportDraft`
- `generateReportSummary`
- `readReportDraft`
- `saveReportDraft`
- `formatReportPeriod`

`src/utils/report.js`:

- `ADMIN_REPORT_DRAFT_KEY`
- `generateReportDraft`
- `saveReportDraft`
- `readReportDraft`

`src/services/supabaseAdminReportSummaryService.js`:

- `getSupabaseAdminReportSummary`
- RPC: `get_public_admin_report_summary`

## 4. 현재 localStorage 보고서 데이터 구조

확인한 localStorage key:

- `happytong_admin_reports`: 최종 생성/저장된 관리자 보고서 목록
- `happytong_report_drafts`: 보고서 작성 초안
- legacy draft keys: `happytong_admin_report_draft`, `happy-tong-admin-report-draft`
- legacy report key: `happy-tong-admin-reports`

mock 및 코드 기준 주요 필드:

- `id`
- `title`
- `periodStart`
- `periodEnd`
- `totalTargets`
- `totalCheckers`
- `totalActivities`
- `externalCount`
- `visitCount`
- `callCount`
- `intensiveCount`
- `emergencyCount`
- `unresolvedEmergencyCount`
- `dangerTargetCount`
- `reassignmentNeededCount`
- `reassignmentNeededTargets`
- `handlingSummary`
- `recentEmergencies`
- `keyIssues`
- `actionTaken`
- `additionalSupportTargets`
- `adminOpinion`
- `overview`
- `emergencySummary`
- `reassignmentSummary`
- `createdAt`
- `updatedAt`

Supabase 전환 시 추가 후보 필드:

- `organizationId`
- `createdBy`
- `createdByName`
- `status`
- `type`
- `content`
- `summary`
- `stats`
- `sections`
- `savedAt`
- `generatedAt`
- `publishedAt`
- `isDraft`

## 5. 관리자 Read 흐름

현재 보고서 read 흐름:

- `readAdminReports()`는 mock `adminReports`와 localStorage `happytong_admin_reports`를 `mergeById`로 병합
- `AdminReportNew`는 `readReportDraft(defaultDraft)`로 초안을 읽음
- `AdminReportPreview`도 `readReportDraft(defaultDraft)`로 저장된 초안을 읽음
- 별도 보고서 상세 조회 화면은 현재 확인되지 않음
- 보고서 목록 전용 UI도 현재는 작성/미리보기 중심이며, `adminReports`는 `actions.addAdminReport`로 상태에 저장됨

Supabase read:

- `getSupabaseAdminReportSummary(organizationId)`만 확인됨
- 이 RPC는 저장된 보고서를 읽는 것이 아니라 기관 기준 활동/이상징후/대상자 요약 통계를 반환한다.
- 보고서 본문/초안/최종본을 읽는 Supabase service는 아직 확인되지 않았다.

보고서 통계 데이터:

- 대부분 화면에서 실시간 계산된 값이다.
- Supabase 요약이 있으면 일부 KPI는 `get_public_admin_report_summary` 결과를 우선 표시한다.
- 최종 보고서 payload에는 생성 시점의 통계 snapshot이 포함된다.

## 6. Supabase Reports 관련 테이블/RPC 후보

확인된 service/RPC:

- `src/services/supabaseAdminReportSummaryService.js`
- RPC: `get_public_admin_report_summary`

아직 확인되지 않은 후보:

- `public.reports`
- `public.admin_reports`
- `public.report_drafts`
- `get_public_admin_reports`
- `get_public_admin_report_detail`
- `save_admin_report`

실제 테이블 존재 여부는 Supabase SQL Editor에서 확인해야 한다.

## 7. 보고서와 Organization/User/기간/통계 데이터 연결 영향

보고서 저장은 다음 연결 정보를 가져야 한다.

- `organization_id`: 관리자 소속 기관
- `created_by`: 관리자 사용자 ID
- `created_by_name`: 관리자 표시명
- `period_start`, `period_end`: 보고 기간
- 활동 기록 통계: `activity_records` 기반
- 이상징후 통계: `emergency_reports`, `emergency_handling_logs` 기반
- 대상자/체커 통계: `targets`, `users` 기반

주의점:

- 보고서 생성 시점의 통계 snapshot을 저장할지, 매번 실시간 재계산할지 결정해야 한다.
- 행정 보고서 출력/보관 용도라면 저장 시점 snapshot을 `stats` JSONB로 보관하는 방식이 안정적이다.
- 본문 섹션은 구조 변경 가능성이 크므로 `sections` 또는 `content` JSONB 후보가 필요하다.

## 8. SQL 점검 체크리스트

아래 SQL은 Supabase SQL Editor에서 확인용으로만 실행한다. 모두 SELECT 계열이며 DB 변경을 하지 않는다.

### report 관련 테이블 존재 여부 조회

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%report%'
    or table_name ilike '%draft%'
  )
order by table_name;
```

### reports/report_drafts/admin_reports 유사 테이블 컬럼 조회

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('reports', 'admin_reports', 'report_drafts')
order by table_name, ordinal_position;
```

### report 관련 FK 조회

```sql
select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('reports', 'admin_reports', 'report_drafts')
order by tc.table_name, tc.constraint_name;
```

### report 관련 CHECK 제약조건 조회

```sql
select
  c.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('reports', 'admin_reports', 'report_drafts')
  and con.contype = 'c'
order by c.relname, con.conname;
```

### report 관련 RLS 활성화 여부 조회

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('reports', 'admin_reports', 'report_drafts')
order by tablename;
```

### report 관련 policy 조회

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('reports', 'admin_reports', 'report_drafts')
order by tablename, policyname;
```

### report 관련 grants 조회

```sql
select
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('reports', 'admin_reports', 'report_drafts')
order by table_name, grantee, privilege_type;
```

### 최근 report 샘플 조회

```sql
select *
from public.reports
order by created_at desc nulls last
limit 10;
```

```sql
select *
from public.admin_reports
order by created_at desc nulls last
limit 10;
```

```sql
select *
from public.report_drafts
order by updated_at desc nulls last
limit 10;
```

### report 관련 RPC 조회

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%report%'
    or p.proname ilike '%draft%'
  )
order by p.proname;
```

## 9. 예상 Write 전환 범위

후보 API:

- `/api/reports` 단일 통합 API

후보 action:

- `createDraft`
- `updateDraft`
- `saveReport`
- `updateReport`
- `deleteDraft`
- `publishReport`

예상 write 대상:

- `public.reports` 또는 `public.admin_reports` insert
- `public.reports` 또는 `public.admin_reports` update
- 초안 저장
- 최종 저장
- 상태 변경: draft/saved/published/completed 등

실제 테이블 존재 여부와 제약조건 확인 전까지는 확정하지 않는다.

## 10. 상태값 매핑 초안

DB 제약조건 확인 전 초안:

- 초안 / `draft` → `draft`
- 생성됨 / `generated` → `generated`
- 저장됨 / `saved` → `saved`
- 완료 / `completed` → `completed`
- 발행 / `published` → `published`

MVP에서는 `draft`, `saved` 두 상태만으로도 시작 가능하다.

## 11. 단일 테이블 vs 초안/최종본 분리 방식 비교

### A안: reports 단일 테이블

구조:

- `reports` 또는 `admin_reports` 하나의 테이블 사용
- `status = draft/saved/published` 등으로 초안/최종본 구분
- `content`, `stats`, `sections`를 JSONB로 저장

장점:

- 구현이 단순하다.
- 목록/상세/read merge가 쉽다.
- Vercel 함수도 `/api/reports` 하나로 유지하기 쉽다.

단점:

- 초안과 최종본의 권한/보존 정책이 복잡해질 경우 분리 필요성이 생길 수 있다.

### B안: report_drafts와 reports 분리

구조:

- `report_drafts`: 작성 중 초안
- `reports`: 최종 저장/발행본

장점:

- 초안과 최종본의 역할이 명확하다.
- 최종본 보존 정책을 엄격히 적용하기 쉽다.

단점:

- 구현 복잡도가 증가한다.
- 초안 → 최종본 전환 로직이 필요하다.
- read/merge와 마이그레이션 범위가 커진다.

현재 MVP 추천:

- A안 우선
- 실제 DB 구조 확인 후 기존 테이블이 이미 분리되어 있으면 그 구조를 따른다.

## 12. Vercel Serverless Function 개수 제한 고려

이 프로젝트는 Vercel Hobby 플랜의 Serverless Function 12개 제한에 걸린 적이 있다.

체커 write 전환에서는 create/update/updateStatus API 3개를 하나의 `/api/checkers`로 통합해 해결했다.

보고서 write 전환도 처음부터 함수 수를 늘리지 않는 방향이 필요하다.

권장:

- `/api/reports` 단일 통합 API
- body의 `action`으로 `createDraft`, `updateDraft`, `saveReport`, `updateReport`, `deleteDraft` 등을 분기
- 새 API 파일을 여러 개 만들지 않는다.

## 13. 구현 단계 초안

1. Supabase report 관련 테이블/RPC 존재 여부 확인
2. 필요한 테이블/컬럼 보완 여부 판단
3. A안 단일 테이블 또는 B안 분리 테이블 결정
4. `/api/reports` 통합 API 설계
5. action 분기 정의: `createDraft`, `updateDraft`, `saveReport`, `updateReport`
6. 관리자 보고서 작성 화면에 Supabase 저장 추가
7. 기존 `saveReportDraft`, `actions.addAdminReport` localStorage 흐름 유지
8. 보고서 목록/미리보기 read 반영 확인
9. 저장된 snapshot 통계와 실시간 통계 표시 기준 결정
10. 테스트 데이터 확인
11. 완료 문서화

## 14. 주의사항

- localStorage fallback은 유지한다.
- 보고서 본문과 통계 snapshot은 구조 변경 가능성이 크므로 JSONB 저장 후보를 검토한다.
- 기간 필드는 `period_start`, `period_end`처럼 명확한 date 컬럼이 필요하다.
- 관리자/기관 권한과 RLS는 마지막 단계에서 정리한다.
- Vercel 함수 개수 제한 때문에 통합 API 방식을 유지한다.
- 보고서 PDF 출력은 브라우저 출력 흐름을 유지하고, 파일 업로드/스토리지는 후속 과제로 분리한다.

## 15. 이번 단계에서 하지 않는 것

- 코드 파일 수정
- API 파일 생성
- DB/SQL/RLS/Auth 수정
- package 파일 수정
- `vercel.json` 수정
- 기존 localStorage 흐름 변경
- 관리자/체커 화면 수정
