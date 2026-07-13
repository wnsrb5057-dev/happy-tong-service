import { useEffect, useMemo, useState } from "react";
import {
  activityHealthLabels,
  activityTypeLabels,
  checkItemGroups,
  checkTypeLabels,
  issueLevelLabels,
} from "../data/mockData.js";
import {
  Button,
  Card,
  CheckboxField,
  EmptyState,
  InfoList,
  PageHeader,
  SelectInput,
  StatusBadge,
  TextArea,
} from "../components/UI.jsx";
import { getAssignedTargets } from "../services/targetService.js";
import { getSupabaseCheckerHome } from "../services/supabaseCheckerHomeService.js";
import { getSupabaseCheckerTargets } from "../services/supabaseCheckerTargetsService.js";
import { getSupabaseCheckerActivityHistory } from "../services/supabaseCheckerActivityHistoryService.js";
import { getSupabaseCheckerActivityFormTargets } from "../services/supabaseCheckerActivityFormTargetsService.js";
import { getToday } from "../utils/statistics.js";
import ElderAvatarIcon from "../components/ElderAvatarIcon.jsx";
import heroGrandmother from "../assets/happytong-hero-grandmother.png";

function isActiveTarget(target) {
  return (target.lifecycleStatus || "active") !== "ended";
}
function isTodayScheduled(target) {
  return target.todayScheduled ?? target.todayVisit;
}

function targetName(targets, targetId) {
  return targets.find((target) => target.id === targetId)?.name ?? "대상자 없음";
}

function getHistoryTargetInfo(targets, targetId) {
  const target = targets.find((item) => item.id === targetId) ?? null;

  if (!target) {
    return {
      target: null,
      label: "대상자 정보 없음",
      searchText: "",
    };
  }

  if (!isActiveTarget(target)) {
    return {
      target,
      label: "관리종료 대상자",
      searchText: `${target.name || ""} ${target.address || ""}`.toLowerCase(),
    };
  }

  return {
    target,
    label: target.name || "대상자 정보 없음",
    searchText: `${target.name || ""} ${target.address || ""}`.toLowerCase(),
  };
}

function getTargetArea(target) {
  return target.area || target.district || target.address;
}

function getTargetCheckTime(target) {
  return target.checkTime || target.visitTime || "시간 미정";
}

function getTargetCheckType(target) {
  return target.defaultCheckType || "external";
}

function formatCheckerHomeDate(value) {
  if (!value || value === "-") return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

function sortByLatestDate(a, b) {
  const aTime = new Date(a?.checkedAt || a?.reportedAt || a?.date || 0).getTime();
  const bTime = new Date(b?.checkedAt || b?.reportedAt || b?.date || 0).getTime();

  return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
}

function resolveCheckerSupabaseId(user) {
  // MVP 읽기 전용 전환용 임시 매핑입니다. 운영 전에는 Auth/users.id 기준으로 대체해야 합니다.
  if (
    user?.username === "checker" ||
    user?.id === "checker" ||
    user?.role === "checker" ||
    String(user?.name || "").includes("김민정") ||
    String(user?.displayName || "").includes("김민정") ||
    String(user?.name || "").includes("김하나")
  ) {
    return "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3";
  }

  return "";
}

function findLocalTargetId(targets, supabaseTarget) {
  const directMatch = targets.find((target) => target.id === supabaseTarget?.id);
  if (directMatch) return directMatch.id;

  const nameMatch = targets.find((target) => target.name === supabaseTarget?.name);
  return nameMatch?.id || "";
}

function buildCheckerTargetDetailPath(target) {
  const routeTargetId = target.localDetailTargetId || target.id;
  const searchParams = new URLSearchParams();

  if (target?.name) {
    searchParams.set("lookupName", target.name);
  }

  if (target?.address) {
    searchParams.set("lookupAddress", target.address);
  }

  const queryString = searchParams.toString();
  return `/checker/targets/${routeTargetId}${queryString ? `?${queryString}` : ""}`;
}

function findCheckerTargetForDetail(targetId, targets) {
  const directTarget = targets.find((item) => item.id === targetId && isActiveTarget(item));
  if (directTarget) return directTarget;

  const params = new URLSearchParams(window.location.search);
  const lookupName = params.get("lookupName") || "";
  const lookupAddress = params.get("lookupAddress") || "";

  if (!lookupName) {
    return null;
  }

  return (
    targets.find((item) => {
      if (!isActiveTarget(item)) return false;
      if (item.name !== lookupName) return false;
      if (!lookupAddress) return true;
      const itemAddress = String(item.address || "").trim();
      return itemAddress === lookupAddress || itemAddress.includes(lookupAddress) || lookupAddress.includes(itemAddress);
    }) || null
  );
}

function getLifecycleStatusLabel(status) {
  if (status === "ended") return "관리종료";
  if (status === "paused") return "일시중지";
  return "관리중";
}

function getTargetDisplayAge(target) {
  if (target?.age) return `${target.age}세`;
  if (target?.birthYear) return `${target.birthYear}년생`;
  return "연령 정보 없음";
}

function getTargetCheckDaysText(target) {
  return Array.isArray(target?.checkDays) && target.checkDays.length > 0 ? target.checkDays.join(", ") : "요일 미정";
}

function getTodayCompletedTargetIds(records) {
  const today = getToday();
  return new Set(
    records
      .filter((record) => (record.date || record.checkedAt || "").slice(0, 10) === today)
      .map((record) => record.targetId)
  );
}

function getLastActivityStatusLabel(status) {
  if (status === "normal" || status === "이상 없음") return "이상 없음";
  if (status === "caution" || status === "관찰 필요") return "관찰 필요";
  if (status === "emergency" || status === "이상징후") return "이상징후";
  if (status === "no_answer" || status === "미응답") return "미응답";
  if (status === "completed" || status === "완료") return "완료";
  if (status === "missed" || status === "미실시") return "미실시";
  return "-";
}

function getCheckerHistoryCheckTypeLabel(checkType) {
  return activityTypeLabels[checkType] || checkTypeLabels[checkType] || checkType || "전화 확인";
}

function getCheckerHistoryResultStatusLabel(status) {
  if (status === "normal" || status === "이상 없음") return "이상 없음";
  if (status === "caution" || status === "관찰 필요") return "관찰 필요";
  if (status === "emergency" || status === "이상징후") return "이상징후";
  if (status === "no_answer" || status === "미응답") return "미응답";
  if (status === "completed" || status === "완료") return "완료";
  if (status === "missed" || status === "미실시") return "미실시";
  return status || "이상 없음";
}

function formatCheckerHistoryDate(value) {
  if (!value) return "날짜 정보 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("ko-KR");
}

function getAssignedCheckerInfo(users, target) {
  const assignedChecker = users.find((user) => user.id === target?.assignedCheckerId);
  const checkerName = assignedChecker?.name || "담당 체커 미배정";
  const checkerPhone =
    assignedChecker?.phone ||
    assignedChecker?.phoneNumber ||
    assignedChecker?.contactPhone ||
    "연락처 없음";

  return {
    name: target?.managerName || checkerName,
    org: target?.managerOrg || assignedChecker?.organizationName || "",
    phone: target?.managerPhone || checkerPhone,
  };
}

function createDefaultCheckItems(checkType) {
  return Object.fromEntries((checkItemGroups[checkType] || checkItemGroups.external).map((item) => [item.key, item.options[0].value]));
}

function getCheckItemText(checkType, checkItems = {}) {
  return (checkItemGroups[checkType] || checkItemGroups.external)
    .map((item) => {
      const value = checkItems[item.key];
      const option = item.options.find((candidate) => candidate.value === value);
      return `${item.label}: ${option?.label || "미선택"}`;
    })
    .join(" · ");
}

function truncateText(text, maxLength = 48) {
  if (!text) {
    return "메모 없음";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="support-action-icon" viewBox="0 0 24 24" fill="none">
      <path d="M4.75 7.75h3.1l1.15-1.75h5l1.15 1.75h4.1a1.75 1.75 0 0 1 1.75 1.75v7.75A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25V9.5A1.75 1.75 0 0 1 4.75 7.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="support-action-icon" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.75 11.75a5.25 5.25 0 0 0 10.5 0M12 17v3.5M9.25 20.5h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetCard({ target, navigate, homePreview = false }) {
  function goDetail() {
    navigate(buildCheckerTargetDetailPath(target));
  }

  const scheduleText = getTargetCheckDaysText(target);
  const isEnded = (target.lifecycleStatus || "active") === "ended";

  return (
    <article className={`target-card risk-card-${target.riskLevel} ${homePreview ? "target-card-home" : "target-card-list"}`}>
      <div className="card-row target-card-head">
        <div className="target-card-person">
          <ElderAvatarIcon gender={target.gender} size={homePreview ? "small" : "default"} />
          <div className="target-card-person-copy">
            <strong>{target.name}</strong>
            <p className="target-address-clamp">{target.address}</p>
          </div>
        </div>
        <StatusBadge type="risk" value={target.riskLevel} />
      </div>

      <div className="badge-row target-card-badges">
        <StatusBadge type="checkType" value={getTargetCheckType(target)} />
        {homePreview ? (
          isTodayScheduled(target) ? (
            <span className="badge badge-info">오늘 확인 예정 {getTargetCheckTime(target)}</span>
          ) : (
            <span className="badge badge-muted">오늘 일정 없음</span>
          )
        ) : (
          <>
            <span className={`badge ${isEnded ? "badge-muted" : "badge-info"}`}>{getLifecycleStatusLabel(target.lifecycleStatus)}</span>
            <span className={`badge ${target.todayCompleted ? "badge-info" : "badge-warning"}`}>
              {target.todayCompleted ? "오늘 확인 완료" : "오늘 확인 필요"}
            </span>
            {Number(target.unresolvedEmergencyCount || 0) > 0 ? (
              <span className="badge badge-danger">미처리 {target.unresolvedEmergencyCount}건</span>
            ) : null}
          </>
        )}
      </div>

      <div className="card-row target-card-meta">
        <small>최근 확인 {formatCheckerHomeDate(target.lastVisitDate || target.lastActivityAt)}</small>
        <small>{scheduleText}</small>
      </div>

      {!homePreview ? (
        <div className="card-row target-card-meta">
          <small>{`${getTargetDisplayAge(target)} · ${target.gender || "성별 정보 없음"}`}</small>
          <small>{target.defaultCheckTypeLabel || checkTypeLabels[getTargetCheckType(target)] || "전화"}</small>
        </div>
      ) : null}

      {!homePreview && target.lastActivityStatusLabel && target.lastActivityStatusLabel !== "-" ? (
        <p className="muted">{`최근 확인 상태 ${target.lastActivityStatusLabel}`}</p>
      ) : null}

      <Button
        variant="ghost"
        className="full-width target-detail-button"
        onClick={goDetail}
        aria-label={`${target.name} 상세보기`}
      >
        상세보기
      </Button>
    </article>
  );
}

function CheckerHomeActivityList({ activities }) {
  if (!activities.length) {
    return (
      <Card className="empty-assignment-card">
        <strong>최근 확인 기록이 없습니다.</strong>
        <p>확인 기록이 등록되면 이곳에 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      {activities.map((record) => (
        <Card key={record.id} className="admin-activity-card">
          <div className="admin-activity-primary">
            <strong>{record.targetName}</strong>
            <span>{formatCheckerHomeDate(record.checkedAt)}</span>
          </div>
          <div className="badge-row compact-badges admin-activity-badges">
            <span className="badge badge-info">{record.checkTypeLabel || record.checkType || "확인"}</span>
            <span className="badge badge-muted">{record.resultStatusLabel || record.statusLabel || "완료"}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CheckerHomeEmergencyList({ emergencies }) {
  if (!emergencies.length) {
    return (
      <Card className="empty-assignment-card">
        <strong>최근 이상징후가 없습니다.</strong>
        <p>보고된 이상징후가 있으면 이곳에 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      {emergencies.map((report) => (
        <Card key={report.id} className="admin-emergency-list-card">
          <div className="admin-emergency-list-head">
            <div className="admin-emergency-list-copy">
              <strong>{report.title || "이상징후 보고"}</strong>
              <p>{report.targetName}</p>
            </div>
            <span>{formatCheckerHomeDate(report.reportedAt || report.date)}</span>
          </div>
          <div className="badge-row compact-badges">
            <span className="badge badge-warning">{report.severityLabel || report.severity || "주의"}</span>
            <span className="badge badge-info">{report.statusLabel || report.status || "접수됨"}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function CheckerHome({ user, currentUser, data, navigate, emergencySent }) {
  const activeUser = currentUser || user;
  const assignedTargets = useMemo(
    () => data.targets.filter((target) => target.assignedCheckerId === activeUser.id && isActiveTarget(target)),
    [activeUser.id, data.targets]
  );
  const todayTargets = useMemo(() => assignedTargets.filter(isTodayScheduled), [assignedTargets]);
  const pendingRecords = useMemo(
    () => data.activityRecords.filter((record) => record.checkerId === activeUser.id && record.status !== "completed"),
    [activeUser.id, data.activityRecords]
  );
  const assignedTargetIds = useMemo(
    () => new Set(assignedTargets.map((target) => target.id)),
    [assignedTargets]
  );
  const localRecentActivities = useMemo(
    () =>
      data.activityRecords
        .filter((record) => record.checkerId === activeUser.id)
        .sort(sortByLatestDate)
        .slice(0, 5)
        .map((record) => ({
          id: record.id,
          targetName: targetName(data.targets, record.targetId),
          checkType: record.type || record.checkType,
          checkTypeLabel: activityTypeLabels[record.type] || checkTypeLabels[record.checkType] || record.type || "확인",
          resultStatus: record.status,
          resultStatusLabel: record.status === "completed" ? "완료" : "미작성",
          checkedAt: record.date || record.checkedAt || record.createdAt,
        })),
    [activeUser.id, data.activityRecords, data.targets]
  );
  const localRecentEmergencies = useMemo(
    () =>
      data.emergencyReports
        .filter((report) => assignedTargetIds.has(report.targetId))
        .sort(sortByLatestDate)
        .slice(0, 5)
        .map((report) => ({
          id: report.id,
          targetName: targetName(data.targets, report.targetId),
          title: report.title || report.issueType || "이상징후 보고",
          severity: report.severity || report.issueLevel || "caution",
          severityLabel: issueLevelLabels[report.issueLevel] || report.severity || "주의",
          status: report.status || "received",
          statusLabel: report.status || "접수됨",
          reportedAt: report.reportedAt || report.date,
        })),
    [assignedTargetIds, data.emergencyReports, data.targets]
  );
  const fallbackHome = useMemo(
    () => ({
      assignedTargetCount: assignedTargets.length,
      todayPendingCount: todayTargets.length,
      todayCompletedCount: Math.max(0, todayTargets.length - pendingRecords.length),
      unresolvedEmergencyCount: localRecentEmergencies.filter((report) => report.status !== "completed").length,
      todayTargets,
      recentActivities: localRecentActivities,
      recentEmergencies: localRecentEmergencies,
    }),
    [assignedTargets, todayTargets, pendingRecords.length, localRecentActivities, localRecentEmergencies]
  );
  const checkerSupabaseId = resolveCheckerSupabaseId(activeUser);
  const [checkerHomeState, setCheckerHomeState] = useState(() => ({
    loading: Boolean(checkerSupabaseId),
    source: checkerSupabaseId ? "loading" : "local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: checkerSupabaseId
      ? "Supabase 체커 홈 요약을 확인 중입니다."
      : "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
    home: fallbackHome,
  }));

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!checkerSupabaseId) {
        setCheckerHomeState({
          loading: false,
          source: "local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
          home: fallbackHome,
        });
        return;
      }

      setCheckerHomeState((current) => ({
        ...current,
        loading: true,
        source: "loading",
        noteLabel: "로컬 데이터 기준",
        noteMessage: "Supabase 체커 홈 요약을 확인 중입니다.",
        home: fallbackHome,
      }));

      console.debug("[checker-home] current user", activeUser);
      console.debug("[checker-home] supabase checker id", checkerSupabaseId);
      const result = await getSupabaseCheckerHome(checkerSupabaseId);

      if (!mounted) return;

      if (result.ok && result.home) {
        const mapSupabaseTarget = (target) => ({
          ...target,
          localDetailTargetId: findLocalTargetId(data.targets, target),
        });

        setCheckerHomeState({
          loading: false,
          source: "supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          home: {
            ...result.home,
            todayTargets: result.home.todayTargets.map(mapSupabaseTarget),
            assignedTargets: result.home.assignedTargets.map(mapSupabaseTarget),
          },
        });
        return;
      }

      setCheckerHomeState({
        loading: false,
        source: "local",
        noteLabel: "로컬 데이터 기준",
        noteMessage:
          result.source === "not_found"
            ? "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다."
            : "Supabase 체커 홈 요약을 불러오지 못해 로컬 데이터를 표시합니다.",
        home: fallbackHome,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [checkerSupabaseId, data.targets, fallbackHome]);

  const displayedHome = checkerHomeState.home || fallbackHome;
  const displayedTodayTargets = Array.isArray(displayedHome.todayTargets) ? displayedHome.todayTargets : [];
  const displayedRecentActivities = Array.isArray(displayedHome.recentActivities) ? displayedHome.recentActivities : [];
  const displayedRecentEmergencies = Array.isArray(displayedHome.recentEmergencies) ? displayedHome.recentEmergencies : [];

  return (
    <>
      <section className="checker-home-hero">
        <div className="checker-home-hero-copy">
          <p className="eyebrow">체커 홈</p>
          <h1>{`${user.name.split(" ")[0]}님, 오늘 확인 일정입니다`}</h1>
          <p className="muted">오늘 일정과 미작성 기록을 먼저 확인하세요.</p>
        </div>
        <div className="checker-home-hero-art" aria-hidden="true">
  <img
    className="checker-home-hero-image"
    src={heroGrandmother}
    alt=""
  />
</div>
        <div className="summary-split checker-home-summary">
          <div className="summary-metric">
            <strong>{displayedHome.assignedTargetCount}</strong>
            <span>담당 대상자</span>
          </div>
          <div className="summary-metric">
            <strong>{displayedHome.todayPendingCount}</strong>
            <span>오늘 확인 필요</span>
          </div>
          <div className="summary-metric">
            <strong>{displayedHome.todayCompletedCount}</strong>
            <span>오늘 확인 완료</span>
          </div>
          <div className="summary-metric">
            <strong>{displayedHome.unresolvedEmergencyCount}</strong>
            <span>미처리 이상징후</span>
          </div>
        </div>
      </section>

      <div className="admin-dashboard-source-note">
        <span className={`badge ${checkerHomeState.source === "supabase" ? "super-source-supabase" : "super-source-local"}`}>
          {checkerHomeState.noteLabel}
        </span>
        <span className="muted">{checkerHomeState.noteMessage}</span>
      </div>

      {emergencySent ? <p className="notice danger-notice">이상징후 보고가 관리자에게 전달되었습니다.</p> : null}

      <div className="emergency-cta">
        <button type="button" onClick={() => navigate("/checker/emergency/new")}>
          🚨 이상징후 보고
        </button>
      </div>

      <section className="section-block">
        <div className="section-title">
          <h2>오늘 확인 예정 대상자</h2>
          <Button variant="ghost" onClick={() => navigate("/checker/targets")}>
            전체 보기
          </Button>
        </div>
        {displayedHome.assignedTargetCount === 0 ? (
          <Card className="empty-assignment-card">
            <strong>아직 배정된 대상자가 없습니다.</strong>
            <p>담당 기관에서 대상자를 배정하면 오늘 확인 일정이 표시됩니다.</p>
            <p className="muted">배정 관련 문의는 소속 기관 담당자에게 확인해주세요.</p>
          </Card>
        ) : (
          <div className="stack">
            {displayedTodayTargets.slice(0, 10).map((target) => (
              <TargetCard key={target.id} target={target} navigate={navigate} homePreview />
            ))}
            {displayedTodayTargets.length === 0 ? (
              <Card className="empty-assignment-card">
                <strong>오늘 확인 예정 대상자가 없습니다.</strong>
                <p>배정된 대상자 중 오늘 일정이 잡히면 이곳에 표시됩니다.</p>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>최근 확인 기록</h2>
        </div>
        <CheckerHomeActivityList activities={displayedRecentActivities} />
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>최근 이상징후</h2>
        </div>
        <CheckerHomeEmergencyList emergencies={displayedRecentEmergencies} />
      </section>
    </>
  );
}

export function CheckerTargets({ user, currentUser, data, navigate }) {
  const activeUser = currentUser || user;
  const localAssignedTargets = useMemo(
    () => data.targets.filter((target) => target.assignedCheckerId === activeUser.id),
    [activeUser.id, data.targets]
  );
  const todayCompletedTargetIds = useMemo(
    () => getTodayCompletedTargetIds(data.activityRecords.filter((record) => record.checkerId === activeUser.id)),
    [activeUser.id, data.activityRecords]
  );
  const fallbackTargets = useMemo(
    () =>
      localAssignedTargets.map((target) => ({
        ...target,
        lifecycleStatus: target.lifecycleStatus || "active",
        lifecycleStatusLabel: getLifecycleStatusLabel(target.lifecycleStatus || "active"),
        defaultCheckTypeLabel: checkTypeLabels[getTargetCheckType(target)] || getTargetCheckType(target),
        checkDays: Array.isArray(target.checkDays) ? target.checkDays : [],
        lastActivityAt: target.lastVisitDate || null,
        lastActivityStatus: "",
        lastActivityStatusLabel: "-",
        todayCompleted: todayCompletedTargetIds.has(target.id),
        unresolvedEmergencyCount: data.emergencyReports.filter(
          (report) => report.targetId === target.id && report.status !== "completed"
        ).length,
        localDetailTargetId: target.id,
      })),
    [data.emergencyReports, localAssignedTargets, todayCompletedTargetIds]
  );
  const checkerSupabaseId = resolveCheckerSupabaseId(activeUser);
  const [checkerTargetsState, setCheckerTargetsState] = useState(() => ({
    loading: Boolean(checkerSupabaseId),
    source: checkerSupabaseId ? "loading" : "local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: checkerSupabaseId
      ? "Supabase 체커 대상자 목록을 확인 중입니다."
      : "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
    targets: fallbackTargets,
  }));

  useEffect(() => {
    let mounted = true;

    async function load() {
      console.debug("[checker-targets] current user", activeUser);

      if (!checkerSupabaseId) {
        setCheckerTargetsState({
          loading: false,
          source: "local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
          targets: fallbackTargets,
        });
        return;
      }

      setCheckerTargetsState((current) => ({
        ...current,
        loading: true,
        source: "loading",
        noteLabel: "로컬 데이터 기준",
        noteMessage: "Supabase 체커 대상자 목록을 확인 중입니다.",
        targets: fallbackTargets,
      }));

      console.debug("[checker-targets] supabase checker id", checkerSupabaseId);
      const result = await getSupabaseCheckerTargets(checkerSupabaseId);

      if (!mounted) return;

      console.debug("[checker-targets] supabase targets result", result.source, result.ok, result.targets?.length);

      if (result.ok) {
        setCheckerTargetsState({
          loading: false,
          source: "supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          targets: result.targets.map((target) => ({
            ...target,
            lifecycleStatusLabel: getLifecycleStatusLabel(target.lifecycleStatus),
            defaultCheckTypeLabel: checkTypeLabels[target.defaultCheckType] || target.defaultCheckType,
            lastActivityStatusLabel: getLastActivityStatusLabel(target.lastActivityStatus),
            localDetailTargetId: findLocalTargetId(data.targets, target),
          })),
        });
        return;
      }

      setCheckerTargetsState({
        loading: false,
        source: "local",
        noteLabel: "로컬 데이터 기준",
        noteMessage:
          result.source === "not_found"
            ? "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다."
            : "Supabase 체커 대상자 목록을 불러오지 못해 로컬 데이터를 표시합니다.",
        targets: fallbackTargets,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [activeUser, checkerSupabaseId, data.targets, fallbackTargets]);

  const displayedTargets =
    checkerTargetsState.source === "supabase"
      ? Array.isArray(checkerTargetsState.targets)
        ? checkerTargetsState.targets
        : []
      : fallbackTargets;
  const todayCount = displayedTargets.filter((target) => !target.todayCompleted && (target.lifecycleStatus || "active") !== "ended").length;
  const riskCount = displayedTargets.filter((target) => target.riskLevel === "caution" || target.riskLevel === "danger").length;

  return (
    <>
      <PageHeader eyebrow="대상자 목록" title="담당 대상자" description="상세주소와 위험도를 함께 확인합니다." />

      <div className="admin-dashboard-source-note">
        <span className={`badge ${checkerTargetsState.source === "supabase" ? "super-source-supabase" : "super-source-local"}`}>
          {checkerTargetsState.noteLabel}
        </span>
        <span className="muted">{checkerTargetsState.noteMessage}</span>
      </div>

      <Card className="summary-card">
        <p className="eyebrow">담당 현황</p>
        <strong>전체 {displayedTargets.length}명 · 오늘 확인 필요 {todayCount}명</strong>
        <span>주의/위험 {riskCount}명</span>
      </Card>

      {displayedTargets.length === 0 ? (
        <EmptyState
          title="배정된 대상자가 없습니다."
          description="담당 기관에서 대상자를 배정하면 이곳에서 확인할 수 있습니다."
        />
      ) : (
        <div className="stack">
          {displayedTargets.map((target) => (
            <TargetCard key={target.id} target={target} navigate={navigate} />
          ))}
        </div>
      )}
    </>
  );
}

export function CheckerTargetDetail({ targetId, user, data, navigate }) {
  const target = findCheckerTargetForDetail(targetId, data.targets);

  if (!target) {
    return (
      <EmptyState title="대상자를 찾을 수 없습니다" description="대상자 목록에서 다시 선택해주세요.">
        <Button onClick={() => navigate("/checker/targets")}>목록으로 돌아가기</Button>
      </EmptyState>
    );
  }

  const assignedCheckerInfo = getAssignedCheckerInfo(data.users, target);
  const recentRecords = data.activityRecords
    .filter((record) => record.targetId === target.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  function handleManagerCall() {
    if (!assignedCheckerInfo.phone || assignedCheckerInfo.phone === "연락처 없음") {
      window.alert("담당자 연락처가 등록되어 있지 않습니다.");
      return;
    }

    window.location.href = `tel:${assignedCheckerInfo.phone}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="대상자 상세"
        title={target.name}
        description={`${getTargetArea(target)} · ${checkTypeLabels[getTargetCheckType(target)]}`}
      />

      <Card className="target-detail-card">
        <div className="card-row target-detail-top">
          <div className="target-card-person">
            <ElderAvatarIcon gender={target.gender} />
            <div className="target-card-person-copy">
              <strong>{target.name}</strong>
              <p className="target-address-clamp">{target.address}</p>
            </div>
          </div>
          <StatusBadge type="risk" value={target.riskLevel} />
        </div>
        <div className="target-detail-meta">
          <div className="target-detail-meta-item">
            <span>확인 유형</span>
            <strong>{checkTypeLabels[getTargetCheckType(target)]}</strong>
          </div>
          <div className="target-detail-meta-item">
            <span>오늘 확인</span>
            <strong>{isTodayScheduled(target) ? getTargetCheckTime(target) : "오늘 일정 없음"}</strong>
          </div>
          <div className="target-detail-meta-item">
            <span>최근 확인</span>
            <strong>{target.lastVisitDate}</strong>
          </div>
          <div className="target-detail-meta-item">
            <span>확인 요일</span>
            <strong>{target.checkDays?.join(", ") || "요일 미정"}</strong>
          </div>
        </div>
      </Card>

      <Card className="target-detail-notes-card">
        <h2>주의사항 요약</h2>
        <InfoList
          items={[
            { label: "건강 상태", value: target.healthStatus },
            { label: "주의사항", value: target.cautionNote },
            { label: "복약 메모", value: target.medicationNote || "없음" },
          ]}
        />
      </Card>

      <Card>
        <h2>담당자 연락</h2>
        <InfoList
          items={[
            {
              label: "담당자",
              value: assignedCheckerInfo.org
                ? `${assignedCheckerInfo.name} · ${assignedCheckerInfo.org}`
                : assignedCheckerInfo.name,
            },
            { label: "연락처", value: assignedCheckerInfo.phone },
          ]}
        />
        <div className="action-grid">
          <Button
            variant="secondary"
            onClick={handleManagerCall}
            disabled={!assignedCheckerInfo.phone || assignedCheckerInfo.phone === "연락처 없음"}
          >
            담당자에게 연락
          </Button>
          <Button variant="danger" onClick={() => navigate(`/checker/emergency/new?targetId=${target.id}`)}>
            이상징후 보고
          </Button>
        </div>
      </Card>

      <p className="notice target-detail-notice">대상자 정보는 담당 확인 업무 목적으로만 사용해야 합니다.</p>

      <section className="section-block">
        <div className="section-title">
          <h2>최근 확인 이력</h2>
          <Button variant="ghost" onClick={() => navigate(`/checker/activity/history?targetId=${target.id}`)}>
            전체 이력 보기
          </Button>
        </div>
        <div className="stack compact-stack">
          {recentRecords.length ? (
            recentRecords.map((record) => (
              <Card key={record.id} className="target-history-card">
                <div className="target-history-row">
                  <div className="target-history-main">
                    <strong>{record.date}</strong>
                    <span>{activityTypeLabels[record.checkType || record.type]}</span>
                  </div>
                  <span className={record.hasIssue || record.issueLevel !== "none" ? "danger-text" : "safe-text"}>
                    {record.hasIssue || record.issueLevel !== "none" ? "이상징후 있음" : "이상징후 없음"}
                  </span>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="최근 확인 이력이 없습니다" description="확인 기록이 작성되면 여기에 표시됩니다." />
          )}
        </div>
      </section>
    </>
  );
}

export function ActivityNew({ user, currentUser, data, actions, navigate, initialTargetId }) {
  const activeUser = currentUser || user;
  const assignedTargets = useMemo(
    () => getAssignedTargets(data.targets, activeUser.id).filter(isActiveTarget),
    [activeUser.id, data.targets]
  );
  const fallbackTargets = useMemo(
    () =>
      assignedTargets.map((target) => ({
        ...target,
        localDetailTargetId: target.id,
        selectionValue: target.id,
      })),
    [assignedTargets]
  );
  const validInitialTargetId = assignedTargets.some((target) => target.id === initialTargetId)
    ? initialTargetId
    : assignedTargets[0]?.id || "";
  const initialTarget = assignedTargets.find((target) => target.id === validInitialTargetId);
  const [form, setForm] = useState({
    targetId: validInitialTargetId,
    checkType: getTargetCheckType(initialTarget || {}),
    issueLevel: "none",
    memo: "",
    issueSummary: "",
  });
  const [checkItems, setCheckItems] = useState(() => createDefaultCheckItems(form.checkType));
  const [error, setError] = useState("");
  const [showTargetPicker, setShowTargetPicker] = useState(!validInitialTargetId);
  const [photoLabel, setPhotoLabel] = useState("");
  const checkerSupabaseId = resolveCheckerSupabaseId(activeUser);
  const [activityFormTargetsState, setActivityFormTargetsState] = useState(() => ({
    loading: Boolean(checkerSupabaseId),
    source: checkerSupabaseId ? "loading" : "local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: checkerSupabaseId
      ? "Supabase 기록작성 대상자 목록을 확인 중입니다."
      : "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
    targets: fallbackTargets,
  }));
  const displayedTargets =
    activityFormTargetsState.source === "supabase"
      ? Array.isArray(activityFormTargetsState.targets)
        ? activityFormTargetsState.targets
        : []
      : fallbackTargets;
  const selectedTarget = displayedTargets.find((target) => (target.selectionValue || target.localDetailTargetId) === form.targetId);
  const activeCheckItems = checkItemGroups[form.checkType] || checkItemGroups.external;

  useEffect(() => {
    let mounted = true;

    async function load() {
      console.debug("[checker-activity-form-targets] current user", activeUser);

      if (!checkerSupabaseId) {
        setActivityFormTargetsState({
          loading: false,
          source: "local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
          targets: fallbackTargets,
        });
        return;
      }

      setActivityFormTargetsState((current) => ({
        ...current,
        loading: true,
        source: "loading",
        noteLabel: "로컬 데이터 기준",
        noteMessage: "Supabase 기록작성 대상자 목록을 확인 중입니다.",
        targets: fallbackTargets,
      }));

      console.debug("[checker-activity-form-targets] supabase checker id", checkerSupabaseId);
      const result = await getSupabaseCheckerActivityFormTargets(checkerSupabaseId);

      if (!mounted) return;

      console.debug(
        "[checker-activity-form-targets] supabase targets result",
        result.source,
        result.ok,
        result.targets?.length
      );

      if (result.ok) {
        setActivityFormTargetsState({
          loading: false,
          source: "supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          targets: result.targets.map((target) => ({
            ...target,
            riskLevelLabel: target.riskLevel,
            lifecycleStatusLabel: getLifecycleStatusLabel(target.lifecycleStatus),
            defaultCheckTypeLabel: checkTypeLabels[target.defaultCheckType] || target.defaultCheckType,
            lastActivityStatusLabel: getLastActivityStatusLabel(target.lastActivityStatus),
            localDetailTargetId: findLocalTargetId(data.targets, target),
            selectionValue: findLocalTargetId(data.targets, target) || `supabase:${target.id}`,
          })),
        });
        return;
      }

      setActivityFormTargetsState({
        loading: false,
        source: "local",
        noteLabel: "로컬 데이터 기준",
        noteMessage:
          result.source === "not_found"
            ? "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다."
            : "Supabase 기록작성 대상자 목록을 불러오지 못해 로컬 데이터를 표시합니다.",
        targets: fallbackTargets,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [activeUser, checkerSupabaseId, data.targets, fallbackTargets]);

  if (displayedTargets.length === 0 && activityFormTargetsState.source !== "loading") {
    return (
      <>
        <PageHeader eyebrow="확인 기록" title="확인 기록 작성" description="대상자와 확인 유형을 확인한 뒤 바로 기록합니다." />
        <EmptyState
          title="기록을 작성할 대상자가 아직 배정되지 않았습니다."
          description="대상자 배정 후 확인 기록을 작성할 수 있습니다."
        />
      </>
    );
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleTargetChange(targetId) {
    const nextTarget = displayedTargets.find((target) => (target.selectionValue || target.localDetailTargetId) === targetId);
    const nextCheckType = getTargetCheckType(nextTarget || {});
    setForm((current) => ({ ...current, targetId, checkType: nextCheckType }));
    setCheckItems(createDefaultCheckItems(nextCheckType));
    setShowTargetPicker(false);
  }

  function handleCheckTypeChange(checkType) {
    setForm((current) => ({ ...current, checkType }));
    setCheckItems(createDefaultCheckItems(checkType));
  }

  function updateCheckItem(key, value) {
    setCheckItems((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.targetId) {
      setError("대상자를 선택해주세요.");
      return;
    }

    if (!selectedTarget || !selectedTarget.localDetailTargetId) {
      setError("로컬 대상자와 연결된 경우에만 기록을 저장할 수 있습니다.");
      return;
    }

    if (activeCheckItems.some((item) => !checkItems[item.key])) {
      setError("확인 항목을 모두 선택해주세요.");
      return;
    }

    const hasIssue = form.issueLevel !== "none";
    const memo = form.memo.trim();
    const issueSummary = form.issueSummary.trim();

    const now = new Date().toISOString();
    actions.addActivityRecord({
      id: `record-${Date.now()}`,
      targetId: selectedTarget.localDetailTargetId,
      checkerId: user.id,
      date: getToday(),
      type: form.checkType,
      checkType: form.checkType,
      checkItems,
      checklist: checkItems,
      healthStatus: form.issueLevel === "urgent" ? "danger" : form.issueLevel === "need_check" ? "caution" : "good",
      memo,
      hasIssue,
      issueLevel: form.issueLevel,
      issueSummary: hasIssue ? issueSummary || "이상징후 확인 필요" : "",
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    navigate("/checker/activity/history?saved=1");
  }

  return (
    <>
      <PageHeader eyebrow="확인 기록" title="확인 기록 작성" description="대상자와 확인 유형을 확인한 뒤 바로 기록합니다." />

      <div className="admin-dashboard-source-note">
        <span className={`badge ${activityFormTargetsState.source === "supabase" ? "super-source-supabase" : "super-source-local"}`}>
          {activityFormTargetsState.noteLabel}
        </span>
        <span className="muted">{activityFormTargetsState.noteMessage}</span>
      </div>

      <form className="form-stack activity-form" onSubmit={handleSubmit}>
        {showTargetPicker ? (
          <Card className="activity-target-card">
            <h2>대상자 선택</h2>
            <div className="activity-target-grid" role="list" aria-label="대상자 선택">
              {displayedTargets.map((target) => (
                <button
                  key={target.selectionValue || target.id || target.localDetailTargetId}
                  type="button"
                  className={`activity-target-option ${form.targetId === (target.selectionValue || target.localDetailTargetId) ? "active" : ""}`}
                  onClick={() => handleTargetChange(target.selectionValue || target.localDetailTargetId)}
                >
                  <strong>{target.name}</strong>
                  <span>{target.address}</span>
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {selectedTarget ? (
          <Card className="activity-summary-card">
            <div className="card-row activity-summary-top">
              <div className="target-card-person">
                <ElderAvatarIcon gender={selectedTarget.gender} size="small" />
                <div className="target-card-person-copy">
                  <strong>{selectedTarget.name}</strong>
                </div>
              </div>
              <div className="activity-summary-actions">
                <StatusBadge type="risk" value={selectedTarget.riskLevel} />
                <Button variant="ghost" className="activity-change-target" onClick={() => setShowTargetPicker(true)}>
                  대상자 변경
                </Button>
              </div>
            </div>
            <p className="activity-summary-address">{selectedTarget.address}</p>
            <div className="badge-row compact-badges">
              <StatusBadge type="checkType" value={form.checkType} />
              <span className="badge badge-info">{`오늘 ${isTodayScheduled(selectedTarget) ? getTargetCheckTime(selectedTarget) : "일정 없음"}`}</span>
            </div>
            {!selectedTarget.localDetailTargetId ? (
              <p className="notice target-detail-notice">이 대상자는 읽기 전용 Supabase 데이터로만 연결되어 있어 현재 기록 저장은 지원하지 않습니다.</p>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <h2>확인 유형</h2>
          <div className="segmented-control activity-type-control">
            {Object.entries(checkTypeLabels).map(([value, label]) => (
              <button
                className={form.checkType === value ? "active" : ""}
                key={value}
                type="button"
                onClick={() => handleCheckTypeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedTarget ? <p className="muted">기본 확인 유형: {checkTypeLabels[getTargetCheckType(selectedTarget)]}</p> : null}
        </Card>

        <Card>
          <h2>확인 항목</h2>
          <div className="segmented-stack">
            {activeCheckItems.map((item) => (
              <div className="segmented-row" key={item.key}>
                <strong>{item.label}</strong>
                <div className="segmented-control">
                  {item.options.map((option) => (
                    <button
                      className={checkItems[item.key] === option.value ? "active" : ""}
                      key={option.value}
                      type="button"
                      onClick={() => updateCheckItem(item.key, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2>이상징후 여부</h2>
          <div className="segmented-control issue-level-control">
            {Object.entries(issueLevelLabels).map(([value, label]) => (
              <button className={form.issueLevel === value ? "active" : ""} key={value} type="button" onClick={() => updateForm("issueLevel", value)}>
                {label}
              </button>
            ))}
          </div>
          {form.issueLevel !== "none" ? (
            <div className={`issue-level-callout ${form.issueLevel === "urgent" ? "issue-level-callout-urgent" : ""}`}>
              <strong>{form.issueLevel === "urgent" ? "긴급 확인 필요" : "확인 필요"}</strong>
              <span>관리자가 바로 이해할 수 있도록 현재 상황을 간단히 적어주세요.</span>
            </div>
          ) : null}
          <TextArea
            id="activity-memo"
            label="추가 메모"
            rows="4"
            value={form.memo}
            onChange={(event) => updateForm("memo", event.target.value)}
            placeholder="현장에서 확인한 내용을 간단히 입력하세요."
          />
          {form.issueLevel !== "none" ? (
            <TextArea
              id="issue-summary"
              label="이상징후 내용"
              rows="3"
              value={form.issueSummary}
              onChange={(event) => updateForm("issueSummary", event.target.value)}
              placeholder="관리자가 바로 확인할 내용을 입력하세요."
            />
          ) : null}
          <div className="upload-grid">
            <div className="upload-box">
              <strong>현장 사진 촬영</strong>
              <p>필요한 경우에만 촬영하세요.</p>
              <label className="photo-capture-button" htmlFor="activity-photo">
                <CameraIcon />
                현장 사진 촬영
              </label>
              <input
                id="activity-photo"
                className="photo-input-hidden"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhotoLabel(event.target.files?.[0]?.name ? "사진 선택됨" : "")}
              />
              {photoLabel ? <span className="photo-selected-label">{photoLabel}</span> : null}
            </div>
            <button className="upload-box" type="button" onClick={() => window.alert("음성 메모 기능은 추후 제공 예정입니다.")}>
              <strong className="support-action-title"><MicIcon />음성으로 메모 입력</strong>
              <p>추후 제공 예정</p>
            </button>
          </div>
        </Card>

        {error ? <p className="form-error">{error}</p> : null}
        <Button className="full-width large-action activity-submit-button" type="submit">확인 기록 저장</Button>
      </form>
    </>
  );
}

export function ActivityHistory({ user, currentUser, data, saved }) {
  const activeUser = currentUser || user;
  const [filter, setFilter] = useState("all");
  const [openRecordId, setOpenRecordId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const params = new URLSearchParams(window.location.search);
  const targetIdFilter = params.get("targetId") || "";
  const today = getToday();
  const localAllRecords = useMemo(() => {
    return data.activityRecords
      .filter((record) => record.checkerId === activeUser.id)
      .sort((a, b) => {
        const aTime = a?.date ? new Date(a.date).getTime() : 0;
        const bTime = b?.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
  }, [activeUser.id, data.activityRecords]);
  const checkerSupabaseId = resolveCheckerSupabaseId(activeUser);
  const [activityHistoryState, setActivityHistoryState] = useState(() => ({
    loading: Boolean(checkerSupabaseId),
    source: checkerSupabaseId ? "loading" : "local",
    noteLabel: "로컬 데이터 기준",
    noteMessage: checkerSupabaseId
      ? "Supabase 체커 확인기록을 확인 중입니다."
      : "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
    records: localAllRecords,
  }));

  useEffect(() => {
    let mounted = true;

    async function load() {
      console.debug("[checker-history] current user", activeUser);

      if (!checkerSupabaseId) {
        setActivityHistoryState({
          loading: false,
          source: "local",
          noteLabel: "로컬 데이터 기준",
          noteMessage: "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다.",
          records: localAllRecords,
        });
        return;
      }

      setActivityHistoryState((current) => ({
        ...current,
        loading: true,
        source: "loading",
        noteLabel: "로컬 데이터 기준",
        noteMessage: "Supabase 체커 확인기록을 확인 중입니다.",
        records: localAllRecords,
      }));

      console.debug("[checker-history] supabase checker id", checkerSupabaseId);
      const result = await getSupabaseCheckerActivityHistory(checkerSupabaseId);

      if (!mounted) return;

      console.debug("[checker-history] supabase records result", result.source, result.ok, result.records?.length);

      if (result.ok) {
        setActivityHistoryState({
          loading: false,
          source: "supabase",
          noteLabel: "Supabase 기준",
          noteMessage: result.message,
          records: result.records,
        });
        return;
      }

      setActivityHistoryState({
        loading: false,
        source: "local",
        noteLabel: "로컬 데이터 기준",
        noteMessage:
          result.source === "not_found"
            ? "Supabase 체커 매핑 정보를 찾지 못해 로컬 데이터를 표시합니다."
            : "Supabase 체커 확인기록을 불러오지 못해 로컬 데이터를 표시합니다.",
        records: localAllRecords,
      });
    }

    load();

    return () => {
      mounted = false;
    };
  }, [activeUser, checkerSupabaseId, localAllRecords]);

  const allRecords =
    activityHistoryState.source === "supabase"
      ? Array.isArray(activityHistoryState.records)
        ? activityHistoryState.records
        : []
      : localAllRecords;
  const records = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return allRecords.filter((record) => {
      const recordType = record.checkType || record.type;
      const hasIssue =
        record.hasIssue ||
        record.issueLevel === "need_check" ||
        record.issueLevel === "urgent" ||
        record.resultStatus === "caution" ||
        record.resultStatus === "emergency";
      const historyTarget = record.isSupabaseOnly
        ? {
            label: record.targetName || "대상자 정보 없음",
            searchText: `${record.targetName || ""} ${record.targetAddress || ""}`.toLowerCase(),
          }
        : getHistoryTargetInfo(data.targets, record.targetId);
      const targetText = historyTarget.searchText;
      const recordDate = (record.date || record.checkedAt || "").slice(0, 10);

      if (targetIdFilter && record.targetId !== targetIdFilter) {
        return false;
      }

      if (filter === "today" && recordDate !== today) {
        return false;
      }

      if (filter === "issue" && !hasIssue) {
        return false;
      }

      if (["external", "visit", "call", "intensive"].includes(filter) && recordType !== filter) {
        return false;
      }

      if (keyword && !targetText.includes(keyword)) {
        return false;
      }

      return true;
    });
  }, [allRecords, data.targets, filter, searchTerm, targetIdFilter, today]);

  const filters = [
    { value: "all", label: "전체" },
    { value: "today", label: "오늘" },
    { value: "issue", label: "이상징후 있음" },
    { value: "external", label: "외부 확인" },
    { value: "call", label: "전화 확인" },
    { value: "visit", label: "방문 확인" },
    { value: "intensive", label: "집중 모니터링" },
  ];
  const issueCount = allRecords.filter(
    (record) =>
      record.hasIssue ||
      record.issueLevel === "need_check" ||
      record.issueLevel === "urgent" ||
      record.resultStatus === "caution" ||
      record.resultStatus === "emergency"
  ).length;
  const todayCount = allRecords.filter((record) => (record.date || record.checkedAt || "").slice(0, 10) === today).length;
  const targetFilterLabel = targetIdFilter ? targetName(data.targets, targetIdFilter) : "";

  return (
    <>
      <PageHeader eyebrow="확인 이력" title="내 확인 기록" description="작성한 확인 기록을 다시 확인합니다." />
      {saved ? <p className="notice">활동 기록이 저장되었습니다.</p> : null}

      <div className="admin-dashboard-source-note">
        <span className={`badge ${activityHistoryState.source === "supabase" ? "super-source-supabase" : "super-source-local"}`}>
          {activityHistoryState.noteLabel}
        </span>
        <span className="muted">{activityHistoryState.noteMessage}</span>
      </div>

      <Card className="summary-card history-summary-card">
        <p className="eyebrow">기록 요약</p>
        <div className="summary-split">
          <div className="summary-metric">
            <strong>{allRecords.length}</strong>
            <span>전체 기록</span>
          </div>
          <div className="summary-metric">
            <strong>{issueCount}</strong>
            <span>이상징후 있음</span>
          </div>
          <div className="summary-metric">
            <strong>{todayCount}</strong>
            <span>오늘 기록</span>
          </div>
        </div>
      </Card>

      <div className="history-search-box">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="대상자 이름 또는 주소 검색"
          aria-label="대상자 이름 또는 주소 검색"
        />
      </div>

      <div className="history-filter-pills" aria-label="확인 기록 필터">
        {filters.map((item) => (
          <button className={filter === item.value ? "filter-tab-active" : ""} key={item.value} type="button" onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {targetFilterLabel ? <p className="muted history-target-filter">{`${targetFilterLabel} 기록만 보는 중`}</p> : null}

      <div className="stack">
        {records.length ? records.map((record) => {
          const hasIssue =
            record.hasIssue ||
            (record.issueLevel && record.issueLevel !== "none") ||
            record.resultStatus === "caution" ||
            record.resultStatus === "emergency";
          const historyTarget = record.isSupabaseOnly
            ? {
                label: record.targetName || "대상자 정보 없음",
              }
            : getHistoryTargetInfo(data.targets, record.targetId);
          return (
            <Card key={record.id} className="history-record-card">
              <div className="history-record-top">
                <strong>{formatCheckerHistoryDate(record.date || record.checkedAt)}</strong>
                <StatusBadge type="record" value={record.status || (record.resultStatus === "completed" ? "completed" : "pending")} />
              </div>
              <div className="history-record-subtitle">
                <strong>{historyTarget.label}</strong>
                <span>{getCheckerHistoryCheckTypeLabel(record.checkType || record.type)}</span>
              </div>
              <p className="history-record-memo">
                {truncateText(
                  record.issueSummary ||
                    record.memo ||
                    record.targetAddress ||
                    getCheckItemText(record.checkType || record.type || "external", record.checkItems),
                  60
                )}
              </p>
              <div className="history-record-footer">
                <span className={hasIssue ? "badge badge-risk-danger" : "badge badge-muted"}>
                  {hasIssue ? "이상징후 있음" : "이상징후 없음"}
                </span>
                <Button variant="ghost" className="history-detail-button" onClick={() => setOpenRecordId(openRecordId === record.id ? "" : record.id)}>상세보기</Button>
              </div>
              {openRecordId === record.id ? (
                <div className="detail-box">
                  <p>확인 유형: {getCheckerHistoryCheckTypeLabel(record.checkType || record.type)}</p>
                  <p>결과 상태: {getCheckerHistoryResultStatusLabel(record.resultStatus || record.status)}</p>
                  <p>대상자 주소: {record.targetAddress || historyTarget.label}</p>
                  {!record.isSupabaseOnly ? <p>건강 상태: {activityHealthLabels[record.healthStatus] ?? "양호"}</p> : null}
                  {!record.isSupabaseOnly ? <p>{getCheckItemText(record.checkType || record.type || "external", record.checkItems)}</p> : null}
                  <p>{record.memo || "작성된 메모가 없습니다."}</p>
                  {record.issueSummary ? <p className="danger-text">{record.issueSummary}</p> : null}
                </div>
              ) : null}
            </Card>
          );
        }) : <EmptyState title="조건에 맞는 확인 기록이 없습니다." description="필터를 변경하거나 검색어를 지워보세요." />}
      </div>
    </>
  );
}

export function EmergencyNew({ user, data, actions, navigate, initialTargetId }) {
  const assignedTargets = getAssignedTargets(data.targets, user.id);
  const validInitialTargetId = assignedTargets.some((target) => target.id === initialTargetId)
    ? initialTargetId
    : assignedTargets[0]?.id || "";
  const [form, setForm] = useState({
    targetId: validInitialTargetId,
    issueType: "연락 지연",
    issueLevel: "need_check",
    description: "",
    urgency: "medium",
    needGuardianContact: true,
    needAdminAlert: true,
  });
  const [error, setError] = useState("");

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.targetId || !form.description.trim()) {
      setError("보고 대상자와 상세 내용을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();
    actions.addEmergencyReport({
      id: `emergency-${Date.now()}`,
      targetId: form.targetId,
      checkerId: user.id,
      date: getToday(),
      issueType: form.issueType,
      issueLevel: form.issueLevel,
      description: form.description.trim(),
      urgency: form.urgency,
      needGuardianContact: form.needGuardianContact,
      needAdminAlert: form.needAdminAlert,
      status: "received",
      adminMemo: "",
      createdAt: now,
      updatedAt: now,
    });
    navigate("/checker/home?emergency=sent");
  }

  return (
    <>
      <PageHeader eyebrow="이상징후 보고" title="이상징후 보고" description="발견한 이상징후를 관리자에게 바로 전달합니다." />

      <form className="form-stack" onSubmit={handleSubmit}>
        <Card>
          <SelectInput id="emergency-target" label="보고 대상자" value={form.targetId} onChange={(event) => updateForm("targetId", event.target.value)}>
            {assignedTargets.map((target) => (
              <option key={target.id} value={target.id}>{target.name}</option>
            ))}
          </SelectInput>
          <SelectInput id="issue-type" label="이상징후 유형" value={form.issueType} onChange={(event) => updateForm("issueType", event.target.value)}>
            <option>연락 지연</option>
            <option>건강 악화</option>
            <option>식사 감소</option>
            <option>복약 문제</option>
            <option>정서 불안</option>
            <option>주거 환경 문제</option>
          </SelectInput>
          <SelectInput
            id="urgency"
            label="확인 필요 수준"
            value={form.urgency}
            onChange={(event) => {
              updateForm("urgency", event.target.value);
              updateForm("issueLevel", event.target.value === "high" ? "urgent" : "need_check");
            }}
          >
            <option value="low">확인 필요</option>
            <option value="medium">확인 필요</option>
            <option value="high">긴급 확인 필요</option>
          </SelectInput>
          <TextArea
            id="emergency-description"
            label="상세 내용"
            rows="5"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="발견한 이상징후와 현재 상황을 입력해주세요."
          />
        </Card>

        <Card>
          <CheckboxField label="보호자 연락 필요" checked={form.needGuardianContact} onChange={(value) => updateForm("needGuardianContact", value)} />
          <CheckboxField label="관리자 즉시 확인 필요" checked={form.needAdminAlert} onChange={(value) => updateForm("needAdminAlert", value)} />
        </Card>

        {error ? <p className="form-error">{error}</p> : null}
        <Button variant="danger" className="full-width" type="submit">이상징후 보고 저장</Button>
      </form>
    </>
  );
}
