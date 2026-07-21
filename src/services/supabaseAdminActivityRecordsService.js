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

function normalizeRecord(item) {
  const checkType = item?.check_type || item?.checkType || "phone";
  const resultStatus = item?.result_status || item?.resultStatus || "normal";
  const hasIssue = optionalBoolean(item?.has_issue ?? item?.hasIssue);

  return {
    id: item?.id || "",
    organizationId: item?.organization_id || item?.organizationId || "",
    targetId: item?.target_id || item?.targetId || null,
    targetName: item?.target_name || item?.targetName || "대상자 없음",
    supabaseTargetAddress: item?.supabase_target_address || item?.supabaseTargetAddress || "",
    supabase_target_address: item?.supabase_target_address || item?.supabaseTargetAddress || "",
    targetAddress: item?.target_address || item?.targetAddress || "-",
    checkerId: item?.checker_id || item?.checkerId || null,
    checkerName: item?.checker_name || item?.checkerName || "체커 없음",
    checkType,
    checkTypeLabel: CHECK_TYPE_LABELS[checkType] || checkType || "전화",
    resultStatus,
    resultStatusLabel: RESULT_STATUS_LABELS[resultStatus] || resultStatus || "이상 없음",
    hasIssue,
    has_issue: hasIssue,
    issueLevel: item?.issue_level || item?.issueLevel || "",
    issue_level: item?.issue_level || item?.issueLevel || "",
    checkItems: item?.check_items || item?.checkItems || [],
    check_items: item?.check_items || item?.checkItems || [],
    status: item?.status || resultStatus || "completed",
    conditionSummary: item?.condition_summary || item?.conditionSummary || "",
    condition_summary: item?.condition_summary || item?.conditionSummary || "",
    memo: item?.memo || "",
    checkedAt: item?.checked_at || item?.checkedAt || null,
    createdAt: item?.created_at || item?.createdAt || item?.checked_at || item?.checkedAt || null,
  };
}

async function enrichTargetAddresses(records) {
  const targetIds = [...new Set(records.map((record) => record.targetId).filter(Boolean))];

  if (!targetIds.length) {
    return records;
  }

  const { data, error } = await supabase
    .from("targets")
    .select("id, address")
    .in("id", targetIds);

  if (error || !Array.isArray(data)) {
    return records;
  }

  const addressByTargetId = new Map(data.map((target) => [target.id, target.address || ""]));
  return records.map((record) => {
    const supabaseTargetAddress = addressByTargetId.get(record.targetId) || "";

    return {
      ...record,
      supabaseTargetAddress,
      supabase_target_address: supabaseTargetAddress,
    };
  });
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

async function getDirectActivityRecords(organizationId) {
  const { data, error } = await supabase
    .from("activity_records")
    .select("id, organization_id, target_id, checker_id, check_type, checked_at, created_at, has_issue, issue_level, check_items, status, condition_summary, memo")
    .eq("organization_id", organizationId)
    .order("checked_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data;
}

function mergeActivityRecords(rpcItems, directItems) {
  const mergedById = new Map();

  rpcItems.forEach((item) => {
    if (item?.id) {
      mergedById.set(item.id, item);
    }
  });

  directItems.forEach((item) => {
    if (item?.id) {
      mergedById.set(item.id, { ...(mergedById.get(item.id) || {}), ...item });
    }
  });

  return Array.from(mergedById.values());
}

export async function getSupabaseAdminActivityRecords(organizationId) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      source: "not_configured",
      records: [],
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      source: "not_found",
      records: [],
      message: "관리자 확인기록 목록을 찾을 수 없습니다.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_public_admin_activity_records", {
      p_organization_id: organizationId,
    });

    if (error) {
      throw error;
    }

    const directRecords = await getDirectActivityRecords(organizationId);
    const mergedRecords = mergeActivityRecords(Array.isArray(data) ? data : [], directRecords);

    return {
      ok: true,
      source: "supabase",
      records: await enrichTargetAddresses(await enrichActivityRecordColumns(mergedRecords.map(normalizeRecord))),
      message: "Supabase 확인기록 목록을 불러왔습니다.",
    };
  } catch (error) {
    return {
      ok: false,
      source: "error",
      records: [],
      message: error?.message || "Supabase 확인기록 목록을 불러오지 못했습니다.",
    };
  }
}
