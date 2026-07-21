function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export async function updateSupabaseEmergencyStatus(payload) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      updated: false,
      reportId: null,
      status: null,
      error: "Fetch API is not supported.",
      code: null,
      warning: null,
    };
  }

  try {
    const response = await win.fetch("/api/emergency-reports/update-status", {
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
        updated: false,
        reportId: null,
        status: null,
        error: result?.error || "Failed to update emergency status.",
        code: result?.code || null,
        warning: null,
      };
    }

    return {
      success: Boolean(result?.success),
      updated: Boolean(result?.updated),
      reportId: result?.reportId || null,
      status: result?.status || null,
      error: null,
      code: null,
      warning: result?.warning || null,
    };
  } catch (error) {
    return {
      success: false,
      updated: false,
      reportId: null,
      status: null,
      error: error instanceof Error ? error.message : "Failed to update emergency status.",
      code: null,
      warning: null,
    };
  }
}
