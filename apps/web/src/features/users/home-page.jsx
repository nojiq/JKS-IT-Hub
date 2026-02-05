import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchSession } from "./auth-api.js";
import LdapSyncPanel from "./ldap-sync-panel.jsx";

export default function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!isLoading && data === null) {
      navigate("/login", { replace: true });
    }
  }, [data, isLoading, navigate]);

  if (isLoading) {
    return <p className="status-text">Checking session…</p>;
  }

  if (error) {
    return (
      <div className="status-block">
        <p className="status-text">Session check failed.</p>
        <p className="status-hint">Try refreshing or signing in again.</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section className="status-card">
      <h2>Welcome back</h2>
      <p className="status-text">
        Signed in as <strong>{data.user.username}</strong>
      </p>
      <dl className="status-grid">
        <div>
          <dt>Role</dt>
          <dd>{data.user.role}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{data.user.status}</dd>
        </div>
      </dl>
      <div className="home-actions">
        <Link className="primary-link" to="/users">
          Open Users directory
        </Link>
        <Link className="primary-link" to="/audit-logs">
          View Audit Logs
        </Link>
        {['it', 'admin', 'head_it'].includes(data.user.role) && (
          <Link className="primary-link" to="/systems">
            Manage Systems & Rules
          </Link>
        )}
      </div>
      <LdapSyncPanel />
    </section>
  );
}
