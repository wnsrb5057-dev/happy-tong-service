import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const CHECK_TYPE_LABELS = {
  visit: "방문",
  phone: "전화",
  message: "메시지",
  call: "전화",
  external: "외부 확인",
  intensive: "집중 모니터링",
  방문: "방문",
  전화: "전화",
  메시지: "메시지",
  외부확인: "외부 확인",
  "외부 확인": "외부 확인",
  "집중 모니터링": "집중 모니터링",
};

const RESULT_STATUS_LABELS = {
  normal: "이상 없음",
  caution: "관찰 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  "이상 없음": "이상 없음",
  "관찰 필요": "관찰 필요",
  이상징후: "이상징후",
  미응답: "미응답",
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
  완료: "완료",
};

const SEVERITY_LABELS = {
  normal: "일반",
  caution: "주의",
  urgent: "긴급",
  일반: "일반",
  주의: "주의",
  긴급: "긴급",
};

function normalizeRecentActivity(item) {
  const checkType = item?.check_type || item?.checkType || "visit";
  const resultStatus = item?.result_status || item?.resultStatus || "normal";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    checkerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || "체커 없음",
    checkType,
    checkTypeLabel: CHECK_TYPE_LABELS[checkType] || checkType || "방문",
    resultStatus,
    resultStatusLabel: RESULT_STATUS_LABELS[resultStatus] || resultStatus || "이상 없음",
    checkedAt: item?.checked_at || item?.checkedAt || null,
  };
}

function normalizeRecentEmergency(item) {
  const status = item?.status || "received";
  const severity = item?.severity || "normal";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    title: item?.title || "이상징후 보고",
    severity,
    severityLabel: SEVERITY_LABELS[severity] || severity || "일반",
    status,
    statusLabel: EMERGENCY_STATUS_LABELS[status] || status || "접수됨",
    reportedAt: item?.reported_at || item?.reportedAt || null,
  };
}

function normalizeDashboard(row) {
  return {
    organizationId: row?.organization_id || "",
    organizationName: row?.organization_name || "기관명 없음",
    targetCount: Number(row?.target_count || 0),
    checkerCount: Number(row?.checker_count || 0),
    todayActivityCount: Number(row?.today_activity_count || 0),
    recentActivityCount: Number(row?.recent_activity_count || 0),
    emergencyCount: Number(row?.emergency_count || 0),
    unresolvedEmergencyCount: Number(row?.unresolved_emergency_count || 0),
    recentActivities: Array.isArray(row?.recent_activities)
      ? row.recent_activities.map(normalizeRecentActivity)
      : [],
    recentEmergencies: Array.isArray(row?.recent_emergencies)
      ? row.recent_emergencies.map(normalizeRecentEmergency)
      : [],
  };
}

export async function getSupabaseAdminDashboard(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      dashboard: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      dashboard: null,
      message: "관리자 기관 대시보드 정보를 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_dashboard", {
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
        dashboard: null,
        message: "관리자 기관 대시보드 정보를 찾을 수 없습니다.",
      };
    }

    return {
      ok: true,
      source: "supabase",
      dashboard: normalizeDashboard(row),
      message: "Supabase 관리자 대시보드 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      dashboard: null,
      message: error?.message || "Supabase 관리자 대시보드 요약을 불러오지 못했습니다.",
    };
  }
}
