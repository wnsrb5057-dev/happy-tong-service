import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const RISK_LEVEL_LABELS = {
  normal: "정상",
  caution: "주의",
  danger: "위험",
  high: "위험",
  urgent: "긴급",
  정상: "정상",
  주의: "주의",
  위험: "위험",
  긴급: "긴급",
};

const LIFECYCLE_STATUS_LABELS = {
  active: "관리중",
  ended: "관리종료",
  paused: "일시중지",
  관리중: "관리중",
  관리종료: "관리종료",
  일시중지: "일시중지",
};

const ACTIVITY_STATUS_LABELS = {
  normal: "이상 없음",
  caution: "관찰 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  "이상 없음": "이상 없음",
  "관찰 필요": "관찰 필요",
  이상징후: "이상징후",
  미응답: "미응답",
};

function normalizeCheckDays(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeTarget(item) {
  const riskLevel = item?.risk_level || item?.riskLevel || "normal";
  const lifecycleStatus = item?.lifecycle_status || item?.lifecycleStatus || "active";
  const lastActivityStatus = item?.last_activity_status || item?.lastActivityStatus || null;
  const birthYearValue = item?.birth_year ?? item?.birthYear ?? null;
  const ageValue = item?.age ?? null;
  const parsedBirthYear =
    birthYearValue === null || birthYearValue === undefined || birthYearValue === ""
      ? null
      : Number(birthYearValue);
  const parsedAge =
    ageValue === null || ageValue === undefined || ageValue === ""
      ? parsedBirthYear
      : Number(ageValue);

  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    name: item?.name || "대상자 정보 없음",
    birthYear: Number.isFinite(parsedBirthYear) ? parsedBirthYear : null,
    age: Number.isFinite(parsedAge) ? parsedAge : null,
    gender: item?.gender || "",
    address: item?.address || "",
    area: item?.address || "",
    phone: item?.phone || "",
    guardianName: item?.guardian_name || item?.guardianName || "",
    guardianPhone: item?.guardian_phone || item?.guardianPhone || "",
    assignedCheckerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || "담당 체커 미배정",
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[riskLevel] || riskLevel || "정상",
    lifecycleStatus,
    lifecycleStatusLabel: LIFECYCLE_STATUS_LABELS[lifecycleStatus] || lifecycleStatus || "관리중",
    memo: item?.memo || "",
    lastActivityAt: item?.last_activity_at || item?.lastActivityAt || null,
    lastActivityStatus,
    lastActivityStatusLabel:
      ACTIVITY_STATUS_LABELS[lastActivityStatus] || lastActivityStatus || null,
    unresolvedEmergencyCount: Number(
      item?.unresolved_emergency_count || item?.unresolvedEmergencyCount || 0
    ),
    createdAt: item?.created_at || item?.createdAt || null,
    defaultCheckType: item?.default_check_type || item?.defaultCheckType || "external",
    checkDays: normalizeCheckDays(item?.check_days || item?.checkDays),
    lastVisitDate: item?.last_activity_at || item?.lastActivityAt || null,
  };
}

export async function getSupabaseAdminTargets(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      targets: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      targets: [],
      message: "관리자 기관 대상자 목록을 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_targets", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      targets: Array.isArray(data) ? data.map(normalizeTarget) : [],
      message: "Supabase 대상자 목록을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      targets: [],
      message: error?.message || "Supabase 대상자 목록을 불러오지 못했습니다.",
    };
  }
}
