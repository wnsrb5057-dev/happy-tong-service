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

function getToday() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function byLatestDate(a, b) {
  return b.date.localeCompare(a.date);
}

function truncateText(text, maxLength = 56) {
  if (!text) return "ë©”ëª¨ ?†ìŒ";
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
  return targetById(targets, targetId)?.name ?? "?€?ìž ?†ìŒ";
}

function checkerName(users, checkerId) {
  return checkerById(users, checkerId)?.name ?? "ì²´ì»¤ ?†ìŒ";
}

function checkerPhone(users, checkerId) {
  return checkerById(users, checkerId)?.phone ?? "?°ë½ì²??†ìŒ";
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
  const days = ["ÀÏ", "¿ù", "È­", "¼ö", "¸ñ", "±Ý", "Åä"];
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
  const todayPlanDay = ["ÀÏ", "¿ù", "È­", "¼ö", "¸ñ", "±Ý", "Åä"][new Date().getDay()];
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

  return (
    <>
      <PageHeader
        eyebrow="°ü¸®ÀÚ ´ë½Ãº¸µå"
        title="¿î¿µ ÇöÈ²"
        description="¿À´Ã ¿î¿µ¿¡ ¹®Á¦°¡ ÀÖ´ÂÁö ¸ÕÀú È®ÀÎÇÕ´Ï´Ù."
      />

      <div className="admin-dashboard-layout">
        <Card className="summary-card admin-dashboard-summary">
          <p className="eyebrow">¿À´Ã ¿î¿µ ÇöÈ² ¡¤ {today}</p>
          <strong>È®ÀÎ ¿¹Á¤ {todayScheduled}°Ç ¡¤ ¿Ï·á {completedToday}°Ç ¡¤ ¹ÌÀÛ¼º {stats.pendingActivityCount}°Ç</strong>
          <span>ÀÌ»óÂ¡ÈÄ {stats.emergencyCount}°Ç ¡¤ ±ä±Þ È®ÀÎ {urgentReports.length}°Ç</span>
        </Card>

         <div className="admin-dashboard-grid">
          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="¿ì¼± Ã³¸® ÇÊ¿ä" description="±ä±Þ È®ÀÎ°ú ¹ÌÃ³¸® °ÇÀ» ¸ÕÀú È®ÀÎÇÏ¼¼¿ä." />
            <div className="priority-list">
              <button type="button" onClick={() => navigate('/admin/emergencies')}>±ä±Þ È®ÀÎ ÇÊ¿ä {urgentReports.length}°Ç</button>
              <button type="button" onClick={() => navigate('/admin/emergencies')}>¹ÌÃ³¸® ÀÌ»óÂ¡ÈÄ {unresolvedReports.length}°Ç</button>
              <button type="button" onClick={() => navigate('/admin/targets')}>À§Çè ´ë»óÀÚ {stats.dangerTargetCount}¸í</button>
              <button type="button" onClick={() => navigate('/admin/activities')}>±â·Ï º¸¿Ï ÇÊ¿ä {stats.pendingActivityCount}°Ç</button>
            </div>
          </section>

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="ÀÌ¹ø ÁÖ È®ÀÎ °èÈ¹" />
            <div className="week-strip">
              {weekPlan.map((item) => (
                <button
               className={`week-day-button ${selectedPlanDay === item.day ? 'week-day-button-selected' : ''}`}
               key={item.day}
               type="button"
               onClick={() => setSelectedPlanDay(item.day)}
             >
               <strong>{item.day}</strong>
               <span>{item.targets.length}¸í</span>
             </button>
              ))}
            </div>
            <div className="stack compact-stack">
              {selectedPlan.targets.length ? (
                selectedPlan.targets.map((target) => (
                  <Card key={target.id} className={`risk-card-${target.riskLevel}`}>
                    <div className="card-row">
                      <div>
                        <strong>{target.name}</strong>
                        <p className="muted">{checkerName(data.users, target.assignedCheckerId)} ¡¤ {checkTypeLabels[getTargetCheckType(target)]}</p>
                      </div>
                      <StatusBadge type="risk" value={target.riskLevel} />
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState title={`${selectedPlan.day}¿äÀÏ È®ÀÎ °èÈ¹ ¾øÀ½`} description="ÇØ´ç ¿äÀÏ¿¡ µî·ÏµÈ È®ÀÎ ´ë»óÀÚ°¡ ¾ø½À´Ï´Ù." />
              )}
            </div>
          </section>

          <section className="section-block admin-dashboard-panel">
  <SectionTitle
    title="ÃÖ±Ù ÀÌ»óÂ¡ÈÄ"
    action={<Button variant="ghost" onClick={() => navigate('/admin/emergencies')}>ÀüÃ¼ º¸±â</Button>}
  />
  <div className="stack">
    {recentEmergencyReports.length ? (
      recentEmergencyReports.map((report) => (
        <Card key={report.id} className={report.urgency === 'high' ? 'danger-card' : 'alert-card'}>
          <div className="card-row">
            <div>
              <strong>{targetName(data.targets, report.targetId)}</strong>
              <p className="muted">{report.date} ¡¤ {report.issueType}</p>
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
    »ó¼¼º¸±â
  </Button>
</div>
        </Card>
      ))
    ) : (
      <EmptyState title="±ä±Þ ¾Ë¸² ¾øÀ½" description="»õ º¸°í°¡ µî·ÏµÇ¸é ÀÌ ¿µ¿ª¿¡ Ç¥½ÃµË´Ï´Ù." />
    )}
  </div>
</section>

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="ÃÖ±Ù È®ÀÎ ±â·Ï" />
            <div className="stack">
              {recentActivities.map((record) => (
                <Card key={record.id}>
                  <div className="card-row">
                    <div>
                      <strong>{targetName(data.targets, record.targetId)}</strong>
                      <p className="muted">{record.date} ¡¤ {checkerName(data.users, record.checkerId)} ¡¤ {activityTypeLabels[getCheckType(record)]}</p>
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
      <PageHeader eyebrow="Ã¼Ä¿ °ü¸®" title="Ã¼Ä¿ ¿î¿µ Áö¿ø" description="´ã´ç ´ë»óÀÚ¿Í È®ÀÎ ±â·Ï º¸¿Ï ÇÊ¿ä ¿©ºÎ¸¦ È®ÀÎÇÕ´Ï´Ù." />

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>Ã¼Ä¿ ÀÌ¿ë ½ÅÃ»</h2>
            <p className="muted">¼Ò¼Ó ±â°üº°·Î Á¢¼öµÈ Ã¼Ä¿ ½ÅÃ»À» È®ÀÎÇÏ°Å³ª ¹Ý·ÁÇÕ´Ï´Ù.</p>
          </div>
        </div>
        {pendingSignupRequests.length ? (
          <div className="stack compact-stack">
            {pendingSignupRequests.map((request) => (
              <Card key={request.id} className="checker-request-card">
                <div className="card-row checker-request-head">
                  <div>
                    <strong>{request.name}</strong>
                    <p className="muted">{request.loginId} ¡¤ {request.phone}</p>
                  </div>
                  <span className="badge badge-info">½ÂÀÎ ´ë±â</span>
                </div>
                <div className="checker-request-meta">
                  <p><strong>¼Ò¼Ó ±â°ü</strong> {request.organizationName}</p>
                  <p><strong>½ÅÃ»ÀÏ</strong> {String(request.createdAt || "").slice(0, 10)}</p>
                  <p><strong>¸Þ¸ð</strong> {request.memo || "¸Þ¸ð ¾øÀ½"}</p>
                </div>
                <div className="checker-request-actions">
                  <Button onClick={() => actions.approveSignupRequest(request.id)}>ÀÌ¿ë ½ÂÀÎ</Button>
                  <Button variant="secondary" onClick={() => actions.rejectSignupRequest(request.id)}>¹Ý·Á</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="ÇöÀç ±â°üÀ¸·Î Á¢¼öµÈ ´ë±â ½ÅÃ»ÀÌ ¾ø½À´Ï´Ù."
            description="´Ù¸¥ ±â°üÀ¸·Î ½ÅÃ»ÇÑ Ã¼Ä¿´Â ÀÌ È­¸é¿¡ Ç¥½ÃµÇÁö ¾Ê½À´Ï´Ù."
          />
        )}
      </section>

      <Card className="summary-card">
        <p className="eyebrow">Ã¼Ä¿ ÇöÈ²</p>
        <strong>ÀüÃ¼ {checkers.length}¸í ¡¤ ¿À´Ã È®ÀÎ ÁøÇà {activeCount}¸í</strong>
        <span>±â·Ï º¸¿Ï ÇÊ¿ä {pendingCheckerCount}¸í ¡¤ Áö¿ø ÇÊ¿ä {attentionCount}¸í</span>
      </Card>

      <div className="filter-tabs compact-filter-tabs" aria-label="Ã¼Ä¿ ÇÊÅÍ">
        {[
          { value: "all", label: "ÀüÃ¼" },
          { value: "active", label: "Á¤»ó" },
          { value: "needs_attention", label: "Áö¿ø ÇÊ¿ä" },
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
              <div><span>´ã´ç ´ë»óÀÚ</span><strong>{checker.assignedCount}¸í</strong></div>
              <div><span>¿À´Ã È®ÀÎ ¿Ï·á</span><strong>{checker.completedCount}°Ç</strong></div>
              <div><span>±â·Ï º¸¿Ï ÇÊ¿ä</span><strong>{checker.pendingCount}°Ç</strong></div>
              <div><span>ÀÌ»óÂ¡ÈÄ º¸°í °ü·Ã</span><strong>{checker.emergencyCount ? `${checker.emergencyCount}°Ç` : "¾øÀ½"}</strong></div>
            </div>
            <Button
              variant="ghost"
              className="full-width admin-checker-detail-button"
              onClick={() => navigate(`/admin/checkers/${checker.id}`)}
            >
              »ó¼¼ Á¤º¸
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
    setSaveMessage("´ã´ç ´ë»óÀÚ ¹èÁ¤ÀÌ ÀúÀåµÇ¾ú½À´Ï´Ù.");
    window.setTimeout(() => {
      setSaveMessage("");
    }, 2400);
  }

  if (!checker || !checkerSummary) {
    return (
      <div className="center-panel">
        <EmptyState title="Ã¼Ä¿ Á¤º¸¸¦ Ã£À» ¼ö ¾ø½À´Ï´Ù." description="¸ñ·ÏÀ¸·Î µ¹¾Æ°¡ ´Ù½Ã È®ÀÎÇØÁÖ¼¼¿ä." />
        <Button onClick={() => navigate("/admin/checkers")}>¸ñ·ÏÀ¸·Î ÀÌµ¿</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ã¼Ä¿ »ó¼¼"
        title={checkerSummary.name}
        description="Ã¼Ä¿ ¿î¿µ ÇöÈ²°ú ´ã´ç ´ë»óÀÚ ¹èÁ¤À» È®ÀÎÇÕ´Ï´Ù."
        action={
          <Button variant="ghost" onClick={() => navigate("/admin/checkers")}>
            ¸ñ·ÏÀ¸·Î ÀÌµ¿
          </Button>
        }
      />

      <Card className="admin-checker-detail-card">
        <div className="card-row admin-checker-detail-head">
          <div>
            <strong>{checkerSummary.name}</strong>
            <p className="muted">{checkerSummary.phone} ¡¤ {checkerSummary.organizationName || "¼Ò¼Ó ±â°ü Á¤º¸ ¾øÀ½"}</p>
          </div>
          <StatusBadge type="checker" value={checkerSummary.status} />
        </div>
        <div className="admin-checker-detail-metrics">
          <div><span>´ã´ç ´ë»óÀÚ ¼ö</span><strong>{checkerSummary.assignedCount}¸í</strong></div>
          <div><span>¿À´Ã È®ÀÎ ¿Ï·á</span><strong>{checkerSummary.completedCount}°Ç</strong></div>
          <div><span>±â·Ï º¸¿Ï ÇÊ¿ä</span><strong>{checkerSummary.pendingCount}°Ç</strong></div>
          <div><span>ÀÌ»óÂ¡ÈÄ º¸°í °ü·Ã</span><strong>{checkerSummary.emergencyCount ? `${checkerSummary.emergencyCount}°Ç` : "¾øÀ½"}</strong></div>
        </div>
      </Card>

      <section className="section-block">
        <div className="section-title">
          <div>
            <h2>´ã´ç ´ë»óÀÚ ¹èÁ¤</h2>
            <p className="muted">ÇöÀç Ã¼Ä¿¿¡°Ô ¹èÁ¤µÈ ´ë»óÀÚ¿Í ¹Ì¹èÁ¤ ´ë»óÀ» ÇÔ²² È®ÀÎÇÕ´Ï´Ù.</p>
          </div>
        </div>

        {saveMessage ? <div className="notice admin-checker-save-notice">{saveMessage}</div> : null}
        {hasUnsavedChanges ? (
          <p className="admin-checker-unsaved-text">ÀúÀåµÇÁö ¾ÊÀº º¯°æ»çÇ×ÀÌ ÀÖ½À´Ï´Ù.</p>
        ) : null}

        <Card className="checker-assignment-section admin-checker-assignment-card">
          <div className="checker-assignment-summary">
            <strong>¹èÁ¤ ÇöÈ²</strong>
            <span>ÇöÀç ¹èÁ¤ {assignedTargetIds.length}¸í ¡¤ ¹Ì¹èÁ¤ {unassignedCount}¸í</span>
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
                        <span className="badge badge-muted">{`${assignedChecker?.name || "´Ù¸¥ Ã¼Ä¿"} ¹èÁ¤Áß`}</span>
                      ) : isChecked ? (
                        <span className="badge badge-info">ÇöÀç ÀÌ Ã¼Ä¿¿¡°Ô ¹èÁ¤µÊ</span>
                      ) : (
                        <span className="badge badge-muted">¹Ì¹èÁ¤</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="checker-assignment-actions">
            <Button onClick={handleAssignmentSave}>¹èÁ¤ ÀúÀå</Button>
            <Button variant="secondary" onClick={handleAssignmentCancel}>º¯°æ Ãë¼Ò</Button>
          </div>
        </Card>
      </section>
    </>
  );
}
export function AdminTargets({ data, navigate }) {
  const [filter, setFilter] = useState("all");
  const filteredTargets = data.targets
    .filter((target) => {
      if (filter === "today") return isTodayScheduled(target);
      if (filter === "all") return true;
      return target.riskLevel === filter;
    })
    .sort(sortTargetsForAdmin);

  return (
    <>
      <PageHeader eyebrow="´ë»óÀÚ °ü¸®" title="´ë»óÀÚ ÇöÈ²" description="È®ÀÎ À¯Çü, À§Çèµµ, ´ã´ç Ã¼Ä¿¸¦ È®ÀÎÇÕ´Ï´Ù." />

      <Card className="summary-card">
        <p className="eyebrow">´ë»óÀÚ ÇöÈ²</p>
        <strong>ÀüÃ¼ {data.targets.length}¸í ¡¤ ¿À´Ã È®ÀÎ {data.targets.filter(isTodayScheduled).length}¸í</strong>
        <span>
          Á¤»ó {data.targets.filter((target) => target.riskLevel === "normal").length}¸í ¡¤ ÁÖÀÇ {data.targets.filter((target) => target.riskLevel === "caution").length}¸í ¡¤ À§Çè {data.targets.filter((target) => target.riskLevel === "danger").length}¸í
        </span>
      </Card>

      <div className="filter-tabs target-filter-tabs" aria-label="´ë»óÀÚ ÇÊÅÍ">
        {[
          { value: "all", label: "ÀüÃ¼" },
          { value: "normal", label: "Á¤»ó" },
          { value: "caution", label: "ÁÖÀÇ" },
          { value: "danger", label: "À§Çè" },
          { value: "today", label: "¿À´Ã È®ÀÎ" },
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
                <p>{target.age}¼¼ ¡¤ {target.gender} ¡¤ {getTargetArea(target)}</p>
              </div>
              <StatusBadge type="risk" value={target.riskLevel} />
            </div>
            <div className="admin-target-meta">
              <div><span>´ã´ç Ã¼Ä¿</span><strong>{checkerName(data.users, target.assignedCheckerId)}</strong></div>
              <div><span>±âº» È®ÀÎ À¯Çü</span><strong>{checkTypeLabels[getTargetCheckType(target)]}</strong></div>
              <div><span>È®ÀÎ ¿äÀÏ</span><strong>{target.checkDays?.join(", ") || "¿äÀÏ ¹ÌÁ¤"}</strong></div>
              <div><span>ÃÖ±Ù È®ÀÎÀÏ</span><strong>{target.lastVisitDate}</strong></div>
            </div>
            <span className="admin-target-detail-action">»ó¼¼º¸±â</span>
          </button>
        ))}
      </div>
    </>
  );
}
export function AdminTargetDetail({ targetId, data }) {
  const target = targetById(data.targets, targetId);

  if (!target) {
    return <EmptyState title="´ë»óÀÚ¸¦ Ã£À» ¼ö ¾ø½À´Ï´Ù" description="´ë»óÀÚ °ü¸® È­¸é¿¡¼­ ´Ù½Ã ¼±ÅÃÇØÁÖ¼¼¿ä." />;
  }

  const checker = checkerById(data.users, target.assignedCheckerId);
  const visits = data.activityRecords.filter((record) => record.targetId === target.id).sort(byLatestDate);
  const reports = data.emergencyReports.filter((report) => report.targetId === target.id).sort(byLatestDate);

  return (
    <>
      <PageHeader
        eyebrow="´ë»óÀÚ »ó¼¼"
        title={target.name}
        description={`${target.age}¼¼ ¡¤ ${target.gender} ¡¤ ${target.address}`}
        action={<StatusBadge type="risk" value={target.riskLevel} />}
      />

      <Card>
        <h2>±âº»Á¤º¸</h2>
        <InfoList
          items={[
            { label: "ÀÌ¸§", value: target.name },
            { label: "¿¬·É/¼ºº°", value: `${target.age}¼¼ ¡¤ ${target.gender}` },
            { label: "ÁÖ¼Ò", value: target.address },
            { label: "À§Çèµµ", value: <StatusBadge type="risk" value={target.riskLevel} /> },
            { label: "ÃÖ±Ù È®ÀÎÀÏ", value: target.lastVisitDate },
            { label: "±âº» È®ÀÎ À¯Çü", value: checkTypeLabels[getTargetCheckType(target)] },
            { label: "È®ÀÎ ¿äÀÏ", value: target.checkDays?.join(", ") || "¿äÀÏ ¹ÌÁ¤" },
          ]}
        />
      </Card>

      <Card>
        <h2>´ã´ç Á¤º¸</h2>
        <InfoList
          items={[
            { label: "´ã´ç Ã¼Ä¿", value: checker?.name ?? "¹Ì¹èÁ¤" },
            { label: "Ã¼Ä¿ ¿¬¶ôÃ³", value: checker?.phone ?? "¿¬¶ôÃ³ ¾øÀ½" },
          ]}
        />
      </Card>

      <Card>
        <h2>°Ç°­ ¹× ÁÖÀÇ»çÇ×</h2>
        <InfoList
          items={[
            { label: "°Ç°­»óÅÂ", value: target.healthStatus },
            { label: "ÁÖÀÇ»çÇ×", value: target.cautionNote },
            { label: "º¹¾à ¸Þ¸ð", value: target.medicationNote || "µî·ÏµÈ º¹¾à ¸Þ¸ð ¾øÀ½" },
          ]}
        />
      </Card>

      <Card>
        <h2>º¸È£ÀÚ Á¤º¸</h2>
        <InfoList
          items={[
            { label: "º¸È£ÀÚ ÀÌ¸§", value: target.guardianName },
            { label: "º¸È£ÀÚ ¿¬¶ôÃ³", value: target.guardianPhone },
          ]}
        />
      </Card>

      <section className="section-block">
        <SectionTitle title="ÃÖ±Ù È®ÀÎ ±â·Ï" />
        <div className="stack compact-stack">
          {visits.length ? (
            visits.slice(0, 5).map((record) => (
              <Card key={record.id}>
                <div className="card-row">
                  <div>
                    <strong>{record.date}</strong>
                    <p className="muted">{checkerName(data.users, record.checkerId)} ¡¤ {activityTypeLabels[getCheckType(record)]}</p>
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
            <EmptyState title="È®ÀÎ ±â·ÏÀÌ ¾ø½À´Ï´Ù" description="±â·ÏÀÌ µî·ÏµÇ¸é ÀÌ ¿µ¿ª¿¡ Ç¥½ÃµË´Ï´Ù." />
          )}
        </div>
      </section>

      <section className="section-block">
        <SectionTitle title="ÀÌ»óÂ¡ÈÄ º¸°í" />
        <div className="stack compact-stack">
          {reports.length ? (
            reports.slice(0, 5).map((report) => (
              <Card key={report.id} className={getIssueLevel(report) === 'urgent' ? 'danger-card' : 'alert-card'}>
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
            <EmptyState title="ÀÌ»óÂ¡ÈÄ º¸°í°¡ ¾ø½À´Ï´Ù" description="º¸°í°¡ µî·ÏµÇ¸é ÀÌ ¿µ¿ª¿¡ Ç¥½ÃµË´Ï´Ù." />
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
      <PageHeader eyebrow="È®ÀÎ ±â·Ï" title="È®ÀÎ ±â·Ï Á¶È¸" description="Ã¼Ä¿°¡ ÀÛ¼ºÇÑ È®ÀÎ ±â·ÏÀ» °ËÅäÇÕ´Ï´Ù." />

      <Card className="summary-card">
        <p className="eyebrow">±â·Ï ÇöÈ²</p>
        <strong>ÀüÃ¼ {data.activityRecords.length}°Ç ¡¤ ¿À´Ã {data.activityRecords.filter((record) => record.date === today).length}°Ç</strong>
        <span>ÀÌ»óÂ¡ÈÄ Æ÷ÇÔ {data.activityRecords.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length}°Ç ¡¤ ¹Ì¿Ï·á {data.activityRecords.filter((record) => record.status !== "completed").length}°Ç</span>
      </Card>

      <div className="admin-activity-filter-pills" aria-label="±â·Ï ÇÊÅÍ">
        {[
          { value: "all", label: "ÀüÃ¼" },
          { value: "today", label: "¿À´Ã" },
          { value: "issue", label: "ÀÌ»óÂ¡ÈÄ" },
          { value: "pending", label: "¹Ì¿Ï·á" },
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
              {record.date || "³¯Â¥ Á¤º¸ ¾øÀ½"} ¡¤ {checkerName(data.users, record.checkerId)} ¡¤ {activityTypeLabels[getCheckType(record)]}
            </p>
          </div>
        
          <p className="muted admin-activity-memo">
            {truncateText(record.memo)}
          </p>
        
          <div className="badge-row compact-badges admin-activity-badges">
            <StatusBadge type="health" value={record.healthStatus || "good"} />
            <span className={record.hasIssue || record.issueLevel !== "none" ? "badge badge-risk-danger" : "badge badge-muted"}>
              {record.hasIssue || record.issueLevel !== "none" ? "ÀÌ»óÂ¡ÈÄ ÀÖÀ½" : "ÀÌ»óÂ¡ÈÄ ¾øÀ½"}
            </span>
            <StatusBadge type="record" value={record.status} />
          </div>
        
          <Button
            variant="ghost"
            className="admin-activity-inline-button"
            onClick={() => setOpenRecordId(openRecordId === record.id ? "" : record.id)}
          >
            »ó¼¼º¸±â
          </Button>
        
          {openRecordId === record.id ? (
            <div className="detail-box admin-activity-detail-box">
              <p>Ã¼Ä¿: {checkerName(data.users, record.checkerId)}</p>
              <p>Ã¼Å© À¯Çü: {activityTypeLabels[getCheckType(record)]}</p>
              <p>¸Þ¸ð: {record.memo || "¸Þ¸ð ¾øÀ½"}</p>
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
      <PageHeader eyebrow="ÀÌ»óÂ¡ÈÄ °ü¸®" title="ÀÌ»óÂ¡ÈÄ º¸°í ÇöÈ²" description="±ä±Þ È®ÀÎÀÌ ÇÊ¿äÇÑ º¸°íºÎÅÍ ¿ì¼± È®ÀÎÇÕ´Ï´Ù." />

      <Card className="summary-card">
        <p className="eyebrow">¿ì¼± È®ÀÎ ÇÊ¿ä</p>
        <strong>±ä±Þ È®ÀÎ ÇÊ¿ä {urgentCount}°Ç ¡¤ ¹ÌÃ³¸® {unresolvedCount}°Ç</strong>
      </Card>

      <div className="filter-tabs emergency-filter-tabs" aria-label="ÀÌ»óÂ¡ÈÄ º¸°í ÇÊÅÍ">
        {[
          { value: "all", label: "ÀüÃ¼" },
          { value: "received", label: "¹ÌÃ³¸®" },
          { value: "in_progress", label: "Ã³¸®Áß" },
          { value: "completed", label: "¿Ï·á" },
          { value: "high", label: "±ä±Þ È®ÀÎ" },
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
          <Card key={report.id} className={report.urgency === 'high' ? 'danger-card' : 'alert-card'}>
            <div className="card-row">
              <div>
                <strong>{targetName(data.targets, report.targetId)}</strong>
                <p className="muted">{report.date} ¡¤ {report.issueType}</p>
              </div>
              <div className="badge-row compact-badges">
                <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
                <StatusBadge type="emergency" value={report.status} />
              </div>
            </div>
            <p className="muted">{truncateText(report.description)}</p>
            <Button variant="ghost" className="full-width" onClick={() => navigate(`/admin/emergencies/${report.id}`)}>
              »ó¼¼º¸±â
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
    return <EmptyState title="ÀÌ»óÂ¡ÈÄ º¸°í¸¦ Ã£À» ¼ö ¾ø½À´Ï´Ù" description="º¸°í ¸ñ·Ï¿¡¼­ ´Ù½Ã ¼±ÅÃÇØÁÖ¼¼¿ä." />;
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
    setNotice('Ã³¸® Á¤º¸°¡ ÀúÀåµÇ¾ú½À´Ï´Ù.');
  }

  return (
    <>
      <PageHeader
        eyebrow="ÀÌ»óÂ¡ÈÄ »ó¼¼"
        title={targetName(data.targets, report.targetId)}
        description={`${report.date} ¡¤ ${report.issueType}`}
        action={<StatusBadge type="issueLevel" value={getIssueLevel(report)} />}
      />

      <Card>
        <div className="admin-emergency-meta">
          <div><span>´ë»óÀÚ</span><strong>{targetName(data.targets, report.targetId)}</strong></div>
          <div><span>Ã¼Ä¿</span><strong>{checkerName(data.users, report.checkerId)}</strong></div>
          <div><span>¿¬¶ôÃ³</span><strong>{checkerPhone(data.users, report.checkerId)}</strong></div>
        </div>
        <div className="badge-row admin-emergency-status-row">
          <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
          <StatusBadge type="emergency" value={report.status} />
        </div>
      </Card>

      <Card>
        <h2>»ó¼¼ ³»¿ë</h2>
        <p>{report.description}</p>
      </Card>

      <Card>
        <SelectInput id="admin-emergency-status" label="Ã³¸® »óÅÂ" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
          <option value="received">Á¢¼öµÊ</option>
          <option value="in_progress">Ã³¸®Áß</option>
          <option value="completed">¿Ï·á</option>
        </SelectInput>
        <TextArea
          id="admin-emergency-memo"
          label="°ü¸®ÀÚ ¸Þ¸ð"
          rows="4"
          value={form.adminMemo}
          onChange={(event) => updateForm('adminMemo', event.target.value)}
          placeholder="º¸È£ÀÚ ¿¬¶ô ¿Ï·á, Ãß°¡ È®ÀÎ ¿¹Á¤ µî"
        />
        {notice ? <p className="notice">{notice}</p> : null}
        <Button className="full-width" onClick={handleSave}>
          Ã³¸® Á¤º¸ ÀúÀå
        </Button>
        <Button variant="ghost" className="full-width" onClick={() => navigate('/admin/emergencies')}>
          ¸ñ·ÏÀ¸·Î ÀÌµ¿
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
              <strong>{row.value}°Ç</strong>
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
        <p>ÇØÇÇÅë¼­ºñ½º</p>
        <h2>{report.title}</h2>
        <span>{period}</span>
      </header>

      <table className="report-table">
        <tbody>
          <tr>
            <th>ÀÛ¼ºÀÏ</th>
            <td>{report.updatedAt || report.createdAt}</td>
            <th>ÀÛ¼ºÀÚ</th>
            <td>{currentUser?.name || "°ü¸®ÀÚ"}</td>
          </tr>
          <tr>
            <th>ÃÑ ´ë»óÀÚ</th>
            <td>{report.totalTargets}¸í</td>
            <th>ÃÑ Ã¼Ä¿</th>
            <td>{report.totalCheckers}¸í</td>
          </tr>
          <tr>
            <th>È®ÀÎ ±â·Ï</th>
            <td>{report.totalActivities}°Ç</td>
            <th>¿ÜºÎ/ÀüÈ­/¹æ¹®/ÁýÁß</th>
            <td>{report.externalCount || 0}°Ç / {report.callCount}°Ç / {report.visitCount}°Ç / {report.intensiveCount || 0}°Ç</td>
          </tr>
          <tr>
            <th>ÀÌ»óÂ¡ÈÄ º¸°í</th>
            <td>{report.emergencyCount}°Ç</td>
            <th>¹ÌÃ³¸® ÀÌ»óÂ¡ÈÄ</th>
            <td>{report.unresolvedEmergencyCount}°Ç</td>
          </tr>
          <tr>
            <th>À§Çè ´ë»óÀÚ</th>
            <td colSpan="3">{report.dangerTargetCount}¸í</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h3>È®ÀÎ ±â·Ï ¿ä¾à</h3>
        <p>{report.keyIssues}</p>
      </section>
      <section>
        <h3>ÀÌ»óÂ¡ÈÄ º¸°í ¿ä¾à</h3>
        <p>ÀÌ»óÂ¡ÈÄ º¸°í´Â ÃÑ {report.emergencyCount}°ÇÀÌ¸ç ¹ÌÃ³¸® °ÇÀº {report.unresolvedEmergencyCount}°ÇÀÔ´Ï´Ù.</p>
      </section>
      <section>
        <h3>À§Çè ´ë»óÀÚ ÇöÈ²</h3>
        <p>À§Çè ´ë»óÀÚ´Â {report.dangerTargetCount}¸íÀÔ´Ï´Ù. Ãß°¡ Áö¿ø ÇÊ¿ä ´ë»óÀÚ: {supportTargets || "¾øÀ½"}</p>
      </section>
      <section>
        <h3>Á¶Ä¡ ³»¿ë</h3>
        <p>{report.actionTaken}</p>
      </section>
      <section>
        <h3>°ü¸®ÀÚ ÀÇ°ß</h3>
        <p>{report.adminOpinion || "ÀÔ·ÂµÈ ÀÇ°ß ¾øÀ½"}</p>
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
      return 'º¸°í¼­ Á¦¸ñÀ» ÀÔ·ÂÇØÁÖ¼¼¿ä.';
    }
    if (!formValue.periodStart || !formValue.periodEnd) {
      return 'º¸°í ±â°£ ½ÃÀÛÀÏ°ú Á¾·áÀÏÀ» ÀÔ·ÂÇØÁÖ¼¼¿ä.';
    }
    if (formValue.periodStart > formValue.periodEnd) {
      return 'º¸°í ±â°£ ½ÃÀÛÀÏÀº Á¾·áÀÏº¸´Ù ´ÊÀ» ¼ö ¾ø½À´Ï´Ù.';
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
    setNotice('È®ÀÎ ±â·Ï ±â¹ÝÀ¸·Î º¸°í¼­ ÃÊ¾È ¹®ÀåÀ» »ý¼ºÇß½À´Ï´Ù.');
  }

  function handleGenerate() {
    const report = getValidatedReportPayload();
    if (!report) return;

    actions.addAdminReport(report);
    saveReportDraft(report);
    setPreview(report);
    setNotice('º¸°í¼­ ¹Ì¸®º¸±â°¡ »ý¼ºµÇ¾ú½À´Ï´Ù.');
  }

  function handlePrint() {
    const report = getValidatedReportPayload();
    if (!report) return;

    saveReportDraft(report);
    setPreview(report);
    setNotice('ÀÎ¼â È­¸é¿¡¼­ PDF·Î ÀúÀåÇÒ ¼ö ÀÖ½À´Ï´Ù.');
    setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <PageHeader
        eyebrow="ÇàÁ¤ º¸°í¼­"
        title="º¸°í¼­ ÀÛ¼º ÃÊ¾È"
        description="È®ÀÎ ±â·Ï°ú ÀÌ»óÂ¡ÈÄ º¸°í¸¦ ¹ÙÅÁÀ¸·Î ÇàÁ¤ º¸°í¼­ ÃÊ¾ÈÀ» ÀÛ¼ºÇÕ´Ï´Ù."
        action={<Button variant="ghost" onClick={() => navigate('/admin/reports/preview')}>¹Ì¸®º¸±â È­¸é</Button>}
      />

      <form className="form-stack">
        <Card>
          <TextInput id="report-title" label="º¸°í¼­ Á¦¸ñ" value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
          <div className="filter-grid">
            <TextInput id="report-start" label="º¸°í ±â°£ ½ÃÀÛÀÏ" type="date" value={form.periodStart} onChange={(event) => updateForm('periodStart', event.target.value)} />
            <TextInput id="report-end" label="º¸°í ±â°£ Á¾·áÀÏ" type="date" value={form.periodEnd} onChange={(event) => updateForm('periodEnd', event.target.value)} />
          </div>
        </Card>

        <Card>
          <TextArea id="report-key-issues" label="ÁÖ¿ä Æ¯ÀÌ»çÇ×" rows="4" value={form.keyIssues} onChange={(event) => updateForm('keyIssues', event.target.value)} />
          <TextArea id="report-action" label="Á¶Ä¡ ³»¿ë" rows="4" value={form.actionTaken} onChange={(event) => updateForm('actionTaken', event.target.value)} />
          <TextInput
            id="support-targets"
            label="Ãß°¡ Áö¿ø ÇÊ¿ä ´ë»óÀÚ"
            value={Array.isArray(form.additionalSupportTargets) ? form.additionalSupportTargets.join(', ') : form.additionalSupportTargets}
            onChange={(event) => updateForm('additionalSupportTargets', event.target.value)}
          />
          <TextArea id="admin-opinion" label="°ü¸®ÀÚ ÀÇ°ß" rows="4" value={form.adminOpinion} onChange={(event) => updateForm('adminOpinion', event.target.value)} />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        <div className="report-actions">
  <Button className="report-primary-action" onClick={handleAutoGenerate}>
    º¸°í¼­ ÃÊ¾È ÀÚµ¿ »ý¼º
  </Button>

  <div className="report-secondary-actions">
    <Button variant="secondary" onClick={handleGenerate}>
      ¹Ì¸®º¸±â »ý¼º
    </Button>
    <Button variant="ghost" onClick={handlePrint}>
      PDF ³»º¸³»±â
    </Button>
  </div>
</div>
      </form>

      {preview ? (
        <section className="section-block print-area">
          <SectionTitle title="º¸°í¼­ ¹Ì¸®º¸±â" description="ÀÎ¼â ½Ã ÀÌ ¿µ¿ª¸¸ Ãâ·ÂµË´Ï´Ù." />
          <ReportDocument report={preview} currentUser={currentUser} />
        </section>
      ) : null}
    </>
  );
}

export function AdminReportPreview({ data, currentUser }) {
  const report = readReportDraft(generateReportDraft(data, "2026-06-10", getTodayFromStats()));

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <PageHeader
        eyebrow="º¸°í¼­ ¹Ì¸®º¸±â"
        title="ÇàÁ¤ º¸°í¼­ Ãâ·Â"
        description="ÀúÀåµÈ º¸°í¼­ ÃÊ¾ÈÀ» ¹®¼­ ÇüÅÂ·Î È®ÀÎÇÏ°í PDF·Î ÀúÀåÇÕ´Ï´Ù."
        action={<Button onClick={handlePrint}>PDF ³»º¸³»±â</Button>}
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
    { label: "Á¢¼öµÊ", value: emergencyStats.reports.filter((report) => report.status === "received").length, tone: "red" },
    { label: "Ã³¸®Áß", value: emergencyStats.reports.filter((report) => report.status === "in_progress").length, tone: "orange" },
    { label: "¿Ï·á", value: emergencyStats.reports.filter((report) => report.status === "completed").length, tone: "green" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Åë°è"
        title="¿î¿µ Åë°è"
        description="È®ÀÎ ±â·Ï°ú ÀÌ»óÂ¡ÈÄ ÇöÈ²À» ÇÙ½É ÁöÇ¥ Áß½ÉÀ¸·Î È®ÀÎÇÕ´Ï´Ù."
      />

<div className="filter-tabs compact-filter-tabs statistics-period-tabs" aria-label="Åë°è ±â°£ ÇÊÅÍ">
        {[
          { value: "all", label: "ÀüÃ¼" },
          { value: "today", label: "¿À´Ã" },
          { value: "7days", label: "ÃÖ±Ù 7ÀÏ" },
          { value: "30days", label: "ÃÖ±Ù 30ÀÏ" },
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
        <StatCard label="ÀüÃ¼ È®ÀÎ ±â·Ï" value={`${stats.totalActivities}°Ç`} tone="green" />
        <StatCard label="ÀÌ»óÂ¡ÈÄ º¸°í" value={`${stats.emergencyCount}°Ç`} tone="red" />
        <StatCard label="¹ÌÃ³¸® ÀÌ»óÂ¡ÈÄ" value={`${stats.unresolvedEmergencyCount}°Ç`} tone={stats.unresolvedEmergencyCount ? "red" : "green"} />
        <StatCard label="À§Çè ´ë»óÀÚ" value={`${stats.dangerTargetCount}¸í`} tone={stats.dangerTargetCount ? "red" : "green"} />
      </div>

      <section className="chart-grid">
        <ChartCard
          title="ÃÖ±Ù 7ÀÏ È®ÀÎ °Ç¼ö"
          description="ÃÖ±Ù 7ÀÏ ³¯Â¥º° È®ÀÎ ±â·Ï ¼öÀÔ´Ï´Ù."
          rows={recentRows.map((row) => ({ label: row.label, value: row.count, tone: "green" }))}
        />
        <ChartCard
          title="ÀÌ»óÂ¡ÈÄ À¯Çüº° ¹ß»ý °Ç¼ö"
          description="±â°£ ÇÊÅÍ°¡ ¹Ý¿µµÈ ÀÌ»óÂ¡ÈÄ À¯Çü ºÐÆ÷ÀÔ´Ï´Ù."
          rows={issueTypeRows.length ? issueTypeRows : [{ label: "ÀÌ»óÂ¡ÈÄ ¾øÀ½", value: 0, tone: "green" }]}
        />
        <ChartCard
          title="Ã³¸® »óÅÂº° ÀÌ»óÂ¡ÈÄ ÇöÈ²"
          description="Á¢¼ö, Ã³¸®Áß, ¿Ï·á »óÅÂ ºÐÆ÷ÀÔ´Ï´Ù."
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
      title: "È®ÀÎ ±â·Ï ³»º¸³»±â",
      description: "Ã¼Ä¿°¡ ÀÛ¼ºÇÑ ÀüÃ¼ È®ÀÎ ±â·ÏÀ» ³»·Á¹Þ½À´Ï´Ù.",
      filename: "happytong_activities.csv",
      rows: () => buildActivitiesCsvRows(data),
    },
    {
      title: "ÀÌ»óÂ¡ÈÄ º¸°í ³»º¸³»±â",
      description: "Á¢¼öµÈ ÀÌ»óÂ¡ÈÄ º¸°í µ¥ÀÌÅÍ¸¦ ³»·Á¹Þ½À´Ï´Ù.",
      filename: "happytong_emergencies.csv",
      rows: () => buildEmergenciesCsvRows(data),
    },
    {
      title: "´ë»óÀÚ ¸ñ·Ï ³»º¸³»±â",
      description: "°ü¸® ÁßÀÎ ´ë»óÀÚ Á¤º¸¸¦ ³»·Á¹Þ½À´Ï´Ù.",
      filename: "happytong_targets.csv",
      rows: () => buildTargetsCsvRows(data),
    },
    {
      title: "Ã¼Ä¿ ¸ñ·Ï ³»º¸³»±â",
      description: "µî·ÏµÈ Ã¼Ä¿ Á¤º¸¸¦ ³»·Á¹Þ½À´Ï´Ù.",
      filename: "happytong_checkers.csv",
      rows: () => buildCheckersCsvRows(data),
    },
  ];

  function handleDownload(card) {
    downloadCsv(card.filename, card.rows());
    setNotice(`${card.title} CSV ´Ù¿î·Îµå°¡ ½ÃÀÛµÇ¾ú½À´Ï´Ù.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="µ¥ÀÌÅÍ ³»º¸³»±â"
        title="CSV ´Ù¿î·Îµå"
        description="È®ÀÎ ±â·Ï, ÀÌ»óÂ¡ÈÄ º¸°í, ´ë»óÀÚ, Ã¼Ä¿ µ¥ÀÌÅÍ¸¦ CSV·Î ³»·Á¹ÞÀ» ¼ö ÀÖ½À´Ï´Ù."
      />

      {notice ? <p className="notice">{notice}</p> : null}

      <div className="stack">
        {cards.map((card) => (
          <Card key={card.filename}>
            <SectionTitle title={card.title} description={card.description} />
            <Button className="full-width" onClick={() => handleDownload(card)}>CSV ´Ù¿î·Îµå</Button>
          </Card>
        ))}
      </div>
    </>
  );
}


