import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useLockedCredentials } from "../credentials/hooks/useCredentials.js";
import { fetchUsers } from "./users-api.js";
import { WorkspacePanel } from "../../shared/workspace/WorkspacePanel.jsx";
import "../../shared/workspace/workspace.css";

const EMPTY_USERS = [];
const EMPTY_LOCKED = [];

export default function UsersHomePage() {
  const usersQuery = useQuery({
    queryKey: ["users", "overview", { page: "1", perPage: "25" }],
    queryFn: () => fetchUsers({ page: "1", perPage: "25" }),
    retry: false
  });

  const lockedQuery = useLockedCredentials();
  const users = usersQuery.data?.users ?? EMPTY_USERS;
  const lockedCredentials = lockedQuery.data?.data ?? EMPTY_LOCKED;

  const overview = useMemo(() => {
    const disabledUsers = users.filter((entry) => String(entry.status).toLowerCase() === "disabled");
    const activeUsers = users.filter((entry) => String(entry.status).toLowerCase() === "active");

    return {
      disabledUsers,
      activeUsers,
      lockedCredentials
    };
  }, [lockedCredentials, users]);

  return (
    <div className="users-home-grid">
      <WorkspacePanel
        variant="detail"
        title="User Directory"
        meta={`${usersQuery.data?.meta?.total ?? users.length ?? 0} users`}
        actions={(
          <Link className="workspace-inline-button" to="/users/directory">
            Open Directory
          </Link>
        )}
      >
        <div className="users-home-metrics">
          <div className="users-home-metric">
            <strong>{overview.activeUsers.length}</strong>
            <span>active</span>
          </div>
          <div className="users-home-metric">
            <strong>{overview.disabledUsers.length}</strong>
            <span>disabled</span>
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        variant="detail"
        title="Recent Access Actions"
        meta="See recent account changes in history."
      >
        <div className="onboarding-actions">
          <Link className="workspace-inline-link" to="/users/history">
            Open history workspace
          </Link>
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        variant="detail"
        title="Password Generation"
        meta="Set or reset passwords on each user's page."
      >
        <div className="onboarding-actions">
          <Link className="workspace-inline-link" to="/users/directory">
            Choose a user to manage credentials
          </Link>
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        variant="detail"
        title="Locked Credentials"
        meta={`${overview.lockedCredentials.length} locked right now`}
        actions={(
          <Link className="workspace-inline-button" to="/users/locked">
            Review Queue
          </Link>
        )}
      />
    </div>
  );
}
