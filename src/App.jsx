import { useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import Layout from "./components/Layout.jsx";
import { Button, EmptyState } from "./components/UI.jsx";
import {
  adminReports as initialAdminReports,
  targets as initialTargets,
  users,
} from "./data/mockData.js";
import { organizations } from "./data/organizations.js";
import LoginPage, { SignupRequestPage } from "./pages/LoginPage.jsx";
import {
  ActivityHistory,
  ActivityNew,
  CheckerHome,
  CheckerTargetDetail,
  CheckerTargets,
  EmergencyNew,
} from "./pages/checkerPages.jsx";
import {
  AdminActivities,
  AdminCheckerDetail,
  AdminCheckers,
  AdminDashboard,
  AdminEmergencies,
  AdminEmergencyDetail,
  AdminExports,
  AdminReportNew,
  AdminReportPreview,
  AdminStatistics,
  AdminTargetDetail,
  AdminTargets,
} from "./pages/adminPages.jsx";
import { readActivityRecords } from "./services/activityService.js";
import {
  buildApprovedCheckerFromRequest,
  clearCurrentUser,
  readCurrentUser,
  readRegisteredUsers,
  saveCurrentUser,
} from "./services/authService.js";
import { readEmergencyReports } from "./services/emergencyService.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, safeReadStorage, writeStorage } from "./utils/storage.js";

function usePersistentState(key, readInitialValue) {
  const [state, setState] = useState(readInitialValue);

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}

function readAdminReports() {
  const savedReports = readWithMigration(STORAGE_KEYS.adminReports, [], LEGACY_STORAGE_KEYS.adminReports);
  return mergeById(initialAdminReports, Array.isArray(savedReports) ? savedReports : []);
}

function readTargets() {
  const savedTargets = readWithMigration(STORAGE_KEYS.targets, [], LEGACY_STORAGE_KEYS.targets);
  return mergeById(initialTargets, Array.isArray(savedTargets) ? savedTargets : []);
}

function readSignupRequests() {
  const savedRequests = safeReadStorage(STORAGE_KEYS.signupRequests, []);
  return Array.isArray(savedRequests) ? savedRequests : [];
}

function getCurrentLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

export default function App() {
  const [location, setLocation] = useState(getCurrentLocation);
  const [targets, setTargets] = usePersistentState(STORAGE_KEYS.targets, readTargets);
  const [activityRecords, setActivityRecords] = usePersistentState(STORAGE_KEYS.activityRecords, readActivityRecords);
  const [emergencyReports, setEmergencyReports] = usePersistentState(STORAGE_KEYS.emergencyReports, readEmergencyReports);
  const [adminReports, setAdminReports] = usePersistentState(STORAGE_KEYS.adminReports, readAdminReports);
  const [signupRequests, setSignupRequests] = usePersistentState(STORAGE_KEYS.signupRequests, readSignupRequests);
  const [registeredUsers, setRegisteredUsers] = usePersistentState(STORAGE_KEYS.registeredUsers, readRegisteredUsers);
  const [currentUser, setCurrentUser] = useState(readCurrentUser);

  useEffect(() => {
    function handlePopState() {
      setLocation(getCurrentLocation());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(to, options = {}) {
    if (options.replace) {
      window.history.replaceState({}, "", to);
    } else {
      window.history.pushState({}, "", to);
    }

    setLocation(getCurrentLocation());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLogin(user) {
    saveCurrentUser(user);
    setCurrentUser(user);
    navigate(user.role === "admin" ? "/admin/dashboard" : "/checker/home", { replace: true });
  }

  function handleLogout() {
    clearCurrentUser();
    setCurrentUser(null);
    navigate("/login", { replace: true });
  }

  const data = useMemo(
    () => ({
      users: mergeById(users, registeredUsers),
      organizations,
      targets,
      activityRecords,
      emergencyReports,
      adminReports,
      signupRequests,
    }),
    [targets, activityRecords, emergencyReports, adminReports, registeredUsers, signupRequests]
  );

  const actions = useMemo(
    () => ({
      addActivityRecord(record) {
        setActivityRecords((current) => [record, ...current]);
      },
      addEmergencyReport(report) {
        setEmergencyReports((current) => [report, ...current]);
      },
      updateEmergencyReport(reportId, updates) {
        setEmergencyReports((current) =>
          current.map((report) =>
            report.id === reportId ? { ...report, ...updates, updatedAt: new Date().toISOString() } : report
          )
        );
      },
      addAdminReport(report) {
        setAdminReports((current) => {
          const exists = current.some((item) => item.id === report.id);
          return exists ? current.map((item) => (item.id === report.id ? report : item)) : [report, ...current];
        });
      },
      approveSignupRequest(requestId) {
        let approvedRequest = null;

        setSignupRequests((current) =>
          current.map((request) => {
            if (request.id !== requestId) {
              return request;
            }

            approvedRequest = {
              ...request,
              status: "approved",
              approvedAt: new Date().toISOString(),
            };
            return approvedRequest;
          })
        );

        if (approvedRequest) {
          const approvedUser = buildApprovedCheckerFromRequest(approvedRequest);
          setRegisteredUsers((current) => {
            const exists = current.some(
              (user) => user.id === approvedUser.id || user.username === approvedUser.username
            );
            return exists
              ? current.map((user) =>
                  user.id === approvedUser.id || user.username === approvedUser.username ? approvedUser : user
                )
              : [approvedUser, ...current];
          });
        }
      },
      rejectSignupRequest(requestId) {
        setSignupRequests((current) =>
          current.map((request) =>
            request.id === requestId
              ? { ...request, status: "rejected", rejectedAt: new Date().toISOString() }
              : request
          )
        );
      },
      updateCheckerAssignments(checkerId, targetIds) {
        const nextAssignedIds = new Set(targetIds);

        setTargets((current) =>
          current.map((target) => {
            if (nextAssignedIds.has(target.id)) {
              return { ...target, assignedCheckerId: checkerId };
            }

            if (target.assignedCheckerId === checkerId) {
              return { ...target, assignedCheckerId: "" };
            }

            return target;
          })
        );
      },
    }),
    [setActivityRecords, setEmergencyReports, setAdminReports, setRegisteredUsers, setSignupRequests, setTargets]
  );

  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "") {
      navigate(currentUser ? (currentUser.role === "admin" ? "/admin/dashboard" : "/checker/home") : "/login", {
        replace: true,
      });
      return;
    }

    if (!currentUser && location.pathname !== "/login" && location.pathname !== "/signup") {
      navigate("/login", { replace: true });
      return;
    }

    if (currentUser && location.pathname === "/login") {
      navigate(currentUser.role === "admin" ? "/admin/dashboard" : "/checker/home", { replace: true });
    }
  }, [currentUser, location.pathname]);

  if (location.pathname === "/login") {
    return <LoginPage onLogin={handleLogin} navigate={navigate} />;
  }

  if (location.pathname === "/signup") {
    return <SignupRequestPage navigate={navigate} />;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} navigate={navigate} />;
  }

  const page = renderPage({
    location,
    user: currentUser,
    data,
    actions,
    navigate,
  });

  return (
    <Layout user={currentUser} currentPath={location.pathname} navigate={navigate} onLogout={handleLogout}>
      {page}
    </Layout>
  );
}

function renderPage({ location, user, data, actions, navigate }) {
  const params = new URLSearchParams(location.search);
  const checkerTargetMatch = location.pathname.match(/^\/checker\/targets\/([^/]+)$/);
  const adminTargetMatch = location.pathname.match(/^\/admin\/targets\/([^/]+)$/);
  const adminCheckerMatch = location.pathname.match(/^\/admin\/checkers\/([^/]+)$/);
  const adminEmergencyMatch = location.pathname.match(/^\/admin\/emergencies\/([^/]+)$/);

  if (user.role === "checker") {
    if (location.pathname.startsWith("/admin")) {
      return <RoleBlocked navigate={() => navigate("/checker/home")} />;
    }

    if (location.pathname === "/checker/home") {
      return <CheckerHome user={user} data={data} navigate={navigate} emergencySent={params.get("emergency") === "sent"} />;
    }

    if (location.pathname === "/checker/targets") {
      return <CheckerTargets user={user} data={data} navigate={navigate} />;
    }

    if (checkerTargetMatch) {
      return <CheckerTargetDetail targetId={checkerTargetMatch[1]} user={user} data={data} navigate={navigate} />;
    }

    if (location.pathname === "/checker/activity/new") {
      return (
        <ActivityNew
          user={user}
          data={data}
          actions={actions}
          navigate={navigate}
          initialTargetId={params.get("targetId")}
        />
      );
    }

    if (location.pathname === "/checker/activity/history") {
      return <ActivityHistory user={user} data={data} saved={params.get("saved") === "1"} />;
    }

    if (location.pathname === "/checker/emergency/new") {
      return (
        <EmergencyNew
          user={user}
          data={data}
          actions={actions}
          navigate={navigate}
          initialTargetId={params.get("targetId")}
        />
      );
    }

    return <NotFound navigate={() => navigate("/checker/home")} />;
  }

  if (user.role === "admin") {
    if (location.pathname.startsWith("/checker")) {
      return <RoleBlocked navigate={() => navigate("/admin/dashboard")} />;
    }

    if (location.pathname === "/admin/dashboard") {
      return <AdminDashboard data={data} navigate={navigate} />;
    }

    if (location.pathname === "/admin/checkers") {
      return <AdminCheckers data={data} actions={actions} currentUser={user} navigate={navigate} />;
    }

    if (adminCheckerMatch) {
      return <AdminCheckerDetail checkerId={adminCheckerMatch[1]} data={data} actions={actions} navigate={navigate} />;
    }

    if (location.pathname === "/admin/targets") {
      return <AdminTargets data={data} navigate={navigate} />;
    }

    if (adminTargetMatch) {
      return <AdminTargetDetail targetId={adminTargetMatch[1]} data={data} />;
    }

    if (location.pathname === "/admin/activities") {
      return <AdminActivities data={data} />;
    }

    if (location.pathname === "/admin/emergencies") {
      return <AdminEmergencies data={data} navigate={navigate} />;
    }

    if (adminEmergencyMatch) {
      return (
        <AdminEmergencyDetail
          emergencyId={adminEmergencyMatch[1]}
          data={data}
          actions={actions}
          navigate={navigate}
        />
      );
    }

    if (location.pathname === "/admin/reports/new") {
      return <AdminReportNew data={data} actions={actions} navigate={navigate} currentUser={user} />;
    }

    if (location.pathname === "/admin/reports/preview") {
      return <AdminReportPreview data={data} currentUser={user} />;
    }

    if (location.pathname === "/admin/exports") {
      return <AdminExports data={data} />;
    }

    if (location.pathname === "/admin/statistics") {
      return <AdminStatistics data={data} />;
    }

    return <NotFound navigate={() => navigate("/admin/dashboard")} />;
  }

  return <NotFound navigate={() => navigate("/login")} />;
}

function RoleBlocked({ navigate }) {
  return (
    <EmptyState
      title="접근 권한이 없습니다"
      description="현재 로그인한 권한에 맞는 화면으로 이동해주세요."
    >
      <Button onClick={navigate}>이동하기</Button>
    </EmptyState>
  );
}

function NotFound({ navigate }) {
  return (
    <div className="center-panel">
      <EmptyState title="화면을 찾을 수 없습니다" description="요청한 경로를 다시 확인해주세요." />
      <Button onClick={navigate}>기본 화면으로 이동</Button>
      <Analytics />
    </div>
  );
}



