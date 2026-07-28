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
      const data = await callRpc(supabase, "get_public_admin_activity_records", organizationId);
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
