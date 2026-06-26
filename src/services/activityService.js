import { activityRecords as initialActivityRecords } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, writeStorage } from "../utils/storage.js";

export function normalizeActivityRecord(record) {
  const date = record.date || new Date().toISOString().slice(0, 10);
  const checkType = record.checkType || record.type || "external";

  return {
    createdAt: record.createdAt || date,
    updatedAt: record.updatedAt || record.createdAt || date,
    checkType,
    type: record.type || checkType,
    checkItems: record.checkItems || {},
    issueLevel: record.issueLevel || (record.hasIssue ? "need_check" : "none"),
    ...record,
  };
}

export function readActivityRecords() {
  const savedRecords = readWithMigration(STORAGE_KEYS.activityRecords, [], LEGACY_STORAGE_KEYS.activityRecords);
  const normalizedSavedRecords = Array.isArray(savedRecords) ? savedRecords.map(normalizeActivityRecord) : [];
  return mergeById(initialActivityRecords.map(normalizeActivityRecord), normalizedSavedRecords);
}

export function writeActivityRecords(records) {
  writeStorage(
    STORAGE_KEYS.activityRecords,
    Array.isArray(records) ? records.map(normalizeActivityRecord) : []
  );
}
