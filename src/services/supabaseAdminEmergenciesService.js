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

  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    targetAddress: item?.target_address || item?.targetAddress || "-",
    checkerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || "체커 없음",
    title: item?.title || "이상징후 보고",
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
