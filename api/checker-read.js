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

async function callRpc(supabase, rpcName, checkerId) {
  const { data, error } = await supabase.rpc(rpcName, {
    p_checker_id: checkerId,
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
    "getHome",
    "getTargets",
    "getActivityHistory",
    "getActivityFormTargets",
  ]);

  if (!validActions.has(action)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid checker read action.",
    });
  }

  const checkerId = body.checkerId || body.checker_id;
  if (!checkerId) {
    return respondWithError(res, 400, "MISSING_CHECKER_ID", "checkerId is required.");
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (action === "getHome") {
      const data = await callRpc(supabase, "get_public_checker_home", checkerId);
      return res.status(200).json({
        success: true,
        home: firstRow(data) || null,
      });
    }

    if (action === "getTargets") {
      const data = await callRpc(supabase, "get_public_checker_targets", checkerId);
      return res.status(200).json({
        success: true,
        targets: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getActivityHistory") {
      const data = await callRpc(supabase, "get_public_checker_activity_history", checkerId);
      return res.status(200).json({
        success: true,
        activityHistory: Array.isArray(data) ? data : [],
      });
    }

    if (action === "getActivityFormTargets") {
      const data = await callRpc(supabase, "get_public_checker_activity_form_targets", checkerId);
      return res.status(200).json({
        success: true,
        targets: Array.isArray(data) ? data : [],
      });
    }
  } catch (error) {
    const code = error?.code || "CHECKER_READ_FAILED";
    console.warn("[checker-read-api]", code, error?.message || "Unknown error");
    return respondWithError(res, 500, code, error?.message || "Failed to load checker data.");
  }
}
