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
    error: "Failed to update target.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("TARGET_UPDATE_FAILED");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRiskLevel(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["danger", "urgent", "high", "emergency", "위험", "긴급"].includes(normalized)) return "danger";
  if (["caution", "warning", "need_check", "issue", "needed", "주의", "확인필요"].includes(normalized)) return "caution";
  if (["normal", "none", "good", "ok", "low", "정상", "양호"].includes(normalized)) return "normal";
  return "normal";
}

function normalizeLifecycleStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["paused", "보류", "일시중지", "중지"].includes(normalized)) return "paused";
  if (["ended", "관리종료", "종료"].includes(normalized)) return "ended";
  if (["hospitalized", "입원"].includes(normalized)) return "hospitalized";
  if (["transferred", "전출", "이관"].includes(normalized)) return "transferred";
  if (["deceased", "사망"].includes(normalized)) return "deceased";
  if (["unknown_address", "unknownaddress", "주소불명"].includes(normalized)) return "unknown_address";
  return "active";
}

function normalizeAge(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCheckDays(value) {
  if (Array.isArray(value)) return value.map((item) => trimOrNull(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

async function findTarget(supabase, targetId) {
  if (!isUuidLike(targetId)) return null;
  const { data, error } = await supabase
    .from("targets")
    .select("id, organization_id")
    .eq("id", targetId)
    .maybeSingle();
  if (error) throw createCodeError("TARGET_QUERY_FAILED");
  return data || null;
}

async function resolveAssignedCheckerId(supabase, checkerId) {
  if (!checkerId) return null;
  if (!isUuidLike(checkerId)) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", checkerId)
    .maybeSingle();
  if (error) return null;
  return data?.id || null;
}

function buildUpdatePayload(body, assignedCheckerId) {
  return {
    assigned_checker_id: assignedCheckerId,
    name: trimOrNull(body.name),
    age: normalizeAge(body.age),
    gender: trimOrNull(body.gender),
    phone: trimOrNull(body.phone),
    address: trimOrNull(body.address),
    risk_level: normalizeRiskLevel(body.riskLevel ?? body.risk_level),
    default_check_type: trimOrNull(body.defaultCheckType ?? body.default_check_type),
    check_days: normalizeCheckDays(body.checkDays ?? body.check_days),
    check_time: trimOrNull(body.checkTime ?? body.check_time),
    health_note: trimOrNull(body.healthNote ?? body.health_note ?? body.healthStatus),
    caution_note: trimOrNull(body.cautionNote ?? body.caution_note),
    medication_note: trimOrNull(body.medicationNote ?? body.medication_note),
    guardian_name: trimOrNull(body.guardianName ?? body.guardian_name),
    guardian_phone: trimOrNull(body.guardianPhone ?? body.guardian_phone),
    lifecycle_status: normalizeLifecycleStatus(body.lifecycleStatus ?? body.lifecycle_status),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const targetId = trimOrNull(body?.targetId ?? body?.target_id ?? body?.id);
  if (!body || !targetId) return respondWithError(res, 400, "MISSING_TARGET_ID");

  try {
    const supabase = getSupabaseAdminClient();
    const target = await findTarget(supabase, targetId);
    if (!target) return respondWithError(res, 404, "TARGET_NOT_FOUND");

    const organizationId = trimOrNull(body.organizationId ?? body.organization_id);
    if (organizationId && organizationId !== target.organization_id) {
      return respondWithError(res, 400, "ORGANIZATION_TARGET_MISMATCH");
    }

    const assignedCheckerCandidate = trimOrNull(body.assignedCheckerId ?? body.assigned_checker_id ?? body.checkerId);
    const assignedCheckerId = await resolveAssignedCheckerId(supabase, assignedCheckerCandidate);
    const updatePayload = buildUpdatePayload(body, assignedCheckerId);

    const { error } = await supabase
      .from("targets")
      .update(updatePayload)
      .eq("id", target.id);

    if (error) {
      console.error("[targets/update] TARGET_UPDATE_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "TARGET_UPDATE_FAILED");
    }

    return res.status(200).json({
      success: true,
      updated: true,
      targetId: target.id,
    });
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "TARGET_UPDATE_FAILED";
    console.error("[targets/update] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, code);
  }
}
