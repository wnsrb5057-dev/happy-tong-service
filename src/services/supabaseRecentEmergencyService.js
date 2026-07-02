import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const STATUS_LABEL_MAP = {
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

const SEVERITY_LABEL_MAP = {
  normal: "일반",
  caution: "주의",
  urgent: "긴급",
  일반: "일반",
  주의: "주의",
  긴급: "긴급",
};

function normalizeRecentEmergency(item) {
  const status = item?.status || "received";
  const severity = item?.severity || "normal";

  return {
    id: item?.id,
    organizationId: item?.organization_id || item?.organizationId || null,
    organizationName: item?.organization_name || item?.organizationName || "기관 정보 없음",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 정보 없음",
    title: item?.title || "이상징후 보고",
    severity,
    severityLabel: SEVERITY_LABEL_MAP[severity] || severity,
    status,
    statusLabel: STATUS_LABEL_MAP[status] || status,
    reportedAt: item?.reported_at || item?.reportedAt || null,
  };
}

export async function getSupabaseRecentEmergencySummaries() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      emergencies: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_recent_emergency_summaries");

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      emergencies: Array.isArray(data) ? data.map(normalizeRecentEmergency) : [],
      message: "Supabase 최근 이상징후 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      emergencies: [],
      message: error?.message || "Supabase 최근 이상징후 요약을 불러오지 못했습니다.",
    };
  }
}
