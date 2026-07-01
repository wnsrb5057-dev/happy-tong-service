import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

function createStatusResult(overrides = {}) {
  return {
    configured: false,
    ok: false,
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

    return createStatusResult({
      configured: true,
      ok: true,
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
      message: error?.message || "Supabase 연결 확인 중 오류가 발생했습니다.",
      checkedAt: new Date().toISOString(),
    });
  }
}
