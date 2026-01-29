import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLatestSync, getLdapSyncStreamUrl, triggerLdapSync } from "./ldap-sync-api.js";

const formatTimestamp = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
};

const formatStatus = (status) => {
  switch (status) {
    case "started":
      return "In progress";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Not run";
  }
};

export default function LdapSyncPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ldap-sync-latest"],
    queryFn: fetchLatestSync,
    retry: false,
    refetchOnWindowFocus: false
  });

  const mutation = useMutation({
    mutationFn: triggerLdapSync,
    onSuccess: (payload) => {
      if (payload?.run) {
        queryClient.setQueryData(["ldap-sync-latest"], payload.run);
      }
    }
  });

  useEffect(() => {
    const url = getLdapSyncStreamUrl();
    const source = new EventSource(url, { withCredentials: true });

    const handleEvent = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const run = payload?.data?.run;
        if (run) {
          queryClient.setQueryData(["ldap-sync-latest"], run);
        }
      } catch {
        // ignore malformed events
      }
    };

    source.addEventListener("ldap.sync", handleEvent);
    source.onerror = () => {
      // keep UI usable even if SSE disconnects
    };

    return () => {
      source.removeEventListener("ldap.sync", handleEvent);
      source.close();
    };
  }, [queryClient]);

  const status = data?.status ?? "not-run";
  const lastUpdated = data?.completedAt ?? data?.startedAt;
  const isRunning = status === "started";

  return (
    <section className="sync-panel">
      <header className="sync-header">
        <div>
          <h3>LDAP Sync</h3>
          <p className="sync-subtitle">Manual sync updates LDAP-derived user fields.</p>
        </div>
        <button
          className="sync-button"
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isRunning}
        >
          {isRunning ? "Syncing..." : "Run Sync"}
        </button>
      </header>

      {isLoading ? (
        <p className="sync-status">Loading latest status…</p>
      ) : (
        <div className={`sync-status-card sync-status-${status}`}>
          <p className="sync-status">
            Status: <strong>{formatStatus(status)}</strong>
          </p>
          <p className="sync-meta">Last update: {formatTimestamp(lastUpdated)}</p>
          {data ? (
            <div className="sync-metrics">
              <div>
                <span className="sync-metric-label">Processed</span>
                <span className="sync-metric-value">{data.processedCount ?? 0}</span>
              </div>
              <div>
                <span className="sync-metric-label">Created</span>
                <span className="sync-metric-value">{data.createdCount ?? 0}</span>
              </div>
              <div>
                <span className="sync-metric-label">Updated</span>
                <span className="sync-metric-value">{data.updatedCount ?? 0}</span>
              </div>
              <div>
                <span className="sync-metric-label">Skipped</span>
                <span className="sync-metric-value">{data.skippedCount ?? 0}</span>
              </div>
            </div>
          ) : (
            <p className="sync-meta">No sync has been recorded yet.</p>
          )}
          {data?.errorMessage ? (
            <p className="sync-error">Error: {data.errorMessage}</p>
          ) : null}
        </div>
      )}

      {error ? <p className="sync-error">{error.message}</p> : null}
      {mutation.error ? (
        <p className="sync-error">{mutation.error.message}</p>
      ) : null}
    </section>
  );
}
