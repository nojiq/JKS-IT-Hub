import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { MaintenanceSubnav } from "../components/MaintenanceSubnav.jsx";
import "./MaintenanceHomePage.css";
import "../maintenance-workspace.css";

import { DEV_ONLY_ROLES } from "../../../shared/auth/workspaceRoles.js";

const MAINTENANCE_ROLES = DEV_ONLY_ROLES;
const DOCUMENT_TITLE_APP = "IT Hub";

/**
 * Browser tab title for maintenance routes (sidebar / subnav use same section names as
 * `workspaceModules` Maintenance children where applicable).
 */
export function maintenancePathDocumentTitle(pathname) {
  const suffix = ` · Maintenance · ${DOCUMENT_TITLE_APP}`;
  if (pathname === "/maintenance") {
    return `Overview${suffix}`;
  }
  if (pathname.startsWith("/maintenance/config")) {
    return `Configuration${suffix}`;
  }
  if (pathname.startsWith("/maintenance/checklists")) {
    return `Checklists${suffix}`;
  }
  if (pathname.startsWith("/maintenance/assignment-rules")) {
    return `Assignment rules${suffix}`;
  }
  if (pathname.startsWith("/maintenance/history")) {
    return `History${suffix}`;
  }
  if (pathname.startsWith("/maintenance/my-tasks")) {
    return `My tasks${suffix}`;
  }
  if (pathname.startsWith("/maintenance/schedule/") && pathname !== "/maintenance/schedule") {
    return `Window detail${suffix}`;
  }
  if (pathname.startsWith("/maintenance/schedule")) {
    return `Schedule${suffix}`;
  }
  return `Maintenance · ${DOCUMENT_TITLE_APP}`;
}

export function MaintenanceLayout() {
  const { user } = useOutletContext() ?? {};
  const location = useLocation();

  useEffect(() => {
    document.title = maintenancePathDocumentTitle(location.pathname);
  }, [location.pathname]);

  useEffect(
    () => () => {
      document.title = DOCUMENT_TITLE_APP;
    },
    []
  );

  if (!user || !MAINTENANCE_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page maintenance-layout">
      <WorkspacePageHeader
        title="Maintenance"
      />

      <MaintenanceSubnav />

      <div className="maintenance-shell">
        <div className="maintenance-module-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
