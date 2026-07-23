function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

async function postReportWrite(payload, mode) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      saved: false,
      updated: false,
      reportId: null,
      reportStatus: null,
      error: "Fetch API is not supported.",
      message: "Fetch API is not supported.",
      httpStatus: null,
      code: null,
      mode,
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

    if (!response.ok) {
      return {
        success: false,
        saved: false,
        updated: false,
        reportId: null,
        reportStatus: null,
        error: result?.error || "Failed to save report.",
        message: result?.message || result?.error || "Failed to save report.",
        httpStatus: response.status,
        code: result?.code || null,
        mode,
      };
    }

    return {
      success: Boolean(result?.success),
      saved: Boolean(result?.saved),
      updated: Boolean(result?.updated),
      reportId: result?.reportId || null,
      reportStatus: result?.status || null,
      error: null,
      message: result?.message || null,
      httpStatus: response.status,
      code: null,
      mode,
    };
  } catch (error) {
    return {
      success: false,
      saved: false,
      updated: false,
      reportId: null,
      reportStatus: null,
      error: error instanceof Error ? error.message : "Failed to save report.",
      message: error instanceof Error ? error.message : "Failed to save report.",
      httpStatus: null,
      code: null,
      mode,
    };
  }
}

export function saveSupabaseReportDraft(payload) {
  return postReportWrite({ action: "saveDraft", ...payload }, "save-draft");
}

export function saveSupabaseReport(payload) {
  return postReportWrite({ action: "saveReport", ...payload }, "save-report");
}

export function updateSupabaseReport(payload) {
  return postReportWrite({ action: "updateReport", ...payload }, "update-report");
}
