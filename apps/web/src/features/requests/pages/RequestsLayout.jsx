import { NavLink, Outlet, useOutletContext } from "react-router-dom";
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

      <div className="requests-shell">
        <nav className="requests-subnav" aria-label="Requests sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/requests"}
              className={({ isActive }) => `requests-subnav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="requests-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
