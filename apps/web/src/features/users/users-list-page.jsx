import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import { fetchUsers } from "./users-api.js";

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

export default function UsersListPage() {
  const navigate = useNavigate();

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    refetchOnWindowFocus: false
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: Boolean(sessionQuery.data)
  });

  useEffect(() => {
    if (!sessionQuery.isLoading && sessionQuery.data === null) {
      navigate("/login", { replace: true });
    }
  }, [navigate, sessionQuery.data, sessionQuery.isLoading]);

  if (sessionQuery.isLoading) {
    return <p className="status-text">Checking session…</p>;
  }

  if (sessionQuery.error) {
    return (
      <div className="status-block">
        <p className="status-text">Session check failed.</p>
        <p className="status-hint">Try refreshing or signing in again.</p>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return null;
  }

  if (usersQuery.isLoading) {
    return <p className="status-text">Loading users…</p>;
  }

  if (usersQuery.error) {
    return (
      <div className="status-block">
        <p className="status-text">Unable to load users.</p>
        <p className="status-hint">{usersQuery.error.message}</p>
      </div>
    );
  }

  const payload = usersQuery.data ?? { users: [], fields: [] };
  const users = payload.users ?? [];
  const fields = payload.fields ?? [];

  const hasSync = users.some((user) => Boolean(user.ldapSyncedAt));
  const tableColumns = useMemo(() => ["user", ...fields], [fields]);

  return (
    <section className="users-page">
      <header className="users-header">
        <div>
          <p className="users-eyebrow">Directory</p>
          <h2>Users</h2>
          <p className="users-subtitle">Read-only LDAP profile data synced into IT-Hub.</p>
        </div>
        <div className="users-header-actions">
          <Link className="users-link" to="/">
            Back to dashboard
          </Link>
        </div>
      </header>

      {!hasSync ? (
        <div className="users-alert">
          <p className="users-alert-title">LDAP sync has not run yet.</p>
          <p className="users-alert-text">
            Run manual sync first to populate directory fields.
            <Link className="users-alert-link" to="/">
              Go to sync panel
            </Link>
          </p>
        </div>
      ) : null}

      {users.length ? (
        <div className="users-table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th key={column}>{column === "user" ? "User" : column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link className="users-name" to={`/users/${user.id}`}>
                      {user.username}
                    </Link>
                    <span className="users-meta">
                      {user.role} · {user.status}
                    </span>
                  </td>
                  {fields.map((field) => (
                    <td key={field}>{formatValue(user.ldapFields?.[field])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="users-empty">
          <p className="status-text">No users found yet.</p>
          <p className="status-hint">Run LDAP sync to populate the directory.</p>
        </div>
      )}
    </section>
  );
}
