import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set(["checker", "admin", "super_admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_SELECT_COLUMNS = "id, auth_user_id, organization_id, role, username, email, status";

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

async function resolveUserByQuery(query, resolveBy) {
  const { data, error } = await query;

  if (error) {
    console.error("[push/subscribe] USER_RESOLVE_FAILED", {
      resolveBy,
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });

    throw new Error("USER_RESOLVE_FAILED");
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return null;
  }

  const activeMatch = rows.find((row) => String(row?.status || "").toLowerCase() === "active");
  return activeMatch || rows[0] || null;
}

async function resolvePushUser(supabase, { userId, authUserId, username, email, role }) {
  if (isUuid(userId)) {
    const directMatch = await resolveUserByQuery(
      supabase.from("users").select(USER_SELECT_COLUMNS).eq("id", userId.trim()).limit(1),
      "userId"
    );

    if (directMatch) {
      return directMatch;
    }
  }

  if (isUuid(authUserId)) {
    const authMatch = await resolveUserByQuery(
      supabase.from("users").select(USER_SELECT_COLUMNS).eq("auth_user_id", authUserId.trim()).limit(1),
      "authUserId"
    );

    if (authMatch) {
      return authMatch;
    }
  }

  if (isNonEmptyString(email)) {
    const emailMatch = await resolveUserByQuery(
      supabase.from("users").select(USER_SELECT_COLUMNS).eq("email", email.trim()).limit(1),
      "email"
    );

    if (emailMatch) {
      return emailMatch;
    }
  }

  if (isNonEmptyString(username) && ALLOWED_ROLES.has(role)) {
    const usernameMatch = await resolveUserByQuery(
      supabase
        .from("users")
        .select(USER_SELECT_COLUMNS)
        .eq("username", username.trim())
        .eq("role", role)
        .limit(5),
      "username"
    );

    if (usernameMatch) {
      return usernameMatch;
    }
  }

  return null;
}

function buildPayload(body, resolvedUser) {
  const subscription = body?.subscription || {};
  const normalizedAuthUserId = normalizeOptionalUuid(body.authUserId);
  const normalizedOrganizationId = normalizeOptionalUuid(body.organizationId);

  return {
    user_id: resolvedUser.id,
    auth_user_id:
      resolvedUser.auth_user_id ||
      (normalizedAuthUserId === "__invalid__" ? null : normalizedAuthUserId),
    organization_id:
      resolvedUser.organization_id ||
      (normalizedOrganizationId === "__invalid__" ? null : normalizedOrganizationId),
    role: resolvedUser.role || body.role,
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
  const hasUsername = isNonEmptyString(body.username);
  const hasEmail = isNonEmptyString(body.email);
  const hasAuthUserId = isNonEmptyString(body.authUserId);

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

  if (!isUuid(body.userId) && !isUuid(body.authUserId) && !hasUsername && !hasEmail) {
    return respondWithError(res, 400, "INVALID_USER_ID", "Invalid push subscription payload.");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const resolvedUser = await resolvePushUser(supabase, {
      userId: body.userId,
      authUserId: normalizedAuthUserId === "__invalid__" ? null : body.authUserId,
      username: body.username,
      email: body.email,
      role,
    });

    if (!resolvedUser) {
      return respondWithError(res, 400, "USER_NOT_FOUND", "Invalid push subscription payload.");
    }

    const payload = buildPayload(body, resolvedUser);

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
        resolveBy: isUuid(body.userId)
          ? "userId"
          : hasAuthUserId && isUuid(body.authUserId)
            ? "authUserId"
            : hasEmail
              ? "email"
              : "username",
        hasUserId: Boolean(body.userId),
        hasUsername,
        hasEmail,
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

    if (error instanceof Error && error.message === "USER_RESOLVE_FAILED") {
      return respondWithError(res, 500, "USER_RESOLVE_FAILED", "Failed to resolve push subscription user.");
    }

    console.error("[push/subscribe] UNEXPECTED_ERROR", {
      message: error instanceof Error ? error.message : "Unknown server error",
      hasUserId: Boolean(body.userId),
      hasUsername,
      hasEmail,
    });

    return respondWithError(res, 500, "SUPABASE_UPSERT_FAILED", "Failed to save push subscription.");
  }
}
