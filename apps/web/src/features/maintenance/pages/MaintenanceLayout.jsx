import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { MaintenanceSubnav } from "../components/MaintenanceSubnav.jsx";
import "./MaintenanceHomePage.css";
import "../maintenance-workspace.css";

import { DEV_ONLY_ROLES } from "../../../shared/auth/workspaceRoles.js";

const MAINTENANCE_ROLES = DEV_ONLY_ROLES;
export function MaintenanceLayout() {
  const { user } = useOutletContext() ?? {};

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
