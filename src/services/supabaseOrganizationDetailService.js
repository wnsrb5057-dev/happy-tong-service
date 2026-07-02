import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const ORGANIZATION_STATUS_LABELS = {
  active: "운영중",
  pilot: "파일럿",
  paused: "일시중지",
  ended: "운영종료",
  운영중: "운영중",
  파일럿: "파일럿",
  일시중지: "일시중지",
  운영종료: "운영종료",
};

const EMERGENCY_STATUS_LABELS = {
  received: "접수됨",
  checking: "확인중",
  contacted: "보호자 연락",
  visiting: "방문 필요",
  completed: "완료",
  resolved: "완료",
  접수됨: "접수됨",
  확인중: "확인중",
  처리중: "확인중",
  완료: "완료",
};

const EMERGENCY_SEVERITY_LABELS = {
  normal: "일반",
  caution: "주의",
  urgent: "긴급",
  일반: "일반",
  주의: "주의",
  긴급: "긴급",
};

const ACTIVITY_RESULT_LABELS = {
  normal: "이상 없음",
  caution: "관심 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  "이상 없음": "이상 없음",
  "관심 필요": "관심 필요",
  이상징후: "이상징후",
  미응답: "미응답",
};

const CHECK_TYPE_LABELS = {
  visit: "방문",
  phone: "전화",
  message: "메시지",
  방문: "방문",
  전화: "전화",
  메시지: "메시지",
};

function getOrganizationStatusLabel(status) {
  return ORGANIZATION_STATUS_LABELS[status] || status || "운영중";
}

function getEmergencyStatusLabel(status) {
  return EMERGENCY_STATUS_LABELS[status] || status || "접수됨";
}

function getEmergencySeverityLabel(severity) {
  return EMERGENCY_SEVERITY_LABELS[severity] || severity || "일반";
}

function getActivityResultStatusLabel(resultStatus) {
  return ACTIVITY_RESULT_LABELS[resultStatus] || resultStatus || "이상 없음";
}

function getCheckTypeLabel(checkType) {
  return CHECK_TYPE_LABELS[checkType] || checkType || "방문";
}

function normalizeRecentEmergency(item) {
  return {
    id: item?.id,
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 정보 없음",
    title: item?.title || "이상징후 보고",
    severity: item?.severity || "normal",
    severityLabel: getEmergencySeverityLabel(item?.severity || "normal"),
    status: item?.status || "received",
    statusLabel: getEmergencyStatusLabel(item?.status || "received"),
    reportedAt: item?.reported_at || item?.reportedAt || null,
  };
}

function normalizeRecentActivityRecord(item) {
  return {
    id: item?.id,
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 정보 없음",
    checkerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || "체커 정보 없음",
    checkType: item?.check_type || item?.checkType || "visit",
    checkTypeLabel: getCheckTypeLabel(item?.check_type || item?.checkType || "visit"),
    resultStatus: item?.result_status || item?.resultStatus || "normal",
    resultStatusLabel: getActivityResultStatusLabel(item?.result_status || item?.resultStatus || "normal"),
    checkedAt: item?.checked_at || item?.checkedAt || null,
  };
}

function normalizeChecker(item) {
  return {
    id: item?.id,
    name: item?.name || "체커 정보 없음",
    status: item?.status || "active",
    statusLabel: getOrganizationStatusLabel(item?.status || "active"),
    phone: item?.phone || "연락처 없음",
  };
}

function normalizeOrganizationDetail(row) {
  return {
    id: row?.id,
    name: row?.name || "기관명 없음",
    region: row?.region || "-",
    adminName: row?.admin_name || row?.adminName || "미배정",
    status: row?.status || "active",
    statusLabel: getOrganizationStatusLabel(row?.status || "active"),
    memo: row?.memo || "",
    targetCount: Number(row?.target_count || row?.targetCount || 0),
    checkerCount: Number(row?.checker_count || row?.checkerCount || 0),
    emergencyCount: Number(row?.emergency_count || row?.emergencyCount || 0),
    unresolvedEmergencyCount: Number(
      row?.unresolved_emergency_count || row?.unresolvedEmergencyCount || 0
    ),
    recentEmergencies: Array.isArray(row?.recent_emergencies)
      ? row.recent_emergencies.map(normalizeRecentEmergency)
      : [],
    recentActivityRecords: Array.isArray(row?.recent_activity_records)
      ? row.recent_activity_records.map(normalizeRecentActivityRecord)
      : [],
    checkers: Array.isArray(row?.checkers) ? row.checkers.map(normalizeChecker) : [],
  };
}

export async function getSupabaseOrganizationDetail(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      organization: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_organization_detail", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        ok: false,
        source: "not_found",
        organization: null,
        message: "기관 정보를 찾을 수 없습니다.",
      };
    }

    return {
      ok: true,
      source: "supabase",
      organization: normalizeOrganizationDetail(row),
      message: "Supabase 기관 상세 정보를 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      organization: null,
      message: error?.message || "Supabase 기관 상세 정보를 불러오지 못했습니다.",
    };
  }
}
