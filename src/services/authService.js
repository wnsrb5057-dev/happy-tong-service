import { users as baseUsers } from "../data/mockData.js";
import { defaultUserOrganizations, getOrganizationById } from "../data/organizations.js";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  readWithMigration,
  removeStorage,
  writeStorage,
} from "../utils/storage.js";

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

export function readRegisteredUsers() {
  const storedUsers = readWithMigration(STORAGE_KEYS.registeredUsers, [], LEGACY_STORAGE_KEYS.registeredUsers);
  return Array.isArray(storedUsers) ? storedUsers : [];
}

export function writeRegisteredUsers(users) {
  writeStorage(STORAGE_KEYS.registeredUsers, Array.isArray(users) ? users : []);
}

export function readAllUsers() {
  return [...baseUsers.map(enrichBaseUser), ...readRegisteredUsers()];
}

export function readUsers() {
  return readAllUsers();
}

export function authenticateUser(username, password) {
  return readAllUsers().find((user) => (user.username || user.id) === username && user.password === password) ?? null;
}

export function readCurrentUser() {
  const savedUserId = readWithMigration(STORAGE_KEYS.currentUser, "", LEGACY_STORAGE_KEYS.currentUser);
  return readAllUsers().find((user) => user.id === savedUserId || user.username === savedUserId) ?? null;
}

export function saveCurrentUser(user) {
  writeStorage(STORAGE_KEYS.currentUser, user.username || user.id);
}

export function clearCurrentUser() {
  removeStorage([STORAGE_KEYS.currentUser, ...LEGACY_STORAGE_KEYS.currentUser]);
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
