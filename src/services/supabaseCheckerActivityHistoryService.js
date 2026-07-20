import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

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

async function enrichActivityRecordColumns(records) {
  const ids = records.map((record) => record.id).filter(Boolean);

  if (!ids.length) {
    return records;
  }

  const { data, error } = await supabase
    .from("activity_records")
    .select("id, has_issue, issue_level, check_items, status, condition_summary, memo")
    .in("id", ids);

  if (error || !Array.isArray(data)) {
    return records;
  }

  const extraById = new Map(data.map((item) => [item.id, item]));
  return records.map((record) => normalizeRecord({ ...record, ...(extraById.get(record.id) || {}) }));
}

export async function getSupabaseCheckerActivityHistory(checkerId) {
  if (!isSupabaseConfigured || !supabase) {
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
    const { data, error } = await supabase.rpc("get_public_checker_activity_history", {
      p_checker_id: checkerId,
    });

    if (error) {
      throw error;
    }

    return {
      ok: true,
      source: "supabase",
      records: Array.isArray(data) ? await enrichActivityRecordColumns(data.map(normalizeRecord)) : [],
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
