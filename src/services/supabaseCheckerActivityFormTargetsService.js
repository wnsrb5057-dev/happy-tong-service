import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

function toNumber(value) {
  return Number(value || 0);
}

function normalizeCheckDays(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTarget(item) {
  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    organizationName: item?.organization_name || item?.organizationName || "",
    checkerId: item?.checker_id || item?.checkerId || "",
    checkerName: item?.checker_name || item?.checkerName || "",
    name: item?.name || "",
    birthYear: item?.birth_year || item?.birthYear || null,
    age: item?.age ?? null,
    gender: item?.gender || "",
    address: item?.address || "-",
    riskLevel: item?.risk_level || item?.riskLevel || "normal",
    lifecycleStatus: item?.lifecycle_status || item?.lifecycleStatus || "active",
    defaultCheckType: item?.default_check_type || item?.defaultCheckType || "phone",
    checkDays: normalizeCheckDays(item?.check_days || item?.checkDays),
    lastActivityAt: item?.last_activity_at || item?.lastActivityAt || null,
    lastActivityStatus: item?.last_activity_status || item?.lastActivityStatus || "",
    todayCompleted: Boolean(item?.today_completed ?? item?.todayCompleted),
    unresolvedEmergencyCount: toNumber(item?.unresolved_emergency_count || item?.unresolvedEmergencyCount),
    createdAt: item?.created_at || item?.createdAt || null,
    isSupabaseOnly: true,
  };
}

export async function getSupabaseCheckerActivityFormTargets(checkerId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      targets: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!checkerId) {
    return {
      ok: false,
      source: "not_found",
      targets: [],
      message: "기록작성 대상자 목록을 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_checker_activity_form_targets", {
      p_checker_id: checkerId,
    });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      targets: Array.isArray(data) ? data.map(normalizeTarget) : [],
      message: "Supabase 기록작성 대상자 목록을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      targets: [],
      message: error?.message || "Supabase 기록작성 대상자 목록을 불러오지 못했습니다.",
    };
  }
}
