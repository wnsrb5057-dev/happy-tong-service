import { adminReports as initialAdminReports } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, writeStorage } from "../utils/storage.js";

export function readAdminReports() {
  const savedReports = readWithMigration(STORAGE_KEYS.adminReports, [], LEGACY_STORAGE_KEYS.adminReports);
  return mergeById(initialAdminReports, Array.isArray(savedReports) ? savedReports : []);
}

export function writeAdminReports(reports) {
  writeStorage(STORAGE_KEYS.adminReports, Array.isArray(reports) ? reports : []);
}
