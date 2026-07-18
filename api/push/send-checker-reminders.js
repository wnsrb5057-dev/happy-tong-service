import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const NOTIFICATION_TYPE = "checker_daily_reminder";
const REMINDER_TITLE = "해피통서비스 확인 알림";
const REMINDER_BODY = "오늘 확인 기록이 아직 남아있어요. 확인 예정 대상자를 확인해주세요.";
const REMINDER_URL = "/checker/home";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseRequestBody(body) {
  if (!body) {
    return {};
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

function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeTargetDate(value) {
  if (!isNonEmptyString(value)) {
    return getTodayDateString();
  }

  const trimmed = value.trim();
  return DATE_PATTERN.test(trimmed) ? trimmed : null;
}

function buildNotificationPayload() {
  return {
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    url: REMINDER_URL,
  };
}

async function getActiveCheckerUsers(supabase) {
  const { data, error } = await supabase
    .from("users")
    .select("id, organization_id, role, status")
    .eq("role", "checker")
    .eq("status", "active");

  if (error) {
    console.error("[push/send-checker-reminders] USER_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw new Error("USER_QUERY_FAILED");
  }

  return Array.isArray(data) ? data : [];
}

async function getExistingReminderLogs(supabase, targetDate, userIds) {
  if (!userIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("push_notification_logs")
    .select("id, target_user_id, status, subscription_id")
    .eq("notification_type", NOTIFICATION_TYPE)
    .eq("sent_date", targetDate)
    .in("target_user_id", userIds);

  if (error) {
    console.error("[push/send-checker-reminders] LOG_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw new Error("LOG_QUERY_FAILED");
  }

  return Array.isArray(data) ? data : [];
}

async function getActiveCheckerSubscriptions(supabase, userIds) {
  if (!userIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, role, endpoint, p256dh, auth, is_active")
    .eq("role", "checker")
    .eq("is_active", true)
    .in("user_id", userIds);

  if (error) {
    console.error("[push/send-checker-reminders] SUBSCRIPTION_QUERY_FAILED", {
      code: error.code || null,
      message: error.message || "Unknown Supabase error",
    });
    throw new Error("SUBSCRIPTION_QUERY_FAILED");
  }

  return Array.isArray(data) ? data : [];
}

function createLogPayload({ user, targetDate, status, errorCode = null, errorMessage = null, subscriptionId = null }) {
  return {
    notification_type: NOTIFICATION_TYPE,
    target_user_id: user.id,
    organization_id: user.organization_id || null,
    related_entity_type: null,
    related_entity_id: null,
    sent_date: targetDate,
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    url: REMINDER_URL,
    status,
    error_code: errorCode,
    error_message: errorMessage,
    subscription_id: subscriptionId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  };
}

async function upsertReminderLog(supabase, existingLogId, payload) {
  if (existingLogId) {
    const { error } = await supabase
      .from("push_notification_logs")
      .update(payload)
      .eq("id", existingLogId);

    return { error };
  }

  const { error } = await supabase.from("push_notification_logs").insert(payload);
  return { error };
}

async function markSubscriptionInactive(supabase, subscriptionId) {
  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("[push/send-checker-reminders] MARK_INACTIVE_FAILED", {
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
      return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send checker reminders.");
    }

    return respondWithError(res, 401, "UNAUTHORIZED", "Unauthorized.");
  }

  const body = parseRequestBody(req.body);
  if (body === null) {
    return respondWithError(res, 400, "INVALID_JSON", "Invalid request body.");
  }

  const targetDate = normalizeTargetDate(body.date);
  if (!targetDate) {
    return respondWithError(res, 400, "INVALID_JSON", "Invalid request body.");
  }

  const dryRun = body.dryRun === true;

  try {
    const supabase = getSupabaseAdminClient();
    const checkerUsers = await getActiveCheckerUsers(supabase);
    const checkerUserIds = checkerUsers.map((user) => user.id);
    const [existingLogs, subscriptions] = await Promise.all([
      getExistingReminderLogs(supabase, targetDate, checkerUserIds),
      getActiveCheckerSubscriptions(supabase, checkerUserIds),
    ]);

    const logByUserId = new Map(existingLogs.map((log) => [log.target_user_id, log]));
    const subscriptionsByUserId = new Map();

    for (const subscription of subscriptions) {
      const existing = subscriptionsByUserId.get(subscription.user_id) || [];
      existing.push(subscription);
      subscriptionsByUserId.set(subscription.user_id, existing);
    }

    const candidateUsers = checkerUsers.filter((user) => {
      const userSubscriptions = subscriptionsByUserId.get(user.id) || [];
      return userSubscriptions.length > 0;
    });

    const alreadyLoggedUsers = candidateUsers.filter((user) => {
      const log = logByUserId.get(user.id);
      return log && (log.status === "sent" || log.status === "pending");
    });

    const scheduledUsers = candidateUsers.filter((user) => {
      const log = logByUserId.get(user.id);
      return !(log && (log.status === "sent" || log.status === "pending"));
    });

    if (dryRun) {
      return res.status(200).json({
        success: true,
        date: targetDate,
        targetUsers: candidateUsers.length,
        activeSubscriptions: subscriptions.length,
        alreadyLogged: alreadyLoggedUsers.length,
        scheduled: scheduledUsers.length,
        sent: 0,
        skipped: alreadyLoggedUsers.length,
        failed: 0,
        dryRun: true,
      });
    }

    const vapidConfig = getVapidConfig();
    webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

    let sent = 0;
    let skipped = alreadyLoggedUsers.length;
    let failed = 0;

    for (const user of scheduledUsers) {
      const userSubscriptions = subscriptionsByUserId.get(user.id) || [];
      const existingLog = logByUserId.get(user.id) || null;
      const payload = buildNotificationPayload();

      let delivered = false;
      let representativeSubscriptionId = existingLog?.subscription_id || userSubscriptions[0]?.id || null;
      let failureCode = "WEB_PUSH_SEND_FAILED";
      let failureMessage = "Failed to send checker reminder.";

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify(payload)
          );

          delivered = true;
          representativeSubscriptionId = subscription.id;
        } catch (error) {
          const statusCode = error?.statusCode || null;

          console.error("[push/send-checker-reminders] WEB_PUSH_SEND_FAILED", {
            subscriptionId: subscription.id,
            userId: user.id,
            statusCode,
            message: error instanceof Error ? error.message : "Unknown web-push error",
          });

          if (statusCode === 404 || statusCode === 410) {
            await markSubscriptionInactive(supabase, subscription.id);
          }
        }
      }

      if (delivered) {
        const logPayload = createLogPayload({
          user,
          targetDate,
          status: "sent",
          subscriptionId: representativeSubscriptionId,
        });

        const { error } = await upsertReminderLog(supabase, existingLog?.id || null, logPayload);

        if (error) {
          if (error.code === "23505") {
            skipped += 1;
            continue;
          }

          console.error("[push/send-checker-reminders] LOG_WRITE_FAILED", {
            stage: "sent",
            userId: user.id,
            code: error.code || null,
            message: error.message || "Unknown Supabase error",
          });

          return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send checker reminders.");
        }

        sent += 1;
        continue;
      }

      const logPayload = createLogPayload({
        user,
        targetDate,
        status: "failed",
        errorCode: failureCode,
        errorMessage: failureMessage,
        subscriptionId: representativeSubscriptionId,
      });

      const { error } = await upsertReminderLog(supabase, existingLog?.id || null, logPayload);

      if (error && error.code !== "23505") {
        console.error("[push/send-checker-reminders] LOG_WRITE_FAILED", {
          stage: "failed",
          userId: user.id,
          code: error.code || null,
          message: error.message || "Unknown Supabase error",
        });

        return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send checker reminders.");
      }

      failed += 1;
    }

    return res.status(200).json({
      success: true,
      date: targetDate,
      targetUsers: candidateUsers.length,
      sent,
      skipped,
      failed,
      dryRun: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_SUPABASE_ENV") {
      return respondWithError(res, 500, "MISSING_SUPABASE_ENV", "Failed to send checker reminders.");
    }

    if (error instanceof Error && error.message === "MISSING_VAPID_ENV") {
      return respondWithError(res, 500, "MISSING_VAPID_ENV", "Failed to send checker reminders.");
    }

    if (
      error instanceof Error &&
      (error.message === "USER_QUERY_FAILED" ||
        error.message === "SUBSCRIPTION_QUERY_FAILED" ||
        error.message === "LOG_QUERY_FAILED")
    ) {
      return respondWithError(res, 500, error.message, "Failed to send checker reminders.");
    }

    console.error("[push/send-checker-reminders] INTERNAL_ERROR", {
      message: error instanceof Error ? error.message : "Unknown server error",
      date: targetDate,
      dryRun,
    });

    return respondWithError(res, 500, "INTERNAL_ERROR", "Failed to send checker reminders.");
  }
}
