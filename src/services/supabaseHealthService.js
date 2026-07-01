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

async function getTableCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function getSupabaseConnectionStatus() {
  if (!isSupabaseConfigured || !supabase) {
    return createStatusResult();
  }

  try {
    const [organizationCount, userCount, targetCount] = await Promise.all([
      getTableCount("organizations"),
      getTableCount("users"),
      getTableCount("targets"),
    ]);

    const counts = [organizationCount, userCount, targetCount];
    const isRestricted = counts.every((count) => count === 0);

    if (isRestricted) {
      return createStatusResult({
        configured: true,
        ok: true,
        status: "connected_but_restricted",
        message:
          "Supabase 연결은 정상이나, RLS 정책 또는 anon 접근 제한으로 데이터가 표시되지 않을 수 있습니다.",
        organizationCount,
        userCount,
        targetCount,
        checkedAt: new Date().toISOString(),
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
      checkedAt: new Date().toISOString(),
    });
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
