import { createClient } from "@supabase/supabase-js";

function createCodeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_error) {
      return {};
    }
  }
  return typeof body === "object" ? body : {};
}

function respondWithError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("SUPABASE_NOT_CONFIGURED");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function callRpc(supabase, rpcName, organizationId) {
  const { data, error } = await supabase.rpc(rpcName, {
    p_organization_id: organizationId,
  });
  if (error) {
    throw error;
  }
  return data;
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function getDirectAdminActivityRecords(supabase, organizationId) {
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

function getRecordId(record) {
  return record?.id || "";
}

function getRecordTargetId(record) {
  return record?.target_id || record?.targetId || "";
}

function mergeActivityRecords(primaryItems, directItems) {
  const mergedById = new Map();

  primaryItems.forEach((item) => {
    const id = getRecordId(item);
    if (id) mergedById.set(id, item);
  });

  directItems.forEach((item) => {
    const id = getRecordId(item);
    if (id) mergedById.set(id, { ...(mergedById.get(id) || {}), ...item });
  });

  return Array.from(mergedById.values());
}

async function enrichActivityRecordColumns(supabase, records) {
  const ids = records.map(getRecordId).filter(Boolean);
  if (!ids.length) return records;

  const { data, error } = await supabase
    .from("activity_records")
    .select("id, has_issue, issue_level, check_items, status, condition_summary, memo")
    .in("id", ids);

  if (error || !Array.isArray(data)) {
    return records;
  }

  const extraById = new Map(data.map((item) => [item.id, item]));
  return records.map((record) => ({
    ...record,
    ...(extraById.get(getRecordId(record)) || {}),
  }));
}

async function enrichTargetAddresses(supabase, records) {
  const targetIds = [...new Set(records.map(getRecordTargetId).filter(Boolean))];
  if (!targetIds.length) return records;

  const { data, error } = await supabase
    .from("targets")
    .select("id, address")
    .in("id", targetIds);

  if (error || !Array.isArray(data)) {
    return records;
  }

  const addressByTargetId = new Map(data.map((target) => [target.id, target.address || ""]));
  return records.map((record) => {
    const targetAddress = addressByTargetId.get(getRecordTargetId(record)) || "";
    return {
      ...record,
      supabase_target_address: targetAddress,
      supabaseTargetAddress: targetAddress,
    };
  });
}

async function getAdminActivityRecords(supabase, organizationId) {
  const rpcData = await callRpc(supabase, "get_public_admin_activity_records", organizationId);
  const directRecords = await getDirectAdminActivityRecords(supabase, organizationId);
  const mergedRecords = mergeActivityRecords(Array.isArray(rpcData) ? rpcData : [], directRecords);
  return enrichTargetAddresses(supabase, await enrichActivityRecordColumns(supabase, mergedRecords));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
    });
  }

  const body = parseRequestBody(req.body);
  const action = body.action;
  const validActions = new Set([
    "getDashboard",
    "getTargets",
    "getEmergencies",
    "getActivityRecords",
    "getStatistics",
    "getReportSummary",
  ]);

  if (!validActions.has(action)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid admin read action.",
    });
  }

  const organizationId = body.organizationId || body.organization_id;
  if (!organizationId) {
    return respondWithError(res, 400, "MISSING_ORGANIZATION_ID", "organizationId is required.");
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (action === "getDashboard") {
      const data = await callRpc(supabase, "get_public_admin_dashboard", organizationId);
      return res.status(200).json({
        success: true,
        dashboard: firstRow(data) || null,
      });
    }

    if (action === "getTargets") {
      const data = await callRpc(supabase, "get_public_admin_targets", organizationId);
      return res.status(200).json({
        success: true,
        targets: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getEmergencies") {
      const data = await callRpc(supabase, "get_public_admin_emergencies", organizationId);
      return res.status(200).json({
        success: true,
        emergencies: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getActivityRecords") {
      const data = await getAdminActivityRecords(supabase, organizationId);
      return res.status(200).json({
        success: true,
        activityRecords: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getStatistics") {
      const data = await callRpc(supabase, "get_public_admin_statistics", organizationId);
      return res.status(200).json({
        success: true,
        statistics: firstRow(data) || null,
      });
    }

    if (action === "getReportSummary") {
      const data = await callRpc(supabase, "get_public_admin_report_summary", organizationId);
      return res.status(200).json({
        success: true,
        reportSummary: firstRow(data) || null,
      });
    }
  } catch (error) {
    const code = error?.code || "ADMIN_READ_FAILED";
    console.warn("[admin-read-api]", code, error?.message || "Unknown error");
    return respondWithError(res, 500, code, error?.message || "Failed to load admin data.");
  }
}
