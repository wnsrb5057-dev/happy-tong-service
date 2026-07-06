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
  caution: "관찰 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  completed: "완료",
  missed: "미실시",
  "이상 없음": "이상 없음",
  "관찰 필요": "관찰 필요",
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
  처리중: "확인중",
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

function normalizeStatistics(row) {
  return {
    organizationId: row?.organization_id || "",
    organizationName: row?.organization_name || "기관명 없음",
    targetCount: Number(row?.target_count || 0),
    activeTargetCount: Number(row?.active_target_count || 0),
    endedTargetCount: Number(row?.ended_target_count || 0),
    checkerCount: Number(row?.checker_count || 0),
    activityCount: Number(row?.activity_count || 0),
    recentActivityCount: Number(row?.recent_activity_count || 0),
    todayActivityCount: Number(row?.today_activity_count || 0),
    emergencyCount: Number(row?.emergency_count || 0),
    unresolvedEmergencyCount: Number(row?.unresolved_emergency_count || 0),
    completedEmergencyCount: Number(row?.completed_emergency_count || 0),
    normalTargetCount: Number(row?.normal_target_count || 0),
    cautionTargetCount: Number(row?.caution_target_count || 0),
    highRiskTargetCount: Number(row?.high_risk_target_count || 0),
    activityByType: ensureArray(row?.activity_by_type).map((item) =>
      normalizeCountRow(item, "type", CHECK_TYPE_LABELS)
    ),
    activityByResult: ensureArray(row?.activity_by_result).map((item) =>
      normalizeCountRow(item, "status", RESULT_STATUS_LABELS)
    ),
    emergencyByStatus: ensureArray(row?.emergency_by_status).map((item) =>
      normalizeCountRow(item, "status", EMERGENCY_STATUS_LABELS)
    ),
    emergencyBySeverity: ensureArray(row?.emergency_by_severity).map((item) =>
      normalizeCountRow(item, "severity", SEVERITY_LABELS)
    ),
    dailyActivityCounts: ensureArray(row?.daily_activity_counts).map((item) => ({
      date: item?.date || "",
      count: Number(item?.count || 0),
    })),
  };
}

export async function getSupabaseAdminStatistics(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      statistics: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      statistics: null,
      message: "통계 정보를 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_statistics", {
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
        statistics: null,
        message: "통계 정보를 찾을 수 없습니다.",
      };
    }

    return {
      ok: true,
      source: "supabase",
      statistics: normalizeStatistics(row),
      message: "Supabase 통계 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      statistics: null,
      message: error?.message || "Supabase 통계 요약을 불러오지 못했습니다.",
    };
  }
}
