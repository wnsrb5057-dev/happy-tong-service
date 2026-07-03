import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "../components/UI.jsx";
import { getSupabaseConnectionStatus } from "../services/supabaseHealthService.js";
import { getSupabaseOrganizationSummaries } from "../services/supabaseOrganizationSummaryService.js";
import { getSupabaseRecentEmergencySummaries } from "../services/supabaseRecentEmergencyService.js";
import { getSupabaseSuperDashboardKpis } from "../services/supabaseSuperDashboardKpiService.js";
import { getSupabaseOrganizationDetail } from "../services/supabaseOrganizationDetailService.js";
import { getSupabaseSuperStatusSummaries } from "../services/supabaseSuperStatusService.js";

const DEFAULT_ORGANIZATION_ID = "org-eunpyeong-care";

const ORGANIZATION_STATUS_LABELS = {
  active: "운영중",
  pilot: "파일럿",
  paused: "일시중지",
  ended: "운영종료",
  운영중: "운영중",
  파일럿: "파일럿",
  일시중지: "일시중지",
  운영종료: "운영종료",
};

const EMERGENCY_STATUS_MAP = {
  received: "received",
  checking: "checking",
  contacted: "contacted",
  visiting: "visiting",
  completed: "completed",
  resolved: "completed",
  접수됨: "received",
  확인중: "checking",
  처리중: "checking",
  "보호자 연락": "contacted",
  "방문 필요": "visiting",
  완료: "completed",
};

const EMERGENCY_STATUS_LABELS = {
  received: "접수됨",
  checking: "확인중",
  contacted: "보호자 연락",
  visiting: "방문 필요",
  completed: "완료",
};

const SEVERITY_LABELS = {
  normal: "일반",
  caution: "주의",
  urgent: "긴급",
  일반: "일반",
  주의: "주의",
  긴급: "긴급",
};

const ACTIVITY_RESULT_LABELS = {
  normal: "이상 없음",
  caution: "관심 필요",
  emergency: "이상징후",
  no_answer: "미응답",
  none: "이상 없음",
  need_check: "관심 필요",
  urgent: "이상징후",
  "이상 없음": "이상 없음",
  "관심 필요": "관심 필요",
  이상징후: "이상징후",
  미응답: "미응답",
};

const CHECK_TYPE_LABELS = {
  external: "외부 확인",
  call: "전화",
  visit: "방문",
  intensive: "집중 모니터링",
  phone: "전화",
  message: "메시지",
  "외부 확인": "외부 확인",
  전화: "전화",
  방문: "방문",
  메시지: "메시지",
  "집중 모니터링": "집중 모니터링",
};

const RISK_LEVEL_LABELS = {
  high: "높음",
  medium: "주의",
  low: "안정",
  높음: "높음",
  주의: "주의",
  안정: "안정",
};

function getOrganizationIdFromTarget(target) {
  return target?.organizationId || DEFAULT_ORGANIZATION_ID;
}

function getOrganizationIdFromUser(user) {
  return user?.organizationId || (user?.role === "checker" ? DEFAULT_ORGANIZATION_ID : "");
}

function getOrganizationIdFromEmergency(report, targets) {
  if (report?.organizationId) return report.organizationId;
  const target = targets.find((item) => item.id === report?.targetId);
  return getOrganizationIdFromTarget(target);
}

function getOrganizationStatusLabel(status) {
  return ORGANIZATION_STATUS_LABELS[String(status || "active").trim()] || status || "운영중";
}

function getEmergencyStatusKey(status) {
  return EMERGENCY_STATUS_MAP[String(status || "received").trim()] || String(status || "received").trim();
}

function getEmergencyStatusLabel(status) {
  const statusKey = getEmergencyStatusKey(status);
  return EMERGENCY_STATUS_LABELS[statusKey] || status || "접수됨";
}

function getEmergencySeverityLabel(severity) {
  return SEVERITY_LABELS[String(severity || "normal").trim()] || severity || "일반";
}

function getActivityResultStatusLabel(resultStatus) {
  return ACTIVITY_RESULT_LABELS[String(resultStatus || "normal").trim()] || resultStatus || "이상 없음";
}

function getCheckTypeLabel(checkType) {
  return CHECK_TYPE_LABELS[String(checkType || "visit").trim()] || checkType || "방문";
}

function getRiskLevelLabel(riskLevel) {
  return RISK_LEVEL_LABELS[String(riskLevel || "low").trim()] || riskLevel || "안정";
}

function isUnresolvedEmergency(report) {
  const status = getEmergencyStatusKey(report?.status).toLowerCase();
  return status !== "completed" && status !== "resolved";
}

function sortByLatestTimestamp(a, b) {
  const aValue = String(a || "");
  const bValue = String(b || "");
  return bValue.localeCompare(aValue);
}

function formatDateTime(value) {
  if (!value) return "날짜 정보 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCheckedAt(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildOrganizationSummaries(data) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];

  return organizations.map((organization) => {
    const targetCount = targets.filter(
      (target) =>
        getOrganizationIdFromTarget(target) === organization.id &&
        String(target.lifecycleStatus || "active") !== "ended"
    ).length;
    const checkerCount = users.filter(
      (user) => user.role === "checker" && getOrganizationIdFromUser(user) === organization.id
    ).length;
    const organizationEmergencies = emergencyReports.filter(
      (report) => getOrganizationIdFromEmergency(report, targets) === organization.id
    );

    return {
      ...organization,
      adminName: organization?.adminName || organization?.admin_name || "미배정",
      status: organization?.status || "active",
      statusLabel: getOrganizationStatusLabel(organization?.status || "active"),
      memo: organization?.memo || "",
      targetCount,
      checkerCount,
      emergencyCount: organizationEmergencies.length,
      unresolvedEmergencyCount: organizationEmergencies.filter(isUnresolvedEmergency).length,
    };
  });
}

function buildRecentEmergencySummaries(data) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];

  return [...emergencyReports]
    .sort((a, b) => sortByLatestTimestamp(a.reportedAt || a.date, b.reportedAt || b.date))
    .slice(0, 5)
    .map((report) => {
      const target = targets.find((item) => item.id === report.targetId);
      const organizationId = getOrganizationIdFromEmergency(report, targets);
      const organization = organizations.find((item) => item.id === organizationId);

      return {
        id: report.id,
        organizationId,
        organizationName: organization?.name || "기관 정보 없음",
        targetId: report.targetId || null,
        targetName: target?.name || "대상자 정보 없음",
        title: report.title || report.issueType || "이상징후 보고",
        severity: report.severity || report.issueLevel || "normal",
        severityLabel: getEmergencySeverityLabel(report.severity || report.issueLevel || "normal"),
        status: report.status || "received",
        statusLabel: getEmergencyStatusLabel(report.status || "received"),
        reportedAt: report.reportedAt || report.date || null,
      };
    });
}

function buildLocalOrganizationDetail(data, organizationId) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const organization = organizations.find((item) => item.id === organizationId);

  if (!organization) {
    return null;
  }

  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];
  const activityRecords = Array.isArray(data.activityRecords) ? data.activityRecords : [];

  const organizationTargets = targets.filter(
    (target) =>
      getOrganizationIdFromTarget(target) === organizationId &&
      String(target.lifecycleStatus || "active") !== "ended"
  );
  const targetIds = new Set(organizationTargets.map((target) => target.id));
  const organizationCheckers = users.filter(
    (user) => user.role === "checker" && getOrganizationIdFromUser(user) === organizationId
  );
  const organizationEmergencies = emergencyReports.filter(
    (report) => getOrganizationIdFromEmergency(report, targets) === organizationId
  );
  const recentEmergencies = [...organizationEmergencies]
    .sort((a, b) => sortByLatestTimestamp(a.reportedAt || a.date, b.reportedAt || b.date))
    .slice(0, 5)
    .map((report) => {
      const target = targets.find((item) => item.id === report.targetId);
      return {
        id: report.id,
        targetId: report.targetId || null,
        targetName: target?.name || "대상자 정보 없음",
        title: report.title || report.issueType || "이상징후 보고",
        severity: report.severity || report.issueLevel || "normal",
        severityLabel: getEmergencySeverityLabel(report.severity || report.issueLevel || "normal"),
        status: report.status || "received",
        statusLabel: getEmergencyStatusLabel(report.status || "received"),
        reportedAt: report.reportedAt || report.date || null,
      };
    });

  const recentActivityRecords = activityRecords
    .filter((record) => targetIds.has(record.targetId))
    .sort((a, b) => sortByLatestTimestamp(a.checkedAt || a.createdAt || a.date, b.checkedAt || b.createdAt || b.date))
    .slice(0, 5)
    .map((record) => {
      const target = targets.find((item) => item.id === record.targetId);
      const checker = users.find((item) => item.id === record.checkerId);
      const resultStatus =
        record.resultStatus ||
        (record.issueLevel === "urgent"
          ? "emergency"
          : record.issueLevel === "need_check"
            ? "caution"
            : record.issueLevel === "none"
              ? "normal"
              : "normal");

      return {
        id: record.id,
        targetId: record.targetId || null,
        targetName: target?.name || "대상자 정보 없음",
        checkerId: record.checkerId || null,
        checkerName: checker?.name || "체커 정보 없음",
        checkType: record.checkType || record.type || "visit",
        checkTypeLabel: getCheckTypeLabel(record.checkType || record.type || "visit"),
        resultStatus,
        resultStatusLabel: getActivityResultStatusLabel(resultStatus),
        checkedAt: record.checkedAt || record.createdAt || record.date || null,
      };
    });

  const checkerRows = organizationCheckers
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .slice(0, 10)
    .map((checker) => ({
      id: checker.id,
      name: checker.name || "체커 정보 없음",
      status: checker.status || checker.activityStatus || "active",
      statusLabel: getOrganizationStatusLabel(checker.status || checker.activityStatus || "active"),
      phone: checker.phone || checker.phoneNumber || checker.contactPhone || "연락처 없음",
    }));

  return {
    id: organization.id,
    name: organization.name || "기관명 없음",
    region: organization.region || "-",
    adminName: organization.adminName || organization.admin_name || "미배정",
    status: organization.status || "active",
    statusLabel: getOrganizationStatusLabel(organization.status || "active"),
    memo: organization.memo || "",
    targetCount: organizationTargets.length,
    checkerCount: organizationCheckers.length,
    emergencyCount: organizationEmergencies.length,
    unresolvedEmergencyCount: organizationEmergencies.filter(isUnresolvedEmergency).length,
    recentEmergencies,
    recentActivityRecords,
    checkers: checkerRows,
  };
}

function buildLocalSuperStatusSummaries(data) {
  const organizationSummaries = buildOrganizationSummaries(data);
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];
  const activityRecords = Array.isArray(data.activityRecords) ? data.activityRecords : [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return organizationSummaries
    .map((organization) => {
      const activeTargets = targets.filter(
        (target) =>
          getOrganizationIdFromTarget(target) === organization.id &&
          String(target.lifecycleStatus || "active") !== "ended"
      );
      const targetIds = new Set(activeTargets.map((target) => target.id));
      const organizationActivities = activityRecords.filter((record) => targetIds.has(record.targetId));
      const recentActivityRecords = organizationActivities.filter((record) => {
        const checkedValue = record.checkedAt || record.createdAt || record.date;
        if (!checkedValue) return false;
        const checkedDate = new Date(checkedValue);
        if (Number.isNaN(checkedDate.getTime())) return false;
        return checkedDate.getTime() >= sevenDaysAgo;
      });
      const organizationEmergencies = emergencyReports.filter(
        (report) => getOrganizationIdFromEmergency(report, targets) === organization.id
      );
      const lastActivityRecord = organizationActivities
        .slice()
        .sort((a, b) =>
          sortByLatestTimestamp(a.checkedAt || a.createdAt || a.date, b.checkedAt || b.createdAt || b.date)
        )[0];
      const lastEmergencyReport = organizationEmergencies
        .slice()
        .sort((a, b) => sortByLatestTimestamp(a.reportedAt || a.date, b.reportedAt || b.date))[0];

      let riskLevel = "low";
      let riskReason = "운영 상태가 안정적입니다.";

      if (
        organization.unresolvedEmergencyCount >= 3 ||
        (recentActivityRecords.length === 0 && activeTargets.length >= 1)
      ) {
        riskLevel = "high";
        riskReason =
          organization.unresolvedEmergencyCount >= 3
            ? "미처리 이상징후가 많습니다."
            : "최근 생활 확인 기록이 없습니다.";
      } else if (
        organization.unresolvedEmergencyCount >= 1 ||
        (activeTargets.length > 0 && recentActivityRecords.length < activeTargets.length)
      ) {
        riskLevel = "medium";
        riskReason =
          organization.unresolvedEmergencyCount >= 1
            ? "미처리 이상징후가 남아 있습니다."
            : "최근 생활 확인 기록이 대상자 수보다 적습니다.";
      }

      return {
        organizationId: organization.id,
        organizationName: organization.name,
        region: organization.region || "-",
        status: organization.status || "active",
        statusLabel: organization.statusLabel || getOrganizationStatusLabel(organization.status || "active"),
        adminName: organization.adminName || "미배정",
        targetCount: Number(organization.targetCount || 0),
        checkerCount: Number(organization.checkerCount || 0),
        emergencyCount: Number(organization.emergencyCount || 0),
        unresolvedEmergencyCount: Number(organization.unresolvedEmergencyCount || 0),
        recentActivityCount: recentActivityRecords.length,
        lastActivityAt: lastActivityRecord?.checkedAt || lastActivityRecord?.createdAt || lastActivityRecord?.date || null,
        lastEmergencyAt: lastEmergencyReport?.reportedAt || lastEmergencyReport?.date || null,
        riskLevel,
        riskLevelLabel: getRiskLevelLabel(riskLevel),
        riskReason,
      };
    })
    .sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      const riskDiff = (riskOrder[a.riskLevel] ?? 9) - (riskOrder[b.riskLevel] ?? 9);
      if (riskDiff !== 0) return riskDiff;
      if (b.unresolvedEmergencyCount !== a.unresolvedEmergencyCount) {
        return b.unresolvedEmergencyCount - a.unresolvedEmergencyCount;
      }
      return String(a.organizationName || "").localeCompare(String(b.organizationName || ""), "ko");
    });
}

function useOrganizationSummarySource(data) {
  const localOrganizationSummaries = useMemo(() => buildOrganizationSummaries(data), [data]);
  const [state, setState] = useState({
    loading: true,
    source: "local",
    noteClassName: "super-source-local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: "",
    organizations: localOrganizationSummaries,
  });

  useEffect(() => {
    let mounted = true;

    setState((current) => ({
      ...current,
      loading: true,
      organizations: localOrganizationSummaries,
    }));

    async function load() {
      const result = await getSupabaseOrganizationSummaries();

      if (!mounted) return;

      if (result.ok && result.organizations.length) {
        setState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          organizations: result.organizations,
        });
        return;
      }

      const fallbackMessage =
        result.source === "error"
          ? "Supabase 기관 요약을 불러오지 못해 로컬 데이터를 표시합니다."
          : result.message || "";

      setState({
        loading: false,
        source: "local",
        noteClassName: "super-source-local",
        noteLabel: "로컬 데이터 기준",
        noteMessage: fallbackMessage,
        organizations: localOrganizationSummaries,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [localOrganizationSummaries]);

  return state;
}

function useRecentEmergencySummarySource(data) {
  const localEmergencies = useMemo(() => buildRecentEmergencySummaries(data), [data]);
  const [state, setState] = useState({
    loading: true,
    source: "local",
    noteClassName: "super-source-local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: "",
    emergencies: localEmergencies,
  });

  useEffect(() => {
    let mounted = true;

    setState((current) => ({
      ...current,
      loading: true,
      emergencies: localEmergencies,
    }));

    async function load() {
      const result = await getSupabaseRecentEmergencySummaries();

      if (!mounted) return;

      if (result.ok && result.emergencies.length) {
        setState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          emergencies: result.emergencies,
        });
        return;
      }

      const fallbackMessage =
        result.source === "error"
          ? "Supabase 최근 이상징후 요약을 불러오지 못해 로컬 데이터를 표시합니다."
          : result.message || "";

      setState({
        loading: false,
        source: "local",
        noteClassName: "super-source-local",
        noteLabel: "로컬 데이터 기준",
        noteMessage: fallbackMessage,
        emergencies: localEmergencies,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [localEmergencies]);

  return state;
}

function useSuperDashboardKpiSource(data) {
  const localKpis = useMemo(
    () => ({
      organizationCount: Array.isArray(data.organizations) ? data.organizations.length : 0,
      activeTargetCount: Array.isArray(data.targets)
        ? data.targets.filter((target) => String(target.lifecycleStatus || "active") !== "ended").length
        : 0,
      checkerCount: Array.isArray(data.users) ? data.users.filter((user) => user.role === "checker").length : 0,
      emergencyCount: Array.isArray(data.emergencyReports) ? data.emergencyReports.length : 0,
      unresolvedEmergencyCount: Array.isArray(data.emergencyReports)
        ? data.emergencyReports.filter(isUnresolvedEmergency).length
        : 0,
    }),
    [data]
  );

  const [state, setState] = useState({
    loading: true,
    source: "local",
    noteClassName: "super-source-local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: "",
    kpis: localKpis,
  });

  useEffect(() => {
    let mounted = true;

    setState((current) => ({
      ...current,
      loading: true,
      kpis: localKpis,
    }));

    async function load() {
      const result = await getSupabaseSuperDashboardKpis();

      if (!mounted) return;

      if (result.ok && result.kpis) {
        setState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          kpis: result.kpis,
        });
        return;
      }

      const fallbackMessage =
        result.source === "error"
          ? "Supabase KPI를 불러오지 못해 로컬 데이터를 표시합니다."
          : result.message || "";

      setState({
        loading: false,
        source: "local",
        noteClassName: "super-source-local",
        noteLabel: "로컬 데이터 기준",
        noteMessage: fallbackMessage,
        kpis: localKpis,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [localKpis]);

  return state;
}

function useOrganizationDetailSource(data, organizationId) {
  const fallbackOrganization = useMemo(
    () => (organizationId ? buildLocalOrganizationDetail(data, organizationId) : null),
    [data, organizationId]
  );

  const [state, setState] = useState({
    loading: true,
    source: fallbackOrganization ? "local" : "not_found",
    noteClassName: fallbackOrganization ? "super-source-local" : "super-source-local",
    noteLabel: fallbackOrganization ? "로컬 데이터 기준" : "",
    noteMessage: "",
    organization: fallbackOrganization,
    notFound: !fallbackOrganization,
  });

  useEffect(() => {
    let mounted = true;

    setState((current) => ({
      ...current,
      loading: true,
      organization: fallbackOrganization,
      notFound: !fallbackOrganization,
    }));

    async function load() {
      if (!organizationId) {
        if (!mounted) return;
        setState({
          loading: false,
          source: "not_found",
          noteClassName: "super-source-local",
          noteLabel: "",
          noteMessage: "",
          organization: null,
          notFound: true,
        });
        return;
      }

      const result = await getSupabaseOrganizationDetail(organizationId);

      if (!mounted) return;

      if (result.ok && result.organization) {
        setState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          organization: result.organization,
          notFound: false,
        });
        return;
      }

      if (fallbackOrganization) {
        const fallbackMessage =
          result.source === "error"
            ? "Supabase 기관 상세 정보를 불러오지 못해 로컬 데이터를 표시합니다."
            : result.message || "";

        setState({
          loading: false,
          source: "local",
          noteClassName: "super-source-local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: fallbackMessage,
          organization: fallbackOrganization,
          notFound: false,
        });
        return;
      }

      setState({
        loading: false,
        source: result.source || "not_found",
        noteClassName: "super-source-local",
        noteLabel: "",
        noteMessage: result.message || "",
        organization: null,
        notFound: true,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [fallbackOrganization, organizationId]);

  return state;
}

function useSuperStatusSource(data) {
  const fallbackStatuses = useMemo(() => buildLocalSuperStatusSummaries(data), [data]);
  const [state, setState] = useState({
    loading: true,
    source: "local",
    noteClassName: "super-source-local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: "",
    statuses: fallbackStatuses,
  });

  useEffect(() => {
    let mounted = true;

    setState((current) => ({
      ...current,
      loading: true,
      statuses: fallbackStatuses,
    }));

    async function load() {
      const result = await getSupabaseSuperStatusSummaries();

      if (!mounted) return;

      if (result.ok) {
        setState({
          loading: false,
          source: "supabase",
          noteClassName: "super-source-supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          statuses: result.statuses,
        });
        return;
      }

      const fallbackMessage =
        result.source === "error"
          ? "Supabase 운영 상태 요약을 불러오지 못해 로컬 데이터를 표시합니다."
          : result.message || "Supabase 운영 상태 요약을 확인 중입니다.";

      setState({
        loading: false,
        source: "local",
        noteClassName: "super-source-local",
        noteLabel: "로컬 데이터 기준",
        noteMessage: fallbackMessage,
        statuses: fallbackStatuses,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [fallbackStatuses]);

  return state;
}

function SuperEmergencyStatusBadge({ status }) {
  const statusKey = getEmergencyStatusKey(status);
  const statusLabel = getEmergencyStatusLabel(status);

  return <span className={`badge badge-emergency-${statusKey} super-emergency-badge`}>{statusLabel}</span>;
}

function SuperDataSourceNote({ loading, loadingMessage, noteLabel, noteClassName, noteMessage }) {
  if (loading) {
    return <p className="muted super-data-source-note">{loadingMessage}</p>;
  }

  if (!noteLabel && !noteMessage) {
    return null;
  }

  return (
    <div className="super-data-source-note">
      {noteLabel ? <span className={`badge super-data-source-badge ${noteClassName}`}>{noteLabel}</span> : null}
      {noteMessage ? <span className="muted">{noteMessage}</span> : null}
    </div>
  );
}

function SuperRiskBadge({ riskLevel, riskLevelLabel }) {
  const badgeClassName =
    riskLevel === "high"
      ? "badge-urgency-high"
      : riskLevel === "medium"
        ? "badge-urgency-medium"
        : "badge-urgency-low";

  return <span className={`badge ${badgeClassName} super-emergency-badge`}>{riskLevelLabel}</span>;
}

function SuperOrganizationCard({ organization, showAction = false, navigate }) {
  return (
    <Card className="super-organization-card">
      <div className="card-row super-organization-card-header">
        <div>
          <strong>{organization.name}</strong>
          <p className="muted">{organization.region || "-"}</p>
        </div>
        <span className="badge badge-info">{organization.statusLabel || organization.status || "운영중"}</span>
      </div>

      <div className="super-organization-summary">
        <div className="super-organization-admin">
          <span>기관 관리자</span>
          <strong>{organization.adminName || "미배정"}</strong>
        </div>

        <div className="super-organization-metrics">
          <div className="super-organization-metric">
            <span>대상자</span>
            <strong>{organization.targetCount}명</strong>
          </div>
          <div className="super-organization-metric">
            <span>체커</span>
            <strong>{organization.checkerCount}명</strong>
          </div>
          <div className="super-organization-metric">
            <span>미처리 이상징후</span>
            <strong>{organization.unresolvedEmergencyCount}건</strong>
          </div>
        </div>
      </div>

      {showAction ? (
        <>
          <p className="muted super-organization-note">
            {organization.memo || "기관 설명이 아직 등록되지 않았습니다."}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="super-disabled-button"
            onClick={() => navigate(`/super/organizations/${organization.id}`)}
          >
            상세보기
          </Button>
        </>
      ) : null}
    </Card>
  );
}

function SuperStatusOrganizationCard({ organization, navigate }) {
  return (
    <Card className="super-organization-card super-status-card">
      <div className="card-row super-organization-card-header super-status-card-head">
        <div>
          <strong>{organization.organizationName}</strong>
          <p className="muted">{organization.region || "-"}</p>
        </div>
        <div className="super-status-card-badges">
          <span className="badge badge-info super-emergency-badge">{organization.statusLabel}</span>
          <SuperRiskBadge riskLevel={organization.riskLevel} riskLevelLabel={organization.riskLevelLabel} />
        </div>
      </div>

      <div className="super-organization-summary">
        <div className="super-organization-admin">
          <span>기관 관리자</span>
          <strong>{organization.adminName || "미배정"}</strong>
        </div>

        <div className="super-status-metrics">
          <div className="super-organization-metric">
            <span>대상자</span>
            <strong>{organization.targetCount}명</strong>
          </div>
          <div className="super-organization-metric">
            <span>체커</span>
            <strong>{organization.checkerCount}명</strong>
          </div>
          <div className="super-organization-metric">
            <span>미처리 이상징후</span>
            <strong>{organization.unresolvedEmergencyCount}건</strong>
          </div>
          <div className="super-organization-metric">
            <span>최근 7일 확인</span>
            <strong>{organization.recentActivityCount}건</strong>
          </div>
        </div>

        <div className="super-detail-meta-grid super-status-meta-grid">
          <div className="super-detail-meta-item">
            <span>마지막 생활 확인</span>
            <strong>{formatCheckedAt(organization.lastActivityAt)}</strong>
          </div>
          <div className="super-detail-meta-item">
            <span>마지막 이상징후 보고</span>
            <strong>{formatCheckedAt(organization.lastEmergencyAt)}</strong>
          </div>
        </div>

        <p className="muted super-organization-note super-status-risk-reason">
          {organization.riskReason || "운영 상태가 안정적입니다."}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="super-disabled-button"
        onClick={() => navigate(`/super/organizations/${organization.organizationId}`)}
      >
        상세 보기
      </Button>
    </Card>
  );
}

function SuperRecentEmergencyCard({ emergency }) {
  return (
    <Card className="super-emergency-card">
      <div className="card-row">
        <div>
          <strong>{emergency.targetName}</strong>
          <p className="muted">
            {emergency.organizationName} · {formatDateTime(emergency.reportedAt)}
          </p>
        </div>
        <SuperEmergencyStatusBadge status={emergency.status} />
      </div>
      <div className="card-row">
        <p className="muted">{emergency.title}</p>
        <span className="badge badge-urgency-medium super-emergency-badge">{emergency.severityLabel}</span>
      </div>
    </Card>
  );
}

function SuperSupabaseStatusCard() {
  const [status, setStatus] = useState({
    configured: false,
    ok: false,
    status: "not_configured",
    message: "Supabase 연결 상태를 아직 확인하지 않았습니다.",
    organizationCount: 0,
    userCount: 0,
    targetCount: 0,
    checkedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);

    try {
      const result = await getSupabaseConnectionStatus();
      setStatus(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheck();
  }, []);

  const statusPresentation = {
    not_configured: {
      label: "미설정",
      className: "supabase-status-muted",
    },
    connected: {
      label: "정상",
      className: "supabase-status-ok",
    },
    connected_but_restricted: {
      label: "연결됨 / 접근 제한",
      className: "supabase-status-warn",
    },
    error: {
      label: "오류",
      className: "supabase-status-error",
    },
  };

  const currentStatusPresentation =
    statusPresentation[status.status] || statusPresentation.not_configured;

  return (
    <Card className="super-supabase-status-card">
      <div className="card-row">
        <div>
          <strong>Supabase 연결 상태</strong>
          <p className="muted">{status.message}</p>
        </div>
        <span className={`badge supabase-status-badge ${currentStatusPresentation.className}`}>
          {currentStatusPresentation.label}
        </span>
      </div>

      <div className="super-organization-metrics super-supabase-status-metrics">
        <div className="super-organization-metric">
          <span>organizations</span>
          <strong>{status.organizationCount}</strong>
        </div>
        <div className="super-organization-metric">
          <span>users</span>
          <strong>{status.userCount}</strong>
        </div>
        <div className="super-organization-metric">
          <span>targets</span>
          <strong>{status.targetCount}</strong>
        </div>
      </div>

      <p className="muted super-supabase-status-note">
        SQL Editor에서 seed 데이터가 확인되더라도, RLS 정책이 적용되지 않았거나 anon 접근이 제한되면 앱에서는
        0건으로 보일 수 있습니다.
      </p>

      <div className="super-supabase-status-footer">
        <span className="muted">마지막 확인: {formatCheckedAt(status.checkedAt)}</span>
        <Button type="button" variant="ghost" onClick={handleCheck} disabled={loading}>
          {loading ? "확인 중..." : "연결 확인"}
        </Button>
      </div>
    </Card>
  );
}

function SuperOrganizationDetailCard({ organization }) {
  return (
    <Card className="super-organization-card">
      <SectionTitle title="기관 정보" />
      <div className="super-detail-meta-grid">
        <div className="super-detail-meta-item">
          <span>기관 관리자</span>
          <strong>{organization.adminName || "미배정"}</strong>
        </div>
        <div className="super-detail-meta-item">
          <span>운영 상태</span>
          <strong>{organization.statusLabel}</strong>
        </div>
        <div className="super-detail-meta-item super-detail-meta-item-wide">
          <span>메모</span>
          <strong>{organization.memo || "등록된 메모가 없습니다."}</strong>
        </div>
      </div>
    </Card>
  );
}

function SuperOrganizationActivityRecordCard({ record }) {
  return (
    <Card className="super-emergency-card">
      <div className="card-row">
        <div>
          <strong>{record.targetName}</strong>
          <p className="muted">
            {record.checkerName} · {record.checkTypeLabel}
          </p>
        </div>
        <span className="badge badge-info super-emergency-badge">{record.resultStatusLabel}</span>
      </div>
      <p className="muted">{formatDateTime(record.checkedAt)}</p>
    </Card>
  );
}

function SuperOrganizationCheckerCard({ checker }) {
  return (
    <Card className="super-emergency-card">
      <div className="card-row">
        <div>
          <strong>{checker.name}</strong>
          <p className="muted">{checker.phone || "연락처 없음"}</p>
        </div>
        <span className="badge badge-info super-emergency-badge">{checker.statusLabel}</span>
      </div>
    </Card>
  );
}

export function SuperAdminDashboard({ data }) {
  const kpiState = useSuperDashboardKpiSource(data);
  const organizationSummaryState = useOrganizationSummarySource(data);
  const recentEmergencyState = useRecentEmergencySummarySource(data);

  return (
    <>
      <PageHeader
        eyebrow="총관리자 대시보드"
        title="전체 운영 현황"
        description="기관별 운영 현황과 최근 이상징후를 한눈에 확인합니다."
      />

      <SuperDataSourceNote
        loading={kpiState.loading}
        loadingMessage="Supabase KPI를 확인 중입니다."
        noteLabel={kpiState.noteLabel}
        noteClassName={kpiState.noteClassName}
        noteMessage={kpiState.noteMessage}
      />

      <div className="statistics-grid super-kpi-grid">
        <StatCard label="전체 기관" value={`${kpiState.kpis.organizationCount}개`} tone="blue" helper="등록 기관 기준" />
        <StatCard label="전체 대상자" value={`${kpiState.kpis.activeTargetCount}명`} tone="green" helper="운영 대상자 기준" />
        <StatCard label="전체 체커" value={`${kpiState.kpis.checkerCount}명`} tone="orange" helper="체커 계정 기준" />
        <StatCard label="전체 이상징후" value={`${kpiState.kpis.emergencyCount}건`} tone="red" helper="누적 보고 기준" />
        <StatCard
          label="미처리 이상징후"
          value={`${kpiState.kpis.unresolvedEmergencyCount}건`}
          tone="red"
          helper="완료 제외"
        />
      </div>

      <div className="super-dashboard">
        <section className="section-block super-section-card">
          <SectionTitle
            title="Supabase 연결 확인"
            description="기존 localStorage 흐름은 유지한 채 읽기 전용 연결 상태만 확인합니다."
          />
          <SuperSupabaseStatusCard />
        </section>

        <section className="section-block super-section-card">
          <SectionTitle
            title="기관별 운영 요약"
            description="기관별 대상자, 체커, 미처리 이상징후를 확인합니다."
          />
          <SuperDataSourceNote
            loading={organizationSummaryState.loading}
            loadingMessage="Supabase 기관 요약을 확인 중입니다."
            noteLabel={organizationSummaryState.noteLabel}
            noteClassName={organizationSummaryState.noteClassName}
            noteMessage={organizationSummaryState.noteMessage}
          />
          {organizationSummaryState.organizations.length ? (
            <div className="super-organization-grid">
              {organizationSummaryState.organizations.map((organization) => (
                <SuperOrganizationCard key={organization.id} organization={organization} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="등록된 기관이 없습니다."
              description="표시할 기관 요약 데이터가 없습니다."
            />
          )}
        </section>

        <section className="section-block super-section-card">
          <SectionTitle
            title="최근 이상징후 요약"
            description="최근 등록된 이상징후와 현재 처리 상태를 확인합니다."
          />
          <SuperDataSourceNote
            loading={recentEmergencyState.loading}
            loadingMessage="Supabase 최근 이상징후 요약을 확인 중입니다."
            noteLabel={recentEmergencyState.noteLabel}
            noteClassName={recentEmergencyState.noteClassName}
            noteMessage={recentEmergencyState.noteMessage}
          />
          {recentEmergencyState.emergencies.length ? (
            <div className="stack compact-stack">
              {recentEmergencyState.emergencies.map((emergency) => (
                <SuperRecentEmergencyCard key={emergency.id} emergency={emergency} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="표시할 데이터가 없습니다."
              description="최근 이상징후가 등록되면 이 영역에 표시됩니다."
            />
          )}
        </section>
      </div>
    </>
  );
}

export function SuperOrganizations({ data, navigate }) {
  const organizationSummaryState = useOrganizationSummarySource(data);

  return (
    <>
      <PageHeader
        eyebrow="기관 관리"
        title="기관 목록"
        description="기관별 운영 현황을 간단히 확인합니다."
      />

      <SuperDataSourceNote
        loading={organizationSummaryState.loading}
        loadingMessage="Supabase 기관 요약을 확인 중입니다."
        noteLabel={organizationSummaryState.noteLabel}
        noteClassName={organizationSummaryState.noteClassName}
        noteMessage={organizationSummaryState.noteMessage}
      />

      {organizationSummaryState.organizations.length ? (
        <div className="super-organization-grid">
          {organizationSummaryState.organizations.map((organization) => (
            <SuperOrganizationCard
              key={organization.id}
              organization={organization}
              showAction
              navigate={navigate}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="등록된 기관이 없습니다."
          description="표시할 기관 요약 데이터가 없습니다."
        />
      )}
    </>
  );
}

export function SuperOrganizationDetailPage({ organizationId, data, navigate }) {
  const detailState = useOrganizationDetailSource(data, organizationId);
  const organization = detailState.organization;

  if (detailState.notFound || !organization) {
    return (
      <>
        <PageHeader
          eyebrow="기관 상세"
          title="기관 정보를 찾을 수 없습니다."
          description="기관 목록으로 돌아가 다시 선택해주세요."
          action={
            <Button variant="ghost" onClick={() => navigate("/super/organizations")}>
              기관 목록으로 돌아가기
            </Button>
          }
        />
        <EmptyState
          title="기관 정보를 찾을 수 없습니다."
          description={detailState.noteMessage || "선택한 기관 정보가 존재하지 않습니다."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="기관 상세"
        title={organization.name}
        description={organization.region || "-"}
        action={
          <Button variant="ghost" onClick={() => navigate("/super/organizations")}>
            목록으로 돌아가기
          </Button>
        }
      />

      <div className="super-detail-header-row">
        <span className="badge badge-info">{organization.statusLabel}</span>
        <SuperDataSourceNote
          loading={detailState.loading}
          loadingMessage="Supabase 기관 상세 정보를 확인 중입니다."
          noteLabel={detailState.noteLabel}
          noteClassName={detailState.noteClassName}
          noteMessage={detailState.noteMessage}
        />
      </div>

      <div className="statistics-grid super-kpi-grid">
        <StatCard label="대상자 수" value={`${organization.targetCount}명`} tone="green" helper="운영 대상자 기준" />
        <StatCard label="체커 수" value={`${organization.checkerCount}명`} tone="orange" helper="소속 체커 기준" />
        <StatCard label="전체 이상징후" value={`${organization.emergencyCount}건`} tone="red" helper="누적 보고 기준" />
        <StatCard
          label="미처리 이상징후"
          value={`${organization.unresolvedEmergencyCount}건`}
          tone="red"
          helper="완료 제외"
        />
      </div>

      <div className="super-detail-grid">
        <section className="section-block super-section-card">
          <SuperOrganizationDetailCard organization={organization} />
        </section>

        <section className="section-block super-section-card">
          <SectionTitle title="최근 이상징후" description="최신 5건까지 표시합니다." />
          {organization.recentEmergencies.length ? (
            <div className="stack compact-stack">
              {organization.recentEmergencies.map((emergency) => (
                <SuperRecentEmergencyCard key={emergency.id} emergency={{ ...emergency, organizationName: organization.name }} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="최근 이상징후가 없습니다."
              description="표시할 최근 이상징후 요약이 없습니다."
            />
          )}
        </section>

        <section className="section-block super-section-card">
          <SectionTitle title="최근 생활 확인 기록" description="최신 5건까지 표시합니다." />
          {organization.recentActivityRecords.length ? (
            <div className="stack compact-stack">
              {organization.recentActivityRecords.map((record) => (
                <SuperOrganizationActivityRecordCard key={record.id} record={record} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="최근 생활 확인 기록이 없습니다."
              description="표시할 최근 생활 확인 기록이 없습니다."
            />
          )}
        </section>

        <section className="section-block super-section-card">
          <SectionTitle title="소속 체커" description="최대 10명까지 표시합니다." />
          {organization.checkers.length ? (
            <div className="stack compact-stack">
              {organization.checkers.map((checker) => (
                <SuperOrganizationCheckerCard key={checker.id} checker={checker} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="등록된 체커가 없습니다."
              description="표시할 체커 정보가 없습니다."
            />
          )}
        </section>
      </div>
    </>
  );
}

function LegacySuperStatusPlaceholder() {
  return (
    <>
      <PageHeader
        eyebrow="운영 현황"
        title="운영 현황"
        description="추가 운영 현황 화면은 다음 단계에서 연결합니다."
      />
      <EmptyState
        title="준비 중입니다."
        description="총관리자 운영 현황 상세 화면은 다음 단계에서 제공합니다."
      />
    </>
  );
}

export function SuperStatusPlaceholder({ data, navigate }) {
  const statusState = useSuperStatusSource(data);

  const summary = useMemo(() => {
    const statuses = Array.isArray(statusState.statuses) ? statusState.statuses : [];

    return {
      organizationCount: statuses.length,
      stableCount: statuses.filter((item) => item.riskLevel === "low").length,
      cautionCount: statuses.filter((item) => item.riskLevel === "medium").length,
      highRiskCount: statuses.filter((item) => item.riskLevel === "high").length,
      unresolvedEmergencyCount: statuses.reduce(
        (total, item) => total + Number(item.unresolvedEmergencyCount || 0),
        0
      ),
    };
  }, [statusState.statuses]);

  return (
    <>
      <PageHeader
        eyebrow="운영 현황"
        title="운영 상태"
        description="기관별 운영 상태, 미처리 이상징후, 최근 생활 확인 흐름을 확인합니다."
      />

      <SuperDataSourceNote
        loading={statusState.loading}
        loadingMessage="Supabase 운영 상태 요약을 확인 중입니다."
        noteLabel={statusState.noteLabel}
        noteClassName={statusState.noteClassName}
        noteMessage={statusState.noteMessage}
      />

      <div className="statistics-grid super-kpi-grid">
        <StatCard label="전체 기관" value={`${summary.organizationCount}개`} tone="blue" helper="표시 기관 기준" />
        <StatCard label="안정 기관" value={`${summary.stableCount}개`} tone="green" helper="risk low 기준" />
        <StatCard label="주의 기관" value={`${summary.cautionCount}개`} tone="orange" helper="risk medium 기준" />
        <StatCard label="고위험 기관" value={`${summary.highRiskCount}개`} tone="red" helper="risk high 기준" />
        <StatCard
          label="전체 미처리 이상징후"
          value={`${summary.unresolvedEmergencyCount}건`}
          tone="red"
          helper="완료 제외"
        />
      </div>

      {statusState.statuses.length ? (
        <div className="super-status-grid">
          {statusState.statuses.map((organization) => (
            <SuperStatusOrganizationCard
              key={organization.organizationId}
              organization={organization}
              navigate={navigate}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="표시할 운영 상태 데이터가 없습니다."
          description="기관 운영 상태 요약을 불러오면 이 화면에 표시됩니다."
        />
      )}
    </>
  );
}
