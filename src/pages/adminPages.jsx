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
  getReportStats,
  getTargetRiskStats,
  getToday as getTodayFromStats,
} from "../services/statisticsService.js";
import {
  formatReportPeriod,
  generateReportDraft,
  generateReportSummary,
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
import { getActiveTargets } from "../services/targetService.js";

function getToday() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function byLatestDate(a, b) {
  return b.date.localeCompare(a.date);
}

function truncateText(text, maxLength = 56) {
  if (!text) return "�޸� ����";
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

function targetName(targets, targetId) {
  return targetById(targets, targetId)?.name ?? "����� ����";
}

function checkerName(users, checkerId) {
  return checkerById(users, checkerId)?.name ?? "üĿ ����";
}

function checkerPhone(users, checkerId) {
  return checkerById(users, checkerId)?.phone ?? "����ó ����";
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
  const days = ["��", "��", "ȭ", "��", "��", "��", "��"];
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
    (report) => report.checkerId === checker.id && report.status !== "completed"
  );

  if (checker.status === "needs_attention" || hasPending || hasOpenEmergency) {
    return "needs_attention";
  }

  return checker.status || "active";
}

export function AdminDashboard({ data, navigate }) {
  const today = getTodayFromStats();
  const todayPlanDay = ["��", "��", "ȭ", "��", "��", "��", "��"][new Date().getDay()];
  const stats = getDashboardStats(data);
  const todayScheduled = data.targets.filter(isTodayScheduled).length;
  const completedToday = data.activityRecords.filter((record) => record.date === today && record.status === "completed").length;
  const urgentReports = data.emergencyReports.filter((report) => getIssueLevel(report) === "urgent" && report.status !== "completed");
  const unresolvedReports = data.emergencyReports.filter((report) => report.status !== "completed");
  const weekPlan = getWeekPlan(data.targets);
  const [selectedPlanDay, setSelectedPlanDay] = useState(todayPlanDay);
  const selectedPlan = weekPlan.find((item) => item.day === selectedPlanDay) || weekPlan[0];
  const recentEmergencyReports = [...data.emergencyReports]
    .sort((a, b) => {
      const urgentDiff = Number(getIssueLevel(b) === "urgent") - Number(getIssueLevel(a) === "urgent");
      if (urgentDiff) return urgentDiff;
      const statusDiff = Number(a.status === "completed") - Number(b.status === "completed");
      if (statusDiff) return statusDiff;
      return byLatestDate(a, b);
    })
    .slice(0, 5);
  const recentActivities = [...data.activityRecords].sort(byLatestDate).slice(0, 4);

  const riskPriority = {
  danger: 0,
  warning: 1,
  normal: 2,
};

const urgencyPriority = {
  high: 0,
  medium: 1,
  low: 2,
};

const statusPriority = {
  pending: 0,
  received: 1,
  processing: 2,
  completed: 3,
};

const sortedSelectedPlanTargets = [...selectedPlan.targets].sort((a, b) => {
  return (riskPriority[a.riskLevel] ?? 99) - (riskPriority[b.riskLevel] ?? 99);
});

const sortedRecentEmergencyReports = [...recentEmergencyReports].sort((a, b) => {
  const urgencyDiff = (urgencyPriority[a.urgency] ?? 99) - (urgencyPriority[b.urgency] ?? 99);
  if (urgencyDiff !== 0) return urgencyDiff;

  const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
  if (statusDiff !== 0) return statusDiff;

  return new Date(b.date) - new Date(a.date);
});
  return (
    <>
      <PageHeader
        eyebrow="������ ��ú���"
        title="� ��Ȳ"
        description="���� ��� ������ �ִ��� ���� Ȯ���մϴ�."
      />

      <div className="admin-dashboard-layout">
        <Card className="summary-card admin-dashboard-summary">
          <p className="eyebrow">���� � ��Ȳ �� {today}</p>
          <strong>Ȯ�� ���� {todayScheduled}�� �� �Ϸ� {completedToday}�� �� ���ۼ� {stats.pendingActivityCount}��</strong>
          <span>�̻�¡�� {stats.emergencyCount}�� �� ��� Ȯ�� {urgentReports.length}��</span>
        </Card>

         <div className="admin-dashboard-grid">
          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="�켱 ó�� �ʿ�" description="��� Ȯ�ΰ� ��ó�� ���� ���� Ȯ���ϼ���." />
            <div className="priority-list">
              <button type="button" onClick={() => navigate('/admin/emergencies')}>��� Ȯ�� �ʿ� {urgentReports.length}��</button>
              <button type="button" onClick={() => navigate('/admin/emergencies')}>��ó�� �̻�¡�� {unresolvedReports.length}��</button>
              <button type="button" onClick={() => navigate('/admin/targets')}>���� ����� {stats.dangerTargetCount}��</button>
              <button type="button" onClick={() => navigate('/admin/activities')}>��� ���� �ʿ� {stats.pendingActivityCount}��</button>
            </div>
          </section>

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="�̹� �� Ȯ�� ��ȹ" />
            <div className="week-strip">
              {weekPlan.map((item) => (
                <button
               className={`week-day-button ${selectedPlanDay === item.day ? 'week-day-button-selected' : ''}`}
               key={item.day}
               type="button"
               onClick={() => setSelectedPlanDay(item.day)}
             >
               <strong>{item.day}</strong>
               <span>{item.targets.length}��</span>
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
            {checkerName(data.users, target.assignedCheckerId)} �� {checkTypeLabels[getTargetCheckType(target)]}
          </p>
        </div>
        <StatusBadge type="risk" value={target.riskLevel} />
      </div>
    </Card>
  ))
) : (
                <EmptyState title={`${selectedPlan.day}���� Ȯ�� ��ȹ ����`} description="�ش� ���Ͽ� ��ϵ� Ȯ�� ����ڰ� �����ϴ�." />
              )}
            </div>
          </section>

          <section className="section-block admin-dashboard-panel">
  <SectionTitle
    title="�ֱ� �̻�¡��"
    action={<Button variant="ghost" onClick={() => navigate('/admin/emergencies')}>��ü ����</Button>}
  />
  <div className="stack">
    {sortedRecentEmergencyReports.length ? (
  sortedRecentEmergencyReports.map((report) => (
        <Card key={report.id} className={report.urgency === 'high' ? 'danger-card' : 'alert-card'}>
          <div className="card-row">
            <div>
              <strong>{targetName(data.targets, report.targetId)}</strong>
              <p className="muted">{report.date} �� {report.issueType}</p>
            </div>
            <div className="badge-row compact-badges">
              <StatusBadge type="urgency" value={report.urgency} />
              <StatusBadge type="emergency" value={report.status} />
            </div>
          </div>
          <p className="muted">{truncateText(report.description)}</p>
          <div className="dashboard-card-actions">
  <Button
    variant="ghost"
    className="dashboard-small-button"
    onClick={() => navigate(`/admin/emergencies/${report.id}`)}
  >
    �󼼺���
  </Button>
</div>
        </Card>
      ))
    ) : (
      <EmptyState title="��� �˸� ����" description="�� ������ ��ϵǸ� �� ������ ǥ�õ˴ϴ�." />
    )}
  </div>
</section>

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="�ֱ� Ȯ�� ���" />
            <div className="stack">
              {recentActivities.map((record) => (
                <Card key={record.id}>
                  <div className="card-row">
                    <div>
                      <strong>{targetName(data.targets, record.targetId)}</strong>
                      <p className="muted">{record.date} �� {checkerName(data.users, record.checkerId)} �� {activityTypeLabels[getCheckType(record)]}</p>
                    </div>
                    <StatusBadge type="record" value={record.status} />
                  </div>
                  <p className="muted">{truncateText(record.memo)}</p>
                </Card>
              ))}
            </div>
          </section>
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
        (report) => report.checkerId === checker.id && report.status !== "completed"
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
      <PageHeader eyebrow="üĿ ����" title="üĿ � ����" description="��� ����ڿ� Ȯ�� ��� ���� �ʿ� ���θ� Ȯ���մϴ�." />

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>üĿ �̿� ��û</h2>
            <p className="muted">�Ҽ� ������� ������ üĿ ��û�� Ȯ���ϰų� �ݷ��մϴ�.</p>
          </div>
        </div>
        {pendingSignupRequests.length ? (
          <div className="stack compact-stack">
            {pendingSignupRequests.map((request) => (
              <Card key={request.id} className="checker-request-card">
                <div className="card-row checker-request-head">
                  <div>
                    <strong>{request.name}</strong>
                    <p className="muted">{request.loginId} �� {request.phone}</p>
                  </div>
                  <span className="badge badge-info">���� ���</span>
                </div>
                <div className="checker-request-meta">
                  <p><strong>�Ҽ� ���</strong> {request.organizationName}</p>
                  <p><strong>��û��</strong> {String(request.createdAt || "").slice(0, 10)}</p>
                  <p><strong>�޸�</strong> {request.memo || "�޸� ����"}</p>
                </div>
                <div className="checker-request-actions">
                  <Button onClick={() => actions.approveSignupRequest(request.id)}>�̿� ����</Button>
                  <Button variant="secondary" onClick={() => actions.rejectSignupRequest(request.id)}>�ݷ�</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="���� ������� ������ ��� ��û�� �����ϴ�."
            description="�ٸ� ������� ��û�� üĿ�� �� ȭ�鿡 ǥ�õ��� �ʽ��ϴ�."
          />
        )}
      </section>

      <Card className="summary-card">
        <p className="eyebrow">üĿ ��Ȳ</p>
        <strong>��ü {checkers.length}�� �� ���� Ȯ�� ���� {activeCount}��</strong>
        <span>��� ���� �ʿ� {pendingCheckerCount}�� �� ���� �ʿ� {attentionCount}��</span>
      </Card>

      <div className="filter-tabs compact-filter-tabs" aria-label="üĿ ����">
        {[
          { value: "all", label: "��ü" },
          { value: "active", label: "����" },
          { value: "needs_attention", label: "���� �ʿ�" },
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
                <p className="muted">{checker.phone}</p>
              </div>
              <StatusBadge type="checker" value={checker.status} />
            </div>
            <div className="admin-checker-metrics">
              <div><span>��� �����</span><strong>{checker.assignedCount}��</strong></div>
              <div><span>���� Ȯ�� �Ϸ�</span><strong>{checker.completedCount}��</strong></div>
              <div><span>��� ���� �ʿ�</span><strong>{checker.pendingCount}��</strong></div>
              <div><span>�̻�¡�� ���� ����</span><strong>{checker.emergencyCount ? `${checker.emergencyCount}��` : "����"}</strong></div>
            </div>
            <Button
              variant="ghost"
              className="full-width admin-checker-detail-button"
              onClick={() => navigate(`/admin/checkers/${checker.id}`)}
            >
              �� ����
            </Button>
          </Card>
        ))}
      </div>
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
        (report) => report.checkerId === checker.id && report.status !== "completed"
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
    setSaveMessage("��� ����� ������ ����Ǿ����ϴ�.");
    window.setTimeout(() => {
      setSaveMessage("");
    }, 2400);
  }

  if (!checker || !checkerSummary) {
    return (
      <div className="center-panel">
        <EmptyState title="üĿ ������ ã�� �� �����ϴ�." description="������� ���ư� �ٽ� Ȯ�����ּ���." />
        <Button onClick={() => navigate("/admin/checkers")}>������� �̵�</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="üĿ ��"
        title={checkerSummary.name}
        description="üĿ � ��Ȳ�� ��� ����� ������ Ȯ���մϴ�."
        action={
          <Button variant="ghost" onClick={() => navigate("/admin/checkers")}>
            ������� �̵�
          </Button>
        }
      />

      <Card className="admin-checker-detail-card">
        <div className="card-row admin-checker-detail-head">
          <div>
            <strong>{checkerSummary.name}</strong>
            <p className="muted">{checkerSummary.phone} �� {checkerSummary.organizationName || "�Ҽ� ��� ���� ����"}</p>
          </div>
          <StatusBadge type="checker" value={checkerSummary.status} />
        </div>
        <div className="admin-checker-detail-metrics">
          <div><span>��� ����� ��</span><strong>{checkerSummary.assignedCount}��</strong></div>
          <div><span>���� Ȯ�� �Ϸ�</span><strong>{checkerSummary.completedCount}��</strong></div>
          <div><span>��� ���� �ʿ�</span><strong>{checkerSummary.pendingCount}��</strong></div>
          <div><span>�̻�¡�� ���� ����</span><strong>{checkerSummary.emergencyCount ? `${checkerSummary.emergencyCount}��` : "����"}</strong></div>
        </div>
      </Card>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>��� ����� ����</h2>
            <p className="muted">���� üĿ���� ������ ����ڿ� �̹��� ����� �Բ� Ȯ���մϴ�.</p>
          </div>
        </div>

        <Card className="checker-assignment-section admin-checker-assignment-card">
          <div className="checker-assignment-summary">
            <strong>���� ��Ȳ</strong>
            <span>���� ���� {assignedTargetIds.length}�� �� �̹��� {unassignedCount}��</span>
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
                        <span className="badge badge-muted">{`${assignedChecker?.name || "�ٸ� üĿ"} ������`}</span>
                      ) : isChecked ? (
                        <span className="badge badge-info">���� �� üĿ���� ������</span>
                      ) : (
                        <span className="badge badge-muted">�̹���</span>
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
      ������� ���� ��������� �ֽ��ϴ�.
    </p>
  ) : null}
</div>
          <div className="checker-assignment-actions">
          <Button onClick={handleAssignmentSave}>
  {saveMessage ? "���� �Ϸ�" : "���� ����"}
</Button>
            <Button variant="secondary" onClick={handleAssignmentCancel}>���� ���</Button>
          </div>
        </Card>
      </section>
    </>
  );
}
export function AdminTargets({ data, navigate }) {
  const [filter, setFilter] = useState("all");
  const activeTargets = getActiveTargets(data.targets);
  const filteredTargets = data.targets
    .filter((target) => {
      const lifecycleStatus = target.lifecycleStatus || "active";
      if (filter === "ended") return lifecycleStatus === "ended";
      if (lifecycleStatus === "ended") return false;
      if (filter === "today") return isTodayScheduled(target);
      if (filter === "all") return true;
      return target.riskLevel === filter;
    })
    .sort(sortTargetsForAdmin);

  return (
    <>
      <PageHeader eyebrow="����� ����" title="����� ��Ȳ" description="Ȯ�� ����, ���赵, ��� üĿ�� Ȯ���մϴ�." />

      <Card className="summary-card">
        <p className="eyebrow">����� ��Ȳ</p>
        <strong>��ü {activeTargets.length}�� �� ���� Ȯ�� {activeTargets.filter(isTodayScheduled).length}��</strong>
        <span>
          ���� {activeTargets.filter((target) => target.riskLevel === "normal").length}�� �� ���� {activeTargets.filter((target) => target.riskLevel === "caution").length}�� �� ���� {activeTargets.filter((target) => target.riskLevel === "danger").length}��
        </span>
      </Card>

      <div className="filter-tabs target-filter-tabs" aria-label="����� ����">
        {[
          { value: "all", label: "��ü" },
          { value: "normal", label: "����" },
          { value: "caution", label: "����" },
          { value: "danger", label: "����" },
          { value: "today", label: "���� Ȯ��" },
          { value: "ended", label: "��������" },
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
        {filteredTargets.map((target) => (
          <button className={`target-card admin-target-card risk-card-${target.riskLevel}`} key={target.id} type="button" onClick={() => navigate(`/admin/targets/${target.id}`)}>
            <div className="card-row">
              <div>
                <strong>{target.name}</strong>
                <p>{target.age}�� �� {target.gender} �� {getTargetArea(target)}</p>
              </div>
              <StatusBadge type="risk" value={target.riskLevel} />
            </div>
            <div className="admin-target-meta">
  <div className="admin-target-meta-item">
    <span>��� üĿ</span>
    <strong>{checkerName(data.users, target.assignedCheckerId)}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>�⺻ Ȯ�� ����</span>
    <strong>{checkTypeLabels[getTargetCheckType(target)]}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>Ȯ�� ����</span>
    <strong>{target.checkDays?.join(", ") || "���� ����"}</strong>
  </div>
  <div className="admin-target-meta-item">
    <span>�ֱ� Ȯ����</span>
    <strong>{target.lastVisitDate}</strong>
  </div>
</div>
            <span className="admin-target-detail-action">�󼼺���</span>
          </button>
        ))}
      </div>
    </>
  );
}
export function AdminTargetDetail({ targetId, data, actions, navigate }) {
  const target = targetById(data.targets, targetId);

  if (!target) {
    return <EmptyState title="����ڸ� ã�� �� �����ϴ�" description="����� ���� ȭ�鿡�� �ٽ� �������ּ���." />;
  }

  const checker = checkerById(data.users, target.assignedCheckerId);
  const visits = data.activityRecords.filter((record) => record.targetId === target.id).sort(byLatestDate);
  const reports = data.emergencyReports.filter((report) => report.targetId === target.id).sort(byLatestDate);

  function handleEndLifecycle() {
    if ((target.lifecycleStatus || "active") === "ended") {
      return;
    }

    const confirmed = window.confirm("�� ������� ������ �����Ͻðڽ��ϱ�?");
    if (!confirmed) {
      return;
    }

    actions.updateTargetLifecycleStatus(target.id, "ended");
    navigate("/admin/targets");
  }

  return (
    <>
      <PageHeader
        eyebrow="����� ��"
        title={target.name}
        description={`${target.age}�� �� ${target.gender} �� ${target.address}`}
      />

      <Card>
        <h2>�⺻����</h2>
        <InfoList
          items={[
            { label: "�̸�", value: target.name },
            { label: "����/����", value: `${target.age}�� �� ${target.gender}` },
            { label: "�ּ�", value: target.address },
            { label: "���赵", value: <StatusBadge type="risk" value={target.riskLevel} /> },
            { label: "�ֱ� Ȯ����", value: target.lastVisitDate },
            { label: "�⺻ Ȯ�� ����", value: checkTypeLabels[getTargetCheckType(target)] },
            { label: "Ȯ�� ����", value: target.checkDays?.join(", ") || "���� ����" },
          ]}
        />
      </Card>

      <Card>
        <h2>��� ����</h2>
        <InfoList
          items={[
            { label: "��� üĿ", value: checker?.name ?? "�̹���" },
            { label: "üĿ ����ó", value: checker?.phone ?? "����ó ����" },
          ]}
        />
      </Card>

      <Card>
        <h2>�ǰ� �� ���ǻ���</h2>
        <InfoList
          items={[
            { label: "�ǰ�����", value: target.healthStatus },
            { label: "���ǻ���", value: target.cautionNote },
            { label: "���� �޸�", value: target.medicationNote || "��ϵ� ���� �޸� ����" },
          ]}
        />
      </Card>

      <Card>
        <h2>��ȣ�� ����</h2>
        <InfoList
          items={[
            { label: "��ȣ�� �̸�", value: target.guardianName },
            { label: "��ȣ�� ����ó", value: target.guardianPhone },
          ]}
        />
      </Card>

      <Card>
        <h2>{"관리 상태"}</h2>
        <InfoList
          items={[
            {
              label: "상태",
              value: (target.lifecycleStatus || "active") === "ended" ? "관리종료" : "관리중",
            },
          ]}
        />
        <Button
          variant={(target.lifecycleStatus || "active") === "ended" ? "secondary" : "danger"}
          className="full-width"
          onClick={handleEndLifecycle}
          disabled={(target.lifecycleStatus || "active") === "ended"}
        >
          {(target.lifecycleStatus || "active") === "ended" ? "관리종료됨" : "관리 종료"}
        </Button>
      </Card>

      <section className="section-block">
        <SectionTitle title="�ֱ� Ȯ�� ���" />
        <div className="stack compact-stack">
          {visits.length ? (
            visits.slice(0, 5).map((record) => (
              <Card key={record.id} className="admin-target-recent-record-card">
                <div className="card-row">
                  <div>
                    <strong>{record.date}</strong>
                    <p className="muted">{checkerName(data.users, record.checkerId)} �� {activityTypeLabels[getCheckType(record)]}</p>
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
            <EmptyState title="Ȯ�� ����� �����ϴ�" description="����� ��ϵǸ� �� ������ ǥ�õ˴ϴ�." />
          )}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="�̻�¡�� ����" />
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
                    <StatusBadge type="emergency" value={report.status} />
                  </div>
                </div>
                <p className="muted">{truncateText(report.description)}</p>
              </Card>
            ))
          ) : (
            <EmptyState title="�̻�¡�� ������ �����ϴ�" description="������ ��ϵǸ� �� ������ ǥ�õ˴ϴ�." />
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
      <PageHeader eyebrow="Ȯ�� ���" title="Ȯ�� ��� ��ȸ" description="üĿ�� �ۼ��� Ȯ�� ����� �����մϴ�." />

      <Card className="summary-card">
        <p className="eyebrow">��� ��Ȳ</p>
        <strong>��ü {data.activityRecords.length}�� �� ���� {data.activityRecords.filter((record) => record.date === today).length}��</strong>
        <span>�̻�¡�� ���� {data.activityRecords.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length}�� �� �̿Ϸ� {data.activityRecords.filter((record) => record.status !== "completed").length}��</span>
      </Card>

      <div className="filter-tabs activity-filter-tabs" aria-label="Ȯ�� ��� ����">
  {[
    { value: "all", label: "��ü" },
    { value: "today", label: "����" },
    { value: "issue", label: "�̻�¡��" },
    { value: "pending", label: "�̿Ϸ�" },
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
              {record.date || "��¥ ���� ����"} �� {checkerName(data.users, record.checkerId)} �� {activityTypeLabels[getCheckType(record)]}
            </p>
          </div>
        
          <p className="muted admin-activity-memo">
            {truncateText(record.memo)}
          </p>
        
          <div className="badge-row compact-badges admin-activity-badges">
            <StatusBadge type="health" value={record.healthStatus || "good"} />
            <span className={record.hasIssue || record.issueLevel !== "none" ? "badge badge-risk-danger" : "badge badge-muted"}>
              {record.hasIssue || record.issueLevel !== "none" ? "�̻�¡�� ����" : "�̻�¡�� ����"}
            </span>
            <StatusBadge type="record" value={record.status} />
          </div>
        
          <Button
            variant="ghost"
            className="admin-activity-inline-button"
            onClick={() => setOpenRecordId(openRecordId === record.id ? "" : record.id)}
          >
            �󼼺���
          </Button>
        
          {openRecordId === record.id ? (
            <div className="detail-box admin-activity-detail-box">
              <p>üĿ: {checkerName(data.users, record.checkerId)}</p>
              <p>üũ ����: {activityTypeLabels[getCheckType(record)]}</p>
              <p>�޸�: {record.memo || "�޸� ����"}</p>
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
    const receivedDiff = Number(a.status === "received") - Number(b.status === "received");
    if (receivedDiff) return receivedDiff;
    const progressDiff = Number(a.status === "in_progress") - Number(b.status === "in_progress");
    if (progressDiff) return progressDiff;
    return byLatestDate(a, b);
  });
  const filteredReports = reports.filter((report) => {
    if (filter === "high") return report.urgency === "high";
    if (filter === "received") return report.status === "received";
    if (filter === "in_progress") return report.status === "in_progress";
    if (filter === "completed") return report.status === "completed";
    return report.status !== "completed";
  });
  const urgentCount = reports.filter((report) => report.urgency === "high").length;
  const unresolvedCount = reports.filter((report) => report.status !== "completed").length;

  return (
    <>
      <PageHeader eyebrow="�̻�¡�� ����" title="�̻�¡�� ���� ��Ȳ" description="��� Ȯ���� �ʿ��� �������� �켱 Ȯ���մϴ�." />

      <Card className="summary-card">
        <p className="eyebrow">�켱 Ȯ�� �ʿ�</p>
        <strong>��� Ȯ�� �ʿ� {urgentCount}�� �� ��ó�� {unresolvedCount}��</strong>
      </Card>

      <div className="filter-tabs emergency-filter-tabs" aria-label="�̻�¡�� ���� ����">
        {[
          { value: "all", label: "��ü" },
          { value: "received", label: "��ó��" },
          { value: "in_progress", label: "ó����" },
          { value: "completed", label: "�Ϸ�" },
          { value: "high", label: "��� Ȯ��" },
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
        {filteredReports.map((report) => (
          <Card
  key={report.id}
  className={`admin-emergency-list-card ${report.urgency === 'high' ? 'danger-card' : 'alert-card'}`}
>
  <div className="admin-emergency-list-head">
    <div className="admin-emergency-list-copy">
      <strong>{targetName(data.targets, report.targetId)}</strong>
      <p className="muted">{report.date} �� {report.issueType}</p>
    </div>

    <div className="admin-emergency-list-badges">
      <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
      <StatusBadge type="emergency" value={report.status} />
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
    �󼼺���
  </Button>
</Card>
        ))}
      </div>
    </>
  );
}
export function AdminEmergencyDetail({ emergencyId, data, actions, navigate }) {
  const report = data.emergencyReports.find((item) => item.id === emergencyId);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(() => ({
    status: report?.status || "received",
    adminMemo: report?.adminMemo || "",
  }));

  if (!report) {
    return <EmptyState title="�̻�¡�� ������ ã�� �� �����ϴ�" description="���� ��Ͽ��� �ٽ� �������ּ���." />;
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    actions.updateEmergencyReport(report.id, {
      status: form.status,
      adminMemo: form.adminMemo,
      updatedAt: new Date().toISOString(),
    });
    setNotice('ó�� ������ ����Ǿ����ϴ�.');
  }

  return (
    <>
      <PageHeader
        eyebrow="�̻�¡�� ��"
        title={targetName(data.targets, report.targetId)}
        description={`${report.date} �� ${report.issueType}`}
        action={<StatusBadge type="issueLevel" value={getIssueLevel(report)} />}
      />

      <Card className="admin-emergency-detail-info-card">
  <div className="admin-emergency-meta">
    <div className="admin-emergency-meta-item">
      <span>�����</span>
      <strong>{targetName(data.targets, report.targetId)}</strong>
    </div>

    <div className="admin-emergency-meta-item">
      <span>üĿ</span>
      <strong>{checkerName(data.users, report.checkerId)}</strong>
    </div>

    <div className="admin-emergency-meta-item">
      <span>����ó</span>
      <strong>{checkerPhone(data.users, report.checkerId)}</strong>
    </div>
  </div>

  <div className="admin-emergency-status-row">
    <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
    <StatusBadge type="emergency" value={report.status} />
  </div>
</Card>

      <Card>
        <h2>�� ����</h2>
        <p>{report.description}</p>
      </Card>

      <Card>
        <SelectInput id="admin-emergency-status" label="ó�� ����" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
          <option value="received">������</option>
          <option value="in_progress">ó����</option>
          <option value="completed">�Ϸ�</option>
        </SelectInput>
        <TextArea
          id="admin-emergency-memo"
          label="������ �޸�"
          rows="4"
          value={form.adminMemo}
          onChange={(event) => updateForm('adminMemo', event.target.value)}
          placeholder="��ȣ�� ���� �Ϸ�, �߰� Ȯ�� ���� ��"
        />
        {notice ? <p className="notice">{notice}</p> : null}
        <Button className="full-width" onClick={handleSave}>
          ó�� ���� ����
        </Button>
        <Button variant="ghost" className="full-width" onClick={() => navigate('/admin/emergencies')}>
          ������� �̵�
        </Button>
      </Card>
    </>
  );
}
function ChartCard({ title, description, rows }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Card className="chart-card">
      <SectionTitle title={title} description={description} />
      <div className="chart-list">
        {rows.map((row) => (
          <div className="chart-row" key={row.label}>
            <div className="bar-row">
              <span>{row.label}</span>
              <strong>{row.value}��</strong>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${row.tone ? `bar-${row.tone}` : ""}`} style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
function ReportDocument({ report, currentUser }) {
  const period = formatReportPeriod(report.periodStart, report.periodEnd);
  const supportTargets = Array.isArray(report.additionalSupportTargets)
    ? report.additionalSupportTargets.join(", ")
    : report.additionalSupportTargets;

  return (
    <article className="report-document" id="report-preview">
      <header className="report-document-header">
        <p>�����뼭��</p>
        <h2>{report.title}</h2>
        <span>{period}</span>
      </header>

      <table className="report-table">
        <tbody>
          <tr>
            <th>�ۼ���</th>
            <td>{report.updatedAt || report.createdAt}</td>
            <th>�ۼ���</th>
            <td>{currentUser?.name || "������"}</td>
          </tr>
          <tr>
            <th>�� �����</th>
            <td>{report.totalTargets}��</td>
            <th>�� üĿ</th>
            <td>{report.totalCheckers}��</td>
          </tr>
          <tr>
            <th>Ȯ�� ���</th>
            <td>{report.totalActivities}��</td>
            <th>�ܺ�/��ȭ/�湮/����</th>
            <td>{report.externalCount || 0}�� / {report.callCount}�� / {report.visitCount}�� / {report.intensiveCount || 0}��</td>
          </tr>
          <tr>
            <th>�̻�¡�� ����</th>
            <td>{report.emergencyCount}��</td>
            <th>��ó�� �̻�¡��</th>
            <td>{report.unresolvedEmergencyCount}��</td>
          </tr>
          <tr>
            <th>���� �����</th>
            <td colSpan="3">{report.dangerTargetCount}��</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h3>Ȯ�� ��� ���</h3>
        <p>{report.keyIssues}</p>
      </section>
      <section>
        <h3>�̻�¡�� ���� ���</h3>
        <p>�̻�¡�� ������ �� {report.emergencyCount}���̸� ��ó�� ���� {report.unresolvedEmergencyCount}���Դϴ�.</p>
      </section>
      <section>
        <h3>���� ����� ��Ȳ</h3>
        <p>���� ����ڴ� {report.dangerTargetCount}���Դϴ�. �߰� ���� �ʿ� �����: {supportTargets || "����"}</p>
      </section>
      <section>
        <h3>��ġ ����</h3>
        <p>{report.actionTaken}</p>
      </section>
      <section>
        <h3>������ �ǰ�</h3>
        <p>{report.adminOpinion || "�Էµ� �ǰ� ����"}</p>
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
  const stats = getReportStats(data, form.periodStart, form.periodEnd);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateReportForm(formValue = form) {
    if (!String(formValue.title || '').trim()) {
      return '������ ������ �Է����ּ���.';
    }
    if (!formValue.periodStart || !formValue.periodEnd) {
      return '���� �Ⱓ �����ϰ� �������� �Է����ּ���.';
    }
    if (formValue.periodStart > formValue.periodEnd) {
      return '���� �Ⱓ �������� �����Ϻ��� ���� �� �����ϴ�.';
    }
    return '';
  }

  function toReportPayload(formValue = form) {
    const reportStats = getReportStats(data, formValue.periodStart, formValue.periodEnd);
    return {
      ...formValue,
      totalTargets: reportStats.totalTargets,
      totalCheckers: reportStats.totalCheckers,
      totalActivities: reportStats.totalActivities,
      externalCount: reportStats.externalCount,
      visitCount: reportStats.visitCount,
      callCount: reportStats.callCount,
      intensiveCount: reportStats.intensiveCount,
      emergencyCount: reportStats.emergencyCount,
      unresolvedEmergencyCount: reportStats.unresolvedEmergencyCount,
      dangerTargetCount: reportStats.dangerTargetCount,
      additionalSupportTargets: Array.isArray(formValue.additionalSupportTargets)
        ? formValue.additionalSupportTargets
        : String(formValue.additionalSupportTargets || '').split(',').map((item) => item.trim()).filter(Boolean),
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

    const generatedText = generateReportSummary(stats);
    const nextForm = {
      ...form,
      keyIssues: generatedText.keyIssues,
      actionTaken: generatedText.actionTaken,
      adminOpinion: generatedText.adminOpinion,
    };
    setForm(nextForm);
    setPreview(toReportPayload(nextForm));
    setError('');
    setNotice('Ȯ�� ��� ������� ������ �ʾ� ������ �����߽��ϴ�.');
  }

  function handleGenerate() {
    const report = getValidatedReportPayload();
    if (!report) return;

    actions.addAdminReport(report);
    saveReportDraft(report);
    setPreview(report);
    setNotice('������ �̸����Ⱑ �����Ǿ����ϴ�.');
  }

  function handlePrint() {
  const report = getValidatedReportPayload();
  if (!report) return;

  saveReportDraft(report);
  setPreview(report);
  setNotice('�μ� ȭ�鿡�� PDF�� ������ �� �ֽ��ϴ�.');

  window.setTimeout(() => {
    window.print();
  }, 500);
}

  return (
    <>
      <PageHeader
        eyebrow="���� ������"
        title="������ �ۼ� �ʾ�"
        description="Ȯ�� ��ϰ� �̻�¡�� ������ �������� ���� ������ �ʾ��� �ۼ��մϴ�."
        action={<Button variant="ghost" onClick={() => navigate('/admin/reports/preview')}>�̸����� ȭ��</Button>}
      />

      <form className="form-stack admin-report-form">
  <Card className="admin-report-form-card">
    <TextInput
      id="report-title"
      label="������ ����"
      value={form.title}
      onChange={(event) => updateForm('title', event.target.value)}
    />

    <div className="admin-report-period-grid">
  <label className="report-date-field" htmlFor="report-start">
    <span>���� �Ⱓ ������</span>
    <div className="report-date-input-wrap">
      <input
        id="report-start"
        className="report-date-input"
        type="date"
        value={form.periodStart}
        onChange={(event) => updateForm('periodStart', event.target.value)}
      />
      <span className="report-date-icon" aria-hidden="true">??</span>
    </div>
  </label>

  <label className="report-date-field" htmlFor="report-end">
    <span>���� �Ⱓ ������</span>
    <div className="report-date-input-wrap">
      <input
        id="report-end"
        className="report-date-input"
        type="date"
        value={form.periodEnd}
        onChange={(event) => updateForm('periodEnd', event.target.value)}
      />
      <span className="report-date-icon" aria-hidden="true">??</span>
    </div>
  </label>
</div>
  </Card>

        <Card className="admin-report-form-card">
          <TextArea id="report-key-issues" label="�ֿ� Ư�̻���" rows="4" value={form.keyIssues} onChange={(event) => updateForm('keyIssues', event.target.value)} />
          <TextArea id="report-action" label="��ġ ����" rows="4" value={form.actionTaken} onChange={(event) => updateForm('actionTaken', event.target.value)} />
          <TextInput
            id="support-targets"
            label="�߰� ���� �ʿ� �����"
            value={Array.isArray(form.additionalSupportTargets) ? form.additionalSupportTargets.join(', ') : form.additionalSupportTargets}
            onChange={(event) => updateForm('additionalSupportTargets', event.target.value)}
          />
          <TextArea id="admin-opinion" label="������ �ǰ�" rows="4" value={form.adminOpinion} onChange={(event) => updateForm('adminOpinion', event.target.value)} />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        <div className="report-actions">
  <Button className="report-primary-action" onClick={handleAutoGenerate}>
    ������ �ʾ� �ڵ� ����
  </Button>

  <div className="report-secondary-actions">
    <Button variant="secondary" onClick={handleGenerate}>
      �̸����� ����
    </Button>
    <Button variant="ghost" onClick={handlePrint}>
      PDF ��������
    </Button>
  </div>
</div>
      </form>

      {preview ? (
        <section className="section-block print-area">
          <SectionTitle title="������ �̸�����" description="�μ� �� �� ������ ��µ˴ϴ�." />
          <ReportDocument report={preview} currentUser={currentUser} />
        </section>
      ) : null}
    </>
  );
}

export function AdminReportPreview({ data, currentUser }) {
  const report = readReportDraft(generateReportDraft(data, "2026-06-10", getTodayFromStats()));

  function handlePrint() {
  if (!preview) {
    const nextReport = buildReportFromForm();
    setPreview(nextReport);

    window.setTimeout(() => {
      window.print();
    }, 100);

    return;
  }

  window.print();
}

  return (
    <>
      <PageHeader
  eyebrow="������ �̸�����"
  title="���� ������ ���"
  description="����� ������ �ʾ��� ���� ���·� Ȯ���ϰ� PDF�� �����մϴ�."
  action={
    <Button onClick={() => window.print()}>
      PDF ��������
    </Button>
  }
/>
      <section className="print-area">
        <ReportDocument report={report} currentUser={currentUser} />
      </section>
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
    { label: "������", value: emergencyStats.reports.filter((report) => report.status === "received").length, tone: "red" },
    { label: "ó����", value: emergencyStats.reports.filter((report) => report.status === "in_progress").length, tone: "orange" },
    { label: "�Ϸ�", value: emergencyStats.reports.filter((report) => report.status === "completed").length, tone: "green" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="���"
        title="� ���"
        description="Ȯ�� ��ϰ� �̻�¡�� ��Ȳ�� �ٽ� ��ǥ �߽����� Ȯ���մϴ�."
      />

<div className="filter-tabs compact-filter-tabs statistics-period-tabs" aria-label="��� �Ⱓ ����">
        {[
          { value: "all", label: "��ü" },
          { value: "today", label: "����" },
          { value: "7days", label: "�ֱ� 7��" },
          { value: "30days", label: "�ֱ� 30��" },
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
        <StatCard label="��ü Ȯ�� ���" value={`${stats.totalActivities}��`} tone="green" />
        <StatCard label="�̻�¡�� ����" value={`${stats.emergencyCount}��`} tone="red" />
        <StatCard label="��ó�� �̻�¡��" value={`${stats.unresolvedEmergencyCount}��`} tone={stats.unresolvedEmergencyCount ? "red" : "green"} />
        <StatCard label="���� �����" value={`${stats.dangerTargetCount}��`} tone={stats.dangerTargetCount ? "red" : "green"} />
      </div>

      <section className="chart-grid">
        <ChartCard
          title="�ֱ� 7�� Ȯ�� �Ǽ�"
          description="�ֱ� 7�� ��¥�� Ȯ�� ��� ���Դϴ�."
          rows={recentRows.map((row) => ({ label: row.label, value: row.count, tone: "green" }))}
        />
        <ChartCard
          title="�̻�¡�� ������ �߻� �Ǽ�"
          description="�Ⱓ ���Ͱ� �ݿ��� �̻�¡�� ���� �����Դϴ�."
          rows={issueTypeRows.length ? issueTypeRows : [{ label: "�̻�¡�� ����", value: 0, tone: "green" }]}
        />
        <ChartCard
          title="ó�� ���º� �̻�¡�� ��Ȳ"
          description="����, ó����, �Ϸ� ���� �����Դϴ�."
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
      title: "Ȯ�� ��� ��������",
      description: "üĿ�� �ۼ��� ��ü Ȯ�� ����� �����޽��ϴ�.",
      filename: "happytong_activities.csv",
      rows: () => buildActivitiesCsvRows(data),
    },
    {
      title: "�̻�¡�� ���� ��������",
      description: "������ �̻�¡�� ���� �����͸� �����޽��ϴ�.",
      filename: "happytong_emergencies.csv",
      rows: () => buildEmergenciesCsvRows(data),
    },
    {
      title: "����� ��� ��������",
      description: "���� ���� ����� ������ �����޽��ϴ�.",
      filename: "happytong_targets.csv",
      rows: () => buildTargetsCsvRows(data),
    },
    {
      title: "üĿ ��� ��������",
      description: "��ϵ� üĿ ������ �����޽��ϴ�.",
      filename: "happytong_checkers.csv",
      rows: () => buildCheckersCsvRows(data),
    },
  ];

  function handleDownload(card) {
    downloadCsv(card.filename, card.rows());
    setNotice(`${card.title} CSV �ٿ�ε尡 ���۵Ǿ����ϴ�.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="������ ��������"
        title="CSV �ٿ�ε�"
        description="Ȯ�� ���, �̻�¡�� ����, �����, üĿ �����͸� CSV�� �������� �� �ֽ��ϴ�."
      />

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="stack">
        {cards.map((card) => (
          <Card key={card.filename}>
            <SectionTitle title={card.title} description={card.description} />
            <Button className="full-width" onClick={() => handleDownload(card)}>CSV �ٿ�ε�</Button>
          </Card>
        ))}
      </div>
    </>
  );
}



