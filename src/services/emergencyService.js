import { emergencyReports as initialEmergencyReports } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration } from "../utils/storage.js";

export function normalizeEmergencyReport(report) {
  const statusMap = {
    open: "received",
    resolved: "completed",
  };
  const date = report.date || new Date().toISOString().slice(0, 10);

  return {
    adminMemo: "",
    createdAt: report.createdAt || date,
    updatedAt: report.updatedAt || report.createdAt || date,
    issueLevel: report.issueLevel || (report.urgency === "high" ? "urgent" : "need_check"),
    ...report,
    status: statusMap[report.status] ?? report.status ?? "received",
  };
}

export function readEmergencyReports() {
  const savedReports = readWithMigration(STORAGE_KEYS.emergencyReports, [], LEGACY_STORAGE_KEYS.emergencyReports);
  const normalizedSavedReports = Array.isArray(savedReports) ? savedReports.map(normalizeEmergencyReport) : [];
  return mergeById(initialEmergencyReports.map(normalizeEmergencyReport), normalizedSavedReports);
}
