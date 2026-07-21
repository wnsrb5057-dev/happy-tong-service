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
    error: "Failed to update checker.",
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const checkerId = trimOrNull(body?.checkerId ?? body?.checker_id ?? body?.id);
  if (!body || !checkerId) return respondWithError(res, 400, "MISSING_CHECKER_ID");

  try {
    const supabase = getSupabaseAdminClient();
    const checker = await findChecker(supabase, checkerId);
    if (!checker) return respondWithError(res, 404, "CHECKER_NOT_FOUND");

    const organizationCandidate = trimOrNull(body.organizationId ?? body.organization_id);
    const organization = await resolveOrganization(supabase, organizationCandidate);
    if (organizationCandidate && !organization) return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");

    const updatePayload = buildUpdatePayload(body, checker, organization?.id);
    const { error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", checker.id)
      .eq("role", "checker");

    if (error) {
      if (error.code === "23505") {
        return respondWithError(res, 409, "CHECKER_USERNAME_DUPLICATED");
      }

      console.error("[checkers/update] CHECKER_UPDATE_FAILED", {
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
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "CHECKER_UPDATE_FAILED";
    console.error("[checkers/update] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, code);
  }
}
