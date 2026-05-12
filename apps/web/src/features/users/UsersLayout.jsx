import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import "../../shared/workspace/workspace.css";

import { IT_STAFF_ROLES } from "../../shared/auth/workspaceRoles.js";

const IT_ROLES = IT_STAFF_ROLES;
export function UsersLayout() {
  const { user } = useOutletContext() ?? {};

  if (!user || !IT_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page users-layout">
      <WorkspacePageHeader
        title="Users & Credentials"
      />

      <div className="users-shell">
        <div className="users-module-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
