import { isSupabaseConfigured } from "./supabaseClient.js";

function normalizeKpis(row) {
  return {
    organizationCount: Number(row?.organization_count || row?.organizationCount || 0),
    activeTargetCount: Number(row?.active_target_count || row?.activeTargetCount || 0),
    checkerCount: Number(row?.checker_count || row?.checkerCount || 0),
    emergencyCount: Number(row?.emergency_count || row?.emergencyCount || 0),
    unresolvedEmergencyCount: Number(row?.unresolved_emergency_count || row?.unresolvedEmergencyCount || 0),
  };
}

export async function getSupabaseSuperDashboardKpis() {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      source: "not_configured",
      kpis: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const response = await fetch("/api/super", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getDashboardKpis" }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || "Failed to load dashboard KPIs.");
    }

    return {
      ok: true,
      source: "supabase",
      kpis: normalizeKpis(result.kpis || {}),
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
