import { isSupabaseConfigured } from "./supabaseClient.js";

function optionalBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return undefined;
}

function normalizeRecord(item) {
  const hasIssue = optionalBoolean(item?.has_issue ?? item?.hasIssue);

  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    organizationName: item?.organization_name || item?.organizationName || "",
    checkerId: item?.checker_id || item?.checkerId || "",
    checkerName: item?.checker_name || item?.checkerName || "",
    targetId: item?.target_id || item?.targetId || "",
    targetName: item?.target_name || item?.targetName || "",
    supabaseTargetAddress: item?.supabase_target_address || item?.supabaseTargetAddress || "",
    supabase_target_address: item?.supabase_target_address || item?.supabaseTargetAddress || "",
    targetAddress: item?.target_address || item?.targetAddress || "-",
    checkType: item?.check_type || item?.checkType || "phone",
    resultStatus: item?.result_status || item?.resultStatus || "normal",
    hasIssue,
    has_issue: hasIssue,
    issueLevel: item?.issue_level || item?.issueLevel || "",
    issue_level: item?.issue_level || item?.issueLevel || "",
    checkItems: item?.check_items || item?.checkItems || [],
    check_items: item?.check_items || item?.checkItems || [],
    status: item?.status || "completed",
    conditionSummary: item?.condition_summary || item?.conditionSummary || "",
    condition_summary: item?.condition_summary || item?.conditionSummary || "",
    memo: item?.memo || "",
    checkedAt: item?.checked_at || item?.checkedAt || null,
    createdAt: item?.created_at || item?.createdAt || item?.checked_at || item?.checkedAt || null,
    isSupabaseOnly: true,
  };
}

export async function getSupabaseCheckerActivityHistory(checkerId) {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      source: "not_configured",
      records: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!checkerId) {
    return {
      ok: false,
      source: "not_found",
      records: [],
      message: "체커 확인기록을 찾을 수 없습니다.",
    };
  }

  try {
    const response = await fetch("/api/checkers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getActivityHistory",
        checkerId,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || "Failed to load checker activity history.");
    }

    return {
      ok: true,
      source: "supabase",
      records: Array.isArray(result.activityHistory) ? result.activityHistory.map(normalizeRecord) : [],
      message: "Supabase 체커 확인기록을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      records: [],
      message: error?.message || "Supabase 체커 확인기록을 불러오지 못했습니다.",
    };
  }
}
