import { isSupabaseConfigured } from "./supabaseClient.js";

function createStatusResult(overrides = {}) {
  return {
    configured: false,
    ok: false,
    status: "not_configured",
    message: "Supabase 환경변수가 설정되지 않았습니다.",
    organizationCount: 0,
    userCount: 0,
    targetCount: 0,
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

function isRestrictedCountResult({ organizationCount, userCount, targetCount }) {
  return [organizationCount, userCount, targetCount].every((count) => Number(count || 0) === 0);
}

function buildConnectedStatus({ organizationCount, userCount, targetCount }) {
  const checkedAt = new Date().toISOString();

  if (
    isRestrictedCountResult({
      organizationCount,
      userCount,
      targetCount,
    })
  ) {
    return createStatusResult({
      configured: true,
      ok: true,
      status: "connected_but_restricted",
      message: "Supabase 연결은 정상이나, 권한 제한으로 데이터가 표시되지 않을 수 있습니다.",
      organizationCount,
      userCount,
      targetCount,
      checkedAt,
    });
  }

  return createStatusResult({
    configured: true,
    ok: true,
    status: "connected",
    message: "Supabase 연결이 정상입니다.",
    organizationCount,
    userCount,
    targetCount,
    checkedAt,
  });
}

async function getCountsFromApi() {
  const response = await fetch("/api/super", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getHealthCounts" }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(result.message || result.error || "Failed to load Supabase health counts.");
  }

  const row = result.healthCounts || {};

  return {
    organizationCount: Number(row?.organization_count || row?.organizationCount || 0),
    userCount: Number(row?.user_count || row?.userCount || 0),
    targetCount: Number(row?.target_count || row?.targetCount || 0),
  };
}

export async function getSupabaseConnectionStatus() {
  if (!isSupabaseConfigured) {
    return createStatusResult();
  }

  try {
    const counts = await getCountsFromApi();
    return buildConnectedStatus(counts);
  } catch (error) {
    return createStatusResult({
      configured: true,
      ok: false,
      status: "error",
      message: error?.message || "Supabase 연결 확인 중 오류가 발생했습니다.",
      checkedAt: new Date().toISOString(),
    });
  }
}
