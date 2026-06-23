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

function targetName(targets, targetId) {
  return targetById(targets, targetId)?.name ?? "대상자 없음";
}

function checkerName(users, checkerId) {
  return checkerById(users, checkerId)?.name ?? "체커 없음";
}

function checkerPhone(users, checkerId) {
  return checkerById(users, checkerId)?.phone ?? "연락처 없음";
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
    (report) => report.checkerId === checker.id && report.status !== "completed"
  );

  if (checker.status === "needs_attention" || hasPending || hasOpenEmergency) {
    return "needs_attention";
  }

  return checker.status || "active";
}

export function AdminDashboard({ data, navigate }) {
  const today = getTodayFromStats();
  const todayPlanDay = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
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
        eyebrow="관리자 대시보드"
        title="운영 현황"
        description="오늘 운영에 문제가 있는지 먼저 확인합니다."
      />

      <div className="admin-dashboard-layout">
        <Card className="summary-card admin-dashboard-summary">
          <p className="eyebrow">오늘 운영 현황 · {today}</p>
          <strong>확인 예정 {todayScheduled}건 · 완료 {completedToday}건 · 미작성 {stats.pendingActivityCount}건</strong>
          <span>이상징후 {stats.emergencyCount}건 · 긴급 확인 {urgentReports.length}건</span>
        </Card>

         <div className="admin-dashboard-grid">
          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="우선 처리 필요" description="긴급 확인과 미처리 건을 먼저 확인하세요." />
            <div className="priority-list">
              <button type="button" onClick={() => navigate('/admin/emergencies')}>긴급 확인 필요 {urgentReports.length}건</button>
              <button type="button" onClick={() => navigate('/admin/emergencies')}>미처리 이상징후 {unresolvedReports.length}건</button>
              <button type="button" onClick={() => navigate('/admin/targets')}>위험 대상자 {stats.dangerTargetCount}명</button>
              <button type="button" onClick={() => navigate('/admin/activities')}>기록 보완 필요 {stats.pendingActivityCount}건</button>
            </div>
          </section>

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="이번 주 확인 계획" />
            <div className="week-strip">
              {weekPlan.map((item) => (
                <button
               className={`week-day-button ${selectedPlanDay === item.day ? 'week-day-button-selected' : ''}`}
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
              {selectedPlan.targets.length ? (
                selectedPlan.targets.map((target) => (
                  <Card key={target.id} className={`risk-card-${target.riskLevel}`}>
                    <div className="card-row">
                      <div>
                        <strong>{target.name}</strong>
                        <p className="muted">{checkerName(data.users, target.assignedCheckerId)} · {checkTypeLabels[getTargetCheckType(target)]}</p>
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

          <section className="section-block admin-dashboard-panel">
  <SectionTitle
    title="최근 이상징후"
    action={<Button variant="ghost" onClick={() => navigate('/admin/emergencies')}>전체 보기</Button>}
  />
  <div className="stack">
    {recentEmergencyReports.length ? (
      recentEmergencyReports.map((report) => (
        <Card key={report.id} className={report.urgency === 'high' ? 'danger-card' : 'alert-card'}>
          <div className="card-row">
            <div>
              <strong>{targetName(data.targets, report.targetId)}</strong>
              <p className="muted">{report.date} · {report.issueType}</p>
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

          <section className="section-block admin-dashboard-panel">
            <SectionTitle title="최근 확인 기록" />
            <div className="stack">
              {recentActivities.map((record) => (
                <Card key={record.id}>
                  <div className="card-row">
                    <div>
                      <strong>{targetName(data.targets, record.targetId)}</strong>
                      <p className="muted">{record.date} · {checkerName(data.users, record.checkerId)} · {activityTypeLabels[getCheckType(record)]}</p>
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
      <PageHeader eyebrow="체커 관리" title="체커 운영 지원" description="담당 대상자와 확인 기록 보완 필요 여부를 확인합니다." />

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
                <p className="muted">{checker.phone}</p>
              </div>
              <StatusBadge type="checker" value={checker.status} />
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
          <Button variant="ghost" onClick={() => navigate("/admin/checkers")}>
            목록으로 이동
          </Button>
        }
      />

      <Card className="admin-checker-detail-card">
        <div className="card-row admin-checker-detail-head">
          <div>
            <strong>{checkerSummary.name}</strong>
            <p className="muted">{checkerSummary.phone} · {checkerSummary.organizationName || "소속 기관 정보 없음"}</p>
          </div>
          <StatusBadge type="checker" value={checkerSummary.status} />
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
      <PageHeader eyebrow="대상자 관리" title="대상자 현황" description="확인 유형, 위험도, 담당 체커를 확인합니다." />

      <Card className="summary-card">
        <p className="eyebrow">대상자 현황</p>
        <strong>전체 {data.targets.length}명 · 오늘 확인 {data.targets.filter(isTodayScheduled).length}명</strong>
        <span>
          정상 {data.targets.filter((target) => target.riskLevel === "normal").length}명 · 주의 {data.targets.filter((target) => target.riskLevel === "caution").length}명 · 위험 {data.targets.filter((target) => target.riskLevel === "danger").length}명
        </span>
      </Card>

      <div className="filter-tabs target-filter-tabs" aria-label="대상자 필터">
        {[
          { value: "all", label: "전체" },
          { value: "normal", label: "정상" },
          { value: "caution", label: "주의" },
          { value: "danger", label: "위험" },
          { value: "today", label: "오늘 확인" },
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
                <p>{target.age}세 · {target.gender} · {getTargetArea(target)}</p>
              </div>
              <StatusBadge type="risk" value={target.riskLevel} />
            </div>
            <div className="admin-target-meta">
              <div><span>담당 체커</span><strong>{checkerName(data.users, target.assignedCheckerId)}</strong></div>
              <div><span>기본 확인 유형</span><strong>{checkTypeLabels[getTargetCheckType(target)]}</strong></div>
              <div><span>확인 요일</span><strong>{target.checkDays?.join(", ") || "요일 미정"}</strong></div>
              <div><span>최근 확인일</span><strong>{target.lastVisitDate}</strong></div>
            </div>
            <span className="admin-target-detail-action">상세보기</span>
          </button>
        ))}
      </div>
    </>
  );
}
export function AdminTargetDetail({ targetId, data }) {
  const target = targetById(data.targets, targetId);

  if (!target) {
    return <EmptyState title="대상자를 찾을 수 없습니다" description="대상자 관리 화면에서 다시 선택해주세요." />;
  }

  const checker = checkerById(data.users, target.assignedCheckerId);
  const visits = data.activityRecords.filter((record) => record.targetId === target.id).sort(byLatestDate);
  const reports = data.emergencyReports.filter((report) => report.targetId === target.id).sort(byLatestDate);

  return (
    <>
      <PageHeader
        eyebrow="대상자 상세"
        title={target.name}
        description={`${target.age}세 · ${target.gender} · ${target.address}`}
        action={<StatusBadge type="risk" value={target.riskLevel} />}
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
              <Card key={record.id}>
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

      <div className="admin-activity-filter-pills" aria-label="기록 필터">
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
        {filteredReports.map((report) => (
          <Card key={report.id} className={report.urgency === 'high' ? 'danger-card' : 'alert-card'}>
            <div className="card-row">
              <div>
                <strong>{targetName(data.targets, report.targetId)}</strong>
                <p className="muted">{report.date} · {report.issueType}</p>
              </div>
              <div className="badge-row compact-badges">
                <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
                <StatusBadge type="emergency" value={report.status} />
              </div>
            </div>
            <p className="muted">{truncateText(report.description)}</p>
            <Button variant="ghost" className="full-width" onClick={() => navigate(`/admin/emergencies/${report.id}`)}>
              상세보기
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
    return <EmptyState title="이상징후 보고를 찾을 수 없습니다" description="보고 목록에서 다시 선택해주세요." />;
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
    setNotice('처리 정보가 저장되었습니다.');
  }

  return (
    <>
      <PageHeader
        eyebrow="이상징후 상세"
        title={targetName(data.targets, report.targetId)}
        description={`${report.date} · ${report.issueType}`}
        action={<StatusBadge type="issueLevel" value={getIssueLevel(report)} />}
      />

      <Card>
        <div className="admin-emergency-meta">
          <div><span>대상자</span><strong>{targetName(data.targets, report.targetId)}</strong></div>
          <div><span>체커</span><strong>{checkerName(data.users, report.checkerId)}</strong></div>
          <div><span>연락처</span><strong>{checkerPhone(data.users, report.checkerId)}</strong></div>
        </div>
        <div className="badge-row admin-emergency-status-row">
          <StatusBadge type="issueLevel" value={getIssueLevel(report)} />
          <StatusBadge type="emergency" value={report.status} />
        </div>
      </Card>

      <Card>
        <h2>상세 내용</h2>
        <p>{report.description}</p>
      </Card>

      <Card>
        <SelectInput id="admin-emergency-status" label="처리 상태" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
          <option value="received">접수됨</option>
          <option value="in_progress">처리중</option>
          <option value="completed">완료</option>
        </SelectInput>
        <TextArea
          id="admin-emergency-memo"
          label="관리자 메모"
          rows="4"
          value={form.adminMemo}
          onChange={(event) => updateForm('adminMemo', event.target.value)}
          placeholder="보호자 연락 완료, 추가 확인 예정 등"
        />
        {notice ? <p className="notice">{notice}</p> : null}
        <Button className="full-width" onClick={handleSave}>
          처리 정보 저장
        </Button>
        <Button variant="ghost" className="full-width" onClick={() => navigate('/admin/emergencies')}>
          목록으로 이동
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
              <strong>{row.value}건</strong>
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
        <p>해피통서비스</p>
        <h2>{report.title}</h2>
        <span>{period}</span>
      </header>

      <table className="report-table">
        <tbody>
          <tr>
            <th>작성일</th>
            <td>{report.updatedAt || report.createdAt}</td>
            <th>작성자</th>
            <td>{currentUser?.name || "관리자"}</td>
          </tr>
          <tr>
            <th>총 대상자</th>
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
            <td colSpan="3">{report.dangerTargetCount}명</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h3>확인 기록 요약</h3>
        <p>{report.keyIssues}</p>
      </section>
      <section>
        <h3>이상징후 보고 요약</h3>
        <p>이상징후 보고는 총 {report.emergencyCount}건이며 미처리 건은 {report.unresolvedEmergencyCount}건입니다.</p>
      </section>
      <section>
        <h3>위험 대상자 현황</h3>
        <p>위험 대상자는 {report.dangerTargetCount}명입니다. 추가 지원 필요 대상자: {supportTargets || "없음"}</p>
      </section>
      <section>
        <h3>조치 내용</h3>
        <p>{report.actionTaken}</p>
      </section>
      <section>
        <h3>관리자 의견</h3>
        <p>{report.adminOpinion || "입력된 의견 없음"}</p>
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
    setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <PageHeader
        eyebrow="행정 보고서"
        title="보고서 작성 초안"
        description="확인 기록과 이상징후 보고를 바탕으로 행정 보고서 초안을 작성합니다."
        action={<Button variant="ghost" onClick={() => navigate('/admin/reports/preview')}>미리보기 화면</Button>}
      />

      <form className="form-stack">
        <Card>
          <TextInput id="report-title" label="보고서 제목" value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
          <div className="filter-grid">
            <TextInput id="report-start" label="보고 기간 시작일" type="date" value={form.periodStart} onChange={(event) => updateForm('periodStart', event.target.value)} />
            <TextInput id="report-end" label="보고 기간 종료일" type="date" value={form.periodEnd} onChange={(event) => updateForm('periodEnd', event.target.value)} />
          </div>
        </Card>

        <Card>
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
  const report = readReportDraft(generateReportDraft(data, "2026-06-10", getTodayFromStats()));

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <PageHeader
        eyebrow="보고서 미리보기"
        title="행정 보고서 출력"
        description="저장된 보고서 초안을 문서 형태로 확인하고 PDF로 저장합니다."
        action={<Button onClick={handlePrint}>PDF 내보내기</Button>}
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
    { label: "접수됨", value: emergencyStats.reports.filter((report) => report.status === "received").length, tone: "red" },
    { label: "처리중", value: emergencyStats.reports.filter((report) => report.status === "in_progress").length, tone: "orange" },
    { label: "완료", value: emergencyStats.reports.filter((report) => report.status === "completed").length, tone: "green" },
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


