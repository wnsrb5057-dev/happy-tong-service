import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const STATUS_LABEL_MAP = {
  active: "운영중",
  pilot: "파일럿",
  paused: "일시중지",
  ended: "운영종료",
  운영중: "운영중",
  파일럿: "파일럿",
  일시중지: "일시중지",
  운영종료: "운영종료",
};

const RISK_LEVEL_LABEL_MAP = {
  high: "높음",
  medium: "주의",
  low: "안정",
  높음: "높음",
  주의: "주의",
  안정: "안정",
};

function normalizeStatusRow(item) {
  const status = item?.status || "active";
  const riskLevel = item?.risk_level || item?.riskLevel || "low";

  return {
    organizationId: item?.organization_id || item?.organizationId || "",
    organizationName: item?.organization_name || item?.organizationName || "기관명 없음",
    region: item?.region || "-",
    status,
    statusLabel: STATUS_LABEL_MAP[status] || status || "운영중",
    adminName: item?.admin_name || item?.adminName || "미배정",
    targetCount: Number(item?.target_count || item?.targetCount || 0),
    checkerCount: Number(item?.checker_count || item?.checkerCount || 0),
    emergencyCount: Number(item?.emergency_count || item?.emergencyCount || 0),
    unresolvedEmergencyCount: Number(
      item?.unresolved_emergency_count || item?.unresolvedEmergencyCount || 0
    ),
    recentActivityCount: Number(item?.recent_activity_count || item?.recentActivityCount || 0),
    lastActivityAt: item?.last_activity_at || item?.lastActivityAt || null,
    lastEmergencyAt: item?.last_emergency_at || item?.lastEmergencyAt || null,
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABEL_MAP[riskLevel] || riskLevel || "안정",
    riskReason: item?.risk_reason || item?.riskReason || "",
  };
}

export async function getSupabaseSuperStatusSummaries() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      statuses: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_super_status_summaries");

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      statuses: Array.isArray(data) ? data.map(normalizeStatusRow) : [],
      message: "Supabase 운영 상태 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      statuses: [],
      message: error?.message || "Supabase 운영 상태 요약을 불러오지 못했습니다.",
    };
  }
}
