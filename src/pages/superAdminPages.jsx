import { Button, Card, EmptyState, PageHeader, SectionTitle, StatCard } from "../components/UI.jsx";

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

function isUnresolvedEmergency(report) {
  const status = getEmergencyStatusKey(report?.status).toLowerCase();
  return status !== "completed" && status !== "resolved";
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
      targetCount,
      checkerCount,
      emergencyCount: organizationEmergencies.length,
      unresolvedEmergencyCount,
    };
  });
}

function SuperEmergencyStatusBadge({ status }) {
  const statusKey = getEmergencyStatusKey(status);
  const statusLabel = getEmergencyStatusLabel(status);

  return <span className={`badge badge-emergency-${statusKey} super-emergency-badge`}>{statusLabel}</span>;
}

function SuperOrganizationCard({ organization, showAction = false }) {
  return (
    <Card className="super-organization-card">
      <div className="card-row super-organization-card-header">
        <div>
          <strong>{organization.name}</strong>
          <p className="muted">{organization.region}</p>
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

export function SuperAdminDashboard({ data }) {
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const emergencyReports = Array.isArray(data.emergencyReports) ? data.emergencyReports : [];
  const organizationSummaries = buildOrganizationSummaries(data);
  const checkerUsers = users.filter((user) => user.role === "checker");
  const unresolvedEmergencyReports = emergencyReports.filter(isUnresolvedEmergency);
  const recentEmergencyReports = [...emergencyReports]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="총관리자 대시보드"
        title="전체 운영 현황"
        description="기관별 운영 현황과 최근 이상징후를 한눈에 확인합니다."
      />

      <div className="statistics-grid super-kpi-grid">
        <StatCard label="전체 기관" value={`${organizations.length}개`} tone="blue" helper="등록 기관 기준" />
        <StatCard label="전체 대상자" value={`${targets.length}명`} tone="green" helper="운영 데이터 기준" />
        <StatCard label="전체 체커" value={`${checkerUsers.length}명`} tone="orange" helper="체커 계정 기준" />
        <StatCard
          label="전체 이상징후"
          value={`${emergencyReports.length}건`}
          tone="red"
          helper="누적 보고 기준"
        />
        <StatCard
          label="미처리 이상징후"
          value={`${unresolvedEmergencyReports.length}건`}
          tone="red"
          helper="완료 제외"
        />
      </div>

      <div className="super-dashboard">
        <section className="section-block super-section-card">
          <SectionTitle
            title="기관별 운영 요약"
            description="기관별 대상자, 체커, 미처리 이상징후를 확인합니다."
          />
          {organizationSummaries.length ? (
            <div className="super-organization-grid">
              {organizationSummaries.map((organization) => (
                <SuperOrganizationCard key={organization.id} organization={organization} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="표시할 데이터가 없습니다."
              description="기관 데이터가 준비되면 이 영역에 표시됩니다."
            />
          )}
        </section>

        <section className="section-block super-section-card">
          <SectionTitle
            title="최근 이상징후 요약"
            description="최근 등록된 이상징후와 현재 처리 상태를 확인합니다."
          />
          {recentEmergencyReports.length ? (
            <div className="stack compact-stack">
              {recentEmergencyReports.map((report) => {
                const target = targets.find((item) => item.id === report.targetId);
                const organizationId = getOrganizationIdFromEmergency(report, targets);
                const organization = organizations.find((item) => item.id === organizationId);

                return (
                  <Card key={report.id} className="super-emergency-card">
                    <div className="card-row">
                      <div>
                        <strong>{target?.name || "대상자 정보 없음"}</strong>
                        <p className="muted">
                          {organization?.name || "기관 정보 없음"} · {report.date || "날짜 정보 없음"}
                        </p>
                      </div>
                      <SuperEmergencyStatusBadge status={report.status} />
                    </div>
                  </Card>
                );
              })}
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
  const organizationSummaries = buildOrganizationSummaries(data);

  return (
    <>
      <PageHeader
        eyebrow="기관 관리"
        title="기관 목록"
        description="기관별 운영 현황을 간단히 확인합니다."
      />

      {organizationSummaries.length ? (
        <div className="super-organization-grid">
          {organizationSummaries.map((organization) => (
            <SuperOrganizationCard key={organization.id} organization={organization} showAction />
          ))}
        </div>
      ) : (
        <EmptyState
          title="표시할 데이터가 없습니다."
          description="기관 데이터가 준비되면 목록에서 확인할 수 있습니다."
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
