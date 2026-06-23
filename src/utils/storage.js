export const STORAGE_KEYS = {
  currentUser: "happytong_current_user",
  targets: "happytong_targets",
  activityRecords: "happytong_activity_records",
  emergencyReports: "happytong_emergency_reports",
  adminReports: "happytong_admin_reports",
  reportDrafts: "happytong_report_drafts",
  signupRequests: "signupRequests",
  registeredUsers: "happytong_registered_users",
};

export const LEGACY_STORAGE_KEYS = {
  currentUser: ["happy-tong-current-user"],
  targets: [],
  activityRecords: ["happy-tong-activity-records"],
  emergencyReports: ["happy-tong-emergency-reports"],
  adminReports: ["happy-tong-admin-reports"],
  reportDrafts: ["happytong_admin_report_draft", "happy-tong-admin-report-draft"],
  signupRequests: [],
  registeredUsers: [],
};

export function safeReadStorage(key, fallback = null) {
  const saved = localStorage.getItem(key);
  if (!saved) {
    return fallback;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return saved;
  }
}

export function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorage(keys) {
  keys.forEach((key) => localStorage.removeItem(key));
}

export function readWithMigration(key, fallback, legacyKeys = []) {
  const current = safeReadStorage(key, null);
  if (current !== null) {
    return current;
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = safeReadStorage(legacyKey, null);
    if (legacyValue !== null) {
      writeStorage(key, legacyValue);
      return legacyValue;
    }
  }

  return fallback;
}

export function mergeById(initialItems, savedItems) {
  if (!Array.isArray(savedItems) || savedItems.length === 0) {
    return initialItems;
  }

  const mergedItems = new Map(initialItems.map((item) => [item.id, item]));
  savedItems.forEach((item) => mergedItems.set(item.id, item));
  return Array.from(mergedItems.values());
}
