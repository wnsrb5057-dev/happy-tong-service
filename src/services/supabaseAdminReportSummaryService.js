import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const CHECK_TYPE_LABELS = {
  visit: "방문",
  phone: "전화",
  call: "전화",
  message: "메시지",
  external: "외부 확인",
  monitoring: "집중 모니터링",
  intensive: "집중 모니터링",
  방문: "방문",
  전화: "전화",
  메시지: "메시지",
  "외부 확인": "외부 확인",
  "집중 모니터링": "집중 모니터링",
};

const RESULT_STATUS_LABELS = {
  normal: "이상 없음",
  caution: "관심 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  completed: "완료",
  missed: "미실시",
  "이상 없음": "이상 없음",
  "관심 필요": "관심 필요",
  이상징후: "이상징후",
  미응답: "미응답",
  완료: "완료",
  미실시: "미실시",
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
  "보호자 연락": "보호자 연락",
  "방문 필요": "방문 필요",
  완료: "완료",
};

const SEVERITY_LABELS = {
  normal: "일반",
  caution: "주의",
  high: "위험",
  urgent: "긴급",
  일반: "일반",
  주의: "주의",
  위험: "위험",
  긴급: "긴급",
};

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCountRow(item, keyName, labelMap) {
  const key = item?.[keyName] || "";
  return {
    ...item,
    [keyName]: key,
    label: labelMap[key] || item?.label || key || "-",
    count: Number(item?.count || 0),
  };
}

function normalizeRecentActivity(item) {
  const checkType = item?.check_type || item?.checkType || item?.type || item?.method || "";
  const resultStatus = item?.result_status || item?.resultStatus || item?.status || "";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || "",
    targetName: item?.target_name || item?.targetName || "대상자 정보 없음",
    checkerId: item?.checker_id || item?.checkerId || "",
    checkerName: item?.checker_name || item?.checkerName || "체커 정보 없음",
    checkType,
    checkTypeLabel: CHECK_TYPE_LABELS[checkType] || checkType || "-",
    resultStatus,
    resultStatusLabel: RESULT_STATUS_LABELS[resultStatus] || resultStatus || "-",
    checkedAt: item?.checked_at || item?.checkedAt || null,
  };
}

function normalizeRecentEmergency(item) {
  const severity = item?.severity || "";
  const status = item?.status || "";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || "",
    targetName: item?.target_name || item?.targetName || "대상자 정보 없음",
    title: item?.title || "이상징후 보고",
    issueType: item?.title || "이상징후 보고",
    severity,
    severityLabel: SEVERITY_LABELS[severity] || severity || "-",
    status,
    statusLabel: EMERGENCY_STATUS_LABELS[status] || status || "-",
    reportedAt: item?.reported_at || item?.reportedAt || null,
    date: item?.reported_at || item?.reportedAt || null,
  };
}

function normalizeSummary(row) {
  return {
    organizationId: row?.organization_id || "",
    organizationName: row?.organization_name || "기관명 없음",
    region: row?.region || "-",
    reportPeriodStart: row?.report_period_start || "",
    reportPeriodEnd: row?.report_period_end || "",
    targetCount: Number(row?.target_count || 0),
    activeTargetCount: Number(row?.active_target_count || 0),
    checkerCount: Number(row?.checker_count || 0),
    activityCount: Number(row?.activity_count || 0),
    recentActivityCount: Number(row?.recent_activity_count || 0),
    todayActivityCount: Number(row?.today_activity_count || 0),
    emergencyCount: Number(row?.emergency_count || 0),
    unresolvedEmergencyCount: Number(row?.unresolved_emergency_count || 0),
    completedEmergencyCount: Number(row?.completed_emergency_count || 0),
    activityByType: ensureArray(row?.activity_by_type).map((item) =>
      normalizeCountRow(item, "type", CHECK_TYPE_LABELS)
    ),
    emergencyByStatus: ensureArray(row?.emergency_by_status).map((item) =>
      normalizeCountRow(item, "status", EMERGENCY_STATUS_LABELS)
    ),
    emergencyBySeverity: ensureArray(row?.emergency_by_severity).map((item) =>
      normalizeCountRow(item, "severity", SEVERITY_LABELS)
    ),
    recentActivities: ensureArray(row?.recent_activities).map(normalizeRecentActivity),
    recentEmergencies: ensureArray(row?.recent_emergencies).map(normalizeRecentEmergency),
  };
}

export async function getSupabaseAdminReportSummary(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      summary: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      summary: null,
      message: "보고서 요약 정보를 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_report_summary", {
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
        summary: null,
        message: "보고서 요약 정보를 찾을 수 없습니다.",
      };
    }

    return {
      ok: true,
      source: "supabase",
      summary: normalizeSummary(row),
      message: "Supabase 보고서 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      summary: null,
      message: error?.message || "Supabase 보고서 요약을 불러오지 못했습니다.",
    };
  }
}
