import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

function normalizeKpis(row) {
  return {
    organizationCount: Number(row?.organization_count || 0),
    activeTargetCount: Number(row?.active_target_count || 0),
    checkerCount: Number(row?.checker_count || 0),
    emergencyCount: Number(row?.emergency_count || 0),
    unresolvedEmergencyCount: Number(row?.unresolved_emergency_count || 0),
  };
}

export async function getSupabaseSuperDashboardKpis() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      kpis: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_super_dashboard_kpis");

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      ok: true,
      source: "supabase",
      kpis: normalizeKpis(row),
      message: "Supabase 총관리자 KPI를 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      kpis: null,
      message: error?.message || "Supabase 총관리자 KPI를 불러오지 못했습니다.",
    };
  }
}
