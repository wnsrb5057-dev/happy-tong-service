import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set(["checker", "admin", "super_admin"]);

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildPayload(body) {
  const subscription = body?.subscription || {};

  return {
    user_id: body.userId,
    auth_user_id: body.authUserId || null,
    organization_id: body.organizationId || null,
    role: body.role,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    user_agent: body.userAgent || null,
    browser_name: body.browserName || null,
    device_type: body.deviceType || null,
    is_active: true,
    last_used_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  const body = parseRequestBody(req.body);

  if (!body) {
    return res.status(400).json({
      success: false,
      error: "Invalid request body.",
    });
  }

  const role = body.role;
  const subscription = body.subscription || {};

  if (
    !isNonEmptyString(body.userId) ||
    !ALLOWED_ROLES.has(role) ||
    !isNonEmptyString(subscription.endpoint) ||
    !isNonEmptyString(subscription.p256dh) ||
    !isNonEmptyString(subscription.auth)
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid push subscription payload.",
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const payload = buildPayload(body);

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(payload, {
        onConflict: "endpoint",
        ignoreDuplicates: false,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to save push subscription.",
      });
    }

    return res.status(200).json({
      success: true,
      saved: true,
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: "Failed to save push subscription.",
    });
  }
}
