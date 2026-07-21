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
    error: "Failed to save target.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("TARGET_INSERT_FAILED");
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
  if (Array.isArray(value)) {
    return value.map((item) => trimOrNull(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function resolveOrganization(supabase, organizationId) {
  if (!isUuidLike(organizationId)) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw createCodeError("ORGANIZATION_NOT_FOUND");
  return data || null;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => trimOrNull(value)).filter(Boolean))];
}

function getCheckerNameCandidates(value) {
  const rawName = trimOrNull(value);
  if (!rawName) return [];

  const withoutRoleSuffix = rawName.replace(/\s*체커$/u, "").trim();
  return uniqueValues([rawName, withoutRoleSuffix]);
}

function getAssignedCheckerLookup(body) {
  return {
    id: trimOrNull(body.assignedCheckerId ?? body.assigned_checker_id ?? body.checkerId ?? body.checker_id),
    email: trimOrNull(body.assignedCheckerEmail ?? body.checkerEmail ?? body.email),
    username: trimOrNull(body.assignedCheckerUsername ?? body.checkerUsername ?? body.username),
    names: uniqueValues([
      ...getCheckerNameCandidates(body.assignedCheckerName),
      ...getCheckerNameCandidates(body.checkerName),
      ...getCheckerNameCandidates(body.assignedChecker),
      ...getCheckerNameCandidates(body.checker),
    ]),
  };
}

function pickCheckerRow(rows, organizationId) {
  if (!Array.isArray(rows) || !rows.length) return null;

  return (
    rows.find((row) => row.organization_id === organizationId && (row.status || "active") === "active") ||
    rows.find((row) => row.organization_id === organizationId) ||
    rows.find((row) => (row.status || "active") === "active") ||
    rows[0]
  );
}

async function findCheckerByColumn(supabase, organizationId, column, value) {
  const candidate = trimOrNull(value);
  if (!candidate) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, organization_id, role, status")
    .eq(column, candidate)
    .eq("role", "checker")
    .limit(5);

  if (error) throw createCodeError("ASSIGNED_CHECKER_NOT_FOUND");
  return pickCheckerRow(data, organizationId);
}

async function resolveAssignedCheckerId(supabase, body, organizationId) {
  const lookup = getAssignedCheckerLookup(body);

  if (!lookup.id && !lookup.email && !lookup.username && !lookup.names.length) {
    return { checkerId: null, warning: null };
  }

  if (isUuidLike(lookup.id)) {
    const row = await findCheckerByColumn(supabase, organizationId, "id", lookup.id);
    if (row?.id) return { checkerId: row.id, warning: null };
  }

  const emailRow = await findCheckerByColumn(supabase, organizationId, "email", lookup.email);
  if (emailRow?.id) return { checkerId: emailRow.id, warning: null };

  const usernameCandidates = uniqueValues([lookup.username, ...lookup.names]);
  for (const username of usernameCandidates) {
    const usernameRow = await findCheckerByColumn(supabase, organizationId, "username", username);
    if (usernameRow?.id) return { checkerId: usernameRow.id, warning: null };
  }

  return { checkerId: null, warning: "ASSIGNED_CHECKER_NOT_FOUND" };
}

function buildInsertPayload(body, organizationId, assignedCheckerId) {
  const now = new Date().toISOString();
  return {
    organization_id: organizationId,
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
  const organizationId = trimOrNull(body?.organizationId ?? body?.organization_id);
  const name = trimOrNull(body?.name);

  if (!body || !organizationId || !name) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const organization = await resolveOrganization(supabase, organizationId);
    if (!organization) return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");

    const assignedChecker = await resolveAssignedCheckerId(supabase, body, organization.id);
    const insertPayload = buildInsertPayload(body, organization.id, assignedChecker.checkerId);

    const { data, error } = await supabase
      .from("targets")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[targets/create] TARGET_INSERT_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "TARGET_INSERT_FAILED");
    }

    return res.status(200).json({
      success: true,
      saved: true,
      targetId: data?.id || null,
      ...(assignedChecker.warning ? { warning: assignedChecker.warning } : {}),
    });
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "TARGET_INSERT_FAILED";
    console.error("[targets/create] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return respondWithError(res, 500, code);
  }
}
