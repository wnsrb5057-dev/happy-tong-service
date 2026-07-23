function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toTimestamp(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

async function postReportRead(payload) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      reports: [],
      report: null,
      error: "Fetch API is not supported.",
      code: null,
      httpStatus: null,
    };
  }

  try {
    const response = await win.fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      return {
        success: false,
        reports: [],
        report: null,
        error: result?.error || result?.message || "Failed to read reports.",
        code: result?.code || null,
        httpStatus: response.status,
      };
    }

    return {
      success: true,
      reports: Array.isArray(result?.reports) ? result.reports : [],
      report: result?.report || null,
      error: null,
      code: null,
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      success: false,
      reports: [],
      report: null,
      error: error instanceof Error ? error.message : "Failed to read reports.",
      code: null,
      httpStatus: null,
    };
  }
}

export function normalizeSupabaseAdminReport(row) {
  if (!row) return null;

  const reportData = isPlainObject(row.report_data) ? row.report_data : {};
  const normalized = {
    ...reportData,
    id: row.id || reportData.id || "",
    originalId: reportData.id || "",
    supabaseId: row.id || "",
    source: "supabase",
    organizationId: row.organization_id || reportData.organizationId || reportData.organization_id || "",
    title: row.title || reportData.title || "",
    status: row.status || reportData.status || "",
    periodStart: row.period_start || reportData.periodStart || reportData.period_start || "",
    periodEnd: row.period_end || reportData.periodEnd || reportData.period_end || "",
    summary: row.summary || reportData.summary || "",
    actionNote: row.action_note || reportData.actionNote || reportData.action_note || "",
    actionTaken: reportData.actionTaken || reportData.actionNote || row.action_note || "",
    adminOpinion: reportData.adminOpinion || row.summary || "",
    createdBy: row.created_by || reportData.createdBy || "",
    createdByName: row.created_by_name || reportData.createdByName || "",
    createdByRole: row.created_by_role || reportData.createdByRole || "",
    createdAt: row.created_at || reportData.createdAt || "",
    updatedAt: row.updated_at || reportData.updatedAt || "",
    reportData,
  };

  return normalized;
}

export function mergeAdminReports(localReports, supabaseReports) {
  const merged = new Map();
  const localList = Array.isArray(localReports) ? localReports : [];
  const supabaseList = Array.isArray(supabaseReports) ? supabaseReports.filter(Boolean) : [];

  localList.forEach((report) => {
    if (!report?.id) return;
    merged.set(report.id, { ...report, source: report.source || "local" });
  });

  supabaseList.forEach((report) => {
    const duplicateKey =
      report.id && merged.has(report.id)
        ? report.id
        : report.originalId && merged.has(report.originalId)
          ? report.originalId
          : report.reportData?.id && merged.has(report.reportData.id)
            ? report.reportData.id
            : report.supabaseId && [...merged.values()].find((item) => item.supabaseId === report.supabaseId)?.id;

    if (duplicateKey) {
      merged.set(duplicateKey, {
        ...merged.get(duplicateKey),
        ...report,
        id: report.id || duplicateKey,
        source: "supabase",
      });
      return;
    }

    merged.set(report.id || report.supabaseId, report);
  });

  return [...merged.values()].sort((a, b) => toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt));
}

export async function getSupabaseAdminReports(organizationId) {
  if (!organizationId) {
    return {
      success: false,
      reports: [],
      error: "Missing organization id.",
      code: "ORGANIZATION_NOT_FOUND",
      httpStatus: null,
    };
  }

  const result = await postReportRead({
    action: "listReports",
    organizationId,
  });

  return {
    ...result,
    reports: result.success ? result.reports.map(normalizeSupabaseAdminReport).filter(Boolean) : [],
  };
}

export async function getSupabaseAdminReportById(reportId) {
  if (!reportId) {
    return {
      success: false,
      report: null,
      error: "Missing report id.",
      code: "MISSING_REPORT_ID",
      httpStatus: null,
    };
  }

  const result = await postReportRead({
    action: "getReport",
    reportId,
  });

  return {
    ...result,
    report: result.success ? normalizeSupabaseAdminReport(result.report) : null,
  };
}
