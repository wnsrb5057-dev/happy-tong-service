-- 해피통서비스 Supabase 데모 seed 데이터
-- docs/supabase-schema.sql 실행 후 사용하는 예시 데이터입니다.
-- MVP 시연용 샘플 데이터이며, 실제 개인정보가 아닌 가상 데이터만 포함합니다.
-- 실제 서비스 적용 전에는 기관별 실제 데이터로 교체가 필요합니다.

-- 실행 순서:
-- 1. docs/supabase-schema.sql 실행
-- 2. docs/supabase-seed.sql 실행
-- 3. Supabase Table Editor에서 데이터 확인
-- 4. RLS policy 적용 전까지는 앱 연결을 진행하지 않음
-- 5. 다음 단계에서 읽기 전용 조회부터 연결

insert into public.organizations (
  id, name, region, address, phone, admin_name, status, memo
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '행복복지관',
    '서울시 은평구',
    '서울시 은평구 행복로 12',
    '02-0000-1000',
    '박서윤 관리자',
    'active',
    '독거노인 생활 확인 시범 운영 기관'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '충주돌봄센터',
    '충청북도 충주시',
    '충청북도 충주시 관아로 20',
    '043-000-2000',
    '미배정',
    'pilot',
    '지역 돌봄 운영 검토 기관'
  )
on conflict (id) do update
set
  name = excluded.name,
  region = excluded.region,
  address = excluded.address,
  phone = excluded.phone,
  admin_name = excluded.admin_name,
  status = excluded.status,
  memo = excluded.memo;

insert into public.users (
  id, organization_id, username, password_hash, name, role, phone, region, activity_status
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    null,
    'super_admin',
    'demo-hash-super-admin',
    '해피통 총관리자',
    'super_admin',
    null,
    null,
    'active'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111111',
    'admin',
    'demo-hash-admin',
    '박서윤 관리자',
    'admin',
    '010-0000-1001',
    '서울시 은평구',
    'active'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '11111111-1111-1111-1111-111111111111',
    'checker',
    'demo-hash-checker',
    '김민정 체커',
    'checker',
    '010-0000-2001',
    '은평구',
    'active'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '11111111-1111-1111-1111-111111111111',
    'checker_paused',
    'demo-hash-checker-paused',
    '이정훈 체커',
    'checker',
    '010-0000-2002',
    '은평구',
    'paused'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '11111111-1111-1111-1111-111111111111',
    'checker_left',
    'demo-hash-checker-left',
    '최유리 체커',
    'checker',
    '010-0000-2003',
    '은평구',
    'left'
  )
on conflict (username) do update
set
  organization_id = excluded.organization_id,
  password_hash = excluded.password_hash,
  name = excluded.name,
  role = excluded.role,
  phone = excluded.phone,
  region = excluded.region,
  activity_status = excluded.activity_status;

-- 주의:
-- password_hash는 실제 비밀번호가 아닌 데모용 placeholder입니다.
-- 실제 서비스에서는 Supabase Auth 또는 안전한 password hash 구조가 필요합니다.

insert into public.targets (
  id,
  organization_id,
  assigned_checker_id,
  name,
  age,
  gender,
  phone,
  address,
  risk_level,
  default_check_type,
  check_days,
  check_time,
  health_note,
  caution_note,
  medication_note,
  guardian_name,
  guardian_phone,
  lifecycle_status
) values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '정춘자',
    82,
    '여성',
    '010-0000-3101',
    '서울시 은평구 행복아파트 101동 1001호',
    'danger',
    '전화 확인',
    array['월', '수', '금'],
    '09:00',
    '혈압 관리 필요',
    '아침 시간 응답이 늦을 수 있음',
    '혈압약 오전 복용',
    '김보호',
    '010-0000-3001',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '박영숙',
    78,
    '여성',
    '010-0000-3102',
    '서울시 은평구 행복로 25',
    'caution',
    '방문 확인',
    array['화', '목'],
    '14:00',
    '무릎 통증 있음',
    '외출 시 지팡이 사용',
    '관절약 저녁 복용',
    '박보호',
    '010-0000-3002',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '이복남',
    85,
    '남성',
    '010-0000-3103',
    '서울시 은평구 행복길 33',
    'caution',
    '외부 확인',
    array['월', '목'],
    '11:00',
    '호흡기 약 복용 중',
    '우편물 확인 필요',
    '복약 시간 점검 필요',
    '이보호',
    '010-0000-3003',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '최만수',
    80,
    '남성',
    '010-0000-3104',
    '서울시 은평구 돌봄로 77',
    'normal',
    '전화 확인',
    array['수'],
    '15:30',
    '일상생활 가능',
    '최근 통화 연결 지연',
    '복약 메모 없음',
    '최보호',
    '010-0000-3004',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    '11111111-1111-1111-1111-111111111111',
    null,
    '오정희',
    76,
    '여성',
    '010-0000-3105',
    '서울시 은평구 안심로 12',
    'normal',
    '집중 모니터링',
    array['월', '화', '금'],
    '10:30',
    '기초 건강 상태 안정',
    '추가 연락 필요',
    '점심 약 복용 여부 확인',
    '오보호',
    '010-0000-3005',
    'active'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6',
    '11111111-1111-1111-1111-111111111111',
    null,
    '윤순자',
    88,
    '여성',
    '010-0000-3106',
    '서울시 은평구 평온로 9',
    'danger',
    '방문 확인',
    array['화', '금'],
    '13:00',
    '건강 상태 관찰 필요',
    '관리 종료 테스트용 대상자',
    '복약 메모 없음',
    '윤보호',
    '010-0000-3006',
    'ended'
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  assigned_checker_id = excluded.assigned_checker_id,
  name = excluded.name,
  age = excluded.age,
  gender = excluded.gender,
  phone = excluded.phone,
  address = excluded.address,
  risk_level = excluded.risk_level,
  default_check_type = excluded.default_check_type,
  check_days = excluded.check_days,
  check_time = excluded.check_time,
  health_note = excluded.health_note,
  caution_note = excluded.caution_note,
  medication_note = excluded.medication_note,
  guardian_name = excluded.guardian_name,
  guardian_phone = excluded.guardian_phone,
  lifecycle_status = excluded.lifecycle_status;

insert into public.activity_records (
  id, organization_id, target_id, checker_id, check_type, checked_at, condition_summary, memo
) values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '전화 확인',
    now() - interval '1 day',
    '건강 상태 확인, 식사 여부 확인',
    '아침 식사 완료, 혈압약 복용 확인'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '방문 확인',
    now() - interval '2 day',
    '외출 및 거주 상태 확인',
    '현관 앞 정리 상태 양호, 컨디션 안정'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '외부 확인',
    now() - interval '3 day',
    '우편물 누적 여부 확인',
    '우편물 누적 없음, 추가 연락 필요 없음'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc4',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '전화 확인',
    now() - interval '4 day',
    '통화 연결 지연 여부 확인',
    '세 번째 시도 후 연결됨, 청력 문제 가능성 있음'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc5',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '집중 모니터링',
    now() - interval '5 day',
    '추가 연락 필요 상태 확인',
    '오후 시간대 재연락 필요 메모 남김'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc6',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '방문 확인',
    now() - interval '6 day',
    '실내 이동 상태 확인',
    '실내 이동 가능, 어지럼증 호소는 없음'
  )
on conflict (id) do nothing;

insert into public.emergency_reports (
  id, organization_id, target_id, checker_id, type, severity, status, title, description, reported_at, completed_at
) values
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '연락 두절',
    'urgent',
    'checking',
    '반복 통화 미응답',
    '사전 확인 전화에 반복적으로 응답하지 않아 추가 확인이 필요합니다.',
    now() - interval '1 day',
    null
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd2',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '복약 확인',
    'caution',
    'contacted',
    '복약 확인 필요',
    '복약 여부가 불명확하여 보호자 연락이 필요합니다.',
    now() - interval '2 day',
    null
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd3',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '우편물 누적',
    'caution',
    'completed',
    '우편물 누적 확인',
    '우편물 누적 상태를 확인했고 방문 확인 후 완료 처리했습니다.',
    now() - interval '4 day',
    now() - interval '3 day'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd4',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '통화 지연',
    'caution',
    'received',
    '통화 연결 지연',
    '정기 통화가 늦게 연결되어 추가 확인이 필요합니다.',
    now() - interval '1 hour',
    null
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  target_id = excluded.target_id,
  checker_id = excluded.checker_id,
  type = excluded.type,
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  description = excluded.description,
  reported_at = excluded.reported_at,
  completed_at = excluded.completed_at;

insert into public.emergency_handling_logs (
  id, emergency_report_id, organization_id, status, memo, contacted_guardian, visit_required, created_by, created_by_name, created_at
) values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    '11111111-1111-1111-1111-111111111111',
    'checking',
    '해당자 보호자 연락 전 추가 확인 중입니다.',
    false,
    true,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '박서윤 관리자',
    now() - interval '20 hour'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
    'dddddddd-dddd-dddd-dddd-ddddddddddd2',
    '11111111-1111-1111-1111-111111111111',
    'contacted',
    '보호자에게 복약 확인을 요청했습니다.',
    true,
    false,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '박서윤 관리자',
    now() - interval '30 hour'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3',
    'dddddddd-dddd-dddd-dddd-ddddddddddd3',
    '11111111-1111-1111-1111-111111111111',
    'completed',
    '방문 확인 결과 특이사항 없이 완료 처리했습니다.',
    true,
    true,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '박서윤 관리자',
    now() - interval '70 hour'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4',
    'dddddddd-dddd-dddd-dddd-ddddddddddd4',
    '11111111-1111-1111-1111-111111111111',
    'received',
    '초기 접수 후 관리자 확인 대기 상태입니다.',
    false,
    false,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '박서윤 관리자',
    now() - interval '50 minute'
  )
on conflict (id) do nothing;

insert into public.admin_reports (
  id, organization_id, title, period_start, period_end, summary, action_note, report_data, created_by
) values
  (
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    '11111111-1111-1111-1111-111111111111',
    '2026년 6월 돌봄 운영 보고서 초안',
    date '2026-06-01',
    date '2026-06-30',
    '생활 확인 기록과 이상징후 보고를 기준으로 운영 현황을 정리했습니다.',
    '미처리 이상징후와 재배정 필요 대상자에 대한 관리자 검토가 필요합니다.',
    jsonb_build_object(
      'targetCount', 6,
      'activityRecordCount', 6,
      'emergencyReportCount', 4,
      'unresolvedEmergencyCount', 3,
      'reassignmentNeededCount', 3
    ),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  title = excluded.title,
  period_start = excluded.period_start,
  period_end = excluded.period_end,
  summary = excluded.summary,
  action_note = excluded.action_note,
  report_data = excluded.report_data,
  created_by = excluded.created_by;

insert into public.signup_requests (
  id, organization_name, requester_name, phone, email, region, memo, status
) values
  (
    '99999999-9999-9999-9999-999999999991',
    '충주돌봄센터',
    '이현주',
    '010-0000-4001',
    'pilot@example.com',
    '충청북도 충주시',
    '시범 운영 참여 문의',
    'pending'
  ),
  (
    '99999999-9999-9999-9999-999999999992',
    '강북구복지센터',
    '서다은',
    '010-0000-4002',
    'contact@example.com',
    '서울시 강북구',
    '기관 도입 상담 완료',
    'approved'
  )
on conflict (id) do update
set
  organization_name = excluded.organization_name,
  requester_name = excluded.requester_name,
  phone = excluded.phone,
  email = excluded.email,
  region = excluded.region,
  memo = excluded.memo,
  status = excluded.status;
