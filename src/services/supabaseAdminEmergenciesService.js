import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

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

const STATUS_LABELS = {
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

function normalizeEmergency(item) {
  const severity = item?.severity || "caution";
  const status = item?.status || "received";
  const lastHandlingStatus = item?.last_handling_status || item?.lastHandlingStatus || null;
  const fallbackTitle =
    item?.title ||
    item?.type ||
    item?.emergency_type ||
    item?.emergencyType ||
    item?.issue_type ||
    item?.issueType ||
    "이상징후 보고";
  const fallbackDescription =
    item?.description ||
    item?.content ||
    item?.note ||
    item?.memo ||
    item?.detail ||
    "";

  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || item?.senior_name || item?.seniorName || item?.name || "대상자 없음",
    targetAddress: item?.target_address || item?.targetAddress || item?.address || "-",
    checkerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || item?.checker || "체커 없음",
    checkerPhone: item?.checker_phone || item?.checkerPhone || item?.phone || "",
    guardianPhone: item?.guardian_phone || item?.guardianPhone || item?.targetPhone || "",
    title: fallbackTitle,
    issueType: item?.issue_type || item?.issueType || item?.emergency_type || item?.emergencyType || fallbackTitle,
    description: fallbackDescription,
    content: fallbackDescription,
    note: item?.note || item?.memo || fallbackDescription,
    date: item?.date || item?.reported_at || item?.reportedAt || "",
    urgency: item?.urgency || severity,
    severity,
    severityLabel: SEVERITY_LABELS[severity] || severity || "주의",
    status,
    statusLabel: STATUS_LABELS[status] || status || "접수됨",
    reportedAt: item?.reported_at || item?.reportedAt || null,
    lastHandlingStatus,
    lastHandlingStatusLabel:
      STATUS_LABELS[lastHandlingStatus] || lastHandlingStatus || null,
    lastHandlingMemo: item?.last_handling_memo || item?.lastHandlingMemo || "",
    handledAt: item?.handled_at || item?.handledAt || null,
    createdAt: item?.created_at || item?.createdAt || item?.reported_at || item?.reportedAt || null,
  };
}

export async function getSupabaseAdminEmergencies(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      emergencies: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      emergencies: [],
      message: "관리자 이상징후 목록을 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_emergencies", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      emergencies: Array.isArray(data) ? data.map(normalizeEmergency) : [],
      message: "Supabase 이상징후 목록을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      emergencies: [],
      message: error?.message || "Supabase 이상징후 목록을 불러오지 못했습니다.",
    };
  }
}

export async function getSupabaseAdminEmergencyById(organizationId, emergencyId) {
  const result = await getSupabaseAdminEmergencies(organizationId);

  if (!result.ok) {
    return {
      ok: false,
      source: result.source,
      emergency: null,
      message: result.message,
    };
  }

  const emergency = Array.isArray(result.emergencies)
    ? result.emergencies.find((item) => item.id === emergencyId) || null
    : null;

  if (!emergency) {
    return {
      ok: false,
      source: "not_found",
      emergency: null,
      message: "Supabase 이상징후 상세 정보를 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    source: "supabase",
    emergency,
    message: "Supabase 이상징후 상세 정보를 불러왔습니다.",
  };
}
