import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set(["checker", "admin", "super_admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("MISSING_ENV");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseRequestBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_error) {
      return null;
    }
  }

  if (typeof body === "object") {
    return body;
  }

  return null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value) {
  return isNonEmptyString(value) && UUID_PATTERN.test(value.trim());
}

function normalizeOptionalUuid(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return isUuid(value) ? value.trim() : "__invalid__";
}

function buildPayload(body) {
  const subscription = body?.subscription || {};
  const normalizedAuthUserId = normalizeOptionalUuid(body.authUserId);
  const normalizedOrganizationId = normalizeOptionalUuid(body.organizationId);

  return {
    user_id: body.userId.trim(),
    auth_user_id: normalizedAuthUserId === "__invalid__" ? null : normalizedAuthUserId,
    organization_id: normalizedOrganizationId === "__invalid__" ? null : normalizedOrganizationId,
    role: body.role,
    endpoint: subscription.endpoint.trim(),
    p256dh: subscription.p256dh.trim(),
    auth: subscription.auth.trim(),
    user_agent: isNonEmptyString(body.userAgent) ? body.userAgent.trim() : null,
    browser_name: isNonEmptyString(body.browserName) ? body.browserName.trim() : null,
    device_type: isNonEmptyString(body.deviceType) ? body.deviceType.trim() : null,
    is_active: true,
    last_used_at: new Date().toISOString(),
  };
}

function respondWithError(res, status, code, error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const body = parseRequestBody(req.body);

  if (!body) {
    return respondWithError(res, 400, "INVALID_JSON", "Invalid request body.");
  }

  const role = body.role;
  const subscription = body.subscription || {};
  const normalizedAuthUserId = normalizeOptionalUuid(body.authUserId);
  const normalizedOrganizationId = normalizeOptionalUuid(body.organizationId);

  if (
    !isNonEmptyString(body.userId) ||
    !isNonEmptyString(subscription.endpoint) ||
    !isNonEmptyString(subscription.p256dh) ||
    !isNonEmptyString(subscription.auth)
  ) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS", "Invalid push subscription payload.");
  }

  if (!ALLOWED_ROLES.has(role)) {
    return respondWithError(res, 400, "INVALID_ROLE", "Invalid push subscription payload.");
  }

  if (!isUuid(body.userId)) {
    return respondWithError(res, 400, "INVALID_USER_ID", "Invalid push subscription payload.");
  }

  if (normalizedAuthUserId === "__invalid__") {
    return respondWithError(res, 400, "INVALID_AUTH_USER_ID", "Invalid push subscription payload.");
  }

  if (normalizedOrganizationId === "__invalid__") {
    return respondWithError(res, 400, "INVALID_ORGANIZATION_ID", "Invalid push subscription payload.");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const payload = buildPayload(body);

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(payload, {
        onConflict: "endpoint",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("[push/subscribe] SUPABASE_UPSERT_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
        hasUserId: Boolean(body.userId),
      });

      return respondWithError(res, 500, "SUPABASE_UPSERT_FAILED", "Failed to save push subscription.");
    }

    return res.status(200).json({
      success: true,
      saved: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_ENV") {
      return respondWithError(res, 500, "MISSING_ENV", "Failed to save push subscription.");
    }

    console.error("[push/subscribe] UNEXPECTED_ERROR", {
      message: error instanceof Error ? error.message : "Unknown server error",
      hasUserId: Boolean(body.userId),
    });

    return respondWithError(res, 500, "SUPABASE_UPSERT_FAILED", "Failed to save push subscription.");
  }
}
