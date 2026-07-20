import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEBUG_VERSION = "activity-create-organization-debug-v4";

function createCodeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value) {
  return isNonEmptyString(value) && UUID_PATTERN.test(value.trim());
}

function trimOrNull(value) {
  return isNonEmptyString(value) ? value.trim() : null;
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

function respondWithError(res, status, code, error, extra = null) {
  return res.status(status).json({
    success: false,
    error,
    code,
    debugVersion: DEBUG_VERSION,
    ...(extra || {}),
  });
}

function getSupabaseHost() {
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).host;
  } catch (_error) {
    return null;
  }
}

function getLast4(value) {
  return isNonEmptyString(value) ? value.trim().slice(-4) : null;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw createCodeError("MISSING_SUPABASE_ENV");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveChecker(supabase, body) {
  const checkerId = trimOrNull(body.checkerId);
  const checkerUserId = trimOrNull(body.checkerUserId);
  const checkerEmail = trimOrNull(body.checkerEmail);
  const checkerUsername = trimOrNull(body.checkerUsername);

  const baseSelect = "id, organization_id, username, email, role, status";

  const queries = [];

  if (isUuid(checkerId)) {
    queries.push({
      resolveBy: "checkerId",
      query: supabase.from("users").select(baseSelect).eq("id", checkerId).eq("role", "checker").limit(1),
    });
  }

  if (isUuid(checkerUserId) && checkerUserId !== checkerId) {
    queries.push({
      resolveBy: "checkerUserId",
      query: supabase.from("users").select(baseSelect).eq("id", checkerUserId).eq("role", "checker").limit(1),
    });
  }

  if (checkerEmail) {
    queries.push({
      resolveBy: "checkerEmail",
      query: supabase.from("users").select(baseSelect).eq("email", checkerEmail).eq("role", "checker").limit(5),
    });
  }

  if (checkerUsername) {
    queries.push({
      resolveBy: "checkerUsername",
      query: supabase.from("users").select(baseSelect).eq("username", checkerUsername).eq("role", "checker").limit(5),
    });
  }

  for (const item of queries) {
    const { data, error } = await item.query;

    if (error) {
      console.error("[activity-records/create] CHECKER_RESOLVE_FAILED", {
        resolveBy: item.resolveBy,
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
        hasCheckerId: Boolean(checkerId),
        hasCheckerUserId: Boolean(checkerUserId),
        hasCheckerEmail: Boolean(checkerEmail),
        hasCheckerUsername: Boolean(checkerUsername),
      });
      throw createCodeError("INTERNAL_ERROR");
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      continue;
    }

    const activeMatch = rows.find((row) => String(row?.status || "").toLowerCase() === "active");
    return activeMatch || rows[0] || null;
  }

  return null;
}

async function resolveTarget(supabase, body, organizationId) {
  const targetId = trimOrNull(body.targetId);
  const targetName = trimOrNull(body.targetName);
  const baseSelect = "id, organization_id, name";

  if (isUuid(targetId)) {
    const { data, error } = await supabase
      .from("targets")
      .select(baseSelect)
      .eq("id", targetId)
      .maybeSingle();

    if (error) {
      console.error("[activity-records/create] TARGET_QUERY_FAILED", {
        resolveBy: "targetId",
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
        hasTargetId: Boolean(targetId),
        hasTargetName: Boolean(targetName),
        hasOrganizationId: Boolean(organizationId),
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    if (data) {
      return data;
    }
  }

  if (targetName) {
    let query = supabase.from("targets").select(baseSelect).eq("name", targetName).limit(5);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[activity-records/create] TARGET_QUERY_FAILED", {
        resolveBy: "targetName",
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
        hasTargetId: Boolean(targetId),
        hasTargetName: Boolean(targetName),
        hasOrganizationId: Boolean(organizationId),
      });
      throw createCodeError("TARGET_QUERY_FAILED");
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length) {
      return rows[0];
    }
  }

  return null;
}

async function resolveOrganization(supabase, candidateOrganizationId, debugState = null) {
  if (!candidateOrganizationId) {
    return null;
  }

  if (!isUuid(candidateOrganizationId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", candidateOrganizationId)
    .maybeSingle();

  if (debugState) {
    debugState.organizationDirectQueryAttempted = true;
    debugState.organizationQueryErrorCode = error?.code || null;
    debugState.organizationQueryErrorMessage = error?.message || null;
  }

  if (error) {
    console.error("[activity-records/create] ORGANIZATION_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw createCodeError("ORGANIZATION_QUERY_FAILED");
  }

  return data || null;
}

async function getOrganizationDebugCounts(supabase, organizationId) {
  const result = {
    organizationsCountAvailable: null,
    matchingOrganizationCount: null,
  };

  const { count: organizationsCount, error: organizationsCountError } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });

  if (organizationsCountError) {
    console.error("[activity-records/create] ORGANIZATIONS_COUNT_FAILED", {
      code: organizationsCountError.code || null,
      message: organizationsCountError.message || "Unknown Supabase error",
    });
  } else {
    result.organizationsCountAvailable = organizationsCount;
  }

  if (organizationId) {
    const { count: matchingCount, error: matchingCountError } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("id", organizationId);

    if (matchingCountError) {
      console.error("[activity-records/create] ORGANIZATION_MATCHING_COUNT_FAILED", {
        code: matchingCountError.code || null,
        message: matchingCountError.message || "Unknown Supabase error",
      });
    } else {
      result.matchingOrganizationCount = matchingCount;
    }
  }

  return result;
}

async function buildOrganizationNotFoundDebug(supabase, debugState) {
  const counts = await getOrganizationDebugCounts(supabase, debugState.organizationId);

  return {
    debug: {
      supabaseHost: getSupabaseHost(),
      organizationIdProvided: Boolean(debugState.organizationId),
      organizationIdLooksUuid: isUuid(debugState.organizationId),
      organizationIdLength: debugState.organizationId ? debugState.organizationId.length : 0,
      organizationIdLast4: getLast4(debugState.organizationId) || "",
      organizationDirectQueryAttempted: debugState.organizationDirectQueryAttempted,
      organizationQueryErrorCode: debugState.organizationQueryErrorCode,
      organizationQueryErrorMessage: debugState.organizationQueryErrorMessage,
      organizationsCountAvailable: counts.organizationsCountAvailable,
      matchingOrganizationCount: counts.matchingOrganizationCount,
      targetOrganizationIdProvided: Boolean(debugState.targetOrganizationId),
      targetOrganizationIdLast4: getLast4(debugState.targetOrganizationId),
      checkerOrganizationIdProvided: Boolean(debugState.checkerOrganizationId),
      checkerOrganizationIdLast4: getLast4(debugState.checkerOrganizationId),
      fallbackFromTargetAttempted: debugState.fallbackFromTargetAttempted,
      fallbackFromCheckerAttempted: debugState.fallbackFromCheckerAttempted,
    },
  };
}

function normalizeCheckedAt(value) {
  if (!isNonEmptyString(value)) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function summarizeCondition(body) {
  const explicitSummary = trimOrNull(body.conditionSummary);
  if (explicitSummary) {
    return explicitSummary.slice(0, 300);
  }

  const parts = [];

  if (Array.isArray(body.checkItems) && body.checkItems.length) {
    const filtered = body.checkItems
      .map((item) => trimOrNull(item))
      .filter(Boolean)
      .slice(0, 4);

    if (filtered.length) {
      parts.push(`확인 항목: ${filtered.join(", ")}`);
    }
  }

  if (body.hasIssue === true) {
    parts.push("이상징후 있음");
  }

  const issueLevel = trimOrNull(body.issueLevel);
  if (issueLevel) {
    parts.push(`위험도: ${issueLevel}`);
  }

  const issueSummary = trimOrNull(body.issueSummary);
  if (issueSummary) {
    parts.push(`요약: ${issueSummary.slice(0, 120)}`);
  }

  if (!parts.length) {
    return null;
  }

  return parts.join(" / ").slice(0, 300);
}

function normalizeCheckType(value) {
  return trimOrNull(value) || "생활 확인";
}

function buildInsertPayload(body, resolvedOrganizationId, resolvedTarget, resolvedChecker) {
  return {
    organization_id: resolvedOrganizationId,
    target_id: resolvedTarget.id,
    checker_id: resolvedChecker.id,
    check_type: normalizeCheckType(body.checkType),
    checked_at: normalizeCheckedAt(body.checkedAt),
    condition_summary: summarizeCondition(body),
    memo: trimOrNull(body.memo),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const body = parseRequestBody(req.body);
  if (!body) {
    return respondWithError(res, 400, "INVALID_JSON", "Failed to save activity record.");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const normalizedOrganizationId = trimOrNull(body.organizationId);

    const resolvedChecker = await resolveChecker(supabase, body);
    if (!resolvedChecker) {
      return respondWithError(res, 400, "CHECKER_NOT_FOUND", "Failed to save activity record.");
    }

    const targetLookupOrganizationId =
      (isUuid(normalizedOrganizationId) ? normalizedOrganizationId : null) ||
      resolvedChecker.organization_id ||
      null;

    const resolvedTarget = await resolveTarget(supabase, body, targetLookupOrganizationId);
    if (!resolvedTarget) {
      return respondWithError(res, 400, "TARGET_NOT_FOUND", "Failed to save activity record.");
    }

    if (
      resolvedChecker.organization_id &&
      resolvedTarget.organization_id &&
      resolvedChecker.organization_id !== resolvedTarget.organization_id
    ) {
      return respondWithError(
        res,
        400,
        "CHECKER_TARGET_ORGANIZATION_MISMATCH",
        "Failed to save activity record."
      );
    }

    if (
      isUuid(normalizedOrganizationId) &&
      resolvedTarget.organization_id &&
      resolvedTarget.organization_id !== normalizedOrganizationId
    ) {
      return respondWithError(
        res,
        400,
        "TARGET_ORGANIZATION_MISMATCH",
        "Failed to save activity record."
      );
    }

    const requestedOrganizationId = isUuid(normalizedOrganizationId) ? normalizedOrganizationId : null;
    let resolvedOrganization = null;
    let resolvedOrganizationId = null;
    const organizationDebugState = {
      organizationId: normalizedOrganizationId,
      targetOrganizationId: resolvedTarget.organization_id || null,
      checkerOrganizationId: resolvedChecker.organization_id || null,
      organizationDirectQueryAttempted: false,
      organizationQueryErrorCode: null,
      organizationQueryErrorMessage: null,
      fallbackFromTargetAttempted: false,
      fallbackFromCheckerAttempted: false,
    };

    if (requestedOrganizationId) {
      resolvedOrganization = await resolveOrganization(supabase, requestedOrganizationId, organizationDebugState);
      if (resolvedOrganization) {
        resolvedOrganizationId = resolvedOrganization.id;
      }
    }

    if (!resolvedOrganization && isUuid(resolvedTarget.organization_id)) {
      organizationDebugState.fallbackFromTargetAttempted = true;
      resolvedOrganization = await resolveOrganization(supabase, resolvedTarget.organization_id);
      if (resolvedOrganization) {
        resolvedOrganizationId = resolvedOrganization.id;
      }
    }

    if (!resolvedOrganization && isUuid(resolvedChecker.organization_id)) {
      organizationDebugState.fallbackFromCheckerAttempted = true;
      resolvedOrganization = await resolveOrganization(supabase, resolvedChecker.organization_id);
      if (resolvedOrganization) {
        resolvedOrganizationId = resolvedOrganization.id;
      }
    }

    if (!resolvedOrganization) {
      const organizationDebug = await buildOrganizationNotFoundDebug(supabase, organizationDebugState);
      return respondWithError(
        res,
        400,
        "ORGANIZATION_NOT_FOUND",
        "Failed to save activity record.",
        organizationDebug
      );
    }

    if (
      resolvedChecker.organization_id && resolvedChecker.organization_id !== resolvedOrganizationId
    ) {
      const organizationDebug = await buildOrganizationNotFoundDebug(supabase, organizationDebugState);
      return respondWithError(
        res,
        400,
        "ORGANIZATION_NOT_FOUND",
        "Failed to save activity record.",
        organizationDebug
      );
    }

    if (resolvedTarget.organization_id && resolvedTarget.organization_id !== resolvedOrganizationId) {
      return respondWithError(
        res,
        400,
        "TARGET_ORGANIZATION_MISMATCH",
        "Failed to save activity record."
      );
    }

    const insertPayload = buildInsertPayload(body, resolvedOrganizationId, resolvedTarget, resolvedChecker);

    const { data, error } = await supabase
      .from("activity_records")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[activity-records/create] ACTIVITY_RECORD_INSERT_FAILED", {
        code: error.code || null,
        message: error.message || "Unknown Supabase error",
        hasOrganizationId: Boolean(resolvedOrganization?.id),
        hasTargetId: Boolean(resolvedTarget?.id),
        hasCheckerId: Boolean(resolvedChecker?.id),
      });

      return respondWithError(
        res,
        500,
        "ACTIVITY_RECORD_INSERT_FAILED",
        "Failed to save activity record."
      );
    }

    return res.status(200).json({
      success: true,
      saved: true,
      recordId: data?.id || null,
      debugVersion: DEBUG_VERSION,
    });
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "INTERNAL_ERROR";

    if (code === "MISSING_SUPABASE_ENV") {
      return respondWithError(res, 500, "MISSING_SUPABASE_ENV", "Failed to save activity record.");
    }

    console.error("[activity-records/create] INTERNAL_ERROR", {
      code,
      message: error instanceof Error ? error.message : "Unknown server error",
      hasOrganizationId: Boolean(trimOrNull(body?.organizationId)),
      hasTargetId: Boolean(trimOrNull(body?.targetId)),
      hasCheckerId: Boolean(trimOrNull(body?.checkerId) || trimOrNull(body?.checkerUserId)),
    });

    return respondWithError(res, 500, code === "INTERNAL_ERROR" ? "INTERNAL_ERROR" : code, "Failed to save activity record.");
  }
}
