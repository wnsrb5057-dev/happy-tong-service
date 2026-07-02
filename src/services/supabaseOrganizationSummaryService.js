import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const STATUS_LABEL_MAP = {
  active: "운영중",
  pilot: "파일럿",
  paused: "일시중지",
  ended: "운영종료",
};

function normalizeOrganizationSummary(item) {
  const status = item?.status || "active";

  return {
    id: item?.id,
    name: item?.name || "기관명 없음",
    region: item?.region || "-",
    adminName: item?.admin_name || item?.adminName || "미배정",
    status,
    statusLabel: STATUS_LABEL_MAP[status] || status,
    memo: item?.memo || "",
    targetCount: Number(item?.target_count || item?.targetCount || 0),
    checkerCount: Number(item?.checker_count || item?.checkerCount || 0),
    unresolvedEmergencyCount: Number(
      item?.unresolved_emergency_count || item?.unresolvedEmergencyCount || 0
    ),
  };
}

export async function getSupabaseOrganizationSummaries() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      organizations: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_organization_summaries");

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      organizations: Array.isArray(data) ? data.map(normalizeOrganizationSummary) : [],
      message: "Supabase 기관 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      organizations: [],
      message: error?.message || "Supabase 기관 요약을 불러오지 못했습니다.",
    };
  }
}
