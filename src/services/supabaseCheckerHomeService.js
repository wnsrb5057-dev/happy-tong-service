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
  "보호자 연락": "보호자 연락",
  "방문 필요": "방문 필요",
  완료: "완료",
};

const SEVERITY_LABELS = {
  normal: "일반",
  caution: "주의",
  danger: "위험",
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

function toNumber(value) {
  return Number(value || 0);
}

function normalizeTarget(item) {
  const riskLevel = item?.risk_level || item?.riskLevel || "normal";

  return {
    id: item?.id || "",
    name: item?.name || "대상자 없음",
    birthYear: item?.birth_year || item?.birthYear || null,
    age: item?.age ?? null,
    gender: item?.gender || "",
    address: item?.address || "-",
    riskLevel,
    riskLevelLabel: RISK_LEVEL_LABELS[riskLevel] || riskLevel || "정상",
    lifecycleStatus: item?.lifecycle_status || item?.lifecycleStatus || "active",
    lastActivityAt: item?.last_activity_at || item?.lastActivityAt || null,
    lastVisitDate: item?.last_activity_at || item?.lastActivityAt || "-",
    unresolvedEmergencyCount: toNumber(item?.unresolved_emergency_count || item?.unresolvedEmergencyCount),
    isSupabaseOnly: true,
  };
}

function normalizeRecentActivity(item) {
  const checkType = item?.check_type || item?.checkType || "external";
  const resultStatus = item?.result_status || item?.resultStatus || "completed";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    checkType,
    checkTypeLabel: CHECK_TYPE_LABELS[checkType] || checkType || "외부 확인",
    resultStatus,
    resultStatusLabel: RESULT_STATUS_LABELS[resultStatus] || resultStatus || "완료",
    checkedAt: item?.checked_at || item?.checkedAt || null,
  };
}

function normalizeRecentEmergency(item) {
  const status = item?.status || "received";
  const severity = item?.severity || "caution";

  return {
    id: item?.id || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    title: item?.title || "이상징후 보고",
    severity,
    severityLabel: SEVERITY_LABELS[severity] || severity || "주의",
    status,
    statusLabel: EMERGENCY_STATUS_LABELS[status] || status || "접수됨",
    reportedAt: item?.reported_at || item?.reportedAt || null,
  };
}

function normalizeHome(row) {
  return {
    checkerId: row?.checker_id || row?.checkerId || "",
    checkerName: row?.checker_name || row?.checkerName || "체커",
    organizationId: row?.organization_id || row?.organizationId || "",
    organizationName: row?.organization_name || row?.organizationName || "기관명 없음",
    assignedTargetCount: toNumber(row?.assigned_target_count || row?.assignedTargetCount),
    todayPendingCount: toNumber(row?.today_pending_count || row?.todayPendingCount),
    todayCompletedCount: toNumber(row?.today_completed_count || row?.todayCompletedCount),
    unresolvedEmergencyCount: toNumber(row?.unresolved_emergency_count || row?.unresolvedEmergencyCount),
    assignedTargets: ensureArray(row?.assigned_targets || row?.assignedTargets).map(normalizeTarget),
    todayTargets: ensureArray(row?.today_targets || row?.todayTargets).map(normalizeTarget),
    recentActivities: ensureArray(row?.recent_activities || row?.recentActivities).map(normalizeRecentActivity),
    recentEmergencies: ensureArray(row?.recent_emergencies || row?.recentEmergencies).map(normalizeRecentEmergency),
  };
}

export async function getSupabaseCheckerHome(checkerId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      home: null,
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!checkerId) {
    return {
      ok: false,
      source: "not_found",
      home: null,
      message: "체커 홈 정보를 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_checker_home", {
      p_checker_id: checkerId,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        ok: false,
        source: "not_found",
        home: null,
        message: "체커 홈 정보를 찾을 수 없습니다.",
      };
    }

    return {
      ok: true,
      source: "supabase",
      home: normalizeHome(row),
      message: "Supabase 체커 홈 요약을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      home: null,
      message: error?.message || "Supabase 체커 홈 요약을 불러오지 못했습니다.",
    };
  }
}
