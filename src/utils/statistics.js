export function getToday() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function toDate(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

function isWithinPreset(dateText, period) {
  if (period === "all") return true;

  const todayText = getToday();
  if (period === "today") return dateText === todayText;

  const days = period === "7days" ? 7 : period === "30days" ? 30 : 0;
  if (!days) return true;

  const today = toDate(todayText);
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  const target = toDate(dateText);
  return target >= from && target <= today;
}

export function isWithinDateRange(dateText, startDate, endDate) {
  if (startDate && dateText < startDate) return false;
  if (endDate && dateText > endDate) return false;
  return true;
}

export function filterRecordsByPeriod(records, period) {
  return records.filter((record) => isWithinPreset(record.date, period));
}

export function filterRecordsByDateRange(records, startDate, endDate) {
  return records.filter((record) => isWithinDateRange(record.date, startDate, endDate));
}

export function getAllActivityRecords(data) {
  return data.activityRecords;
}

export function getAllEmergencyReports(data) {
  return data.emergencyReports;
}

export function getActivityStats(records, period = "all") {
  const filteredRecords = filterRecordsByPeriod(records, period);
  const getCheckType = (record) => record.checkType || record.type;

  return {
    records: filteredRecords,
    total: filteredRecords.length,
    today: filteredRecords.filter((record) => record.date === getToday()).length,
    external: filteredRecords.filter((record) => getCheckType(record) === "external").length,
    visit: filteredRecords.filter((record) => getCheckType(record) === "visit").length,
    call: filteredRecords.filter((record) => getCheckType(record) === "call").length,
    intensive: filteredRecords.filter((record) => getCheckType(record) === "intensive").length,
    issue: filteredRecords.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length,
    pending: filteredRecords.filter((record) => record.status !== "completed").length,
  };
}

export function getEmergencyStats(reports, period = "all") {
  const filteredReports = filterRecordsByPeriod(reports, period);

  return {
    reports: filteredReports,
    total: filteredReports.length,
    unresolved: filteredReports.filter((report) => report.status !== "completed").length,
    low: filteredReports.filter((report) => report.urgency === "low").length,
    medium: filteredReports.filter((report) => report.urgency === "medium").length,
    high: filteredReports.filter((report) => report.urgency === "high").length,
  };
}

export function getTargetRiskStats(targets) {
  return {
    total: targets.length,
    normal: targets.filter((target) => target.riskLevel === "normal").length,
    caution: targets.filter((target) => target.riskLevel === "caution").length,
    danger: targets.filter((target) => target.riskLevel === "danger").length,
  };
}

export function getCheckerActivityStats(records, checkers) {
  return checkers.map((checker) => ({
    checkerId: checker.id,
    checkerName: checker.name,
    count: records.filter((record) => record.checkerId === checker.id).length,
  }));
}

export function getRecentDailyActivityStats(records, days = 7) {
  const today = toDate(getToday());

  return Array.from({ length: days }).map((_, index) => {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - (days - 1 - index));
    const date = targetDate.toISOString().slice(0, 10);

    return {
      date,
      label: date.slice(5),
      count: records.filter((record) => record.date === date).length,
    };
  });
}

export function getDashboardStats(data, period = "all") {
  const checkers = data.users.filter((user) => user.role === "checker");
  const activity = getActivityStats(data.activityRecords, period);
  const emergency = getEmergencyStats(data.emergencyReports, period);
  const risk = getTargetRiskStats(data.targets);

  return {
    totalTargets: data.targets.length,
    totalCheckers: checkers.length,
    totalActivities: activity.total,
    todayActivities: activity.today,
    externalCount: activity.external,
    visitCount: activity.visit,
    callCount: activity.call,
    intensiveCount: activity.intensive,
    issueCount: activity.issue,
    pendingActivityCount: activity.pending,
    emergencyCount: emergency.total,
    unresolvedEmergencyCount: emergency.unresolved,
    dangerTargetCount: risk.danger,
    activity,
    emergency,
    risk,
    checkers,
  };
}

export function getReportStats(data, startDate, endDate) {
  const checkers = data.users.filter((user) => user.role === "checker");
  const activities = filterRecordsByDateRange(data.activityRecords, startDate, endDate);
  const emergencies = filterRecordsByDateRange(data.emergencyReports, startDate, endDate);
  const risk = getTargetRiskStats(data.targets);
  const getCheckType = (record) => record.checkType || record.type;

  return {
    totalTargets: data.targets.length,
    totalCheckers: checkers.length,
    totalActivities: activities.length,
    externalCount: activities.filter((record) => getCheckType(record) === "external").length,
    visitCount: activities.filter((record) => getCheckType(record) === "visit").length,
    callCount: activities.filter((record) => getCheckType(record) === "call").length,
    intensiveCount: activities.filter((record) => getCheckType(record) === "intensive").length,
    emergencyCount: emergencies.length,
    unresolvedEmergencyCount: emergencies.filter((report) => report.status !== "completed").length,
    dangerTargetCount: risk.danger,
    issueCount: activities.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length,
    activities,
    emergencies,
    risk,
  };
}
