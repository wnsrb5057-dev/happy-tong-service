import { createClient } from "@supabase/supabase-js";

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createCodeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuidLike(value) {
  return isNonEmptyString(value) && UUID_LIKE_PATTERN.test(value.trim());
}

function trimOrNull(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function parseRequestBody(body) {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_error) {
      return null;
    }
  }
  return typeof body === "object" ? body : null;
}

function respondWithError(res, status, code, message = "Failed to save checker.") {
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
    throw createCodeError("CHECKER_UPDATE_FAILED");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeCheckerActivityStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["paused", "inactive", "pause", "hold"].includes(normalized)) return "paused";
  if (["left", "ended", "quit", "exit"].includes(normalized)) return "left";
  if (["active", "normal", "ok"].includes(normalized)) return "active";
  return "active";
}

function normalizeCheckerStatus(value, activityStatus) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (activityStatus === "active") return "active";
  if (activityStatus === "paused" || activityStatus === "left") return "inactive";
  if (["inactive", "paused", "left", "ended", "pause"].includes(normalized)) return "inactive";
  if (["active", "normal", "ok"].includes(normalized)) return "active";
  return "active";
}

async function resolveOrganization(supabase, organizationId) {
  if (!organizationId) return null;
  if (!isUuidLike(organizationId)) throw createCodeError("ORGANIZATION_NOT_FOUND");

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw createCodeError("ORGANIZATION_NOT_FOUND");
  return data || null;
}

async function findChecker(supabase, checkerId) {
  if (!isUuidLike(checkerId)) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, organization_id, role")
    .eq("id", checkerId)
    .maybeSingle();

  if (error) throw createCodeError("CHECKER_QUERY_FAILED");
  if (!data || data.role !== "checker") return null;
  return data;
}

function buildInsertPayload(body, organizationId) {
  const now = new Date().toISOString();
  const activityStatus = normalizeCheckerActivityStatus(body.activityStatus ?? body.activity_status ?? body.status);
  const status = normalizeCheckerStatus(body.status, activityStatus);

  return {
    organization_id: organizationId,
    username: trimOrNull(body.username ?? body.loginId ?? body.userId),
    password_hash: trimOrNull(body.passwordHash ?? body.password_hash),
    name: trimOrNull(body.name),
    role: "checker",
    phone: trimOrNull(body.phone),
    region: trimOrNull(body.region ?? body.area),
    activity_status: activityStatus,
    email: trimOrNull(body.email),
    status,
    created_at: now,
    updated_at: now,
  };
}

function buildUpdatePayload(body, existingChecker, organizationId) {
  const activityStatus = normalizeCheckerActivityStatus(body.activityStatus ?? body.activity_status ?? body.status);
  const status = normalizeCheckerStatus(body.status, activityStatus);
  const username = trimOrNull(body.username ?? body.loginId);
  const name = trimOrNull(body.name);

  return {
    organization_id: organizationId ?? existingChecker.organization_id,
    ...(username ? { username } : {}),
    ...(name ? { name } : {}),
    phone: trimOrNull(body.phone),
    region: trimOrNull(body.region ?? body.area),
    activity_status: activityStatus,
    email: trimOrNull(body.email),
    status,
    updated_at: new Date().toISOString(),
  };
}

async function handleCreate(supabase, body, res) {
  const username = trimOrNull(body?.username ?? body?.loginId ?? body?.userId);
  const name = trimOrNull(body?.name);

  if (!username || !name) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  const organizationId = trimOrNull(body.organizationId ?? body.organization_id);
  const organization = await resolveOrganization(supabase, organizationId);
  if (organizationId && !organization) return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");

  const { data, error } = await supabase
    .from("users")
    .insert(buildInsertPayload(body, organization?.id || null))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return respondWithError(res, 409, "CHECKER_USERNAME_DUPLICATED");
    }

    console.error("[checkers] CHECKER_INSERT_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    return respondWithError(res, 500, "CHECKER_INSERT_FAILED");
  }

  return res.status(200).json({
    success: true,
    saved: true,
    checkerId: data?.id || null,
  });
}

async function handleUpdate(supabase, body, res) {
  const checkerId = trimOrNull(body?.checkerId ?? body?.checker_id ?? body?.id);
  if (!checkerId) return respondWithError(res, 400, "MISSING_CHECKER_ID");

  const checker = await findChecker(supabase, checkerId);
  if (!checker) return respondWithError(res, 404, "CHECKER_NOT_FOUND");

  const organizationCandidate = trimOrNull(body.organizationId ?? body.organization_id);
  const organization = await resolveOrganization(supabase, organizationCandidate);
  if (organizationCandidate && !organization) return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");

  const { error } = await supabase
    .from("users")
    .update(buildUpdatePayload(body, checker, organization?.id))
    .eq("id", checker.id)
    .eq("role", "checker");

  if (error) {
    if (error.code === "23505") {
      return respondWithError(res, 409, "CHECKER_USERNAME_DUPLICATED");
    }

    console.error("[checkers] CHECKER_UPDATE_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    return respondWithError(res, 500, "CHECKER_UPDATE_FAILED");
  }

  return res.status(200).json({
    success: true,
    updated: true,
    checkerId: checker.id,
  });
}

async function handleUpdateStatus(supabase, body, res) {
  const checkerId = trimOrNull(body?.checkerId ?? body?.checker_id ?? body?.id);
  const rawStatus = body?.activityStatus ?? body?.activity_status ?? body?.status;

  if (!checkerId || !trimOrNull(rawStatus)) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  const checker = await findChecker(supabase, checkerId);
  if (!checker) return respondWithError(res, 404, "CHECKER_NOT_FOUND");

  const activityStatus = normalizeCheckerActivityStatus(rawStatus);
  const status = normalizeCheckerStatus(body.status, activityStatus);
  const { error } = await supabase
    .from("users")
    .update({
      activity_status: activityStatus,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checker.id)
    .eq("role", "checker");

  if (error) {
    console.error("[checkers] CHECKER_STATUS_UPDATE_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    return respondWithError(res, 500, "CHECKER_STATUS_UPDATE_FAILED", "Failed to update checker status.");
  }

  return res.status(200).json({
    success: true,
    updated: true,
    checkerId: checker.id,
    status,
    activityStatus,
  });
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
  const action = trimOrNull(body?.action);

  if (!body || !action) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid checker action.",
    });
  }

  try {
    const supabase = getSupabaseAdminClient();

    if (action === "create") return handleCreate(supabase, body, res);
    if (action === "update") return handleUpdate(supabase, body, res);
    if (action === "updateStatus") return handleUpdateStatus(supabase, body, res);

    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid checker action.",
    });
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "CHECKER_UPDATE_FAILED";
    console.error("[checkers] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, code);
  }
}
