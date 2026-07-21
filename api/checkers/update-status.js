import { createClient } from "@supabase/supabase-js";

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    error: "Failed to update checker status.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("CHECKER_STATUS_UPDATE_FAILED");
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const checkerId = trimOrNull(body?.checkerId ?? body?.checker_id ?? body?.id);
  const rawStatus = body?.activityStatus ?? body?.activity_status ?? body?.status;

  if (!body || !checkerId || !trimOrNull(rawStatus)) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  if (!isUuidLike(checkerId)) {
    return respondWithError(res, 404, "CHECKER_NOT_FOUND");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: checker, error: queryError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", checkerId)
      .maybeSingle();

    if (queryError || !checker || checker.role !== "checker") {
      return respondWithError(res, 404, "CHECKER_NOT_FOUND");
    }

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
      console.error("[checkers/update-status] CHECKER_STATUS_UPDATE_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "CHECKER_STATUS_UPDATE_FAILED");
    }

    return res.status(200).json({
      success: true,
      updated: true,
      checkerId: checker.id,
      status,
      activityStatus,
    });
  } catch (error) {
    console.error("[checkers/update-status] REQUEST_FAILED", {
      code: "CHECKER_STATUS_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, "CHECKER_STATUS_UPDATE_FAILED");
  }
}
