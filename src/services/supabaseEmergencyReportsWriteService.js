function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export async function createSupabaseEmergencyReport(payload) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      saved: false,
      reportId: null,
      error: "Fetch API is not supported.",
      code: null,
      warning: null,
    };
  }

  try {
    const response = await win.fetch("/api/emergency-reports/create", {
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
        reportId: null,
        error: result?.error || "Failed to save emergency report.",
        code: result?.code || null,
        warning: null,
      };
    }

    return {
      success: Boolean(result?.success),
      saved: Boolean(result?.saved),
      reportId: result?.reportId || null,
      error: null,
      code: null,
      warning: result?.warning || null,
    };
  } catch (error) {
    return {
      success: false,
      saved: false,
      reportId: null,
      error: error instanceof Error ? error.message : "Failed to save emergency report.",
      code: null,
      warning: null,
    };
  }
}
