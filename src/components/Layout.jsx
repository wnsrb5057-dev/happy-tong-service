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
  { path: "/checker/home", label: "홈", icon: HomeTabIcon },
  { path: "/checker/targets", label: "대상자", icon: TargetTabIcon },
  { path: "/checker/activity/new", label: "기록작성", icon: ActivityTabIcon },
  { path: "/checker/activity/history", label: "이력", icon: HistoryTabIcon },
];

const adminTabs = [
  { path: "/admin/dashboard", label: "대시보드", icon: AdminDashboardTabIcon },
  { path: "/admin/emergencies", label: "이상징후", icon: AlertTabIcon },
  { path: "/admin/targets", label: "대상자", icon: TargetTabIcon },
  { path: "/admin/checkers", label: "체커", icon: TargetTabIcon },
  { path: "/admin/activities", label: "확인기록", icon: ActivityTabIcon },
  { path: "/admin/statistics", label: "통계", icon: StatsTabIcon },
  { path: "/admin/reports/new", label: "보고서", icon: ReportTabIcon },
];

const superAdminTabs = [
  { path: "/super/dashboard", label: "대시보드", icon: AdminDashboardTabIcon },
  { path: "/super/organizations", label: "기관 관리", icon: TargetTabIcon },
  { path: "/super/status", label: "운영 현황", icon: StatsTabIcon },
];

function isActivePath(currentPath, path) {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

function getHomePath(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "super_admin") return "/super/dashboard";
  return "/checker/home";
}

export default function Layout({ user, currentPath, navigate, onLogout, children }) {
  const isAdminShell = user.role === "admin" || user.role === "super_admin";
  const tabs = user.role === "admin" ? adminTabs : user.role === "super_admin" ? superAdminTabs : checkerTabs;
  const roleClassName = isAdminShell ? "app-shell-admin" : "app-shell-checker";
  const sidebarTitle = user.role === "super_admin" ? "총관리자 메뉴" : "관리자 메뉴";

  return (
    <div className={`app-shell ${roleClassName}`}>
      <header className="top-bar">
        <button className="brand" type="button" onClick={() => navigate(getHomePath(user.role))}>
          <BrandLogo size="default" />
        </button>
        <div className="user-chip">
          <span>{user.name}</span>
          <button type="button" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {isAdminShell ? (
        <div className="admin-desktop-layout">
          <aside className="admin-sidebar" aria-label={sidebarTitle}>
            <div className="admin-sidebar-panel">
              <p className="admin-sidebar-eyebrow">{sidebarTitle}</p>
              <nav className="admin-sidebar-nav">
                {tabs.map((tab) => (
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
          const Icon = tab.icon;

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
