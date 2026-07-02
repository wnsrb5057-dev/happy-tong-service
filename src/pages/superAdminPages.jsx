import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "../components/UI.jsx";
import { getSupabaseConnectionStatus } from "../services/supabaseHealthService.js";
import { getSupabaseOrganizationSummaries } from "../services/supabaseOrganizationSummaryService.js";
import { getSupabaseRecentEmergencySummaries } from "../services/supabaseRecentEmergencyService.js";
import { getSupabaseSuperDashboardKpis } from "../services/supabaseSuperDashboardKpiService.js";

const DEFAULT_ORGANIZATION_ID = "org-eunpyeong-care";

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

function getEmergencyStatusKey(status) {
  const normalized = String(status || "received").trim();
  const statusMap = {
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

  return statusMap[normalized] || normalized;
}

function getEmergencyStatusLabel(status) {
  const statusKey = getEmergencyStatusKey(status);
  const labelMap = {
    received: "접수됨",
    checking: "확인중",
    contacted: "보호자 연락",
    visiting: "방문 필요",
    completed: "완료",
  };

  return labelMap[statusKey] || status || "접수됨";
}

function getEmergencySeverityLabel(severity) {
  const normalized = String(severity || "normal").trim();
  const severityMap = {
    normal: "일반",
    caution: "주의",
    urgent: "긴급",
    일반: "일반",
    주의: "주의",
    긴급: "긴급",
  };

  return severityMap[normalized] || normalized;
}

function isUnresolvedEmergency(report) {
  const status = getEmergencyStatusKey(report?.status).toLowerCase();
  return status !== "completed" && status !== "resolved";
}

function getOrganizationStatusLabel(status) {
  const normalized = String(status || "active").trim();
  const labelMap = {
    active: "운영중",
    pilot: "파일럿",
    paused: "일시중지",
    ended: "운영종료",
    운영중: "운영중",
    파일럿: "파일럿",
    일시중지: "일시중지",
    운영종료: "운영종료",
  };

  return labelMap[normalized] || normalized;
}

function buildOrganizationSummaries(data) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];

  return organizations.map((organization) => {
    const targetCount = targets.filter((target) => getOrganizationIdFromTarget(target) === organization.id).length;
    const checkerCount = users.filter(
      (user) => user.role === "checker" && getOrganizationIdFromUser(user) === organization.id
    ).length;
    const organizationEmergencies = emergencyReports.filter(
      (report) => getOrganizationIdFromEmergency(report, targets) === organization.id
    );
    const unresolvedEmergencyCount = organizationEmergencies.filter(isUnresolvedEmergency).length;

    return {
      ...organization,
      adminName: organization?.adminName || organization?.admin_name || "미배정",
      status: organization?.status || "active",
      statusLabel: getOrganizationStatusLabel(organization?.status || "active"),
      memo: organization?.memo || "",
      targetCount,
      checkerCount,
      emergencyCount: organizationEmergencies.length,
      unresolvedEmergencyCount,
    };
  });
}

function buildRecentEmergencySummaries(data) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];

  return [...emergencyReports]
    .sort((a, b) =>
      String(b.reportedAt || b.date || "").localeCompare(String(a.reportedAt || a.date || ""))
    )
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
        title: report.title || "이상징후 보고",
        severity: report.severity || report.issueLevel || "normal",
        severityLabel: getEmergencySeverityLabel(report.severity || report.issueLevel || "normal"),
        status: report.status || "received",
        statusLabel: getEmergencyStatusLabel(report.status || "received"),
        reportedAt: report.reportedAt || report.date || null,
      };
    });
}

function formatCheckedAt(checkedAt) {
  if (!checkedAt) return "-";

  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return checkedAt;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReportedAt(reportedAt) {
  if (!reportedAt) return "날짜 정보 없음";

  const date = new Date(reportedAt);
  if (Number.isNaN(date.getTime())) return reportedAt;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
      activeTargetCount: Array.isArray(data.targets) ? data.targets.length : 0,
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

function SuperEmergencyStatusBadge({ status }) {
  const statusKey = getEmergencyStatusKey(status);
  const statusLabel = getEmergencyStatusLabel(status);

  return <span className={`badge badge-emergency-${statusKey} super-emergency-badge`}>{statusLabel}</span>;
}

function SuperDataSourceNote({ loading, loadingMessage, noteLabel, noteClassName, noteMessage }) {
  if (loading) {
    return <p className="muted super-data-source-note">{loadingMessage}</p>;
  }

  return (
    <div className="super-data-source-note">
      <span className={`badge super-data-source-badge ${noteClassName}`}>{noteLabel}</span>
      {noteMessage ? <span className="muted">{noteMessage}</span> : null}
    </div>
  );
}

function SuperOrganizationCard({ organization, showAction = false }) {
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
            onClick={() => window.alert("기관 상세 기능은 준비 중입니다.")}
          >
            상세보기
          </Button>
        </>
      ) : null}
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
            {emergency.organizationName} · {formatReportedAt(emergency.reportedAt)}
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

export function SuperOrganizations({ data }) {
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
            <SuperOrganizationCard key={organization.id} organization={organization} showAction />
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

export function SuperStatusPlaceholder() {
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
