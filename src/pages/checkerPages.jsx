import { useMemo, useState } from "react";
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
import { findTargetById, getAssignedTargets } from "../services/targetService.js";
import { getToday } from "../utils/statistics.js";
import ElderAvatarIcon from "../components/ElderAvatarIcon.jsx";
import heroGrandmother from "../assets/happytong-hero-grandmother.png";

function isTodayScheduled(target) {
  return target.todayScheduled ?? target.todayVisit;
}

function targetName(targets, targetId) {
  return targets.find((target) => target.id === targetId)?.name ?? "대상자 없음";
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
    navigate(`/checker/targets/${target.id}`);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goDetail();
    }
  }

  const scheduleText = target.checkDays?.join(", ") || "요일 미정";

  return (
    <article
      className={`target-card risk-card-${target.riskLevel} ${homePreview ? "target-card-home" : "target-card-list"}`}
      role="button"
      tabIndex="0"
      onClick={goDetail}
      onKeyDown={handleKeyDown}
    >
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
        {isTodayScheduled(target) ? (
          <span className="badge badge-info">오늘 확인 예정 {getTargetCheckTime(target)}</span>
        ) : (
          <span className="badge badge-muted">오늘 일정 없음</span>
        )}
      </div>

      <div className="card-row target-card-meta">
        <small>최근 확인 {target.lastVisitDate}</small>
        <small>{scheduleText}</small>
      </div>

      <Button
        variant="ghost"
        className="full-width target-detail-button"
        onClick={(event) => {
          event.stopPropagation();
          goDetail();
        }}
      >
        상세보기
      </Button>
    </article>
  );
}

export function CheckerHome({ user, data, navigate, emergencySent }) {
  const assignedTargets = getAssignedTargets(data.targets, user.id);
  const todayTargets = assignedTargets.filter(isTodayScheduled);
  const pendingRecords = data.activityRecords.filter(
    (record) => record.checkerId === user.id && record.status !== "completed"
  );
  const riskCount = assignedTargets.filter((target) => target.riskLevel === "caution" || target.riskLevel === "danger").length;

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
            <strong>{todayTargets.length}</strong>
            <span>오늘 확인 예정</span>
          </div>
          <div className="summary-metric">
            <strong>{pendingRecords.length}</strong>
            <span>미작성</span>
          </div>
          <div className="summary-metric">
            <strong>{riskCount}</strong>
            <span>주의/위험</span>
          </div>
        </div>
      </section>

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
        {assignedTargets.length === 0 ? (
          <Card className="empty-assignment-card">
            <strong>아직 배정된 대상자가 없습니다.</strong>
            <p>담당 기관에서 대상자를 배정하면 오늘 확인 일정이 표시됩니다.</p>
            <p className="muted">배정 관련 문의는 소속 기관 담당자에게 확인해주세요.</p>
          </Card>
        ) : (
          <div className="stack">
            {todayTargets.slice(0, 2).map((target) => (
              <TargetCard key={target.id} target={target} navigate={navigate} homePreview />
            ))}
            {todayTargets.length === 0 ? (
              <Card className="empty-assignment-card">
                <strong>오늘 확인 예정 대상자가 없습니다.</strong>
                <p>배정된 대상자 중 오늘 일정이 잡히면 이곳에 표시됩니다.</p>
              </Card>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}

export function CheckerTargets({ user, data, navigate }) {
  const assignedTargets = getAssignedTargets(data.targets, user.id);
  const todayCount = assignedTargets.filter(isTodayScheduled).length;
  const riskCount = assignedTargets.filter((target) => target.riskLevel === "caution" || target.riskLevel === "danger").length;

  return (
    <>
      <PageHeader eyebrow="대상자 목록" title="담당 대상자" description="상세주소와 위험도를 함께 확인합니다." />

      <Card className="summary-card">
        <p className="eyebrow">담당 현황</p>
        <strong>전체 {assignedTargets.length}명 · 오늘 {todayCount}명</strong>
        <span>주의/위험 {riskCount}명</span>
      </Card>

      {assignedTargets.length === 0 ? (
        <EmptyState
          title="배정된 대상자가 없습니다."
          description="담당 기관에서 대상자를 배정하면 이곳에서 확인할 수 있습니다."
        />
      ) : (
        <div className="stack">
          {assignedTargets.map((target) => (
            <TargetCard key={target.id} target={target} navigate={navigate} />
          ))}
        </div>
      )}
    </>
  );
}

export function CheckerTargetDetail({ targetId, user, data, navigate }) {
  const target = findTargetById(getAssignedTargets(data.targets, user.id), targetId);

  if (!target) {
    return <EmptyState title="대상자를 찾을 수 없습니다" description="대상자 목록에서 다시 선택해주세요." />;
  }

  const recentRecords = data.activityRecords
    .filter((record) => record.targetId === target.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  function handleManagerCall() {
    if (!target.managerPhone) {
      window.alert("담당자 연락처가 등록되어 있지 않습니다.");
      return;
    }

    window.location.href = `tel:${target.managerPhone}`;
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
            { label: "담당자", value: `${target.managerName} · ${target.managerOrg}` },
            { label: "연락처", value: target.managerPhone },
          ]}
        />
        <div className="action-grid">
          <Button variant="secondary" onClick={handleManagerCall} disabled={!target.managerPhone}>
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

export function ActivityNew({ user, data, actions, navigate, initialTargetId }) {
  const assignedTargets = getAssignedTargets(data.targets, user.id);
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
  const selectedTarget = assignedTargets.find((target) => target.id === form.targetId);
  const activeCheckItems = checkItemGroups[form.checkType] || checkItemGroups.external;

  if (assignedTargets.length === 0) {
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
    const nextTarget = assignedTargets.find((target) => target.id === targetId);
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
      targetId: form.targetId,
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

      <form className="form-stack activity-form" onSubmit={handleSubmit}>
        {showTargetPicker ? (
          <Card className="activity-target-card">
            <h2>대상자 선택</h2>
            <div className="activity-target-grid" role="list" aria-label="대상자 선택">
              {assignedTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={`activity-target-option ${form.targetId === target.id ? "active" : ""}`}
                  onClick={() => handleTargetChange(target.id)}
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

export function ActivityHistory({ user, data, saved }) {
  const [filter, setFilter] = useState("all");
  const [openRecordId, setOpenRecordId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const params = new URLSearchParams(window.location.search);
  const targetIdFilter = params.get("targetId") || "";
  const today = getToday();
  const allRecords = useMemo(() => {
    return data.activityRecords
      .filter((record) => record.checkerId === user.id)
      .sort((a, b) => {
        const aTime = a?.date ? new Date(a.date).getTime() : 0;
        const bTime = b?.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
  }, [data.activityRecords, user.id]);
  const records = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return allRecords.filter((record) => {
      const recordType = record.checkType || record.type;
      const hasIssue = record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent";
      const target = data.targets.find((item) => item.id === record.targetId);
      const targetText = `${target?.name || ""} ${target?.address || ""}`.toLowerCase();

      if (targetIdFilter && record.targetId !== targetIdFilter) {
        return false;
      }

      if (filter === "today" && record.date !== today) {
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
  const issueCount = allRecords.filter((record) => record.hasIssue || record.issueLevel === "need_check" || record.issueLevel === "urgent").length;
  const todayCount = allRecords.filter((record) => record.date === today).length;
  const targetFilterLabel = targetIdFilter ? targetName(data.targets, targetIdFilter) : "";

  return (
    <>
      <PageHeader eyebrow="확인 이력" title="내 확인 기록" description="작성한 확인 기록을 다시 확인합니다." />
      {saved ? <p className="notice">활동 기록이 저장되었습니다.</p> : null}

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
          const hasIssue = record.hasIssue || record.issueLevel !== "none";
          return (
            <Card key={record.id} className="history-record-card">
              <div className="history-record-top">
                <strong>{record.date || "날짜 정보 없음"}</strong>
                <StatusBadge type="record" value={record.status} />
              </div>
              <div className="history-record-subtitle">
                <strong>{targetName(data.targets, record.targetId)}</strong>
                <span>{activityTypeLabels[record.checkType || record.type]}</span>
              </div>
              <p className="history-record-memo">{truncateText(record.issueSummary || record.memo || getCheckItemText(record.checkType || record.type || "external", record.checkItems), 60)}</p>
              <div className="history-record-footer">
                <span className={hasIssue ? "badge badge-risk-danger" : "badge badge-muted"}>
                  {hasIssue ? "이상징후 있음" : "이상징후 없음"}
                </span>
                <Button variant="ghost" className="history-detail-button" onClick={() => setOpenRecordId(openRecordId === record.id ? "" : record.id)}>상세보기</Button>
              </div>
              {openRecordId === record.id ? (
                <div className="detail-box">
                  <p>건강 상태: {activityHealthLabels[record.healthStatus] ?? "양호"}</p>
                  <p>{getCheckItemText(record.checkType || record.type || "external", record.checkItems)}</p>
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
