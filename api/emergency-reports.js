import { createClient } from "@supabase/supabase-js";

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUS_VALUES = new Set(["received", "checking", "contacted", "visiting", "completed"]);

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
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
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

function respondWithError(res, status, code, error = "Failed to save emergency report.", message = null) {
  return res.status(status).json({
    success: false,
    error,
    code,
    ...(message ? { message } : {}),
  });
}

function getSupabaseAdminClient(missingCode) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError(missingCode);
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
      console.error("[emergency-reports] CHECKER_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("CHECKER_QUERY_FAILED");
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (!rows.length) continue;

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
      console.error("[emergency-reports] TARGET_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    if (data) return data;
  }

  if (targetName) {
    let query = supabase.from("targets").select(baseSelect).eq("name", targetName).limit(5);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[emergency-reports] TARGET_QUERY_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length) return rows[0];
  }

  return null;
}

async function resolveOrganization(supabase, candidateOrganizationId) {
  if (!isUuidLike(candidateOrganizationId)) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", candidateOrganizationId)
    .maybeSingle();

  if (error) {
    console.error("[emergency-reports] ORGANIZATION_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw createCodeError("ORGANIZATION_NOT_FOUND");
  }

  return data || null;
}

function normalizeReportedAt(value) {
  if (!isNonEmptyString(value)) return new Date().toISOString();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeEmergencySeverity(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["urgent", "emergency", "danger", "high", "critical"].includes(normalized)) return "urgent";
  if (["caution", "warning", "need_check", "issue", "needed", "abnormal", "low", "medium"].includes(normalized)) {
    return "caution";
  }
  if (["normal", "none", "good", "ok"].includes(normalized)) return "normal";

  return "caution";
}

function normalizeCreateEmergencyStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALLOWED_STATUS_VALUES.has(normalized)) return normalized;
  return "received";
}

function normalizeUpdateEmergencyStatus(value) {
  const compact = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const statusMap = {
    received: "received",
    "접수": "received",
    "접수됨": "received",
    checking: "checking",
    in_progress: "checking",
    "확인중": "checking",
    "처리중": "checking",
    contacted: "contacted",
    "보호자연락": "contacted",
    "연락완료": "contacted",
    visiting: "visiting",
    "방문필요": "visiting",
    "방문예정": "visiting",
    completed: "completed",
    resolved: "completed",
    "완료": "completed",
    "조치완료": "completed",
  };

  return statusMap[compact] || "checking";
}

function getDefaultMemo(status) {
  const memoMap = {
    received: "이상징후 보고 접수",
    checking: "관리자 확인 중",
    contacted: "보호자 연락 완료",
    visiting: "방문 확인 필요",
    completed: "조치 완료",
  };

  return memoMap[status] || "처리 상태 변경";
}

function normalizeCompletedAt(body, status, now) {
  if (status !== "completed") return null;

  const value = body.completedAt ?? body.completed_at;
  if (!isNonEmptyString(value)) return now;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? now : parsed.toISOString();
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
    status: normalizeCreateEmergencyStatus(body.status),
    title,
    description: trimOrNull(body.description ?? body.content ?? body.memo) || "",
    reported_at: reportedAt,
    created_at: now,
    updated_at: now,
  };
}

function buildInitialHandlingLogPayload(body, reportId, organizationId, checkerId) {
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
    created_at: new Date().toISOString(),
  };
}

async function findEmergencyReport(supabase, reportId) {
  const { data, error } = await supabase
    .from("emergency_reports")
    .select("id, organization_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error("[emergency-reports] EMERGENCY_REPORT_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw createCodeError("EMERGENCY_REPORT_QUERY_FAILED");
  }

  return data || null;
}

async function handleCreate(body, res) {
  const supabase = getSupabaseAdminClient("MISSING_REQUIRED_FIELDS");
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
    if (resolvedOrganization) break;
  }

  if (!resolvedOrganization) {
    return respondWithError(res, 400, "ORGANIZATION_NOT_FOUND");
  }

  if (resolvedTarget.organization_id && resolvedTarget.organization_id !== resolvedOrganization.id) {
    return respondWithError(res, 400, "ORGANIZATION_TARGET_MISMATCH");
  }

  const { data, error } = await supabase
    .from("emergency_reports")
    .insert(buildInsertPayload(body, resolvedOrganization.id, resolvedTarget, resolvedChecker))
    .select("id")
    .single();

  if (error) {
    console.error("[emergency-reports] EMERGENCY_REPORT_INSERT_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    return respondWithError(res, 500, "EMERGENCY_REPORT_INSERT_FAILED");
  }

  let warning = null;
  const { error: handlingLogError } = await supabase
    .from("emergency_handling_logs")
    .insert(buildInitialHandlingLogPayload(body, data.id, resolvedOrganization.id, resolvedChecker?.id || null));

  if (handlingLogError) {
    console.warn("[emergency-reports] EMERGENCY_HANDLING_LOG_INSERT_FAILED", {
      code: handlingLogError.code || null,
      message: handlingLogError.message || "Unknown Supabase error",
    });
    warning = { code: "EMERGENCY_HANDLING_LOG_INSERT_FAILED" };
  }

  return res.status(200).json({
    success: true,
    saved: true,
    reportId: data?.id || null,
    ...(warning ? { warning } : {}),
  });
}

async function handleUpdateStatus(body, res) {
  const reportId = trimOrNull(body?.reportId ?? body?.emergencyReportId ?? body?.emergency_report_id ?? body?.id);

  if (!reportId) {
    return respondWithError(res, 400, "MISSING_REPORT_ID", "Failed to update emergency status.");
  }

  if (!isUuidLike(reportId)) {
    return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND", "Failed to update emergency status.");
  }

  const supabase = getSupabaseAdminClient("EMERGENCY_REPORT_UPDATE_FAILED");
  const emergencyReport = await findEmergencyReport(supabase, reportId);

  if (!emergencyReport) {
    return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND", "Failed to update emergency status.");
  }

  const organizationId = trimOrNull(body.organizationId ?? body.organization_id) || emergencyReport.organization_id;
  if (organizationId !== emergencyReport.organization_id) {
    return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND", "Failed to update emergency status.");
  }

  const normalizedStatus = normalizeUpdateEmergencyStatus(body.status);
  if (!ALLOWED_STATUS_VALUES.has(normalizedStatus)) {
    return respondWithError(res, 400, "INVALID_STATUS", "Failed to update emergency status.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("emergency_reports")
    .update({
      status: normalizedStatus,
      completed_at: normalizeCompletedAt(body, normalizedStatus, now),
      updated_at: now,
    })
    .eq("id", reportId);

  if (updateError) {
    console.error("[emergency-reports] EMERGENCY_REPORT_UPDATE_FAILED", {
      code: updateError.code || null,
      message: updateError.message || "Unknown Supabase error",
    });
    return respondWithError(res, 500, "EMERGENCY_REPORT_UPDATE_FAILED", "Failed to update emergency status.");
  }

  const memo =
    trimOrNull(body.memo ?? body.adminMemo ?? body.actionMemo) ||
    getDefaultMemo(normalizedStatus);
  const createdBy = trimOrNull(body.createdBy ?? body.created_by ?? body.adminId);
  const createdByName =
    trimOrNull(body.createdByName ?? body.created_by_name ?? body.adminName) ||
    "관리자";

  const { error: handlingLogError } = await supabase
    .from("emergency_handling_logs")
    .insert({
      emergency_report_id: reportId,
      organization_id: emergencyReport.organization_id,
      status: normalizedStatus,
      memo,
      contacted_guardian: normalizeBoolean(body.contactedGuardian ?? body.contacted_guardian) || normalizedStatus === "contacted",
      visit_required: normalizeBoolean(body.visitRequired ?? body.visit_required) || normalizedStatus === "visiting",
      created_by: isUuidLike(createdBy) ? createdBy : null,
      created_by_name: createdByName,
      created_at: now,
    });

  const responseBody = {
    success: true,
    updated: true,
    reportId,
    status: normalizedStatus,
  };

  if (handlingLogError) {
    console.warn("[emergency-reports] EMERGENCY_HANDLING_LOG_INSERT_FAILED", {
      code: handlingLogError.code || null,
      message: handlingLogError.message || "Unknown Supabase error",
    });
    responseBody.warning = "EMERGENCY_HANDLING_LOG_INSERT_FAILED";
  }

  return res.status(200).json(responseBody);
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

  const action = trimOrNull(body.action);
  if (!action) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Unsupported emergency reports action.",
    });
  }

  try {
    if (action === "create") return handleCreate(body, res);
    if (action === "updateStatus") return handleUpdateStatus(body, res);

    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Unsupported emergency reports action.",
    });
  } catch (error) {
    const fallbackError = action === "updateStatus"
      ? "Failed to update emergency status."
      : "Failed to save emergency report.";
    const fallbackCode = action === "updateStatus"
      ? "EMERGENCY_REPORT_UPDATE_FAILED"
      : "EMERGENCY_REPORT_INSERT_FAILED";
    const code = error instanceof Error && error.code ? error.code : fallbackCode;

    console.error("[emergency-reports] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return respondWithError(res, 500, code, fallbackError);
  }
}
