function getSafeWindow() {
  return typeof window !== "undefined" ? window : null;
}

async function postTargetWrite(path, payload, mode) {
  const win = getSafeWindow();

  if (!win || typeof win.fetch !== "function") {
    return {
      success: false,
      saved: false,
      updated: false,
      targetId: null,
      error: "Fetch API is not supported.",
      code: null,
      warning: null,
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
        targetId: null,
        error: result?.error || "Failed to save target.",
        code: result?.code || null,
        warning: null,
      };
    }

    return {
      success: Boolean(result?.success),
      saved: Boolean(result?.saved),
      updated: Boolean(result?.updated),
      targetId: result?.targetId || null,
      lifecycleStatus: result?.lifecycleStatus || null,
      error: null,
      code: null,
      warning: result?.warning || null,
      mode,
    };
  } catch (error) {
    return {
      success: false,
      saved: false,
      updated: false,
      targetId: null,
      error: error instanceof Error ? error.message : "Failed to save target.",
      code: null,
      warning: null,
    };
  }
}

export function createSupabaseTarget(payload) {
  return postTargetWrite("/api/targets", { action: "create", ...payload }, "create");
}

export function updateSupabaseTarget(payload) {
  return postTargetWrite("/api/targets", { action: "update", ...payload }, "update");
}

export function updateSupabaseTargetStatus(payload) {
  return postTargetWrite("/api/targets", { action: "updateStatus", ...payload }, "update-status");
}
