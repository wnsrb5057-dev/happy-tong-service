import { emergencyReports as initialEmergencyReports } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, writeStorage } from "../utils/storage.js";

export function normalizeEmergencyReport(report) {
  const statusMap = {
    open: "received",
    "접수됨": "received",
    in_progress: "checking",
    "처리중": "checking",
    checking: "checking",
    contacted: "contacted",
    visiting: "visiting",
    resolved: "completed",
    "완료": "completed",
  };
  const date = report.date || new Date().toISOString().slice(0, 10);

  return {
    adminMemo: "",
    createdAt: report.createdAt || date,
    updatedAt: report.updatedAt || report.createdAt || date,
    issueLevel: report.issueLevel || (report.urgency === "high" ? "urgent" : "need_check"),
    handlingLogs: Array.isArray(report.handlingLogs)
      ? report.handlingLogs.map((log) => ({
          ...log,
          status: statusMap[log?.status] ?? log?.status ?? "received",
        }))
      : [],
    ...report,
    status: statusMap[report.status] ?? report.status ?? "received",
  };
}

export function readEmergencyReports() {
  const savedReports = readWithMigration(STORAGE_KEYS.emergencyReports, [], LEGACY_STORAGE_KEYS.emergencyReports);
  const normalizedSavedReports = Array.isArray(savedReports) ? savedReports.map(normalizeEmergencyReport) : [];
  return mergeById(initialEmergencyReports.map(normalizeEmergencyReport), normalizedSavedReports);
}

export function writeEmergencyReports(reports) {
  writeStorage(
    STORAGE_KEYS.emergencyReports,
    Array.isArray(reports) ? reports.map(normalizeEmergencyReport) : []
  );
}
