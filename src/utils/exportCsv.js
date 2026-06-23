import {
  activityHealthLabels,
  activityTypeLabels,
  emergencyStatusLabels,
  riskLabels,
  urgencyLabels,
  recordStatusLabels,
  checkerStatusLabels,
} from "../data/mockData.js";

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function convertToCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  return `\uFEFF${headers.map(escapeCsvValue).join(",")}\n${lines.join("\n")}`;
}

export function downloadCsv(filename, rows) {
  const csv = convertToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function targetName(targets, targetId) {
  return targets.find((target) => target.id === targetId)?.name ?? "";
}

function checkerName(users, checkerId) {
  return users.find((user) => user.id === checkerId)?.name ?? "";
}

export function buildActivitiesCsvRows(data) {
  return data.activityRecords.map((record) => ({
    날짜: record.date,
    대상자명: targetName(data.targets, record.targetId),
    체커명: checkerName(data.users, record.checkerId),
    활동유형: activityTypeLabels[record.type] ?? record.type,
    건강상태: activityHealthLabels[record.healthStatus] ?? record.healthStatus,
    특이사항여부: record.hasIssue ? "있음" : "없음",
    메모: record.memo,
    상태: recordStatusLabels[record.status] ?? record.status,
  }));
}

export function buildEmergenciesCsvRows(data) {
  return data.emergencyReports.map((report) => ({
    날짜: report.date,
    대상자명: targetName(data.targets, report.targetId),
    체커명: checkerName(data.users, report.checkerId),
    이상징후유형: report.issueType,
    확인필요수준: urgencyLabels[report.urgency] ?? report.urgency,
    상세내용: report.description,
    보호자연락필요: report.needGuardianContact ? "필요" : "불필요",
    처리상태: emergencyStatusLabels[report.status] ?? report.status,
    관리자메모: report.adminMemo,
  }));
}

export function buildTargetsCsvRows(data) {
  return data.targets.map((target) => ({
    이름: target.name,
    나이: target.age,
    성별: target.gender,
    주소: target.address,
    담당체커: checkerName(data.users, target.assignedCheckerId),
    위험도: riskLabels[target.riskLevel] ?? target.riskLevel,
    최근방문일: target.lastVisitDate,
    보호자명: target.guardianName,
    보호자연락처: target.guardianPhone,
    오늘방문예정: target.todayScheduled ? "예정" : "없음",
  }));
}

export function buildCheckersCsvRows(data) {
  return data.users
    .filter((user) => user.role === "checker")
    .map((checker) => ({
      이름: checker.name,
      연락처: checker.phone,
      상태: checkerStatusLabels[checker.status] ?? checker.status,
      담당대상자수: data.targets.filter((target) => target.assignedCheckerId === checker.id).length,
      활동기록수: data.activityRecords.filter((record) => record.checkerId === checker.id).length,
      긴급보고수: data.emergencyReports.filter((report) => report.checkerId === checker.id).length,
    }));
}

export function exportActivitiesCsv(data) {
  downloadCsv("happytong_activities.csv", buildActivitiesCsvRows(data));
}

export function exportEmergenciesCsv(data) {
  downloadCsv("happytong_emergencies.csv", buildEmergenciesCsvRows(data));
}

export function exportTargetsCsv(data) {
  downloadCsv("happytong_targets.csv", buildTargetsCsvRows(data));
}

export function exportCheckersCsv(data) {
  downloadCsv("happytong_checkers.csv", buildCheckersCsvRows(data));
}
