import { Link, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader";
import "./RequestsHomePage.css";

export function RequestsLayout() {
  const { user } = useOutletContext() ?? {};
  const navigate = useNavigate();

  const openSubmitModal = () => {
    navigate("/requests/my-requests?submit=1");
  };

  return (
    <section className="workspace-page requests-layout">
      <WorkspacePageHeader
        title="Requests"
        actions={(
          <button
            type="button"
            className="workspace-inline-link is-primary"
            onClick={openSubmitModal}
          >
            New Request
          </button>
        )}
      />

      <div className="requests-shell">
        <div className="requests-panel">
          <Outlet context={{ user, openSubmitModal }} />
        </div>
      </div>
    </section>
  );
}
