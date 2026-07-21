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
    error: "Failed to update emergency status.",
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("EMERGENCY_REPORT_UPDATE_FAILED");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeEmergencyStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const compact = normalized.replace(/\s+/g, "");

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
  if (status !== "completed") {
    return null;
  }

  const value = body.completedAt ?? body.completed_at;
  if (!isNonEmptyString(value)) {
    return now;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? now : parsed.toISOString();
}

async function findEmergencyReport(supabase, reportId) {
  const { data, error } = await supabase
    .from("emergency_reports")
    .select("id, organization_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error("[emergency-reports/update-status] EMERGENCY_REPORT_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw createCodeError("EMERGENCY_REPORT_QUERY_FAILED");
  }

  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED");
  }

  const body = parseRequestBody(req.body);
  const reportId = trimOrNull(body?.reportId ?? body?.emergencyReportId ?? body?.emergency_report_id ?? body?.id);

  if (!reportId) {
    return respondWithError(res, 400, "MISSING_REPORT_ID");
  }

  if (!isUuidLike(reportId)) {
    return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const emergencyReport = await findEmergencyReport(supabase, reportId);

    if (!emergencyReport) {
      return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND");
    }

    const organizationId = trimOrNull(body.organizationId ?? body.organization_id) || emergencyReport.organization_id;
    if (organizationId !== emergencyReport.organization_id) {
      return respondWithError(res, 404, "EMERGENCY_REPORT_NOT_FOUND");
    }

    const normalizedStatus = normalizeEmergencyStatus(body.status);
    if (!ALLOWED_STATUS_VALUES.has(normalizedStatus)) {
      return respondWithError(res, 400, "INVALID_STATUS");
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
      console.error("[emergency-reports/update-status] EMERGENCY_REPORT_UPDATE_FAILED", {
        code: updateError.code || null,
        message: updateError.message || "Unknown Supabase error",
      });
      return respondWithError(res, 500, "EMERGENCY_REPORT_UPDATE_FAILED");
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
      console.warn("[emergency-reports/update-status] EMERGENCY_HANDLING_LOG_INSERT_FAILED", {
        code: handlingLogError.code || null,
        message: handlingLogError.message || "Unknown Supabase error",
      });
      responseBody.warning = "EMERGENCY_HANDLING_LOG_INSERT_FAILED";
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "EMERGENCY_REPORT_UPDATE_FAILED";

    console.error("[emergency-reports/update-status] REQUEST_FAILED", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
    });

    return respondWithError(res, 500, code);
  }
}
