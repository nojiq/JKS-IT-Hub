import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspaceModuleTabs } from "../../../shared/workspace/WorkspaceModuleTabs.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import "./MaintenanceHomePage.css";

const IT_ROLES = ["it", "admin", "head_it"];

export function MaintenanceLayout() {
  const { user } = useOutletContext() ?? {};
  const navItems = [
    { label: "Overview", to: "/maintenance" },
    { label: "Schedule", to: "/maintenance/schedule" },
    { label: "My Tasks", to: "/maintenance/my-tasks" },
    { label: "History", to: "/maintenance/history" },
    { label: "Config", to: "/maintenance/config" },
    { label: "Rules", to: "/maintenance/assignment-rules" },
    { label: "Checklists", to: "/maintenance/checklists" }
  ];

  if (!user || !IT_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page maintenance-layout">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="Maintenance"
        description="Schedule preventive work, assign tasks, and close overdue actions."
        meta="Schedule, task execution, history, and configuration stay inside one maintenance workspace."
      />

      <WorkspaceModuleTabs items={navItems} ariaLabel="Maintenance sections" />

      <div className="maintenance-shell">
        <div className="maintenance-module-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
