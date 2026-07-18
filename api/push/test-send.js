import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const ALLOWED_ROLES = new Set(["checker", "admin", "super_admin"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value) {
  return isNonEmptyString(value) && UUID_PATTERN.test(value.trim());
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

function respondWithError(res, status, code, error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("MISSING_SUPABASE_ENV");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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

function isAuthorizedRequest(req) {
  const secret = process.env.CRON_SECRET;

  if (!isNonEmptyString(secret)) {
    throw new Error("MISSING_CRON_SECRET");
  }

  const headerSecret = req.headers["x-cron-secret"];
  const bearerSecret = getBearerToken(req.headers.authorization);
  return headerSecret === secret || bearerSecret === secret;
}

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("MISSING_VAPID_ENV");
  }

  return {
    publicKey,
    privateKey,
    subject,
  };
}

async function getTargetSubscription(supabase, body) {
  const subscriptionId = isNonEmptyString(body.subscriptionId) ? body.subscriptionId.trim() : null;
  const role = isNonEmptyString(body.role) ? body.role.trim() : null;

  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id, role, is_active")
    .eq("is_active", true);

  if (subscriptionId) {
    if (!isUuid(subscriptionId)) {
      return { data: null, error: null };
    }

    const { data, error } = await query.eq("id", subscriptionId).maybeSingle();
    return { data, error };
  }

  if (!role || !ALLOWED_ROLES.has(role)) {
    return { data: null, error: null };
  }

  const { data, error } = await query.eq("role", role).limit(1);
  return {
    data: Array.isArray(data) ? data[0] || null : null,
    error,
  };
}

function buildNotificationPayload(body) {
  return {
    title: isNonEmptyString(body.title) ? body.title.trim() : "해피통서비스 알림 테스트",
    body: isNonEmptyString(body.body) ? body.body.trim() : "알림 수신 설정이 정상적으로 연결되었습니다.",
    url: isNonEmptyString(body.url) ? body.url.trim() : "/checker/home",
  };
}

async function markSubscriptionInactive(supabase, subscriptionId) {
  if (!isUuid(subscriptionId)) {
    return;
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("[push/test-send] MARK_INACTIVE_FAILED", {
      subscriptionId,
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondWithError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  try {
    if (!isAuthorizedRequest(req)) {
      return respondWithError(res, 401, "UNAUTHORIZED", "Unauthorized.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_CRON_SECRET") {
      return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send test push notification.");
    }

    return respondWithError(res, 401, "UNAUTHORIZED", "Unauthorized.");
  }

  const body = parseRequestBody(req.body);
  if (!body) {
    return respondWithError(res, 400, "INVALID_JSON", "Invalid request body.");
  }

  if (isNonEmptyString(body.role) && !ALLOWED_ROLES.has(body.role.trim())) {
    return respondWithError(res, 400, "INVALID_JSON", "Invalid request body.");
  }

  try {
    const supabase = getSupabaseAdminClient();
    const vapidConfig = getVapidConfig();

    webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

    const { data: subscriptionRow, error: subscriptionError } = await getTargetSubscription(supabase, body);

    if (subscriptionError) {
      console.error("[push/test-send] SUBSCRIPTION_LOOKUP_FAILED", {
        code: subscriptionError.code || null,
        message: subscriptionError.message || "Unknown Supabase error",
        subscriptionId: isNonEmptyString(body.subscriptionId) ? body.subscriptionId.trim() : null,
        role: isNonEmptyString(body.role) ? body.role.trim() : null,
      });

      return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send test push notification.");
    }

    if (!subscriptionRow) {
      return respondWithError(res, 404, "SUBSCRIPTION_NOT_FOUND", "Failed to send test push notification.");
    }

    const payload = buildNotificationPayload(body);

    try {
      await webpush.sendNotification(
        {
          endpoint: subscriptionRow.endpoint,
          keys: {
            p256dh: subscriptionRow.p256dh,
            auth: subscriptionRow.auth,
          },
        },
        JSON.stringify(payload)
      );
    } catch (error) {
      const statusCode = error?.statusCode || null;

      console.error("[push/test-send] WEB_PUSH_SEND_FAILED", {
        subscriptionId: subscriptionRow.id,
        role: subscriptionRow.role,
        statusCode,
        message: error instanceof Error ? error.message : "Unknown web-push error",
      });

      if (statusCode === 404 || statusCode === 410) {
        await markSubscriptionInactive(supabase, subscriptionRow.id);
      }

      return respondWithError(
        res,
        500,
        "WEB_PUSH_SEND_FAILED",
        "Failed to send test push notification."
      );
    }

    return res.status(200).json({
      success: true,
      sent: 1,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_SUPABASE_ENV") {
      return respondWithError(res, 500, "MISSING_SUPABASE_ENV", "Failed to send test push notification.");
    }

    if (error instanceof Error && error.message === "MISSING_VAPID_ENV") {
      return respondWithError(res, 500, "MISSING_VAPID_ENV", "Failed to send test push notification.");
    }

    console.error("[push/test-send] INTERNAL_ERROR", {
      message: error instanceof Error ? error.message : "Unknown server error",
      subscriptionId: isNonEmptyString(body?.subscriptionId) ? body.subscriptionId.trim() : null,
      role: isNonEmptyString(body?.role) ? body.role.trim() : null,
    });

    return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send test push notification.");
  }
}
