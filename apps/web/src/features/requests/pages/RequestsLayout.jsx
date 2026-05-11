import { Link, Outlet, useOutletContext } from "react-router-dom";
import { WorkspaceModuleTabs } from "../../../shared/workspace/WorkspaceModuleTabs";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader";
import "./RequestsHomePage.css";

const ADMIN_ROLES = ["admin", "head_it"];
const REQUESTS_TAB_EXCLUDED_DETAIL_SEGMENTS = new Set(["new", "my-requests", "review", "approvals"]);

export function RequestsLayout() {
  const { user } = useOutletContext() ?? {};
  const showApprovals = ADMIN_ROLES.includes(user?.role);

  const navItems = [
    { label: "Overview", to: "/requests" },
    {
      label: "My Requests",
      to: "/requests/my-requests",
      matches: (pathname) => {
        if (pathname === "/requests/my-requests") {
          return true;
        }

        const detailMatch = pathname.match(/^\/requests\/([^/]+)$/);
        return !!detailMatch && !REQUESTS_TAB_EXCLUDED_DETAIL_SEGMENTS.has(detailMatch[1]);
      }
    },
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
        actions={(
          <Link className="workspace-inline-link is-primary" to="/requests/new">
            New Request
          </Link>
        )}
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
