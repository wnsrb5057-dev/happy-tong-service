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
    error: "Failed to update target status.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("TARGET_STATUS_UPDATE_FAILED");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeLifecycleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["paused", "보류", "일시중지", "중지"].includes(normalized)) return "paused";
  if (["ended", "관리종료", "종료"].includes(normalized)) return "ended";
  if (["hospitalized", "입원"].includes(normalized)) return "hospitalized";
  if (["transferred", "전출", "이관"].includes(normalized)) return "transferred";
  if (["deceased", "사망"].includes(normalized)) return "deceased";
  if (["unknown_address", "unknownaddress", "주소불명"].includes(normalized)) return "unknown_address";
  if (["active", "운영중", "운영", "관리중"].includes(normalized)) return "active";
  return "active";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const targetId = trimOrNull(body?.targetId ?? body?.target_id ?? body?.id);
  const lifecycleStatus = trimOrNull(body?.lifecycleStatus ?? body?.lifecycle_status ?? body?.status);

  if (!body || !targetId || !lifecycleStatus) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  if (!isUuidLike(targetId)) {
    return respondWithError(res, 404, "TARGET_NOT_FOUND");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: target, error: queryError } = await supabase
      .from("targets")
      .select("id, organization_id")
      .eq("id", targetId)
      .maybeSingle();

    if (queryError || !target) return respondWithError(res, 404, "TARGET_NOT_FOUND");

    const organizationId = trimOrNull(body.organizationId ?? body.organization_id);
    if (organizationId && organizationId !== target.organization_id) {
      return respondWithError(res, 404, "TARGET_NOT_FOUND");
    }

    const normalizedStatus = normalizeLifecycleStatus(lifecycleStatus);
    const { error } = await supabase
      .from("targets")
      .update({
        lifecycle_status: normalizedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);

    if (error) {
      console.error("[targets/update-status] TARGET_STATUS_UPDATE_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "TARGET_STATUS_UPDATE_FAILED");
    }

    return res.status(200).json({
      success: true,
      updated: true,
      targetId: target.id,
      lifecycleStatus: normalizedStatus,
    });
  } catch (error) {
    console.error("[targets/update-status] REQUEST_FAILED", {
      code: "TARGET_STATUS_UPDATE_FAILED",
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, "TARGET_STATUS_UPDATE_FAILED");
  }
}
