import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspaceModuleTabs } from "../../shared/workspace/WorkspaceModuleTabs.jsx";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import "../../shared/workspace/workspace.css";

const IT_ROLES = ["it", "admin", "head_it"];

export function UsersLayout() {
  const { user } = useOutletContext() ?? {};
  const navItems = [
    { label: "Overview", to: "/users" },
    { label: "Directory", to: "/users/directory" },
    { label: "IMAP Generator", to: "/users/imap-generator" },
    { label: "Locked Credentials", to: "/users/locked" },
    { label: "History", to: "/users/history" }
  ];

  if (!user || !IT_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page users-layout">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="Users & Credentials"
        description="Manage account status, credential tools, and follow-up access work from one module."
        meta="Directory review, password generation, locked credentials, and history stay inside the same operational shell."
      />

      <WorkspaceModuleTabs items={navItems} ariaLabel="Users and credentials sections" />

      <div className="users-shell">
        <div className="users-module-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
