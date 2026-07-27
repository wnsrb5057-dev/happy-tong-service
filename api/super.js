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

function respondWithError(res, status, code, message = "Failed to load super data.") {
  return res.status(status).json({
    success: false,
    error: message,
    code,
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

async function callRpc(supabase, rpcName, params) {
  const { data, error } = await supabase.rpc(rpcName, params);
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

  try {
    const supabase = getSupabaseAdminClient();

    if (action === "getHealthCounts") {
      const data = await callRpc(supabase, "get_public_health_counts");
      return res.status(200).json({
        success: true,
        healthCounts: firstRow(data) || null,
      });
    }

    if (action === "getOrganizationSummaries") {
      const data = await callRpc(supabase, "get_public_organization_summaries");
      return res.status(200).json({
        success: true,
        organizations: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getOrganizationDetail") {
      const organizationId = body.organizationId || body.organization_id;
      if (!organizationId) {
        return respondWithError(res, 400, "MISSING_ORGANIZATION_ID", "Missing organization id.");
      }

      const data = await callRpc(supabase, "get_public_organization_detail", {
        p_organization_id: organizationId,
      });
      const organization = firstRow(data);

      if (!organization) {
        return respondWithError(res, 404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
      }

      return res.status(200).json({
        success: true,
        organization,
      });
    }

    if (action === "getRecentEmergencySummaries") {
      const data = await callRpc(supabase, "get_public_recent_emergency_summaries");
      return res.status(200).json({
        success: true,
        emergencies: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getDashboardKpis") {
      const data = await callRpc(supabase, "get_public_super_dashboard_kpis");
      return res.status(200).json({
        success: true,
        kpis: firstRow(data) || null,
      });
    }

    if (action === "getStatusSummaries") {
      const data = await callRpc(supabase, "get_public_super_status_summaries");
      return res.status(200).json({
        success: true,
        statuses: Array.isArray(data) ? data : [],
      });
    }

    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid super action.",
    });
  } catch (error) {
    const code = error?.code || "SUPER_ACTION_FAILED";
    console.warn("[super-api]", code, error?.message || "Unknown error");
    return respondWithError(res, 500, code, error?.message || "Failed to load super data.");
  }
}
