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

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return Boolean(value);
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

function respondWithError(res, status, code) {
  return res.status(status).json({
    success: false,
    error: "Failed to save emergency report.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("MISSING_REQUIRED_FIELDS");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveChecker(supabase, body) {
  const checkerId = trimOrNull(body.checkerId ?? body.checker_id);
  const checkerUsername = trimOrNull(body.checkerUsername);
  const checkerEmail = trimOrNull(body.checkerEmail);
  const baseSelect = "id, organization_id, username, email, role, status";
  const queries = [];

  if (isUuidLike(checkerId)) {
    queries.push(supabase.from("users").select(baseSelect).eq("id", checkerId).maybeSingle());
  }

  if (checkerEmail) {
    queries.push(supabase.from("users").select(baseSelect).eq("email", checkerEmail).limit(5));
  }

  if (checkerUsername) {
    queries.push(supabase.from("users").select(baseSelect).eq("username", checkerUsername).limit(5));
  }

  for (const query of queries) {
    const { data, error } = await query;

    if (error) {
      console.error("[emergency-reports/create] CHECKER_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("CHECKER_QUERY_FAILED");
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (!rows.length) {
      continue;
    }

    const activeMatch = rows.find((row) => String(row?.status || "").toLowerCase() === "active");
    return activeMatch || rows[0] || null;
  }

  return null;
}

async function resolveTarget(supabase, body, organizationId) {
  const targetId = trimOrNull(body.targetId ?? body.target_id);
  const targetName = trimOrNull(body.targetName);
  const baseSelect = "id, organization_id, name";

  if (isUuidLike(targetId)) {
    const { data, error } = await supabase
      .from("targets")
      .select(baseSelect)
      .eq("id", targetId)
      .maybeSingle();

    if (error) {
      console.error("[emergency-reports/create] TARGET_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    if (data) {
      return data;
    }
  }

  if (targetName) {
    let query = supabase.from("targets").select(baseSelect).eq("name", targetName).limit(5);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[emergency-reports/create] TARGET_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length) {
      return rows[0];
    }
  }

  return null;
}

async function resolveOrganization(supabase, candidateOrganizationId) {
  if (!isUuidLike(candidateOrganizationId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", candidateOrganizationId)
    .maybeSingle();

  if (error) {
    console.error("[emergency-reports/create] ORGANIZATION_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw createCodeError("ORGANIZATION_NOT_FOUND");
  }

  return data || null;
}

function normalizeReportedAt(value) {
  if (!isNonEmptyString(value)) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeEmergencySeverity(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["urgent", "emergency", "danger", "high", "critical"].includes(normalized)) {
    return "urgent";
  }

  if (["caution", "warning", "need_check", "issue", "needed", "abnormal", "low", "medium"].includes(normalized)) {
    return "caution";
  }

  if (["normal", "none", "good", "ok"].includes(normalized)) {
    return "normal";
  }

  return "caution";
}

function normalizeEmergencyStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["received", "checking", "contacted", "visiting", "completed"].includes(normalized)) {
    return normalized;
  }

  return "received";
}

function buildInsertPayload(body, resolvedOrganizationId, resolvedTarget, resolvedChecker) {
  const now = new Date().toISOString();
  const reportedAt = normalizeReportedAt(body.reportedAt ?? body.reported_at);
  const type = trimOrNull(body.type ?? body.issueType ?? body.emergencyType) || "general";
  const title = trimOrNull(body.title) || `${resolvedTarget.name || "대상자"} 이상징후 보고`;

  return {
    organization_id: resolvedOrganizationId,
    target_id: resolvedTarget.id,
    checker_id: resolvedChecker?.id || null,
    type,
    severity: normalizeEmergencySeverity(body.severity ?? body.issueLevel),
    status: normalizeEmergencyStatus(body.status),
    title,
    description: trimOrNull(body.description ?? body.content ?? body.memo) || "",
    reported_at: reportedAt,
    created_at: now,
    updated_at: now,
  };
}

function buildHandlingLogPayload(body, reportId, organizationId, checkerId) {
  const now = new Date().toISOString();
  const checkerName =
    trimOrNull(body.checkerUsername) ||
    trimOrNull(body.checkerEmail) ||
    "체커";

  return {
    emergency_report_id: reportId,
    organization_id: organizationId,
    status: "received",
    memo: "이상징후 보고 접수",
    contacted_guardian: normalizeBoolean(body.contactedGuardian),
    visit_required: normalizeBoolean(body.visitRequired),
    created_by: checkerId || null,
    created_by_name: checkerName,
    created_at: now,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  if (!body) {
    return respondWithError(res, 400, "MISSING_REQUIRED_FIELDS");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const requestedOrganizationId = trimOrNull(body.organizationId ?? body.organization_id);
    const requestedOrganizationIdForLookup = isUuidLike(requestedOrganizationId) ? requestedOrganizationId : null;
    const resolvedChecker = await resolveChecker(supabase, body);
    const resolvedTarget = await resolveTarget(
      supabase,
      body,
      requestedOrganizationIdForLookup || resolvedChecker?.organization_id || null
    );

    if (!resolvedTarget) {
      return respondWithError(res, 400, "TARGET_NOT_FOUND");
    }

    if (
      requestedOrganizationIdForLookup &&
      resolvedTarget.organization_id &&
      resolvedTarget.organization_id !== requestedOrganizationIdForLookup
    ) {
      return respondWithError(res, 400, "ORGANIZATION_TARGET_MISMATCH");
    }

    const organizationCandidates = [
      requestedOrganizationIdForLookup,
      resolvedTarget.organization_id,
      resolvedChecker?.organization_id,
    ].filter(Boolean);

    let resolvedOrganization = null;
    for (const organizationId of organizationCandidates) {
      resolvedOrganization = await resolveOrganization(supabase, organizationId);
      if (resolvedOrganization) {
        break;
      }
    }

    if (!resolvedOrganization) {
      return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");
    }

    if (
      resolvedTarget.organization_id &&
      resolvedTarget.organization_id !== resolvedOrganization.id
    ) {
      return respondWithError(res, 400, "ORGANIZATION_TARGET_MISMATCH");
    }

    const insertPayload = buildInsertPayload(body, resolvedOrganization.id, resolvedTarget, resolvedChecker);
    const { data, error } = await supabase
      .from("emergency_reports")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[emergency-reports/create] EMERGENCY_REPORT_INSERT_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "EMERGENCY_REPORT_INSERT_FAILED");
    }

    let warning = null;
    const handlingLogPayload = buildHandlingLogPayload(
      body,
      data.id,
      resolvedOrganization.id,
      resolvedChecker?.id || null
    );
    const { error: handlingLogError } = await supabase
      .from("emergency_handling_logs")
      .insert(handlingLogPayload);

    if (handlingLogError) {
      console.warn("[emergency-reports/create] EMERGENCY_HANDLING_LOG_INSERT_FAILED", {
        code: handlingLogError.code || null,
        message: handlingLogError.message || "Unknown Supabase error",
      });
      warning = {
        code: "EMERGENCY_HANDLING_LOG_INSERT_FAILED",
      };
    }

    return res.status(200).json({
      success: true,
      saved: true,
      reportId: data?.id || null,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "EMERGENCY_REPORT_INSERT_FAILED";

    console.error("[emergency-reports/create] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return respondWithError(res, 500, code);
  }
}
