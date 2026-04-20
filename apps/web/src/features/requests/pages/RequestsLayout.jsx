import { Outlet, useOutletContext } from "react-router-dom";
import { WorkspaceModuleTabs } from "../../../shared/workspace/WorkspaceModuleTabs";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader";
import "./RequestsHomePage.css";

const ADMIN_ROLES = ["admin", "head_it"];

export function RequestsLayout() {
  const { user } = useOutletContext() ?? {};
  const showApprovals = ADMIN_ROLES.includes(user?.role);

  const navItems = [
    { label: "Overview", to: "/requests" },
    { label: "Review Queue", to: "/requests/review" }
  ];

  if (showApprovals) {
    navItems.push({ label: "Approvals", to: "/requests/approvals" });
  }

  return (
    <section className="workspace-page requests-layout">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="Requests"
        description="Review purchase requests, move approvals forward, and resolve blocked items."
        meta="Module search and filters stay inside each request workflow."
      />

      <WorkspaceModuleTabs items={navItems} ariaLabel="Requests sections" />

      <div className="requests-shell">
        <div className="requests-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
