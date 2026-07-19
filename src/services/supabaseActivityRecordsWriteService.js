function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export async function createSupabaseActivityRecord(payload) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      saved: false,
      recordId: null,
      error: "Fetch API is not supported.",
      code: null,
    };
  }

  try {
    const response = await win.fetch("/api/activity-records/create", {
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
        recordId: null,
        error: result?.error || "Failed to save activity record.",
        code: result?.code || null,
      };
    }

    return {
      success: Boolean(result?.success),
      saved: Boolean(result?.saved),
      recordId: result?.recordId || null,
      error: null,
      code: null,
    };
  } catch (error) {
    return {
      success: false,
      saved: false,
      recordId: null,
      error: error instanceof Error ? error.message : "Failed to save activity record.",
      code: null,
    };
  }
}
