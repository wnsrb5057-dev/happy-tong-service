import { useEffect, useMemo, useState } from "react";
import {
  activityHealthLabels,
  activityTypeLabels,
  checkTypeLabels,
  emergencyStatusLabels,
  issueLevelLabels,
  riskLabels,
  urgencyLabels,
  recordStatusLabels,
} from "../data/mockData.js";
import {
  Button,
  Card,
  CheckboxField,
  EmptyState,
  InfoList,
  PageHeader,
  SectionTitle,
  SelectInput,
  StatCard,
  StatusBadge,
  TextArea,
  TextInput,
} from "../components/UI.jsx";
import {
  getActivityStats,
  getCheckerActivityStats,
  getDashboardStats,
  getEmergencyStats,
  getRecentDailyActivityStats,
  getTargetRiskStats,
  getToday as getTodayFromStats,
} from "../services/statisticsService.js";
import {
  formatReportPeriod,
  generateReportDraft,
  readReportDraft,
  saveReportDraft,
} from "../services/reportService.js";
import {
  buildActivitiesCsvRows,
  buildCheckersCsvRows,
  buildEmergenciesCsvRows,
  buildTargetsCsvRows,
  downloadCsv,
} from "../utils/exportCsv.js";
import { getSupabaseAdminDashboard } from "../services/supabaseAdminDashboardService.js";

function getToday() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function byLatestDate(a, b) {
  return b.date.localeCompare(a.date);
}

function truncateText(text, maxLength = 56) {
  if (!text) return "메모 없음";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isTodayScheduled(target) {
  return target.todayScheduled ?? target.todayVisit;
}

function targetById(targets, targetId) {
  return targets.find((target) => target.id === targetId);
}

function checkerById(users, checkerId) {
  return users.find((user) => user.id === checkerId);
}

function getAssignedCheckerState(checker) {
  return checker?.status || checker?.activityStatus || "active";
}

function isActiveLifecycleTarget(target) {
  return (target?.lifecycleStatus || "active") !== "ended";
}

function isReassignmentNeededTarget(target, users) {
  if (!isActiveLifecycleTarget(target)) return false;

  const assignedCheckerId = target?.assignedCheckerId;
  const checker = checkerById(users, assignedCheckerId);

  if (!assignedCheckerId || !checker) {
    return true;
  }

  return getAssignedCheckerState(checker) !== "active";
}

function getTargetCheckerAlert(checker) {
  if (!checker) {
    return {
      badge: "담당 체커 미배정",
      message: "재배정 필요",
      tone: "danger",
    };
  }

  const checkerStatus = getAssignedCheckerState(checker);

  if (checkerStatus === "paused") {
    return {
      badge: "체커 일시중지",
      message: "재배정 검토 필요",
      tone: "warning",
    };
  }

  if (checkerStatus === "left") {
    return {
      badge: "체커 활동종료",
      message: "재배정 필요",
      tone: "danger",
    };
  }

  return null;
}

function targetName(targets, targetId) {
  return targetById(targets, targetId)?.name ?? "대상자 없음";
}

function checkerName(users, checkerId) {
  return checkerById(users, checkerId)?.name ?? "체커 없음";
}

function checkerPhone(users, checkerId) {
  return checkerById(users, checkerId)?.phone ?? "연락처 없음";
}

const SUPABASE_ADMIN_ORGANIZATION_ID_MAP = {
  "org-eunpyeong-care": "11111111-1111-1111-1111-111111111111",
  "org-chungju-pungdong": "22222222-2222-2222-2222-222222222222",
  "은평구 돌봄센터": "11111111-1111-1111-1111-111111111111",
  "서울시 은평구": "11111111-1111-1111-1111-111111111111",
  "충주 풍동 행정복지센터": "22222222-2222-2222-2222-222222222222",
  충주돌봄센터: "22222222-2222-2222-2222-222222222222",
};

function resolveAdminSupabaseOrganizationId(currentUser, data) {
  const directCandidates = [
    currentUser?.organizationId,
    currentUser?.organizationName,
    currentUser?.region,
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    if (SUPABASE_ADMIN_ORGANIZATION_ID_MAP[candidate]) {
      return SUPABASE_ADMIN_ORGANIZATION_ID_MAP[candidate];
    }
  }

  const organizations = Array.isArray(data?.organizations) ? data.organizations : [];
  const localOrganization =
    organizations.find((organization) => organization.id === currentUser?.organizationId) ||
    organizations.find((organization) => organization.adminName === currentUser?.name) ||
    organizations.find((organization) => organization.name === currentUser?.organizationName);

  if (localOrganization) {
    return (
      SUPABASE_ADMIN_ORGANIZATION_ID_MAP[localOrganization.id] ||
      SUPABASE_ADMIN_ORGANIZATION_ID_MAP[localOrganization.name] ||
      SUPABASE_ADMIN_ORGANIZATION_ID_MAP[localOrganization.region] ||
      null
    );
  }

  if (currentUser?.username === "admin" || currentUser?.id === "admin") {
    return "11111111-1111-1111-1111-111111111111";
  }

  return null;
}

function getCheckerPhoneValue(checker) {
  return checker?.phone || checker?.phoneNumber || checker?.contactPhone || "";
}

function formatDashboardDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

function getCheckerAreaValue(checker) {
  return checker?.area || checker?.region || checker?.assignedArea || "";
}

function getCheckerStatusLabel(status) {
  if (status === "paused") return "일시중지";
  if (status === "left") return "활동종료";
  if (status === "active") return "활동중";
  if (status === "needs_attention") return "지원 필요";
  return status || "상태 없음";
}

function renderCheckerStatusBadge(status) {
  if (status === "active" || status === "needs_attention") {
    return <StatusBadge type="checker" value={status} />;
  }

  return <span className="badge badge-muted">{getCheckerStatusLabel(status)}</span>;
}

function getCheckType(record) {
  return record.checkType || record.type || "external";
}

function getTargetCheckType(target) {
  return target.defaultCheckType || "external";
}

function getTargetArea(target) {
  return target.area || target.district || target.address;
}

function getIssueLevel(report) {
  return report.issueLevel || (report.urgency === "high" ? "urgent" : "need_check");
}

function getEmergencyStatusValue(status) {
  const statusMap = {
    received: "received",
    "접수됨": "received",
    in_progress: "checking",
    "처리중": "checking",
    checking: "checking",
    contacted: "contacted",
    visiting: "visiting",
    completed: "completed",
    resolved: "completed",
    "완료": "completed",
  };

  return statusMap[status] || status || "received";
}

function getEmergencyStatusMeta(status) {
  const normalizedStatus = getEmergencyStatusValue(status);

  if (normalizedStatus === "checking") {
    return { value: normalizedStatus, label: "확인중", tone: "warning" };
  }

  if (normalizedStatus === "contacted") {
    return { value: normalizedStatus, label: "보호자 연락", tone: "info" };
  }

  if (normalizedStatus === "visiting") {
    return { value: normalizedStatus, label: "방문 필요", tone: "danger" };
  }

  if (normalizedStatus === "completed") {
    return { value: normalizedStatus, label: "완료", tone: "success" };
  }

  return { value: "received", label: "접수됨", tone: "warning" };
}

function isEmergencyCompleted(status) {
  return getEmergencyStatusValue(status) === "completed";
}

function EmergencyStatusBadge({ status }) {
  const meta = getEmergencyStatusMeta(status);
  return <span className={`badge badge-${meta.tone}`}>{meta.label}</span>;
}

function isWithinReportRange(dateText, startDate, endDate) {
  if (!dateText) return false;
  if (startDate && dateText < startDate) return false;
  if (endDate && dateText > endDate) return false;
  return true;
}

function getLatestEmergencyHandlingStatus(report) {
  const logs = Array.isArray(report?.handlingLogs) ? [...report.handlingLogs] : [];
  if (logs.length) {
    const latestLog = logs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
    return getEmergencyStatusValue(latestLog?.status);
  }

  return getEmergencyStatusValue(report?.status);
}

function buildReportInsights(data, startDate, endDate) {
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const activityRecords = Array.isArray(data.activityRecords) ? data.activityRecords : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];
  const activeTargets = targets.filter(isActiveLifecycleTarget);
  const checkers = users.filter((user) => user.role === "checker");
  const rangedActivities = activityRecords.filter((record) => isWithinReportRange(record.date, startDate, endDate));
  const rangedEmergencies = emergencyReports.filter((report) => isWithinReportRange(report.date, startDate, endDate));
  const unresolvedEmergencies = rangedEmergencies.filter((report) => !isEmergencyCompleted(report.status));
  const reassignmentNeededTargets = activeTargets
    .filter((target) => isReassignmentNeededTarget(target, users))
    .map((target) => {
      const checker = checkerById(users, target.assignedCheckerId);
      const checkerAlert = getTargetCheckerAlert(checker);
      return {
        id: target.id,
        name: target.name,
        checkerName: target.assignedCheckerId ? checkerName(users, target.assignedCheckerId) : "담당 체커 미배정",
        reason: checkerAlert?.badge || "담당 체커 미배정",
      };
    });

  const handlingSummary = rangedEmergencies.reduce(
    (summary, report) => {
      const status = getLatestEmergencyHandlingStatus(report);
      summary[status] = (summary[status] || 0) + 1;
      if (!isEmergencyCompleted(status)) {
        summary.unresolved += 1;
      }
      return summary;
    },
    { received: 0, checking: 0, contacted: 0, visiting: 0, completed: 0, unresolved: 0 }
  );

  const operatingTargetCount = activeTargets.length;
  const dangerTargetCount = activeTargets.filter((target) => target.riskLevel === "danger").length;

  return {
    operatingTargetCount,
    totalCheckers: checkers.length,
    totalActivities: rangedActivities.length,
    externalCount: rangedActivities.filter((record) => getCheckType(record) === "external").length,
    visitCount: rangedActivities.filter((record) => getCheckType(record) === "visit").length,
    callCount: rangedActivities.filter((record) => getCheckType(record) === "call").length,
    intensiveCount: rangedActivities.filter((record) => getCheckType(record) === "intensive").length,
    emergencyCount: rangedEmergencies.length,
    unresolvedEmergencyCount: unresolvedEmergencies.length,
    dangerTargetCount,
    issueCount: rangedActivities.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length,
    handlingSummary,
    reassignmentNeededCount: reassignmentNeededTargets.length,
    reassignmentNeededTargets,
    recentEmergencies: [...rangedEmergencies]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 5),
  };
}

function buildReportNarrative(insights) {
  const outstandingText = insights.unresolvedEmergencyCount
    ? `${insights.unresolvedEmergencyCount}건은 추가 확인이 필요한 상태입니다.`
    : "모든 이상징후는 완료 또는 후속 조치가 반영된 상태입니다.";
  const reassignmentText = insights.reassignmentNeededCount
    ? `담당 체커 상태 변경 또는 미배정으로 인해 ${insights.reassignmentNeededCount}명의 대상자에 대해 재배정 검토가 필요합니다.`
    : "재배정이 필요한 대상자는 없습니다.";

  return {
    overview:
      `해당 기간 동안 생활 확인 기록과 이상징후 보고 내역을 기준으로 운영 현황을 정리했습니다. ` +
      `운영 대상자는 ${insights.operatingTargetCount}명이며, 확인 기록은 총 ${insights.totalActivities}건입니다.`,
    keyIssues:
      `해당 기간 동안 외부 확인 ${insights.externalCount}건, 전화 확인 ${insights.callCount}건, 방문 확인 ${insights.visitCount}건, 집중 모니터링 ${insights.intensiveCount}건이 기록되었습니다. ` +
      `확인 기록과 이상징후 데이터를 기반으로 운영 현황을 정리했으며 관리자 검토가 필요합니다.`,
    emergencySummary:
      `해당 기간 동안 총 ${insights.emergencyCount}건의 이상징후가 보고되었으며, 완료 ${insights.handlingSummary.completed}건, 확인중 ${insights.handlingSummary.checking}건, ` +
      `보호자 연락 ${insights.handlingSummary.contacted}건, 방문 필요 ${insights.handlingSummary.visiting}건으로 집계되었습니다. ${outstandingText}`,
    reassignmentSummary: reassignmentText,
    actionTaken:
      `미처리 이상징후 ${insights.unresolvedEmergencyCount}건과 위험 대상자 ${insights.dangerTargetCount}명에 대한 후속 확인이 필요합니다. ` +
      `본 보고서는 관리자 검토 후 제출용으로 활용할 수 있습니다.`,
    adminOpinion:
      `본 보고서는 관리자 검토 후 제출용으로 활용할 수 있습니다. 기관 운영 상황에 따라 보호자 연락, 방문 확인, 대상자 재배정 여부를 추가 검토해주세요.`,
  };
}

function compareDatesAscending(aDate, bDate) {
  const aTime = aDate ? new Date(aDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = bDate ? new Date(bDate).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

function getRiskPriority(riskLevel) {
  if (riskLevel === "danger") return 0;
  if (riskLevel === "caution") return 1;
  return 2;
}

function sortTargetsForAdmin(a, b) {
  const riskDiff = getRiskPriority(a.riskLevel) - getRiskPriority(b.riskLevel);
  if (riskDiff) return riskDiff;
  const todayDiff = Number(isTodayScheduled(b)) - Number(isTodayScheduled(a));
  if (todayDiff) return todayDiff;
  const dateDiff = compareDatesAscending(a.lastVisitDate, b.lastVisitDate);
  if (dateDiff) return dateDiff;
  return String(a.name || "").localeCompare(String(b.name || ""), "ko");
}

function getWeekPlan(targets) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days.map((day) => ({
    day,
    targets: targets.filter((target) => target.checkDays?.includes(day)),
  }));
}

function countCompleted(records, checkerId) {
  return records.filter((record) => record.checkerId === checkerId && record.status === "completed").length;
}

function countPending(records, checkerId) {
  return records.filter((record) => record.checkerId === checkerId && record.status !== "completed").length;
}

function getCheckerStatus(checker, data) {
  const hasPending = countPending(data.activityRecords, checker.id) > 0;
  const hasOpenEmergency = data.emergencyReports.some(
    (report) => report.checkerId === checker.id && !isEmergencyCompleted(report.status)
  );

  if (checker.status === "needs_attention" || hasPending || hasOpenEmergency) {
    return "needs_attention";
  }

  return checker.status || "active";
}

export function AdminDashboard({ data, navigate, currentUser }) {
  const dashboardSampleTrend = [
    { label: "06-22", value: 2, tone: "blue" },
    { label: "06-23", value: 4, tone: "blue" },
    { label: "06-24", value: 3, tone: "blue" },
    { label: "06-25", value: 5, tone: "blue" },
    { label: "06-26", value: 4, tone: "blue" },
    { label: "06-27", value: 6, tone: "blue" },
    { label: "06-28", value: 5, tone: "blue" },
  ];
  const adminSupabaseOrganizationId = useMemo(
    () => resolveAdminSupabaseOrganizationId(currentUser, data),
    [currentUser, data]
  );
  const [supabaseDashboardState, setSupabaseDashboardState] = useState({
    loading: true,
    source: "local",
    noteClassName: "super-source-local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: "",
    dashboard: null,
  });
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const activityRecords = Array.isArray(data.activityRecords) ? data.activityRecords : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];
  const activeTargets = targets.filter(isActiveLifecycleTarget);
  const today = getTodayFromStats();
  const todayPlanDay = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
  const stats = getDashboardStats({ ...data, targets: activeTargets });
  const todayScheduled = activeTargets.filter(isTodayScheduled).length;
  const completedToday = activityRecords.filter((record) => record.date === today && record.status === "completed").length;
  const urgentReports = emergencyReports.filter((report) => getIssueLevel(report) === "urgent" && !isEmergencyCompleted(report.status));
  const unresolvedReports = emergencyReports.filter((report) => !isEmergencyCompleted(report.status));
  const weekPlan = getWeekPlan(activeTargets);
  const [selectedPlanDay, setSelectedPlanDay] = useState(todayPlanDay);
  const selectedPlan = weekPlan.find((item) => item.day === selectedPlanDay) || weekPlan[0];
  const recentEmergencyReports = [...emergencyReports]
    .sort((a, b) => {
      const urgentDiff = Number(getIssueLevel(b) === "urgent") - Number(getIssueLevel(a) === "urgent");
      if (urgentDiff) return urgentDiff;
      const statusDiff = Number(isEmergencyCompleted(a.status)) - Number(isEmergencyCompleted(b.status));
      if (statusDiff) return statusDiff;
      return byLatestDate(a, b);
    })
    .slice(0, 5);
  const recentActivities = [...activityRecords].sort(byLatestDate).slice(0, 4);
  const fallbackDashboard = useMemo(
    () => ({
      targetCount: activeTargets.length,
      checkerCount: users.filter((user) => user.role === "checker").length,
      todayActivityCount: completedToday,
      recentActivityCount: getRecentDailyActivityStats(activityRecords, 7).reduce((sum, row) => sum + row.count, 0),
      emergencyCount: emergencyReports.length,
      unresolvedEmergencyCount: unresolvedReports.length,
      recentActivities: recentActivities.map((record) => ({
        id: record.id,
        targetId: record.targetId,
        targetName: targetName(targets, record.targetId),
        checkerId: record.checkerId,
        checkerName: checkerName(users, record.checkerId),
        checkType: getCheckType(record),
        checkTypeLabel: activityTypeLabels[getCheckType(record)] || checkTypeLabels[getCheckType(record)] || getCheckType(record),
        resultStatus: record.status,
        resultStatusLabel: recordStatusLabels[record.status] || record.status || "상태 없음",
        checkedAt: record.checkedAt || record.date || record.createdAt || null,
      })),
      recentEmergencies: recentEmergencyReports.map((report) => ({
        id: report.id,
        targetId: report.targetId,
        targetName: targetName(targets, report.targetId),
        title: report.title || report.issueType || "이상징후 보고",
        severity: report.severity || report.urgency || "normal",
        severityLabel: urgencyLabels[report.urgency] || urgencyLabels[report.severity] || report.urgency || "일반",
        status: report.status,
        statusLabel: getEmergencyStatusMeta(report.status).label,
        reportedAt: report.reportedAt || report.date || null,
      })),
    }),
    [
      activeTargets.length,
      users,
      completedToday,
      emergencyReports.length,
      unresolvedReports.length,
      recentActivities,
      recentEmergencyReports,
      targets,
    ]
  );
  const reassignmentNeededTargets = activeTargets.filter((target) => isReassignmentNeededTarget(target, users)).sort(sortTargetsForAdmin);
  const riskRows = [
    { label: "정상", value: activeTargets.filter((target) => target.riskLevel === "normal").length, tone: "green" },
    { label: "주의", value: activeTargets.filter((target) => target.riskLevel === "caution").length, tone: "orange" },
    { label: "위험", value: activeTargets.filter((target) => target.riskLevel === "danger").length, tone: "red" },
  ];
  const actualRecentActivityRows = getRecentDailyActivityStats(activityRecords, 7).map((row) => ({
    label: row.label,
    value: row.count,
    tone: "blue",
  }));
  const recentActivityTotal = actualRecentActivityRows.reduce((sum, row) => sum + row.value, 0);
  const recentActivityRows = recentActivityTotal ? actualRecentActivityRows : dashboardSampleTrend;
  const activityTypeRows = [
    { label: checkTypeLabels.external || "외부 확인", value: activityRecords.filter((record) => getCheckType(record) === "external").length, tone: "blue" },
    { label: checkTypeLabels.call || "전화 확인", value: activityRecords.filter((record) => getCheckType(record) === "call").length, tone: "green" },
    { label: checkTypeLabels.visit || "방문 확인", value: activityRecords.filter((record) => getCheckType(record) === "visit").length, tone: "orange" },
    { label: checkTypeLabels.intensive || "집중 모니터링", value: activityRecords.filter((record) => getCheckType(record) === "intensive").length, tone: "red" },
  ];
  const emergencyStatusSummary = emergencyReports.reduce(
    (summary, report) => {
      const status = getEmergencyStatusValue(report.status);
      if (status === "completed") summary.completed += 1;
      else if (status === "received" || status === "pending") summary.received += 1;
      else summary.inProgress += 1;
      return summary;
    },
    { received: 0, inProgress: 0, completed: 0 }
  );
  const emergencyStatusRows = [
    { label: emergencyStatusLabels.received || "접수됨", value: emergencyStatusSummary.received, tone: "orange" },
    { label: emergencyStatusLabels.in_progress || emergencyStatusLabels.processing || "처리중", value: emergencyStatusSummary.inProgress, tone: "blue" },
    { label: emergencyStatusLabels.completed || "완료", value: emergencyStatusSummary.completed, tone: "green" },
  ];
  const unresolvedTargetIds = new Set(unresolvedReports.map((report) => report.targetId));
  const urgentTargetIds = new Set(urgentReports.map((report) => report.targetId));
  const reassignmentTargetIds = new Set(reassignmentNeededTargets.map((target) => target.id));
  const priorityTargets = activeTargets
    .filter((target) => target.riskLevel === "danger" || unresolvedTargetIds.has(target.id) || reassignmentTargetIds.has(target.id))
    .sort((a, b) => {
      const urgentDiff = Number(urgentTargetIds.has(b.id)) - Number(urgentTargetIds.has(a.id));
      if (urgentDiff) return urgentDiff;
      const unresolvedDiff = Number(unresolvedTargetIds.has(b.id)) - Number(unresolvedTargetIds.has(a.id));
      if (unresolvedDiff) return unresolvedDiff;
      const reassignmentDiff = Number(reassignmentTargetIds.has(b.id)) - Number(reassignmentTargetIds.has(a.id));
      if (reassignmentDiff) return reassignmentDiff;
      return sortTargetsForAdmin(a, b);
    })
    .slice(0, 5);

  const riskPriority = { danger: 0, caution: 1, normal: 2 };
  const urgencyPriority = { high: 0, medium: 1, low: 2 };
  const statusPriority = { pending: 0, received: 1, in_progress: 2, processing: 2, checking: 2, contacted: 2, visiting: 2, completed: 3 };

  const sortedSelectedPlanTargets = [...selectedPlan.targets].sort((a, b) => (riskPriority[a.riskLevel] ?? 99) - (riskPriority[b.riskLevel] ?? 99));
  const sortedRecentEmergencyReports = [...recentEmergencyReports].sort((a, b) => {
    const urgencyDiff = (urgencyPriority[a.urgency] ?? 99) - (urgencyPriority[b.urgency] ?? 99);
    if (urgencyDiff !== 0) return urgencyDiff;
    const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.date) - new Date(a.date);
  });

  useEffect(() => {
    let mounted = true;

    setSupabaseDashboardState((current) => ({
      ...current,
      loading: true,
      dashboard: fallbackDashboard,
    }));

    async function load() {
      if (!adminSupabaseOrganizationId) {
        if (!mounted) return;
        setSupabaseDashboardState({
          loading: false,
          source: "local",
          noteClassName: "super-source-local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: "Supabase 기관 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
          dashboard: fallbackDashboard,
        });
        return;
      }

      const result = await getSupabaseAdminDashboard(adminSupabaseOrganizationId);

      if (!mounted) return;

      if (result.ok && result.dashboard) {
        setSupabaseDashboardState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          dashboard: result.dashboard,
        });
        return;
      }

      const fallbackMessage =
        result.source === "error" || result.source === "not_found"
          ? "Supabase 관리자 대시보드 요약을 불러오지 못해 로컬 데이터를 표시합니다."
          : result.message || "Supabase 관리자 대시보드 요약을 확인 중입니다.";

      setSupabaseDashboardState({
        loading: false,
        source: "local",
        noteClassName: "super-source-local",
        noteLabel: "로컬 데이터 기준",
        noteMessage: fallbackMessage,
        dashboard: fallbackDashboard,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [adminSupabaseOrganizationId, fallbackDashboard]);

  const dashboardData = supabaseDashboardState.dashboard || fallbackDashboard;
  const displayedTargetCount = dashboardData.targetCount ?? activeTargets.length;
  const displayedCheckerCount = dashboardData.checkerCount ?? users.filter((user) => user.role === "checker").length;
  const displayedTodayActivityCount = dashboardData.todayActivityCount ?? completedToday;
  const displayedRecentActivities = Array.isArray(dashboardData.recentActivities) && dashboardData.recentActivities.length
    ? dashboardData.recentActivities
    : fallbackDashboard.recentActivities;
  const displayedRecentEmergencies = Array.isArray(dashboardData.recentEmergencies) && dashboardData.recentEmergencies.length
    ? dashboardData.recentEmergencies
    : fallbackDashboard.recentEmergencies;
  const displayedEmergencyCount = dashboardData.emergencyCount ?? emergencyReports.length;
  const displayedUnresolvedEmergencyCount = dashboardData.unresolvedEmergencyCount ?? unresolvedReports.length;

  return (
    <>
      <PageHeader eyebrow="관리자 대시보드" title="운영 현황" description="오늘 운영에 문제가 있는지 먼저 확인합니다." />

      <div className="admin-dashboard-source-note">
        {supabaseDashboardState.loading ? (
          <span className="muted">Supabase 관리자 대시보드 요약을 확인 중입니다.</span>
        ) : (
          <>
            <span className={`badge ${supabaseDashboardState.noteClassName}`}>{supabaseDashboardState.noteLabel}</span>
            <span className="muted">{supabaseDashboardState.noteMessage}</span>
          </>
        )}
      </div>

      <div className="admin-dashboard-layout admin-dashboard-shell">
        <div className="statistics-grid admin-dashboard-kpi-grid">
          <StatCard label="전체 대상자" value={`${displayedTargetCount}명`} tone="blue" helper="운영 중 대상자 기준" />
          <StatCard label="오늘 확인" value={`${displayedTodayActivityCount}건`} tone="green" helper={`예정 ${todayScheduled}건`} />
          <StatCard label="미처리 이상징후" value={`${displayedUnresolvedEmergencyCount}건`} tone="orange" helper={`긴급 ${urgentReports.length}건`} />
          <StatCard label="재배정 필요" value={`${reassignmentNeededTargets.length}명`} tone="red" helper="담당 체커 상태 기준" />
        </div>

        <div className="admin-dashboard-columns">
          <div className="admin-dashboard-column">
            <DonutSummaryCard title="위험도 분포" description="운영 중 대상자의 위험도를 한눈에 확인합니다." rows={riskRows} unit="명" />
            <ChartCard title="확인 유형별 현황" description="외부 확인, 전화 확인, 방문 확인, 집중 모니터링 비중입니다." rows={activityTypeRows} />
            <section className="section-block admin-dashboard-panel admin-dashboard-support-card">
              <SectionTitle title="이번 주 확인 계획" description="요일별 계획과 우선 위험도를 함께 확인합니다." />
              <div className="week-strip">
                {weekPlan.map((item) => (
                  <button
                    className={`week-day-button ${selectedPlanDay === item.day ? "week-day-button-selected" : ""}`}
                    key={item.day}
                    type="button"
                    onClick={() => setSelectedPlanDay(item.day)}
                  >
                    <strong>{item.day}</strong>
                    <span>{item.targets.length}명</span>
                  </button>
                ))}
              </div>
              <div className="stack compact-stack">
                {sortedSelectedPlanTargets.length ? (
                  sortedSelectedPlanTargets.map((target) => (
                    <Card key={target.id} className={`admin-dashboard-target-card risk-card-${target.riskLevel}`}>
                      <div className="admin-dashboard-card-head">
                        <div className="admin-dashboard-card-copy">
                          <strong>{target.name}</strong>
                          <p className="muted">
                            {checkerName(users, target.assignedCheckerId)} · {checkTypeLabels[getTargetCheckType(target)]}
                          </p>
                        </div>
                        <StatusBadge type="risk" value={target.riskLevel} />
                      </div>
                    </Card>
                  ))
                ) : (
                  <EmptyState title={`${selectedPlan.day}요일 확인 계획 없음`} description="해당 요일에 등록된 확인 대상자가 없습니다." />
                )}
              </div>
            </section>
          </div>

          <div className="admin-dashboard-column">
            <MiniTrendChart
              title="최근 7일 확인 활동 추이"
              description={recentActivityTotal ? "최근 일주일간 확인 기록 건수입니다." : "시연용 샘플 추이로 표시하고 있습니다."}
              rows={recentActivityRows}
            />
            <EmergencyStatusOverview
              title="이상징후 처리 현황"
              description="접수부터 완료까지의 처리 상태를 요약합니다."
              rows={emergencyStatusRows}
              total={displayedEmergencyCount}
              unresolvedCount={displayedUnresolvedEmergencyCount}
            />
            <section className="section-block admin-dashboard-panel admin-dashboard-support-card">
              <SectionTitle title="최근 이상징후" action={<Button variant="ghost" onClick={() => navigate("/admin/emergencies")}>전체 보기</Button>} />
              <div className="stack">
                {displayedRecentEmergencies.length ? (
                  displayedRecentEmergencies.map((report) => (
                    <Card key={report.id} className={report.severity === "urgent" ? "danger-card" : "alert-card"}>
                      <div className="card-row">
                        <div>
                          <strong>{report.targetName || targetName(targets, report.targetId)}</strong>
                          <p className="muted">{formatDashboardDate(report.reportedAt || report.date)} · {report.title || report.issueType}</p>
                        </div>
                        <div className="badge-row compact-badges">
                          <span className="badge badge-info">{report.severityLabel || report.severity || "일반"}</span>
                          <EmergencyStatusBadge status={report.status} />
                        </div>
                      </div>
                      <p className="muted">{truncateText(report.title || report.issueType || "이상징후 보고")}</p>
                      <div className="dashboard-card-actions">
                        <Button variant="ghost" className="dashboard-small-button" onClick={() => navigate(`/admin/emergencies/${report.id}`)}>
                          상세보기
                        </Button>
                      </div>
                    </Card>
                  ))
                ) : (
                  <EmptyState title="긴급 알림 없음" description="새 보고가 등록되면 이 영역에 표시됩니다." />
                )}
              </div>
            </section>
          </div>

          <div className="admin-dashboard-column">
            <section className="section-block admin-dashboard-panel admin-dashboard-list-card">
              <SectionTitle title="우선 확인 대상자" description="위험도와 미처리 이상징후를 기준으로 우선순위를 정리했습니다." />
              <div className="stack compact-stack">
                {priorityTargets.length ? (
                  priorityTargets.map((target) => {
                    const hasUrgentReport = urgentTargetIds.has(target.id);
                    const hasUnresolvedReport = unresolvedTargetIds.has(target.id);
                    const needsReassignment = reassignmentTargetIds.has(target.id);
                    return (
                      <Card key={target.id} className={`admin-dashboard-target-card risk-card-${target.riskLevel}`}>
                        <div className="admin-dashboard-card-head">
                          <div className="admin-dashboard-card-copy">
                            <strong>{target.name}</strong>
                            <p className="muted">
                              {checkerName(users, target.assignedCheckerId)} · {checkTypeLabels[getTargetCheckType(target)]}
                            </p>
                          </div>
                          <div className="admin-dashboard-card-badges">
                            {hasUrgentReport ? <StatusBadge type="issueLevel" value="urgent" /> : null}
                            {!hasUrgentReport && hasUnresolvedReport ? <StatusBadge type="issueLevel" value="need_check" /> : null}
                            {needsReassignment ? <span className="badge badge-warning">재배정 검토</span> : null}
                            <StatusBadge type="risk" value={target.riskLevel} />
                          </div>
                        </div>
                        <p className="admin-dashboard-card-description">
                          {hasUrgentReport
                            ? "긴급 확인이 필요한 이상징후가 접수되었습니다."
                            : needsReassignment
                              ? "담당 체커 상태를 확인하고 재배정을 검토해야 합니다."
                              : hasUnresolvedReport
                                ? "미처리 이상징후가 있어 확인이 필요합니다."
                                : "위험도 기준 우선 확인 대상자입니다."}
                        </p>
                        <div className="dashboard-card-actions">
                          <Button variant="ghost" className="dashboard-small-button" onClick={() => navigate(`/admin/targets/${target.id}`)}>
                            상세보기
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <EmptyState title="우선 확인 대상자 없음" description="현재 위험 대상자 또는 미처리 이상징후 대상자가 없습니다." />
                )}
              </div>
            </section>

            <section className="section-block admin-dashboard-panel admin-dashboard-list-card">
              <SectionTitle
                title="재배정 필요 대상자"
                description="담당 체커 미배정 또는 체커 상태 변경으로 재배정 검토가 필요한 대상자입니다."
                action={<Button variant="ghost" onClick={() => navigate("/admin/targets")}>대상자 보기</Button>}
              />
              <Card className="admin-dashboard-reassignment-card">
                <div className="admin-dashboard-reassignment-head">
                  <strong>{reassignmentNeededTargets.length}명</strong>
                  <span>담당 체커 상태 기준</span>
                </div>
                <div className="stack compact-stack">
                  {reassignmentNeededTargets.length ? (
                    reassignmentNeededTargets.slice(0, 4).map((target) => {
                      const assignedChecker = checkerById(users, target.assignedCheckerId);
                      const checkerAlert = getTargetCheckerAlert(assignedChecker);
                      return (
                        <div className="admin-dashboard-reassignment-item" key={target.id}>
                          <div>
                            <strong>{target.name}</strong>
                            <p className="muted">
                              {checkerName(users, target.assignedCheckerId)} · {getTargetArea(target)}
                            </p>
                          </div>
                          {checkerAlert ? <span className={`badge badge-${checkerAlert.tone}`}>{checkerAlert.message}</span> : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="muted">현재 재배정이 필요한 대상자가 없습니다.</p>
                  )}
                </div>
              </Card>
            </section>

            <section className="section-block admin-dashboard-panel admin-dashboard-support-card">
              <SectionTitle title="최근 확인 기록" />
              <div className="stack">
                {displayedRecentActivities.map((record) => (
                  <Card key={record.id}>
                    <div className="card-row">
                      <div>
                        <strong>{record.targetName || targetName(targets, record.targetId)}</strong>
                        <p className="muted">
                          {formatDashboardDate(record.checkedAt || record.date)} · {record.checkerName || checkerName(users, record.checkerId)} · {record.checkTypeLabel || activityTypeLabels[getCheckType(record)]}
                        </p>
                      </div>
                      <span className="badge badge-muted">{record.resultStatusLabel || record.status || "상태 없음"}</span>
                    </div>
                    <p className="muted">{truncateText(record.resultStatusLabel || record.memo || "최근 확인 기록")}</p>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
export function AdminCheckers({ data, actions, currentUser, navigate }) {
  const [filter, setFilter] = useState("all");
  const currentOrganizationId = currentUser?.organizationId || "";
  const pendingSignupRequests = (data.signupRequests || []).filter(
    (request) => {
      const requestStatus = request.status || "pending";

      return (
        request.role === "checker" &&
        requestStatus === "pending" &&
        request.organizationId &&
        request.organizationId === currentOrganizationId
      );
    }
  );
  const checkers = data.users.filter((user) => user.role === "checker");
  const checkerSummaries = checkers
    .map((checker) => {
      const assignedCount = data.targets.filter((target) => target.assignedCheckerId === checker.id).length;
      const pendingCount = countPending(data.activityRecords, checker.id);
      const emergencyCount = data.emergencyReports.filter(
        (report) => report.checkerId === checker.id && !isEmergencyCompleted(report.status)
      ).length;
      const status = getCheckerStatus(checker, data);

      return {
        ...checker,
        assignedCount,
        completedCount: countCompleted(data.activityRecords, checker.id),
        pendingCount,
        emergencyCount,
        status,
      };
    })
    .sort((a, b) => {
      const supportDiff = Number(b.status === "needs_attention") - Number(a.status === "needs_attention");
      if (supportDiff) return supportDiff;
      const pendingDiff = b.pendingCount - a.pendingCount;
      if (pendingDiff) return pendingDiff;
      const completedDiff = a.completedCount - b.completedCount;
      if (completedDiff) return completedDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });
  const filteredCheckers = checkerSummaries.filter((checker) => {
    if (filter === "active") return checker.status === "active";
    if (filter === "needs_attention") return checker.status === "needs_attention";
    return true;
  });
  const activeCount = checkerSummaries.filter((checker) => checker.status === "active").length;
  const pendingCheckerCount = checkerSummaries.filter((checker) => checker.pendingCount > 0).length;
  const attentionCount = checkerSummaries.filter((checker) => checker.status === "needs_attention").length;

  return (
    <>
      <PageHeader
        eyebrow="체커 관리"
        title="체커 운영 지원"
        description="담당 대상자와 확인 기록 보완 필요 여부를 확인합니다."
        action={<Button onClick={() => navigate("/admin/checkers/new")}>체커 등록</Button>}
      />

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>체커 이용 신청</h2>
            <p className="muted">소속 기관별로 접수된 체커 신청을 확인하거나 반려합니다.</p>
          </div>
        </div>
        {pendingSignupRequests.length ? (
          <div className="stack compact-stack">
            {pendingSignupRequests.map((request) => (
              <Card key={request.id} className="checker-request-card">
                <div className="card-row checker-request-head">
                  <div>
                    <strong>{request.name}</strong>
                    <p className="muted">{request.loginId} · {request.phone}</p>
                  </div>
                  <span className="badge badge-info">승인 대기</span>
                </div>
                <div className="checker-request-meta">
                  <p><strong>소속 기관</strong> {request.organizationName}</p>
                  <p><strong>신청일</strong> {String(request.createdAt || "").slice(0, 10)}</p>
                  <p><strong>메모</strong> {request.memo || "메모 없음"}</p>
                </div>
                <div className="checker-request-actions">
                  <Button onClick={() => actions.approveSignupRequest(request.id)}>이용 승인</Button>
                  <Button variant="secondary" onClick={() => actions.rejectSignupRequest(request.id)}>반려</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="현재 기관으로 접수된 대기 신청이 없습니다."
            description="다른 기관으로 신청한 체커는 이 화면에 표시되지 않습니다."
          />
        )}
      </section>

      <Card className="summary-card">
        <p className="eyebrow">체커 현황</p>
        <strong>전체 {checkers.length}명 · 오늘 확인 진행 {activeCount}명</strong>
        <span>기록 보완 필요 {pendingCheckerCount}명 · 지원 필요 {attentionCount}명</span>
      </Card>

      <div className="filter-tabs compact-filter-tabs" aria-label="체커 필터">
        {[
          { value: "all", label: "전체" },
          { value: "active", label: "정상" },
          { value: "needs_attention", label: "지원 필요" },
        ].map((item) => (
          <button
            className={filter === item.value ? "filter-tab-active" : ""}
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-checker-grid">
        {filteredCheckers.map((checker) => (
          <Card key={checker.id} className="admin-checker-card">
            <div className="card-row">
              <div>
                <strong>{checker.name}</strong>
                <p className="muted">
                  {getCheckerPhoneValue(checker) || "연락처 없음"}
                  {" · "}
                  {getCheckerAreaValue(checker) || "담당 지역 없음"}
                </p>
              </div>
              {renderCheckerStatusBadge(checker.status)}
            </div>
            <div className="admin-checker-metrics">
              <div><span>담당 대상자</span><strong>{checker.assignedCount}명</strong></div>
              <div><span>오늘 확인 완료</span><strong>{checker.completedCount}건</strong></div>
              <div><span>기록 보완 필요</span><strong>{checker.pendingCount}건</strong></div>
              <div><span>이상징후 보고 관련</span><strong>{checker.emergencyCount ? `${checker.emergencyCount}건` : "없음"}</strong></div>
            </div>
            <Button
              variant="ghost"
              className="full-width admin-checker-detail-button"
              onClick={() => navigate(`/admin/checkers/${checker.id}`)}
            >
              상세 정보
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

export function AdminCheckerNew({ data, actions, navigate }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    phone: "",
    region: "",
    activityStatus: "active",
  });
  const [error, setError] = useState("");

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedUsername = form.username.trim();
    const trimmedPassword = form.password;
    const trimmedPhone = form.phone.trim();
    const trimmedRegion = form.region.trim();
    const normalizedUsername = trimmedUsername.toLowerCase();

    if (!trimmedName || !trimmedUsername || !trimmedPassword) {
      setError("이름, 로그인 아이디, 비밀번호는 필수 입력입니다.");
      return;
    }

    const existingUser = (Array.isArray(data.users) ? data.users : []).some((user) => {
      const userLoginId = String(user.username || user.loginId || user.id || "").trim().toLowerCase();
      return userLoginId === normalizedUsername;
    });

    if (existingUser) {
      setError("이미 사용 중인 로그인 아이디입니다.");
      return;
    }

    const timestamp = new Date().toISOString();
    const newChecker = {
      id: `checker-${Date.now()}`,
      role: "checker",
      type: "checker",
      username: trimmedUsername,
      loginId: trimmedUsername,
      password: trimmedPassword,
      name: trimmedName,
      phone: trimmedPhone,
      phoneNumber: trimmedPhone,
      region: trimmedRegion,
      area: trimmedRegion,
      status: form.activityStatus,
      activityStatus: form.activityStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    actions.addUser(newChecker);
    navigate("/admin/checkers");
  }

  return (
    <>
      <PageHeader
        eyebrow="체커 등록"
        title="신규 체커 등록"
        description="기관에서 사용할 체커 계정을 등록합니다."
      />

      <form className="form-stack" onSubmit={handleSubmit}>
        <Card>
          <TextInput
            id="checker-new-name"
            label="이름"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="체커 이름"
          />
          <TextInput
            id="checker-new-username"
            label="로그인 아이디"
            value={form.username}
            onChange={(event) => updateForm("username", event.target.value)}
            placeholder="예: checker02"
          />
          <TextInput
            id="checker-new-password"
            label="비밀번호"
            type="password"
            value={form.password}
            onChange={(event) => updateForm("password", event.target.value)}
            placeholder="비밀번호 입력"
          />
          <TextInput
            id="checker-new-phone"
            label="연락처"
            value={form.phone}
            onChange={(event) => updateForm("phone", event.target.value)}
            placeholder="010-0000-0000"
          />
          <TextInput
            id="checker-new-region"
            label="담당 지역"
            value={form.region}
            onChange={(event) => updateForm("region", event.target.value)}
            placeholder="예: 은평구 갈현동"
          />
          <SelectInput
            id="checker-new-status"
            label="활동 상태"
            value={form.activityStatus}
            onChange={(event) => updateForm("activityStatus", event.target.value)}
          >
            <option value="active">활동중</option>
            <option value="paused">일시중지</option>
            <option value="left">활동종료</option>
          </SelectInput>
        </Card>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="action-grid">
          <Button type="submit">저장</Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/admin/checkers")}>
            취소
          </Button>
        </div>
      </form>
    </>
  );
}

export function AdminCheckerDetail({ checkerId, data, actions, navigate }) {
  const [draftAssignments, setDraftAssignments] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");
  const checker = data.users.find((user) => user.role === "checker" && user.id === checkerId);

  const assignedTargetIds = useMemo(
    () => data.targets.filter((target) => target.assignedCheckerId === checkerId).map((target) => target.id),
    [data.targets, checkerId]
  );

  const checkerSummary = useMemo(() => {
    if (!checker) return null;

    return {
      ...checker,
      assignedCount: assignedTargetIds.length,
      completedCount: countCompleted(data.activityRecords, checker.id),
      pendingCount: countPending(data.activityRecords, checker.id),
      emergencyCount: data.emergencyReports.filter(
        (report) => report.checkerId === checker.id && !isEmergencyCompleted(report.status)
      ).length,
      status: getCheckerStatus(checker, data),
    };
  }, [assignedTargetIds.length, checker, data]);

  const sortedTargets = useMemo(() => [...data.targets].sort(sortTargetsForAdmin), [data.targets]);
  const unassignedCount = data.targets.filter((target) => !target.assignedCheckerId).length;

  const assignedSignature = assignedTargetIds.slice().sort().join("|");
  const draftSignature = draftAssignments.slice().sort().join("|");
  const hasUnsavedChanges = assignedSignature !== draftSignature;

  useEffect(() => {
    setDraftAssignments(assignedTargetIds);
  }, [assignedSignature]);

  function toggleTargetAssignment(targetId) {
    setDraftAssignments((current) => {
      const exists = current.includes(targetId);
      return exists ? current.filter((id) => id !== targetId) : [...current, targetId];
    });
  }

  function handleAssignmentCancel() {
    setDraftAssignments(assignedTargetIds);
    setSaveMessage("");
  }

  function handleAssignmentSave() {
    actions.updateCheckerAssignments(checkerId, draftAssignments);
    setSaveMessage("담당 대상자 배정이 저장되었습니다.");
    window.setTimeout(() => {
      setSaveMessage("");
    }, 2400);
  }

  if (!checker || !checkerSummary) {
    return (
      <div className="center-panel">
        <EmptyState title="체커 정보를 찾을 수 없습니다." description="목록으로 돌아가 다시 확인해주세요." />
        <Button onClick={() => navigate("/admin/checkers")}>목록으로 이동</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="체커 상세"
        title={checkerSummary.name}
        description="체커 운영 현황과 담당 대상자 배정을 확인합니다."
        action={
          <div className="page-header-actions">
            <Button variant="ghost" onClick={() => navigate(`/admin/checkers/${checkerSummary.id}/edit`)}>
              정보 수정
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin/checkers")}>
              목록으로 이동
            </Button>
          </div>
        }
      />

      <Card className="admin-checker-detail-card">
        <div className="card-row admin-checker-detail-head">
          <div>
            <strong>{checkerSummary.name}</strong>
            <p className="muted">
              {getCheckerPhoneValue(checkerSummary) || "연락처 없음"}
              {" · "}
              {getCheckerAreaValue(checkerSummary) || "담당 지역 없음"}
            </p>
          </div>
          {renderCheckerStatusBadge(checkerSummary.status)}
        </div>
        <div className="admin-checker-detail-metrics">
          <div><span>담당 대상자 수</span><strong>{checkerSummary.assignedCount}명</strong></div>
          <div><span>오늘 확인 완료</span><strong>{checkerSummary.completedCount}건</strong></div>
          <div><span>기록 보완 필요</span><strong>{checkerSummary.pendingCount}건</strong></div>
          <div><span>이상징후 보고 관련</span><strong>{checkerSummary.emergencyCount ? `${checkerSummary.emergencyCount}건` : "없음"}</strong></div>
        </div>
      </Card>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>담당 대상자 배정</h2>
            <p className="muted">현재 체커에게 배정된 대상자와 미배정 대상을 함께 확인합니다.</p>
          </div>
        </div>

        <Card className="checker-assignment-section admin-checker-assignment-card">
          <div className="checker-assignment-summary">
            <strong>배정 현황</strong>
            <span>현재 배정 {assignedTargetIds.length}명 · 미배정 {unassignedCount}명</span>
          </div>

          <div className="checker-assignment-list">
            {sortedTargets.map((target) => {
              const isChecked = draftAssignments.includes(target.id);
              const assignedToOther = target.assignedCheckerId && target.assignedCheckerId !== checkerId;
              const assignedChecker = assignedToOther ? checkerById(data.users, target.assignedCheckerId) : null;

              return (
                <label
                  key={target.id}
                  className={`checker-assignment-item ${assignedToOther ? "checker-assignment-item-disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={Boolean(assignedToOther)}
                    onChange={() => toggleTargetAssignment(target.id)}
                  />
                  <div className="checker-assignment-copy">
                    <div className="checker-assignment-title">
                      <strong>{target.name}</strong>
                      <StatusBadge type="risk" value={target.riskLevel} />
                    </div>
                    <p>{getTargetArea(target)}</p>
                    <div className="badge-row compact-badges">
                      <StatusBadge type="checkType" value={getTargetCheckType(target)} />
                      {assignedToOther ? (
                        <span className="badge badge-muted">{`${assignedChecker?.name || "다른 체커"} 배정중`}</span>
                      ) : isChecked ? (
                        <span className="badge badge-info">현재 이 체커에게 배정됨</span>
                      ) : (
                        <span className="badge badge-muted">미배정</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="checker-assignment-feedback">
  {saveMessage ? (
    <div className="admin-checker-save-notice">
      {saveMessage}
    </div>
  ) : null}

  {hasUnsavedChanges ? (
    <p className="admin-checker-unsaved-text">
      저장되지 않은 변경사항이 있습니다.
    </p>
  ) : null}
</div>
          <div className="checker-assignment-actions">
          <Button onClick={handleAssignmentSave}>
  {saveMessage ? "저장 완료" : "배정 저장"}
</Button>
            <Button variant="secondary" onClick={handleAssignmentCancel}>변경 취소</Button>
          </div>
        </Card>
      </section>
    </>
  );
}

export function AdminCheckerEdit({ checkerId, data, actions, navigate }) {
  const checker = data.users.find((item) => item.id === checkerId && item.role === "checker");
  const [form, setForm] = useState(() => ({
    name: checker?.name || "",
    phone: getCheckerPhoneValue(checker),
    area: getCheckerAreaValue(checker),
    status: checker?.status || "active",
  }));
  const [error, setError] = useState("");

  if (!checker) {
    return (
      <>
        <PageHeader
          eyebrow="체커 수정"
          title="체커를 찾을 수 없습니다"
          description="체커 목록으로 돌아가 다시 선택해주세요."
        />
        <Button onClick={() => navigate("/admin/checkers")}>목록으로 돌아가기</Button>
      </>
    );
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedArea = form.area.trim();

    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!trimmedPhone) {
      setError("연락처를 입력해주세요.");
      return;
    }

    if (!trimmedArea) {
      setError("담당 지역을 입력해주세요.");
      return;
    }

    actions.updateUser(checker.id, {
      name: trimmedName,
      phone: trimmedPhone,
      area: trimmedArea,
      status: form.status,
    });

    navigate(`/admin/checkers/${checker.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="체커 수정"
        title={`${checker.name} 정보 수정`}
        description="체커 정보 수정 화면입니다. 다음 단계에서 입력 폼을 연결합니다."
        action={
          <Button variant="ghost" onClick={() => navigate(`/admin/checkers/${checker.id}`)}>
            상세로 돌아가기
          </Button>
        }
      />

      <form className="form-stack" onSubmit={handleSubmit}>
        <Card>
          <TextInput
            id="checker-edit-name"
            label="이름"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="체커 이름"
          />
          <TextInput
            id="checker-edit-phone"
            label="연락처"
            value={form.phone}
            onChange={(event) => updateForm("phone", event.target.value)}
            placeholder="010-0000-0000"
          />
          <TextInput
            id="checker-edit-area"
            label="담당 지역"
            value={form.area}
            onChange={(event) => updateForm("area", event.target.value)}
            placeholder="예: 은평구 갈현동"
          />
          <SelectInput
            id="checker-edit-status"
            label="활동 상태"
            value={form.status}
            onChange={(event) => updateForm("status", event.target.value)}
          >
            <option value="active">활동중</option>
            <option value="paused">일시중지</option>
            <option value="left">활동종료</option>
          </SelectInput>
        </Card>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="action-grid">
          <Button type="submit">저장</Button>
          <Button variant="secondary" onClick={() => navigate(`/admin/checkers/${checker.id}`)}>
            취소
          </Button>
        </div>
      </form>
    </>
  );
}

export function AdminTargets({ data, navigate }) {
  const [filter, setFilter] = useState("all");
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const activeTargets = targets.filter(isActiveLifecycleTarget);
  const reassignmentNeededTargets = activeTargets.filter((target) => isReassignmentNeededTarget(target, users));

const filteredTargets = targets
  .filter((target) => {
    const targetIsActive = isActiveLifecycleTarget(target);

    if (filter === "ended") {
      return !targetIsActive;
    }

    if (!targetIsActive) {
      return false;
    }

    if (filter === "all") return true;
    if (filter === "reassignment") {
      return isReassignmentNeededTarget(target, users);
    }
    if (filter === "today") {
  const todayLabel = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
  const checkDays = target.checkDays || target.checkDay || target.days || target.checkDayLabels || [];

  if (Array.isArray(checkDays)) {
    return checkDays.includes(todayLabel);
  }

  if (typeof checkDays === "string") {
    return checkDays.includes(todayLabel);
  }

  return false;
}
    return target.riskLevel === filter;
  })
  .sort(sortTargetsForAdmin);

  return (
    <>
      <PageHeader
        eyebrow="대상자 관리"
        title="대상자 현황"
        description="확인 유형, 위험도, 담당 체커를 확인합니다."
        action={<Button onClick={() => navigate("/admin/targets/new")}>대상자 등록</Button>}
      />

      <Card className="summary-card">
        <p className="eyebrow">대상자 현황</p>
        <strong>전체 {activeTargets.length}명 · 오늘 확인 {activeTargets.filter(isTodayScheduled).length}명</strong>
        <span>
          정상 {activeTargets.filter((target) => target.riskLevel === "normal").length}명 · 주의 {activeTargets.filter((target) => target.riskLevel === "caution").length}명 · 위험 {activeTargets.filter((target) => target.riskLevel === "danger").length}명
        </span>
      </Card>

      <div className="filter-tabs target-filter-tabs" aria-label="대상자 필터">
        {[
          { value: "all", label: "전체" },
          { value: "normal", label: "정상" },
          { value: "caution", label: "주의" },
          { value: "danger", label: "위험" },
          { value: "today", label: "오늘 확인" },
          { value: "reassignment", label: "재배정 필요" },
          { value: "ended", label: "관리종료" },
        ].map((item) => (
          <button
            className={filter === item.value ? "filter-tab-active" : ""}
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stack">
        {filteredTargets.length ? filteredTargets.map((target) => (
          <article className={`target-card admin-target-card risk-card-${target.riskLevel}`} key={target.id}>
            {(() => {
              const assignedChecker = checkerById(users, target.assignedCheckerId);
              const checkerAlert = getTargetCheckerAlert(assignedChecker);

              return checkerAlert ? (
                <div className={`admin-target-alert admin-target-alert-${checkerAlert.tone}`}>
                  <span className={`badge ${checkerAlert.tone === "danger" ? "badge-danger" : "badge-warning"} admin-target-reassignment-badge`}>재배정 필요</span>
                  <strong>{checkerAlert.message}</strong>
                </div>
              ) : null;
            })()}
            <div className="card-row">
              <div>
                <strong>{target.name}</strong>
                <p>{target.age}세 · {target.gender} · {getTargetArea(target)}</p>
              </div>
              <StatusBadge type="risk" value={target.riskLevel} />
            </div>
            <div className="admin-target-meta">
  <div className="admin-target-meta-item">
    <span>담당 체커</span>
    <strong>{target.assignedCheckerId ? checkerName(users, target.assignedCheckerId) : "담당 체커 미배정"}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>기본 확인 유형</span>
    <strong>{checkTypeLabels[getTargetCheckType(target)]}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>확인 요일</span>
    <strong>{target.checkDays?.join(", ") || "요일 미정"}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>최근 확인일</span>
    <strong>{target.lastVisitDate}</strong>
  </div>
</div>
            <Button
              variant="ghost"
              className="admin-target-detail-action"
              onClick={() => navigate(`/admin/targets/${target.id}`)}
              aria-label={`${target.name} 상세보기`}
            >
              상세보기
            </Button>
          </article>
        )) : (
          <EmptyState
            title={filter === "reassignment" ? "재배정이 필요한 대상자가 없습니다." : "조건에 맞는 대상자가 없습니다."}
            description={filter === "reassignment" ? "담당 체커 미배정 또는 체커 상태 변경 대상이 없습니다." : "필터를 변경해 다시 확인해주세요."}
          />
        )}
      </div>
    </>
  );
}
export function AdminTargetDetail({ targetId, data, actions, navigate }) {
  const target = targetById(data.targets, targetId);

  if (!target) {
    return <EmptyState title="대상자를 찾을 수 없습니다" description="대상자 관리 화면에서 다시 선택해주세요." />;
  }

  const checker = checkerById(data.users, target.assignedCheckerId);
  const checkerAlert = getTargetCheckerAlert(checker);
  const visits = data.activityRecords.filter((record) => record.targetId === target.id).sort(byLatestDate);
  const reports = data.emergencyReports.filter((report) => report.targetId === target.id).sort(byLatestDate);
  const confirmMessage = `${target.name}님을 관리 종료 처리할까요?`;

  return (
    <>
      <PageHeader
  eyebrow="대상자 상세"
  title={target.name}
  description={`${target.age}세 · ${target.gender} · ${target.address}`}
  action={
    <div className="page-header-actions">
      <Button variant="ghost" onClick={() => navigate(`/admin/targets/${target.id}/edit`)}>
        정보 수정
      </Button>
      {(target.lifecycleStatus || "active") !== "ended" ? (
        <Button
  variant="ghost"
  onClick={() => {
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    actions.updateTarget(target.id, {
      lifecycleStatus: "ended",
    });

    navigate("/admin/targets");
  }}
>
  {"\uAD00\uB9AC \uC885\uB8CC"}
</Button>
      ) : (
        <StatusBadge label={"\uAD00\uB9AC\uC885\uB8CC"} />
      )}
    </div>
  }
/>

      <Card>
        <h2>기본정보</h2>
        <InfoList
          items={[
            { label: "이름", value: target.name },
            { label: "연령/성별", value: `${target.age}세 · ${target.gender}` },
            { label: "주소", value: target.address },
            { label: "위험도", value: <StatusBadge type="risk" value={target.riskLevel} /> },
            { label: "최근 확인일", value: target.lastVisitDate },
            { label: "기본 확인 유형", value: checkTypeLabels[getTargetCheckType(target)] },
            { label: "확인 요일", value: target.checkDays?.join(", ") || "요일 미정" },
          ]}
        />
      </Card>

      <Card>
        <h2>담당 정보</h2>
        <InfoList
          items={[
            { label: "담당 체커", value: checker?.name ?? "미배정" },
            { label: "체커 연락처", value: checker?.phone ?? "연락처 없음" },
          ]}
        />
        {checkerAlert ? (
          <p className={`admin-target-detail-alert admin-target-detail-alert-${checkerAlert.tone}`}>
            {checkerAlert.tone === "warning"
              ? "담당 체커가 일시중지 상태입니다. 재배정 검토가 필요합니다."
              : "담당 체커가 활동종료 상태입니다. 재배정이 필요합니다."}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2>건강 및 주의사항</h2>
        <InfoList
          items={[
            { label: "건강상태", value: target.healthStatus },
            { label: "주의사항", value: target.cautionNote },
            { label: "복약 메모", value: target.medicationNote || "등록된 복약 메모 없음" },
          ]}
        />
      </Card>

      <Card>
        <h2>보호자 정보</h2>
        <InfoList
          items={[
            { label: "보호자 이름", value: target.guardianName },
            { label: "보호자 연락처", value: target.guardianPhone },
          ]}
        />
      </Card>

      <section className="section-block">
        <SectionTitle title="최근 확인 기록" />
        <div className="stack compact-stack">
          {visits.length ? (
            visits.slice(0, 5).map((record) => (
              <Card key={record.id} className="admin-target-recent-record-card">
                <div className="card-row">
                  <div>
                    <strong>{record.date}</strong>
                    <p className="muted">{checkerName(data.users, record.checkerId)} · {activityTypeLabels[getCheckType(record)]}</p>
                  </div>
                  <div className="badge-row compact-badges">
                    <StatusBadge type="health" value={record.healthStatus || 'good'} />
                    <StatusBadge type="record" value={record.status} />
                  </div>
                </div>
                <p className="muted">{truncateText(record.memo)}</p>
              </Card>
            ))
          ) : (
            <EmptyState title="확인 기록이 없습니다" description="기록이 등록되면 이 영역에 표시됩니다." />
          )}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="이상징후 보고" />
        <div className="stack compact-stack">
          {reports.length ? (
            reports.slice(0, 5).map((report) => (
              <Card
  key={report.id}
  className={`admin-target-emergency-report-card ${getIssueLevel(report) === 'urgent' ? 'danger-card' : 'alert-card'}`}
>
                <div className="card-row">
                  <div>
                    <strong>{report.issueType}</strong>
                    <p className="muted">{report.date}</p>
                  </div>
                  <div className="badge-row compact-badges">
                    <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
                    <EmergencyStatusBadge status={report.status} />
                  </div>
                </div>
                <p className="muted">{truncateText(report.description)}</p>
              </Card>
            ))
          ) : (
            <EmptyState title="이상징후 보고가 없습니다" description="보고가 등록되면 이 영역에 표시됩니다." />
          )}
        </div>
      </section>
    </>
  );
}
export function AdminActivities({ data }) {
  const [filter, setFilter] = useState("all");
  const [openRecordId, setOpenRecordId] = useState("");
  const today = getToday();
  const records = [...data.activityRecords].sort((a, b) => {
    const aTime = a?.date ? new Date(a.date).getTime() : 0;
    const bTime = b?.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });
  const filteredRecords = records.filter((record) => {
    if (filter === "issue") return record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent";
    if (filter === "pending") return record.status !== "completed";
    if (filter === "today") return record.date === today;
    return true;
  });

  return (
    <>
      <PageHeader eyebrow="확인 기록" title="확인 기록 조회" description="체커가 작성한 확인 기록을 검토합니다." />

      <Card className="summary-card">
        <p className="eyebrow">기록 현황</p>
        <strong>전체 {data.activityRecords.length}건 · 오늘 {data.activityRecords.filter((record) => record.date === today).length}건</strong>
        <span>이상징후 포함 {data.activityRecords.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length}건 · 미완료 {data.activityRecords.filter((record) => record.status !== "completed").length}건</span>
      </Card>

      <div className="filter-tabs activity-filter-tabs" aria-label="확인 기록 필터">
  {[
    { value: "all", label: "전체" },
    { value: "today", label: "오늘" },
    { value: "issue", label: "이상징후" },
    { value: "pending", label: "미완료" },
  ].map((item) => (
    <button
      className={filter === item.value ? "filter-tab-active" : ""}
      key={item.value}
      type="button"
      onClick={() => setFilter(item.value)}
    >
      {item.label}
    </button>
  ))}
</div>

      <div className="stack admin-activity-list">
        {filteredRecords.map((record) => (
          <Card key={record.id} className="admin-activity-card">
          <div className="admin-activity-primary">
            <strong>{targetName(data.targets, record.targetId)}</strong>
            <p className="muted">
              {record.date || "날짜 정보 없음"} · {checkerName(data.users, record.checkerId)} · {activityTypeLabels[getCheckType(record)]}
            </p>
          </div>
        
          <p className="muted admin-activity-memo">
            {truncateText(record.memo)}
          </p>
        
          <div className="badge-row compact-badges admin-activity-badges">
            <StatusBadge type="health" value={record.healthStatus || "good"} />
            <span className={record.hasIssue || record.issueLevel !== "none" ? "badge badge-risk-danger" : "badge badge-muted"}>
              {record.hasIssue || record.issueLevel !== "none" ? "이상징후 있음" : "이상징후 없음"}
            </span>
            <StatusBadge type="record" value={record.status} />
          </div>
        
          <Button
            variant="ghost"
            className="admin-activity-inline-button"
            onClick={() => setOpenRecordId(openRecordId === record.id ? "" : record.id)}
          >
            상세보기
          </Button>
        
          {openRecordId === record.id ? (
            <div className="detail-box admin-activity-detail-box">
              <p>체커: {checkerName(data.users, record.checkerId)}</p>
              <p>체크 유형: {activityTypeLabels[getCheckType(record)]}</p>
              <p>메모: {record.memo || "메모 없음"}</p>
              {record.issueSummary ? <p className="danger-text">{record.issueSummary}</p> : null}
            </div>
          ) : null}
        </Card>
        ))}
      </div>
    </>
  );
}
export function AdminEmergencies({ data, navigate }) {
  const [filter, setFilter] = useState("all");
  const reports = [...data.emergencyReports].sort((a, b) => {
    const urgentDiff = Number(getIssueLevel(b) === "urgent") - Number(getIssueLevel(a) === "urgent");
    if (urgentDiff) return urgentDiff;
    const receivedDiff = Number(getEmergencyStatusValue(a.status) === "received") - Number(getEmergencyStatusValue(b.status) === "received");
    if (receivedDiff) return receivedDiff;
    const progressDiff = Number(getEmergencyStatusValue(a.status) === "checking") - Number(getEmergencyStatusValue(b.status) === "checking");
    if (progressDiff) return progressDiff;
    return byLatestDate(a, b);
  });
  const filteredReports = reports.filter((report) => {
    if (filter === "high") return report.urgency === "high";
    if (filter === "received") return getEmergencyStatusValue(report.status) === "received";
    if (filter === "in_progress") return ["checking", "contacted", "visiting"].includes(getEmergencyStatusValue(report.status));
    if (filter === "completed") return isEmergencyCompleted(report.status);
    return !isEmergencyCompleted(report.status);
  });
  const urgentCount = reports.filter((report) => report.urgency === "high").length;
  const unresolvedCount = reports.filter((report) => !isEmergencyCompleted(report.status)).length;

  return (
    <>
      <PageHeader eyebrow="이상징후 관리" title="이상징후 보고 현황" description="긴급 확인이 필요한 보고부터 우선 확인합니다." />

      <Card className="summary-card">
        <p className="eyebrow">우선 확인 필요</p>
        <strong>긴급 확인 필요 {urgentCount}건 · 미처리 {unresolvedCount}건</strong>
      </Card>

      <div className="filter-tabs emergency-filter-tabs" aria-label="이상징후 보고 필터">
        {[
          { value: "all", label: "전체" },
          { value: "received", label: "미처리" },
          { value: "in_progress", label: "처리중" },
          { value: "completed", label: "완료" },
          { value: "high", label: "긴급 확인" },
        ].map((item) => (
          <button
            className={filter === item.value ? "filter-tab-active" : ""}
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stack">
        {filteredReports.length ? filteredReports.map((report) => (
          <Card
  key={report.id}
  className={`admin-emergency-list-card ${report.urgency === 'high' ? 'danger-card' : 'alert-card'}`}
>
  <div className="admin-emergency-list-head">
    <div className="admin-emergency-list-copy">
      <strong>{targetName(data.targets, report.targetId)}</strong>
      <p className="muted">{report.date} · {report.issueType}</p>
    </div>

    <div className="admin-emergency-list-badges">
      <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
                    <EmergencyStatusBadge status={report.status} />
    </div>
  </div>

  <p className="admin-emergency-list-description">
    {truncateText(report.description)}
  </p>

  <Button
    variant="ghost"
    className="admin-emergency-detail-button"
    onClick={() => navigate(`/admin/emergencies/${report.id}`)}
  >
    상세보기
  </Button>
</Card>
        )) : (
          <EmptyState title="표시할 이상징후가 없습니다" description="선택한 상태에 맞는 보고가 없습니다." />
        )}
      </div>
    </>
  );
}
export function AdminEmergencyDetail({ emergencyId, data, actions, currentUser, navigate }) {
  const report = data.emergencyReports.find((item) => item.id === emergencyId);
  const handlingLogs = [...(Array.isArray(report?.handlingLogs) ? report.handlingLogs : [])].sort(
    (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    status: getEmergencyStatusValue(report?.status),
    memo: "",
    contactedGuardian: false,
    visitRequired: false,
  }));

  if (!report) {
    return <EmptyState title="이상징후 보고를 찾을 수 없습니다" description="보고 목록에서 다시 선택해주세요." />;
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function handleSave() {
    if (!form.status) {
      setError("처리 상태를 선택해주세요.");
      return;
    }

    if (!form.memo.trim()) {
      setError("처리 메모를 입력해주세요.");
      return;
    }

    const statusMeta = getEmergencyStatusMeta(form.status);
    const nextLog = {
      id: `log-${Date.now()}`,
      status: statusMeta.value,
      statusLabel: statusMeta.label,
      memo: form.memo.trim(),
      contactedGuardian: form.contactedGuardian,
      visitRequired: form.visitRequired,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || "관리자",
    };

    actions.addEmergencyHandlingLog(report.id, nextLog);
    setForm({
      status: statusMeta.value,
      memo: "",
      contactedGuardian: false,
      visitRequired: false,
    });
    setNotice("처리 기록이 저장되었습니다.");
    setError("");
  }

  return (
    <>
      <PageHeader
        eyebrow="이상징후 상세"
        title={targetName(data.targets, report.targetId)}
        description={`${report.date} · ${report.issueType}`}
        action={<StatusBadge type="issueLevel" value={getIssueLevel(report)} />}
      />

      <Card className="admin-emergency-detail-info-card">
  <div className="admin-emergency-meta">
    <div className="admin-emergency-meta-item">
      <span>대상자</span>
      <strong>{targetName(data.targets, report.targetId)}</strong>
    </div>

    <div className="admin-emergency-meta-item">
      <span>체커</span>
      <strong>{checkerName(data.users, report.checkerId)}</strong>
    </div>

    <div className="admin-emergency-meta-item">
      <span>연락처</span>
      <strong>{checkerPhone(data.users, report.checkerId)}</strong>
    </div>
  </div>

  <div className="admin-emergency-status-row">
    <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
    <EmergencyStatusBadge status={report.status} />
  </div>
</Card>

      <Card>
        <h2>상세 내용</h2>
        <p>{report.description}</p>
      </Card>

      <Card className="emergency-handling-form">
        <h2>처리 기록 추가</h2>
        <SelectInput id="admin-emergency-status" label="처리 상태" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
          <option value="received">접수됨</option>
          <option value="checking">확인중</option>
          <option value="contacted">보호자 연락</option>
          <option value="visiting">방문 필요</option>
          <option value="completed">완료</option>
        </SelectInput>
        <TextArea
          id="admin-emergency-handling-memo"
          label="처리 메모"
          rows="4"
          value={form.memo}
          onChange={(event) => updateForm('memo', event.target.value)}
          placeholder="보호자 연락 완료, 추가 확인 예정 등"
        />
        <div className="emergency-handling-options">
          <CheckboxField label="보호자 연락 여부" checked={form.contactedGuardian} onChange={(value) => updateForm("contactedGuardian", value)} />
          <CheckboxField label="방문 필요 여부" checked={form.visitRequired} onChange={(value) => updateForm("visitRequired", value)} />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        <Button className="full-width" onClick={handleSave}>
          처리 기록 저장
        </Button>
        <Button variant="ghost" className="full-width" onClick={() => navigate('/admin/emergencies')}>
          목록으로 이동
        </Button>
      </Card>

      <Card>
        <h2>처리 이력</h2>
        <div className="emergency-handling-log-list">
          {handlingLogs.length ? (
            handlingLogs.map((log) => (
              <div className="emergency-handling-log-item" key={log.id}>
                <div className="card-row">
                  <div>
                    <strong>{log.statusLabel || getEmergencyStatusMeta(log.status).label}</strong>
                    <p className="muted">{String(log.createdAt || "").replace("T", " ").slice(0, 16)} · {log.createdBy || "관리자"}</p>
                  </div>
                  <EmergencyStatusBadge status={log.status} />
                </div>
                <p>{log.memo || "메모 없음"}</p>
                <div className="badge-row compact-badges">
                  <span className={`badge ${log.contactedGuardian ? "badge-info" : "badge-muted"}`}>
                    {log.contactedGuardian ? "보호자 연락함" : "보호자 연락 없음"}
                  </span>
                  <span className={`badge ${log.visitRequired ? "badge-warning" : "badge-muted"}`}>
                    {log.visitRequired ? "방문 필요" : "방문 불필요"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="아직 등록된 처리 이력이 없습니다." description="처리 기록을 저장하면 이곳에 표시됩니다." />
          )}
        </div>
      </Card>
    </>
  );
}
function ChartCard({ title, description, rows, unit = "건" }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card className="chart-card admin-dashboard-chart-card">
      <SectionTitle title={title} description={description} />
      <div className="chart-list">
        {rows.map((row) => (
          <div className="chart-row admin-dashboard-bar-row" key={row.label}>
            <div className="bar-row">
              <span>{row.label}</span>
              <strong>{row.value}{unit}</strong>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${row.tone ? `bar-${row.tone}` : ""}`} style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
            <small>{total ? Math.round((row.value / total) * 100) : 0}%</small>
          </div>
        ))}
      </div>
    </Card>
  );
}
function DonutSummaryCard({ title, description, rows, unit = "건" }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const safeTotal = total || 1;
  let accumulated = 0;
  const gradientStops = rows.map((row) => {
    const start = accumulated;
    accumulated += (row.value / safeTotal) * 100;
    const toneColor = row.tone === "green"
      ? "var(--green)"
      : row.tone === "orange"
        ? "var(--orange)"
        : row.tone === "red"
          ? "var(--red)"
          : "var(--primary)";
    return `${toneColor} ${start}% ${accumulated}%`;
  });
  const donutBackground = total
    ? `conic-gradient(${gradientStops.join(", ")})`
    : "conic-gradient(var(--line) 0% 100%)";

  return (
    <Card className="chart-card admin-dashboard-chart-card">
      <SectionTitle title={title} description={description} />
      <div className="dashboard-donut-layout">
        <div className="dashboard-donut-wrap">
          <div className="dashboard-donut-chart" style={{ background: donutBackground }}>
            <div className="dashboard-donut-hole">
              <strong>{total}{unit}</strong>
              <span>운영 대상</span>
            </div>
          </div>
        </div>
        <div className="dashboard-donut-legend">
          {rows.map((row) => (
            <div className="dashboard-donut-legend-item" key={row.label}>
              <span className={`dashboard-donut-dot tone-${row.tone || "blue"}`} />
              <div>
                <strong>{row.label}</strong>
                <p className="muted">{row.value}{unit}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
function MiniTrendChart({ title, description, rows }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Card className="chart-card admin-dashboard-chart-card">
      <SectionTitle title={title} description={description} />
      <div className="dashboard-trend-bars">
        {rows.map((row) => (
          <div className="dashboard-trend-bar-item" key={row.label}>
            <strong>{row.value}</strong>
            <div className="dashboard-trend-bar-track">
              <div className="dashboard-trend-bar-fill" style={{ height: `${Math.max((row.value / max) * 100, row.value ? 20 : 8)}%` }} />
            </div>
            <span>{row.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
function EmergencyStatusOverview({ title, description, rows, total, unresolvedCount }) {
  const safeTotal = total || 1;

  return (
    <Card className="chart-card admin-dashboard-chart-card">
      <SectionTitle title={title} description={description} />
      <div className="dashboard-status-grid">
        {rows.map((row) => {
          const percent = total ? Math.round((row.value / safeTotal) * 100) : 0;
          return (
            <div className="dashboard-status-card" key={row.label}>
              <div className="dashboard-status-card-head">
                <strong>{row.label}</strong>
                <span>{row.value}건</span>
              </div>
              <p className="dashboard-status-card-meta">{percent}%</p>
            </div>
          );
        })}
      </div>
      <div className="dashboard-status-summary">
        <strong>미처리 {unresolvedCount}건</strong>
        <span>접수 및 처리중 상태를 우선 확인하세요.</span>
      </div>
    </Card>
  );
}
function ReportDocument({ report, currentUser }) {
  const period = formatReportPeriod(report.periodStart, report.periodEnd);
  const supportTargets = Array.isArray(report.additionalSupportTargets)
    ? report.additionalSupportTargets.join(", ")
    : report.additionalSupportTargets;
  const reassignmentTargets = Array.isArray(report.reassignmentNeededTargets) ? report.reassignmentNeededTargets : [];
  const recentEmergencies = Array.isArray(report.recentEmergencies) ? report.recentEmergencies : [];
  const handlingSummary = report.handlingSummary || {
    received: 0,
    checking: 0,
    contacted: 0,
    visiting: 0,
    completed: 0,
    unresolved: report.unresolvedEmergencyCount || 0,
  };
  const reportKpis = [
    { label: "운영 대상자", value: `${report.totalTargets}명` },
    { label: "확인 기록", value: `${report.totalActivities}건` },
    { label: "이상징후 보고", value: `${report.emergencyCount}건` },
    { label: "미처리 이상징후", value: `${report.unresolvedEmergencyCount}건` },
    { label: "재배정 필요", value: `${report.reassignmentNeededCount || 0}명` },
  ];

  return (
    <article className="report-document" id="report-preview">
      <header className="report-document-header">
        <p>해피통서비스</p>
        <h2>{report.title}</h2>
        <span>{period}</span>
      </header>

      <p className="report-document-intro">
        {report.overview || "해당 기간 동안 생활 확인 기록과 이상징후 보고 내역을 기준으로 운영 현황을 정리했습니다."}
      </p>

      <div className="report-kpi-grid">
        {reportKpis.map((item) => (
          <div className="report-kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <table className="report-table">
        <tbody>
          <tr>
            <th>작성일</th>
            <td>{report.updatedAt || report.createdAt}</td>
            <th>작성자</th>
            <td>{currentUser?.name || "관리자"}</td>
          </tr>
          <tr>
            <th>운영 대상자</th>
            <td>{report.totalTargets}명</td>
            <th>총 체커</th>
            <td>{report.totalCheckers}명</td>
          </tr>
          <tr>
            <th>확인 기록</th>
            <td>{report.totalActivities}건</td>
            <th>외부/전화/방문/집중</th>
            <td>{report.externalCount || 0}건 / {report.callCount}건 / {report.visitCount}건 / {report.intensiveCount || 0}건</td>
          </tr>
          <tr>
            <th>이상징후 보고</th>
            <td>{report.emergencyCount}건</td>
            <th>미처리 이상징후</th>
            <td>{report.unresolvedEmergencyCount}건</td>
          </tr>
          <tr>
            <th>위험 대상자</th>
            <td>{report.dangerTargetCount}명</td>
            <th>재배정 필요</th>
            <td>{report.reassignmentNeededCount || 0}명</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h3>운영 개요</h3>
        <p>{report.overview || "해당 기간 동안 생활 확인 기록과 이상징후 보고 내역을 기준으로 운영 현황을 정리했습니다."}</p>
      </section>
      <section>
        <h3>생활 확인 현황</h3>
        <p>{report.keyIssues}</p>
      </section>
      <section>
        <h3>이상징후 보고 및 처리 현황</h3>
        <p>{report.emergencySummary || `해당 기간 동안 총 ${report.emergencyCount}건의 이상징후가 보고되었습니다.`}</p>
        <ul className="report-bullet-list">
          <li>접수됨 {handlingSummary.received}건</li>
          <li>확인중 {handlingSummary.checking}건</li>
          <li>보호자 연락 {handlingSummary.contacted}건</li>
          <li>방문 필요 {handlingSummary.visiting}건</li>
          <li>완료 {handlingSummary.completed}건</li>
          <li>미처리 {handlingSummary.unresolved}건</li>
        </ul>
      </section>
      <section>
        <h3>재배정 필요 대상자</h3>
        <p>{report.reassignmentSummary || "재배정이 필요한 대상자가 없습니다."}</p>
        {reassignmentTargets.length ? (
          <table className="report-table report-sub-table">
            <thead>
              <tr>
                <th>대상자명</th>
                <th>현재 담당 체커</th>
                <th>재배정 필요 사유</th>
              </tr>
            </thead>
            <tbody>
              {reassignmentTargets.map((target) => (
                <tr key={target.id}>
                  <td>{target.name}</td>
                  <td>{target.checkerName}</td>
                  <td>{target.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>재배정이 필요한 대상자가 없습니다.</p>
        )}
      </section>
      <section>
        <h3>관리자 확인 사항</h3>
        <p>{report.actionTaken}</p>
        <p>{report.adminOpinion || "입력된 의견 없음"}</p>
      </section>
      <section>
        <h3>최근 이상징후 요약</h3>
        {recentEmergencies.length ? (
          <table className="report-table report-sub-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>대상자</th>
                <th>유형</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {recentEmergencies.map((reportItem) => (
                <tr key={reportItem.id}>
                  <td>{reportItem.date || "-"}</td>
                  <td>{reportItem.targetName || "대상자 정보 없음"}</td>
                  <td>{reportItem.issueType || "이상징후"}</td>
                  <td>{getEmergencyStatusMeta(reportItem.status).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>해당 기간의 이상징후 보고가 없습니다.</p>
        )}
      </section>
      <section>
        <h3>추가 지원 대상</h3>
        <p>{supportTargets || "재배정 또는 추가 지원이 필요한 대상자가 없습니다."}</p>
      </section>
    </article>
  );
}
export function AdminReportNew({ data, actions, navigate, currentUser }) {
  const defaultDraft = generateReportDraft(data, "2026-06-10", getTodayFromStats());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(() => readReportDraft(defaultDraft));
  const reportInsights = useMemo(
    () => buildReportInsights(data, form.periodStart, form.periodEnd),
    [data, form.periodEnd, form.periodStart]
  );

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateReportForm(formValue = form) {
    if (!String(formValue.title || '').trim()) {
      return '보고서 제목을 입력해주세요.';
    }
    if (!formValue.periodStart || !formValue.periodEnd) {
      return '보고 기간 시작일과 종료일을 입력해주세요.';
    }
    if (formValue.periodStart > formValue.periodEnd) {
      return '보고 기간 시작일은 종료일보다 늦을 수 없습니다.';
    }
    return '';
  }

  function toReportPayload(formValue = form) {
    const reportStats = buildReportInsights(data, formValue.periodStart, formValue.periodEnd);
    const reportNarrative = buildReportNarrative(reportStats);
    return {
      ...formValue,
      totalTargets: reportStats.operatingTargetCount,
      totalCheckers: reportStats.totalCheckers,
      totalActivities: reportStats.totalActivities,
      externalCount: reportStats.externalCount,
      visitCount: reportStats.visitCount,
      callCount: reportStats.callCount,
      intensiveCount: reportStats.intensiveCount,
      emergencyCount: reportStats.emergencyCount,
      unresolvedEmergencyCount: reportStats.unresolvedEmergencyCount,
      dangerTargetCount: reportStats.dangerTargetCount,
      reassignmentNeededCount: reportStats.reassignmentNeededCount,
      reassignmentNeededTargets: reportStats.reassignmentNeededTargets,
      handlingSummary: reportStats.handlingSummary,
      recentEmergencies: reportStats.recentEmergencies.map((report) => ({
        ...report,
        targetName: targetName(data.targets, report.targetId),
      })),
      additionalSupportTargets: Array.isArray(formValue.additionalSupportTargets)
        ? formValue.additionalSupportTargets
        : String(formValue.additionalSupportTargets || '').split(',').map((item) => item.trim()).filter(Boolean),
      overview: reportNarrative.overview,
      emergencySummary: reportNarrative.emergencySummary,
      reassignmentSummary: reportNarrative.reassignmentSummary,
      keyIssues: String(formValue.keyIssues || "").trim() || reportNarrative.keyIssues,
      actionTaken: String(formValue.actionTaken || "").trim() || reportNarrative.actionTaken,
      adminOpinion: String(formValue.adminOpinion || "").trim() || reportNarrative.adminOpinion,
      updatedAt: getTodayFromStats(),
      createdAt: formValue.createdAt || getTodayFromStats(),
    };
  }

  function getValidatedReportPayload() {
    const validationMessage = validateReportForm();
    if (validationMessage) {
      setError(validationMessage);
      setNotice('');
      return null;
    }
    setError('');
    return toReportPayload();
  }

  function handleAutoGenerate() {
    const validationMessage = validateReportForm();
    if (validationMessage) {
      setError(validationMessage);
      setNotice('');
      return;
    }

    const generatedText = buildReportNarrative(reportInsights);
    const nextForm = {
      ...form,
      keyIssues: generatedText.keyIssues,
      actionTaken: generatedText.actionTaken,
      adminOpinion: generatedText.adminOpinion,
    };
    setForm(nextForm);
    setPreview(toReportPayload(nextForm));
    setError('');
    setNotice('확인 기록 기반으로 보고서 초안 문장을 생성했습니다.');
  }

  function handleGenerate() {
    const report = getValidatedReportPayload();
    if (!report) return;

    actions.addAdminReport(report);
    saveReportDraft(report);
    setPreview(report);
    setNotice('보고서 미리보기가 생성되었습니다.');
  }

  function handlePrint() {
    const report = getValidatedReportPayload();
    if (!report) return;

    saveReportDraft(report);
    setPreview(report);
    setNotice('인쇄 화면에서 PDF로 저장할 수 있습니다.');

    window.setTimeout(() => {
      window.print();
    }, 500);
  }

  return (
    <>
      <PageHeader
        eyebrow="행정 보고서"
        title="보고서 작성 초안"
        description="해당 기간 동안 생활 확인 기록과 이상징후 보고 내역을 기준으로 운영 현황을 정리합니다."
        action={<Button variant="ghost" onClick={() => navigate('/admin/reports/preview')}>미리보기 화면</Button>}
      />

      <div className="statistics-grid super-kpi-grid report-kpi-summary-grid">
        <StatCard label="운영 대상자" value={`${reportInsights.operatingTargetCount}명`} tone="blue" helper="관리종료 제외" />
        <StatCard label="확인 기록" value={`${reportInsights.totalActivities}건`} tone="green" helper="기간 내 집계" />
        <StatCard label="이상징후 보고" value={`${reportInsights.emergencyCount}건`} tone="orange" helper="기간 내 보고" />
        <StatCard label="미처리 이상징후" value={`${reportInsights.unresolvedEmergencyCount}건`} tone="red" helper="완료 제외" />
        <StatCard label="재배정 필요" value={`${reportInsights.reassignmentNeededCount}명`} tone="red" helper="체커 상태 기준" />
      </div>

      <form className="form-stack admin-report-form">
  <Card className="admin-report-form-card">
    <TextInput
      id="report-title"
      label="보고서 제목"
      value={form.title}
      onChange={(event) => updateForm('title', event.target.value)}
    />

    <div className="admin-report-period-grid">
  <label className="report-date-field" htmlFor="report-start">
    <span>보고 기간 시작일</span>
    <div className="report-date-input-wrap">
      <input
        id="report-start"
        className="report-date-input"
        type="date"
        value={form.periodStart}
        onChange={(event) => updateForm('periodStart', event.target.value)}
      />
      <span className="report-date-icon" aria-hidden="true">📅</span>
    </div>
  </label>

  <label className="report-date-field" htmlFor="report-end">
    <span>보고 기간 종료일</span>
    <div className="report-date-input-wrap">
      <input
        id="report-end"
        className="report-date-input"
        type="date"
        value={form.periodEnd}
        onChange={(event) => updateForm('periodEnd', event.target.value)}
      />
      <span className="report-date-icon" aria-hidden="true">📅</span>
    </div>
  </label>
</div>
  </Card>

        <Card className="admin-report-form-card">
          <TextArea id="report-key-issues" label="주요 특이사항" rows="4" value={form.keyIssues} onChange={(event) => updateForm('keyIssues', event.target.value)} />
          <TextArea id="report-action" label="조치 내용" rows="4" value={form.actionTaken} onChange={(event) => updateForm('actionTaken', event.target.value)} />
          <TextInput
            id="support-targets"
            label="추가 지원 필요 대상자"
            value={Array.isArray(form.additionalSupportTargets) ? form.additionalSupportTargets.join(', ') : form.additionalSupportTargets}
            onChange={(event) => updateForm('additionalSupportTargets', event.target.value)}
          />
          <TextArea id="admin-opinion" label="관리자 의견" rows="4" value={form.adminOpinion} onChange={(event) => updateForm('adminOpinion', event.target.value)} />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        <div className="report-actions">
  <Button className="report-primary-action" onClick={handleAutoGenerate}>
    보고서 초안 자동 생성
  </Button>

  <div className="report-secondary-actions">
    <Button variant="secondary" onClick={handleGenerate}>
      미리보기 생성
    </Button>
    <Button variant="ghost" onClick={handlePrint}>
      PDF 내보내기
    </Button>
  </div>
</div>
      </form>

      {preview ? (
        <section className="section-block print-area">
          <SectionTitle title="보고서 미리보기" description="인쇄 시 이 영역만 출력됩니다." />
          <ReportDocument report={preview} currentUser={currentUser} />
        </section>
      ) : null}
    </>
  );
}

export function AdminReportPreview({ data, currentUser }) {
  const savedReport = readReportDraft(generateReportDraft(data, "2026-06-10", getTodayFromStats()));
  const reportInsights = buildReportInsights(data, savedReport.periodStart, savedReport.periodEnd);
  const reportNarrative = buildReportNarrative(reportInsights);
  const report = {
    ...savedReport,
    totalTargets: reportInsights.operatingTargetCount,
    totalCheckers: reportInsights.totalCheckers,
    totalActivities: reportInsights.totalActivities,
    externalCount: reportInsights.externalCount,
    visitCount: reportInsights.visitCount,
    callCount: reportInsights.callCount,
    intensiveCount: reportInsights.intensiveCount,
    emergencyCount: reportInsights.emergencyCount,
    unresolvedEmergencyCount: reportInsights.unresolvedEmergencyCount,
    dangerTargetCount: reportInsights.dangerTargetCount,
    reassignmentNeededCount: reportInsights.reassignmentNeededCount,
    reassignmentNeededTargets: reportInsights.reassignmentNeededTargets,
    handlingSummary: reportInsights.handlingSummary,
    recentEmergencies: reportInsights.recentEmergencies.map((item) => ({
      ...item,
      targetName: targetName(data.targets, item.targetId),
    })),
    overview: savedReport.overview || reportNarrative.overview,
    emergencySummary: savedReport.emergencySummary || reportNarrative.emergencySummary,
    reassignmentSummary: savedReport.reassignmentSummary || reportNarrative.reassignmentSummary,
    keyIssues: savedReport.keyIssues || reportNarrative.keyIssues,
    actionTaken: savedReport.actionTaken || reportNarrative.actionTaken,
    adminOpinion: savedReport.adminOpinion || reportNarrative.adminOpinion,
  };

  return (
    <>
      <PageHeader
  eyebrow="보고서 미리보기"
  title="행정 보고서 출력"
  description="저장된 보고서 초안을 문서 형태로 확인하고 PDF로 저장합니다."
  action={
    <Button onClick={() => window.print()}>
      PDF 내보내기
    </Button>
  }
/>
      <section className="print-area">
        <ReportDocument report={report} currentUser={currentUser} />
      </section>
    </>
  );
}

export function AdminTargetEdit({ targetId, data, actions, navigate }) {
  const target = data.targets.find((item) => item.id === targetId);
  const checkerOptions = data.users.filter((user) => user.role === "checker");
  const dayOptions = ["월", "화", "수", "목", "금", "토", "일"];
  const initialCheckDays = Array.isArray(target?.checkDays)
    ? target.checkDays
    : typeof target?.checkDays === "string"
      ? target.checkDays.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const [form, setForm] = useState(() => ({
    name: target?.name || "",
    age: target?.age ? String(target.age) : "",
    gender: target?.gender || "여성",
    address: target?.address || "",
    riskLevel: target?.riskLevel || "normal",
    defaultCheckType: target?.defaultCheckType || "external",
    assignedCheckerId: target?.assignedCheckerId || "",
    checkDays: initialCheckDays,
    checkTime: target?.checkTime || target?.visitTime || "",
    healthStatus: target?.healthStatus || "",
    cautionNote: target?.cautionNote || "",
    medicationNote: target?.medicationNote || "",
    guardianName: target?.guardianName || "",
    guardianPhone: target?.guardianPhone || "",
  }));
  const [error, setError] = useState("");

  if (!target) {
    return (
      <>
        <PageHeader
          eyebrow="대상자 수정"
          title="대상자를 찾을 수 없습니다"
          description="대상자 목록으로 돌아가 다시 선택해주세요."
        />
        <Button onClick={() => navigate("/admin/targets")}>목록으로 돌아가기</Button>
      </>
    );
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCheckDay(day) {
    setForm((current) => ({
      ...current,
      checkDays: current.checkDays.includes(day)
        ? current.checkDays.filter((item) => item !== day)
        : [...current.checkDays, day],
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedAddress = form.address.trim();
    const parsedAge = Number(form.age);

    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!form.age.trim() || Number.isNaN(parsedAge)) {
      setError("나이는 숫자로 입력해주세요.");
      return;
    }

    if (!trimmedAddress) {
      setError("주소를 입력해주세요.");
      return;
    }

    actions.updateTarget(target.id, {
      name: trimmedName,
      age: parsedAge,
      gender: form.gender,
      address: trimmedAddress,
      riskLevel: form.riskLevel,
      defaultCheckType: form.defaultCheckType,
      assignedCheckerId: form.assignedCheckerId,
      checkDays: form.checkDays,
      checkTime: form.checkTime,
      visitTime: form.checkTime,
      healthStatus: form.healthStatus.trim(),
      cautionNote: form.cautionNote.trim(),
      medicationNote: form.medicationNote.trim(),
      guardianName: form.guardianName.trim(),
      guardianPhone: form.guardianPhone.trim(),
    });

    navigate(`/admin/targets/${target.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="대상자 수정"
        title={`${target.name} 정보 수정`}
        description="기본 대상자 정보를 수정하고 저장할 수 있습니다."
        action={
          <Button variant="ghost" onClick={() => navigate(`/admin/targets/${target.id}`)}>
            상세로 돌아가기
          </Button>
        }
      />

      <form className="form-stack" onSubmit={handleSubmit}>
        <Card>
          <TextInput
            id="target-edit-name"
            label="이름"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="대상자 이름"
          />
          <TextInput
            id="target-edit-age"
            label="나이"
            inputMode="numeric"
            value={form.age}
            onChange={(event) => updateForm("age", event.target.value)}
            placeholder="나이"
          />
          <SelectInput
            id="target-edit-gender"
            label="성별"
            value={form.gender}
            onChange={(event) => updateForm("gender", event.target.value)}
          >
            <option value="여성">여성</option>
            <option value="남성">남성</option>
          </SelectInput>
          <TextInput
            id="target-edit-address"
            label="주소"
            value={form.address}
            onChange={(event) => updateForm("address", event.target.value)}
            placeholder="상세 주소"
          />
          <SelectInput
            id="target-edit-risk"
            label="위험도"
            value={form.riskLevel}
            onChange={(event) => updateForm("riskLevel", event.target.value)}
          >
            <option value="normal">정상</option>
            <option value="caution">주의</option>
            <option value="danger">위험</option>
          </SelectInput>
          <SelectInput
            id="target-edit-check-type"
            label="기본 확인 유형"
            value={form.defaultCheckType}
            onChange={(event) => updateForm("defaultCheckType", event.target.value)}
          >
            <option value="external">외부 확인</option>
            <option value="call">전화 확인</option>
            <option value="visit">방문 확인</option>
            <option value="intensive">집중 모니터링</option>
          </SelectInput>
          <SelectInput
            id="target-edit-checker"
            label="담당 체커"
            value={form.assignedCheckerId}
            onChange={(event) => updateForm("assignedCheckerId", event.target.value)}
          >
            <option value="">미배정</option>
            {checkerOptions.map((checker) => (
              <option key={checker.id} value={checker.id}>
                {checker.name}
              </option>
            ))}
          </SelectInput>
          <div className="field">
            <span>확인 요일</span>
            <div className="checker-assignment-list">
              {dayOptions.map((day) => (
                <CheckboxField
                  key={day}
                  label={day}
                  checked={form.checkDays.includes(day)}
                  onChange={() => toggleCheckDay(day)}
                />
              ))}
            </div>
          </div>
          <TextInput
            id="target-edit-check-time"
            label="확인 시간"
            type="time"
            value={form.checkTime}
            onChange={(event) => updateForm("checkTime", event.target.value)}
          />
          <TextInput
            id="target-edit-health-status"
            label="건강상태"
            value={form.healthStatus}
            onChange={(event) => updateForm("healthStatus", event.target.value)}
            placeholder="건강 상태를 입력하세요"
          />
          <TextArea
            id="target-edit-caution-note"
            label="주의사항"
            rows="3"
            value={form.cautionNote}
            onChange={(event) => updateForm("cautionNote", event.target.value)}
            placeholder="주의사항을 입력하세요"
          />
          <TextArea
            id="target-edit-medication-note"
            label="복약 메모"
            rows="3"
            value={form.medicationNote}
            onChange={(event) => updateForm("medicationNote", event.target.value)}
            placeholder="복약 관련 메모를 입력하세요"
          />
          <TextInput
            id="target-edit-guardian-name"
            label="보호자 이름"
            value={form.guardianName}
            onChange={(event) => updateForm("guardianName", event.target.value)}
            placeholder="보호자 이름"
          />
          <TextInput
            id="target-edit-guardian-phone"
            label="보호자 연락처"
            value={form.guardianPhone}
            onChange={(event) => updateForm("guardianPhone", event.target.value)}
            placeholder="010-0000-0000"
          />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="action-grid">
          <Button type="submit">저장</Button>
          <Button variant="secondary" onClick={() => navigate(`/admin/targets/${target.id}`)}>
            취소
          </Button>
        </div>
      </form>
    </>
  );
}

export function AdminTargetNew({ data, actions, navigate }) {
  const checkerOptions = data.users.filter((user) => user.role === "checker");
  const dayOptions = ["월", "화", "수", "목", "금", "토", "일"];
  const [form, setForm] = useState(() => ({
    name: "",
    age: "",
    gender: "여성",
    address: "",
    riskLevel: "normal",
    defaultCheckType: "external",
    assignedCheckerId: "",
    checkDays: ["월", "수", "금"],
    checkTime: "",
    healthStatus: "",
    cautionNote: "",
    medicationNote: "",
    guardianName: "",
    guardianPhone: "",
  }));
  const [error, setError] = useState("");

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCheckDay(day) {
    setForm((current) => ({
      ...current,
      checkDays: current.checkDays.includes(day)
        ? current.checkDays.filter((item) => item !== day)
        : [...current.checkDays, day],
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedAddress = form.address.trim();
    const parsedAge = Number(form.age);

    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!form.age.trim() || Number.isNaN(parsedAge)) {
      setError("나이는 숫자로 입력해주세요.");
      return;
    }

    if (!trimmedAddress) {
      setError("주소를 입력해주세요.");
      return;
    }

    const todayLabel = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
    const isTodaySelected = form.checkDays.includes(todayLabel);
    const now = new Date().toISOString();
    const newTarget = {
      id: `target-${Date.now()}`,
      name: trimmedName,
      age: parsedAge,
      gender: form.gender,
      address: trimmedAddress,
      riskLevel: form.riskLevel,
      defaultCheckType: form.defaultCheckType,
      assignedCheckerId: form.assignedCheckerId,
      checkDays: form.checkDays,
      checkTime: form.checkTime,
      visitTime: form.checkTime,
      healthStatus: form.healthStatus.trim(),
      cautionNote: form.cautionNote.trim(),
      medicationNote: form.medicationNote.trim(),
      guardianName: form.guardianName.trim(),
      guardianPhone: form.guardianPhone.trim(),
      todayScheduled: isTodaySelected,
      todayVisit: isTodaySelected,
      lifecycleStatus: "active",
      createdAt: now,
      updatedAt: now,
    };

    actions.addTarget(newTarget);
    navigate(`/admin/targets/${newTarget.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="대상자 등록"
        title="신규 대상자 등록"
        description="운영에 필요한 기본 정보를 입력하고 대상자를 등록합니다."
        action={
          <Button variant="ghost" onClick={() => navigate("/admin/targets")}>
            목록으로 돌아가기
          </Button>
        }
      />

      <form className="form-stack" onSubmit={handleSubmit}>
        <Card>
          <TextInput
            id="target-new-name"
            label="이름"
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="대상자 이름"
          />
          <TextInput
            id="target-new-age"
            label="나이"
            inputMode="numeric"
            value={form.age}
            onChange={(event) => updateForm("age", event.target.value)}
            placeholder="나이"
          />
          <SelectInput
            id="target-new-gender"
            label="성별"
            value={form.gender}
            onChange={(event) => updateForm("gender", event.target.value)}
          >
            <option value="여성">여성</option>
            <option value="남성">남성</option>
          </SelectInput>
          <TextInput
            id="target-new-address"
            label="주소"
            value={form.address}
            onChange={(event) => updateForm("address", event.target.value)}
            placeholder="상세 주소"
          />
          <SelectInput
            id="target-new-risk"
            label="위험도"
            value={form.riskLevel}
            onChange={(event) => updateForm("riskLevel", event.target.value)}
          >
            <option value="normal">정상</option>
            <option value="caution">주의</option>
            <option value="danger">위험</option>
          </SelectInput>
          <SelectInput
            id="target-new-check-type"
            label="기본 확인 유형"
            value={form.defaultCheckType}
            onChange={(event) => updateForm("defaultCheckType", event.target.value)}
          >
            <option value="external">외부 확인</option>
            <option value="call">전화 확인</option>
            <option value="visit">방문 확인</option>
            <option value="intensive">집중 모니터링</option>
          </SelectInput>
          <SelectInput
            id="target-new-checker"
            label="담당 체커"
            value={form.assignedCheckerId}
            onChange={(event) => updateForm("assignedCheckerId", event.target.value)}
          >
            <option value="">미배정</option>
            {checkerOptions.map((checker) => (
              <option key={checker.id} value={checker.id}>
                {checker.name}
              </option>
            ))}
          </SelectInput>
          <div className="field">
            <span>확인 요일</span>
            <div className="checker-assignment-list">
              {dayOptions.map((day) => (
                <CheckboxField
                  key={day}
                  label={day}
                  checked={form.checkDays.includes(day)}
                  onChange={() => toggleCheckDay(day)}
                />
              ))}
            </div>
          </div>
          <TextInput
            id="target-new-check-time"
            label="확인 시간"
            type="time"
            value={form.checkTime}
            onChange={(event) => updateForm("checkTime", event.target.value)}
          />
          <TextInput
            id="target-new-health-status"
            label="건강상태"
            value={form.healthStatus}
            onChange={(event) => updateForm("healthStatus", event.target.value)}
            placeholder="건강 상태를 입력하세요"
          />
          <TextArea
            id="target-new-caution-note"
            label="주의사항"
            rows="3"
            value={form.cautionNote}
            onChange={(event) => updateForm("cautionNote", event.target.value)}
            placeholder="주의사항을 입력하세요"
          />
          <TextArea
            id="target-new-medication-note"
            label="복약 메모"
            rows="3"
            value={form.medicationNote}
            onChange={(event) => updateForm("medicationNote", event.target.value)}
            placeholder="복약 관련 메모를 입력하세요"
          />
          <TextInput
            id="target-new-guardian-name"
            label="보호자 이름"
            value={form.guardianName}
            onChange={(event) => updateForm("guardianName", event.target.value)}
            placeholder="보호자 이름"
          />
          <TextInput
            id="target-new-guardian-phone"
            label="보호자 연락처"
            value={form.guardianPhone}
            onChange={(event) => updateForm("guardianPhone", event.target.value)}
            placeholder="010-0000-0000"
          />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="action-grid">
          <Button type="submit">저장</Button>
          <Button variant="secondary" onClick={() => navigate("/admin/targets")}>
            취소
          </Button>
        </div>
      </form>
    </>
  );
}

export function AdminStatistics({ data }) {
  const [period, setPeriod] = useState("all");
  const stats = getDashboardStats(data, period);
  const emergencyStats = getEmergencyStats(data.emergencyReports, period);
  const recentRows = getRecentDailyActivityStats(data.activityRecords, 7);
  const issueTypeRows = Object.entries(
    emergencyStats.reports.reduce((result, report) => {
      result[report.issueType] = (result[report.issueType] || 0) + 1;
      return result;
    }, {})
  ).map(([label, value]) => ({ label, value, tone: "orange" }));
  const statusRows = [
    { label: "접수됨", value: emergencyStats.reports.filter((report) => getEmergencyStatusValue(report.status) === "received").length, tone: "red" },
    { label: "처리중", value: emergencyStats.reports.filter((report) => ["checking", "contacted", "visiting"].includes(getEmergencyStatusValue(report.status))).length, tone: "orange" },
    { label: "완료", value: emergencyStats.reports.filter((report) => isEmergencyCompleted(report.status)).length, tone: "green" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="통계"
        title="운영 통계"
        description="확인 기록과 이상징후 현황을 핵심 지표 중심으로 확인합니다."
      />

<div className="filter-tabs compact-filter-tabs statistics-period-tabs" aria-label="통계 기간 필터">
        {[
          { value: "all", label: "전체" },
          { value: "today", label: "오늘" },
          { value: "7days", label: "최근 7일" },
          { value: "30days", label: "최근 30일" },
        ].map((item) => (
          <button
            className={period === item.value ? "filter-tab-active" : ""}
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stats-grid statistics-grid">
        <StatCard label="전체 확인 기록" value={`${stats.totalActivities}건`} tone="green" />
        <StatCard label="이상징후 보고" value={`${stats.emergencyCount}건`} tone="red" />
        <StatCard label="미처리 이상징후" value={`${stats.unresolvedEmergencyCount}건`} tone={stats.unresolvedEmergencyCount ? "red" : "green"} />
        <StatCard label="위험 대상자" value={`${stats.dangerTargetCount}명`} tone={stats.dangerTargetCount ? "red" : "green"} />
      </div>

      <section className="chart-grid">
        <ChartCard
          title="최근 7일 확인 건수"
          description="최근 7일 날짜별 확인 기록 수입니다."
          rows={recentRows.map((row) => ({ label: row.label, value: row.count, tone: "green" }))}
        />
        <ChartCard
          title="이상징후 유형별 발생 건수"
          description="기간 필터가 반영된 이상징후 유형 분포입니다."
          rows={issueTypeRows.length ? issueTypeRows : [{ label: "이상징후 없음", value: 0, tone: "green" }]}
        />
        <ChartCard
          title="처리 상태별 이상징후 현황"
          description="접수, 처리중, 완료 상태 분포입니다."
          rows={statusRows}
        />
      </section>
    </>
  );
}
export function AdminExports({ data }) {
  const [notice, setNotice] = useState("");
  const cards = [
    {
      title: "확인 기록 내보내기",
      description: "체커가 작성한 전체 확인 기록을 내려받습니다.",
      filename: "happytong_activities.csv",
      rows: () => buildActivitiesCsvRows(data),
    },
    {
      title: "이상징후 보고 내보내기",
      description: "접수된 이상징후 보고 데이터를 내려받습니다.",
      filename: "happytong_emergencies.csv",
      rows: () => buildEmergenciesCsvRows(data),
    },
    {
      title: "대상자 목록 내보내기",
      description: "관리 중인 대상자 정보를 내려받습니다.",
      filename: "happytong_targets.csv",
      rows: () => buildTargetsCsvRows(data),
    },
    {
      title: "체커 목록 내보내기",
      description: "등록된 체커 정보를 내려받습니다.",
      filename: "happytong_checkers.csv",
      rows: () => buildCheckersCsvRows(data),
    },
  ];

  function handleDownload(card) {
    downloadCsv(card.filename, card.rows());
    setNotice(`${card.title} CSV 다운로드가 시작되었습니다.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="데이터 내보내기"
        title="CSV 다운로드"
        description="확인 기록, 이상징후 보고, 대상자, 체커 데이터를 CSV로 내려받을 수 있습니다."
      />

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="stack">
        {cards.map((card) => (
          <Card key={card.filename}>
            <SectionTitle title={card.title} description={card.description} />
            <Button className="full-width" onClick={() => handleDownload(card)}>CSV 다운로드</Button>
          </Card>
        ))}
      </div>
    </>
  );
}


