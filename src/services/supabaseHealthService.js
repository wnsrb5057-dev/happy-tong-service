import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

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
      message: "Supabase 연결은 정상이나, RLS 정책 또는 anon 접근 제한으로 데이터가 표시되지 않을 수 있습니다.",
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

async function getTableCount(tableName) {
  const { count, error } = await supabase.from(tableName).select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return Number(count || 0);
}

async function getCountsFromRpc() {
  const { data, error } = await supabase.rpc("get_public_health_counts");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    organizationCount: Number(row?.organization_count || 0),
    userCount: Number(row?.user_count || 0),
    targetCount: Number(row?.target_count || 0),
  };
}

async function getCountsFromDirectQueries() {
  const [organizationCount, userCount, targetCount] = await Promise.all([
    getTableCount("organizations"),
    getTableCount("users"),
    getTableCount("targets"),
  ]);

  return {
    organizationCount,
    userCount,
    targetCount,
  };
}

export async function getSupabaseConnectionStatus() {
  if (!isSupabaseConfigured || !supabase) {
    return createStatusResult();
  }

  try {
    const counts = await getCountsFromRpc();
    return buildConnectedStatus(counts);
  } catch (rpcError) {
    try {
      const counts = await getCountsFromDirectQueries();
      return buildConnectedStatus(counts);
    } catch (fallbackError) {
      return createStatusResult({
        configured: true,
        ok: false,
        status: "error",
        message: fallbackError?.message || rpcError?.message || "Supabase 연결 확인 중 오류가 발생했습니다.",
        checkedAt: new Date().toISOString(),
      });
    }
  }
}
