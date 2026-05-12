import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import "./MaintenanceHomePage.css";

const IT_ROLES = ["it", "admin", "head_it"];

export function MaintenanceLayout() {
  const { user } = useOutletContext() ?? {};

  if (!user || !IT_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page maintenance-layout">
      <WorkspacePageHeader
        title="Maintenance"
      />

      <div className="maintenance-shell">
        <div className="maintenance-module-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
