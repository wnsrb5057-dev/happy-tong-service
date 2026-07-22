function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

async function postCheckerWrite(path, payload, mode) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      saved: false,
      updated: false,
      checkerId: null,
      error: "Fetch API is not supported.",
      message: "Fetch API is not supported.",
      status: null,
      code: null,
    };
  }

  try {
    const response = await win.fetch(path, {
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
        checkerId: null,
        error: result?.error || "Failed to save checker.",
        message: result?.message || result?.error || "Failed to save checker.",
        status: response.status,
        code: result?.code || null,
      };
    }

    return {
      success: Boolean(result?.success),
      saved: Boolean(result?.saved),
      updated: Boolean(result?.updated),
      checkerId: result?.checkerId || null,
      status: result?.status || null,
      activityStatus: result?.activityStatus || null,
      error: null,
      message: result?.message || null,
      status: response.status,
      code: null,
      mode,
    };
  } catch (error) {
    return {
      success: false,
      saved: false,
      updated: false,
      checkerId: null,
      error: error instanceof Error ? error.message : "Failed to save checker.",
      message: error instanceof Error ? error.message : "Failed to save checker.",
      status: null,
      code: null,
    };
  }
}

export function createSupabaseChecker(payload) {
  return postCheckerWrite("/api/checkers", { action: "create", ...payload }, "create");
}

export function updateSupabaseChecker(payload) {
  return postCheckerWrite("/api/checkers", { action: "update", ...payload }, "update");
}

export function updateSupabaseCheckerStatus(payload) {
  return postCheckerWrite("/api/checkers", { action: "updateStatus", ...payload }, "update-status");
}
