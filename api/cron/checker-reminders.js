import { runCheckerReminderJob } from "../push/_checkerReminderService.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function respondWithError(res, status, code, error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

function getBearerToken(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const trimmed = value.trim();
  const prefix = "Bearer ";
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length).trim() : null;
}

function isCronSecretAuthorized(req) {
  const secret = process.env.CRON_SECRET;

  if (!isNonEmptyString(secret)) {
    throw new Error("MISSING_CRON_SECRET");
  }

  const headerSecret = req.headers["x-cron-secret"];
  const bearerSecret = getBearerToken(req.headers.authorization);
  return headerSecret === secret || bearerSecret === secret;
}

function isVercelCronRequest(req) {
  const userAgent = isNonEmptyString(req.headers["user-agent"]) ? req.headers["user-agent"].toLowerCase() : "";
  const hasScheduleHeader = isNonEmptyString(req.headers["x-vercel-cron-schedule"]);
  return userAgent.includes("vercel-cron") || hasScheduleHeader;
}

function parseDryRun(value) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false" || value === undefined) {
    return false;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  let source = null;

  try {
    if (isVercelCronRequest(req)) {
      source = "vercel-cron";
    } else if (isCronSecretAuthorized(req)) {
      source = "manual-secret";
    } else {
      return respondWithError(res, 401, "UNAUTHORIZED", "Unauthorized.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_CRON_SECRET") {
      return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send checker reminders.");
    }

    return respondWithError(res, 401, "UNAUTHORIZED", "Unauthorized.");
  }

  try {
    const result = await runCheckerReminderJob({
      date: req.query?.date,
      dryRun: parseDryRun(req.query?.dryRun),
      source,
    });

    return res.status(200).json(result);
  } catch (error) {
    const code = error instanceof Error && error.code ? error.code : "INTERNAL_ERROR";
    const allowedCodes = new Set([
      "MISSING_SUPABASE_ENV",
      "MISSING_VAPID_ENV",
      "USER_QUERY_FAILED",
      "SUBSCRIPTION_QUERY_FAILED",
      "LOG_QUERY_FAILED",
      "WEB_PUSH_SEND_FAILED",
      "INVALID_JSON",
      "INTERNAL_ERROR",
    ]);

    return respondWithError(
      res,
      code === "INVALID_JSON" ? 400 : 500,
      allowedCodes.has(code) ? code : "INTERNAL_ERROR",
      "Failed to send checker reminders."
    );
  }
}
