import BrandLogo from "./BrandLogo.jsx";
import {
  HomeTabIcon,
  TargetTabIcon,
  ActivityTabIcon,
  HistoryTabIcon,
  AdminDashboardTabIcon,
  AlertTabIcon,
  StatsTabIcon,
  ReportTabIcon,
} from "./TabIcons.jsx";

const checkerTabs = [
  { path: "/checker/home", label: "홈" },
  { path: "/checker/targets", label: "대상자" },
  { path: "/checker/activity/new", label: "기록작성" },
  { path: "/checker/activity/history", label: "이력" },
];

const adminTabs = [
  { path: "/admin/dashboard", label: "대시보드" },
  { path: "/admin/emergencies", label: "이상징후" },
  { path: "/admin/targets", label: "대상자" },
  { path: "/admin/checkers", label: "체커" },
  { path: "/admin/activities", label: "확인기록" },
  { path: "/admin/statistics", label: "통계" },
  { path: "/admin/reports/new", label: "보고서" },
];

function isActivePath(currentPath, path) {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export default function Layout({ user, currentPath, navigate, onLogout, children }) {
  const tabs = user.role === "admin" ? adminTabs : checkerTabs;
  const roleClassName = user.role === "admin" ? "app-shell-admin" : "app-shell-checker";

  return (
    <div className={`app-shell ${roleClassName}`}>
      <header className="top-bar">
        <button className="brand" type="button" onClick={() => navigate(user.role === "admin" ? "/admin/dashboard" : "/checker/home")}>
          <BrandLogo size="default" />
        </button>
        <div className="user-chip">
          <span>{user.name}</span>
          <button type="button" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {user.role === "admin" ? (
        <div className="admin-desktop-layout">
          <aside className="admin-sidebar" aria-label="관리자 주요 메뉴">
            <div className="admin-sidebar-panel">
              <p className="admin-sidebar-eyebrow">관리자 메뉴</p>
              <nav className="admin-sidebar-nav">
                {adminTabs.map((tab) => (
                  <button
                    className={isActivePath(currentPath, tab.path) ? "active" : ""}
                    key={tab.path}
                    type="button"
                    onClick={() => navigate(tab.path)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="admin-content">
            <main className="app-main">{children}</main>
          </div>
        </div>
      ) : (
        <main className="app-main">{children}</main>
      )}

      <nav className="bottom-tabs" aria-label="주요 메뉴">
        {tabs.map((tab) => {
          const isActive = isActivePath(currentPath, tab.path);
          const Icon = getTabIcon(tab.label, user.role);

          return (
            <button
              className={isActive ? "active" : ""}
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
            >
              {Icon ? <Icon /> : null}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function getTabIcon(label, role) {
  if (role === "checker") {
    if (label === "홈") return HomeTabIcon;
    if (label === "대상자") return TargetTabIcon;
    if (label === "기록작성") return ActivityTabIcon;
    if (label === "이력") return HistoryTabIcon;
  }

  if (role === "admin") {
    if (label === "대시보드") return AdminDashboardTabIcon;
    if (label === "이상징후") return AlertTabIcon;
    if (label === "대상자") return TargetTabIcon;
    if (label === "체커") return TargetTabIcon;
    if (label === "확인기록") return ActivityTabIcon;
    if (label === "통계") return StatsTabIcon;
    if (label === "보고서") return ReportTabIcon;
  }

  return null;
}
