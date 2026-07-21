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

function respondWithError(res, status, code) {
  return res.status(status).json({
    success: false,
    error: "Failed to save checker.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("CHECKER_INSERT_FAILED");
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
  if (["paused", "일시중지", "중지", "보류", "inactive", "비활성"].includes(normalized)) return "paused";
  if (["left", "퇴사", "탈퇴", "종료", "활동종료"].includes(normalized)) return "left";
  if (["active", "활동중", "활동", "정상", "운영중", "운영"].includes(normalized)) return "active";
  return "active";
}

function normalizeCheckerStatus(value, activityStatus) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (activityStatus === "active") return "active";
  if (activityStatus === "paused" || activityStatus === "left") return "inactive";
  if (["inactive", "paused", "left", "비활성", "중지", "퇴사", "활동종료"].includes(normalized)) return "inactive";
  if (["active", "활동중", "정상"].includes(normalized)) return "active";
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const username = trimOrNull(body?.username ?? body?.loginId ?? body?.userId);
  const name = trimOrNull(body?.name);

  if (!body || !username || !name) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const organizationId = trimOrNull(body.organizationId ?? body.organization_id);
    const organization = await resolveOrganization(supabase, organizationId);
    if (organizationId && !organization) return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");

    const insertPayload = buildInsertPayload(body, organization?.id || null);
    const { data, error } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return respondWithError(res, 409, "CHECKER_USERNAME_DUPLICATED");
      }

      console.error("[checkers/create] CHECKER_INSERT_FAILED", {
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
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "CHECKER_INSERT_FAILED";
    console.error("[checkers/create] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, code);
  }
}
