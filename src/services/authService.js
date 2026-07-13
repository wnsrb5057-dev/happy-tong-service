import { users as baseUsers } from "../data/mockData.js";
import { defaultUserOrganizations, getOrganizationById } from "../data/organizations.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  readWithMigration,
  removeStorage,
  writeStorage,
} from "../utils/storage.js";

const superAdminUser = {
  id: "super_admin",
  username: "super_admin",
  loginId: "super_admin",
  password: "1234",
  role: "super_admin",
  name: "해피통 총관리자",
  organizationId: "",
  organizationName: "",
};

function enrichBaseUser(user) {
  const organizationId = user.organizationId || defaultUserOrganizations[user.id] || defaultUserOrganizations[user.username];
  const organization = getOrganizationById(organizationId);

  return {
    ...user,
    username: user.username || user.loginId || user.id,
    organizationId: organizationId || "",
    organizationName: user.organizationName || organization?.name || "",
  };
}

function normalizeSupabaseCurrentUser(userRow, organizationName = "") {
  return {
    id: userRow?.id || "",
    authUserId: userRow?.auth_user_id || "",
    username: userRow?.username || userRow?.login_id || userRow?.email || "",
    role: userRow?.role || "",
    name: userRow?.name || "",
    organizationId: userRow?.organization_id || "",
    organizationName: organizationName || "",
    status: userRow?.status || "",
    email: userRow?.email || "",
  };
}

export function readRegisteredUsers() {
  const storedUsers = readWithMigration(STORAGE_KEYS.registeredUsers, [], LEGACY_STORAGE_KEYS.registeredUsers);
  return Array.isArray(storedUsers) ? storedUsers : [];
}

export function writeRegisteredUsers(users) {
  writeStorage(STORAGE_KEYS.registeredUsers, Array.isArray(users) ? users : []);
}

export function readAllUsers() {
  return [superAdminUser, ...baseUsers.map(enrichBaseUser), ...readRegisteredUsers()];
}

export function readUsers() {
  return readAllUsers();
}

export function authenticateUser(username, password) {
  return readAllUsers().find((user) => (user.username || user.id) === username && user.password === password) ?? null;
}

export function readCurrentUser() {
  const savedUserId = readWithMigration(STORAGE_KEYS.currentUser, "", LEGACY_STORAGE_KEYS.currentUser);

  if (savedUserId && typeof savedUserId === "object" && savedUserId.role) {
    return savedUserId;
  }

  return readAllUsers().find((user) => user.id === savedUserId || user.username === savedUserId) ?? null;
}

export function saveCurrentUser(user) {
  if (user?.authUserId || user?.email) {
    writeStorage(STORAGE_KEYS.currentUser, user);
    return;
  }

  writeStorage(STORAGE_KEYS.currentUser, user.username || user.id);
}

export function clearCurrentUser() {
  removeStorage([STORAGE_KEYS.currentUser, ...LEGACY_STORAGE_KEYS.currentUser]);
}

export async function authenticateSupabaseUser(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Supabase 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw authError;
    }

    const authUserId = authData?.user?.id || "";

    if (!authUserId) {
      await supabase.auth.signOut();
      return {
        ok: false,
        reason: "missing_auth_user",
        message: "Supabase 로그인 사용자 정보를 확인할 수 없습니다.",
      };
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, auth_user_id, username, role, name, organization_id, status, email")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!userRow) {
      await supabase.auth.signOut();
      return {
        ok: false,
        reason: "user_not_found",
        message: "public.users에서 로그인 사용자 정보를 찾을 수 없습니다.",
      };
    }

    if (String(userRow.status || "").toLowerCase() !== "active") {
      await supabase.auth.signOut();
      return {
        ok: false,
        reason: "inactive",
        message: "현재 계정은 활성 상태가 아니어서 로그인할 수 없습니다.",
      };
    }

    let organizationName = "";

    if (userRow.organization_id) {
      const { data: organizationRow, error: organizationError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", userRow.organization_id)
        .maybeSingle();

      if (!organizationError) {
        organizationName = organizationRow?.name || "";
      }
    }

    return {
      ok: true,
      user: normalizeSupabaseCurrentUser(userRow, organizationName),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error?.message || "Supabase 로그인에 실패했습니다.",
    };
  }
}

export async function signOutSupabaseAuth() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // mock 로그인 흐름에 영향이 없도록 로그아웃 에러는 무시합니다.
  }
}

export function buildApprovedCheckerFromRequest(request) {
  return {
    id: `user-${request.loginId}`,
    username: request.loginId,
    loginId: request.loginId,
    password: request.password,
    name: request.name,
    phone: request.phone,
    role: "checker",
    organizationId: request.organizationId,
    organizationName: request.organizationName,
    status: "active",
    assignedTargetIds: [],
  };
}
