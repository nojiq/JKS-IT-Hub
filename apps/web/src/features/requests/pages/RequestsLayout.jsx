import { Link, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader";
import "./RequestsHomePage.css";

export function RequestsLayout() {
  const { user } = useOutletContext() ?? {};

  return (
    <section className="workspace-page requests-layout">
      <WorkspacePageHeader
        title="Requests"
        actions={(
          <Link className="workspace-inline-link is-primary" to="/requests/new">
            New Request
          </Link>
        )}
      />

      <div className="requests-shell">
        <div className="requests-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
