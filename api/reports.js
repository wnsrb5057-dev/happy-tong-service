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

function trimOrNull(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function isUuidLike(value) {
  return isNonEmptyString(value) && UUID_LIKE_PATTERN.test(value.trim());
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

function respondWithError(res, status, code, message = "Failed to save report.") {
  return res.status(status).json({
    success: false,
    error: message,
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("REPORT_SAVE_FAILED");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeReportStatus(value, fallback = "draft") {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (["draft", "초안", "임시저장"].includes(normalized)) return "draft";
  if (["saved", "저장", "저장됨"].includes(normalized)) return "saved";
  if (["completed", "완료", "생성완료", "최종저장"].includes(normalized)) return "completed";
  if (["published", "발행", "제출", "제출완료"].includes(normalized)) return "published";
  return fallback;
}

function normalizeDateOrNull(value) {
  const candidate = trimOrNull(value);
  if (!candidate) return null;
  return candidate.slice(0, 10);
}

function getReportSource(body) {
  return body?.reportData && typeof body.reportData === "object"
    ? body.reportData
    : body?.report && typeof body.report === "object"
      ? body.report
      : {};
}

function buildReportData(body) {
  const source = getReportSource(body);
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return { ...source };
  }

  return {
    title: body?.title || null,
    periodStart: body?.periodStart || body?.period_start || null,
    periodEnd: body?.periodEnd || body?.period_end || null,
    summary: body?.summary || null,
    actionNote: body?.actionNote || body?.action_note || body?.actionTaken || null,
  };
}

function resolveOrganizationId(body) {
  const report = getReportSource(body);
  const organizationId = trimOrNull(
    body?.organizationId ??
      body?.organization_id ??
      report?.organizationId ??
      report?.organization_id ??
      body?.currentUser?.organizationId ??
      body?.currentUser?.organization_id
  );

  return isUuidLike(organizationId) ? organizationId : null;
}

function resolveCreatedBy(body) {
  const report = getReportSource(body);
  const createdBy = trimOrNull(
    body?.createdBy ??
      body?.created_by ??
      body?.currentUser?.id ??
      body?.currentUser?.userId ??
      body?.currentUser?.supabaseUserId ??
      report?.createdBy
  );

  return isUuidLike(createdBy) ? createdBy : null;
}

async function resolveOrganization(supabase, organizationId) {
  if (!organizationId) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw createCodeError("ORGANIZATION_NOT_FOUND");
  return data || null;
}

function buildReportPayload(body, status) {
  const report = getReportSource(body);
  const reportData = buildReportData(body);
  const title = trimOrNull(body?.title ?? report?.title ?? reportData?.title);
  const periodStart = normalizeDateOrNull(
    body?.periodStart ?? body?.period_start ?? report?.periodStart ?? report?.period_start ?? reportData?.periodStart
  );
  const periodEnd = normalizeDateOrNull(
    body?.periodEnd ?? body?.period_end ?? report?.periodEnd ?? report?.period_end ?? reportData?.periodEnd
  );
  const summary = trimOrNull(
    body?.summary ?? report?.summary ?? body?.adminOpinion ?? report?.adminOpinion ?? reportData?.summary ?? reportData?.adminOpinion
  );
  const actionNote = trimOrNull(
    body?.actionNote ??
      body?.action_note ??
      body?.actionTaken ??
      report?.actionTaken ??
      report?.actionNote ??
      reportData?.actionTaken ??
      reportData?.actionNote
  );

  return {
    title,
    period_start: periodStart,
    period_end: periodEnd,
    summary,
    action_note: actionNote,
    report_data: reportData,
    created_by: resolveCreatedBy(body),
    status,
    updated_at: new Date().toISOString(),
  };
}

function getReportId(body) {
  const report = getReportSource(body);
  const candidate = trimOrNull(body?.reportId ?? body?.id ?? report?.reportId ?? report?.id);
  return isUuidLike(candidate) ? candidate : null;
}

async function insertReport(supabase, body, status) {
  const organizationId = resolveOrganizationId(body);
  const organization = await resolveOrganization(supabase, organizationId);
  if (!organization) throw createCodeError("ORGANIZATION_NOT_FOUND");

  const payload = {
    ...buildReportPayload(body, status),
    organization_id: organization.id,
  };

  if (!payload.title) throw createCodeError("MISSING_REQUIRED_FIELDS");

  const { data, error } = await supabase
    .from("admin_reports")
    .insert(payload)
    .select("id, status")
    .single();

  if (error) throw createCodeError("REPORT_SAVE_FAILED", error.message);
  return data;
}

async function updateReport(supabase, reportId, body, statusFallback = null) {
  const { data: existingReport, error: findError } = await supabase
    .from("admin_reports")
    .select("id, organization_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (findError) throw createCodeError("REPORT_UPDATE_FAILED", findError.message);
  if (!existingReport) throw createCodeError("REPORT_NOT_FOUND");

  const requestedStatus = body?.status ?? body?.reportStatus ?? getReportSource(body)?.status;
  const nextStatus = requestedStatus
    ? normalizeReportStatus(requestedStatus, existingReport.status || statusFallback || "draft")
    : statusFallback || existingReport.status || "draft";
  const payload = buildReportPayload(body, nextStatus);
  if (!resolveCreatedBy(body)) {
    delete payload.created_by;
  }
  if (!payload.title) throw createCodeError("MISSING_REQUIRED_FIELDS");

  const { data, error } = await supabase
    .from("admin_reports")
    .update(payload)
    .eq("id", reportId)
    .select("id, status")
    .single();

  if (error) throw createCodeError("REPORT_UPDATE_FAILED", error.message);
  return data;
}

async function handleSaveDraft(supabase, body, res) {
  const reportId = getReportId(body);
  const savedReport = reportId
    ? await updateReport(supabase, reportId, body, "draft")
    : await insertReport(supabase, body, "draft");

  return res.status(200).json({
    success: true,
    saved: true,
    reportId: savedReport.id,
    status: savedReport.status || "draft",
  });
}

async function handleSaveReport(supabase, body, res) {
  const reportId = getReportId(body);
  const requestedStatus = body?.status ?? body?.reportStatus ?? getReportSource(body)?.status;
  const status = normalizeReportStatus(requestedStatus, "completed");
  const savedReport = reportId
    ? await updateReport(supabase, reportId, body, status)
    : await insertReport(supabase, body, status);

  return res.status(200).json({
    success: true,
    saved: true,
    reportId: savedReport.id,
    status: savedReport.status || status,
  });
}

async function handleUpdateReport(supabase, body, res) {
  const reportId = getReportId(body);
  if (!reportId) return respondWithError(res, 400, "MISSING_REPORT_ID");

  const updatedReport = await updateReport(supabase, reportId, body);

  return res.status(200).json({
    success: true,
    updated: true,
    reportId: updatedReport.id,
    status: updatedReport.status || "draft",
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
    });
  }

  const body = parseRequestBody(req.body);
  const action = body?.action;

  try {
    const supabase = getSupabaseAdminClient();

    if (action === "saveDraft") {
      return await handleSaveDraft(supabase, body, res);
    }

    if (action === "saveReport") {
      return await handleSaveReport(supabase, body, res);
    }

    if (action === "updateReport") {
      return await handleUpdateReport(supabase, body, res);
    }

    return res.status(400).json({
      success: false,
      code: "INVALID_ACTION",
      message: "Invalid report action.",
    });
  } catch (error) {
    const code = error?.code || "REPORT_SAVE_FAILED";
    const status =
      code === "MISSING_REQUIRED_FIELDS" ||
      code === "ORGANIZATION_NOT_FOUND" ||
      code === "MISSING_REPORT_ID" ||
      code === "REPORT_NOT_FOUND"
        ? 400
        : 500;

    console.error("[reports]", code, {
      message: error?.message || "Unknown report save error",
    });

    return respondWithError(
      res,
      status,
      code,
      code === "REPORT_UPDATE_FAILED" ? "Failed to update report." : "Failed to save report."
    );
  }
}
