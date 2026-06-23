import { STORAGE_KEYS, LEGACY_STORAGE_KEYS, readWithMigration, writeStorage } from "./storage.js";
import { getReportStats, getToday } from "./statistics.js";

export const ADMIN_REPORT_DRAFT_KEY = STORAGE_KEYS.reportDrafts;

export function formatReportPeriod(startDate, endDate) {
  if (!startDate && !endDate) return "전체 기간";
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `${startDate} 이후`;
  return `${endDate} 이전`;
}

export function generateReportSummary(stats) {
  return {
    keyIssues: `해당 기간 동안 총 ${stats.totalActivities}건의 확인 활동이 진행되었으며, 외부 확인 ${stats.externalCount || 0}건, 전화 확인 ${stats.callCount}건, 방문 확인 ${stats.visitCount}건, 집중 모니터링 ${stats.intensiveCount || 0}건으로 집계되었습니다. 이상징후 보고는 총 ${stats.emergencyCount}건 접수되었으며, 미처리 건은 ${stats.unresolvedEmergencyCount}건입니다.`,
    actionTaken: `미처리 이상징후 보고 ${stats.unresolvedEmergencyCount}건은 관리자 확인이 필요합니다. 위험도 '위험' 대상자 ${stats.dangerTargetCount}명은 확인 주기 조정과 추가 지원 검토가 필요합니다.`,
    adminOpinion: `현재 운영 현황상 확인 기록과 이상징후 보고를 정기적으로 점검하고, 위험 대상자 중심의 확인 계획을 유지하는 것이 필요합니다.`,
  };
}

export function generateReportDraft(data, startDate, endDate) {
  const stats = getReportStats(data, startDate, endDate);
  const sentences = generateReportSummary(stats);

  return {
    id: `admin-report-${Date.now()}`,
    title: "해피통서비스 운영 보고서",
    periodStart: startDate,
    periodEnd: endDate,
    totalTargets: stats.totalTargets,
    totalCheckers: stats.totalCheckers,
    totalActivities: stats.totalActivities,
    externalCount: stats.externalCount,
    visitCount: stats.visitCount,
    callCount: stats.callCount,
    intensiveCount: stats.intensiveCount,
    emergencyCount: stats.emergencyCount,
    unresolvedEmergencyCount: stats.unresolvedEmergencyCount,
    dangerTargetCount: stats.dangerTargetCount,
    keyIssues: sentences.keyIssues,
    actionTaken: sentences.actionTaken,
    additionalSupportTargets: data.targets
      .filter((target) => target.riskLevel !== "normal")
      .map((target) => target.name)
      .join(", "),
    adminOpinion: sentences.adminOpinion,
    createdAt: getToday(),
    updatedAt: getToday(),
  };
}

export function saveReportDraft(form) {
  const savedReport = {
    ...form,
    updatedAt: getToday(),
  };
  writeStorage(ADMIN_REPORT_DRAFT_KEY, savedReport);
  return savedReport;
}

export function readReportDraft(defaultDraft) {
  const saved = readWithMigration(ADMIN_REPORT_DRAFT_KEY, null, LEGACY_STORAGE_KEYS.reportDrafts);
  return saved ? { ...defaultDraft, ...saved } : defaultDraft;
}
