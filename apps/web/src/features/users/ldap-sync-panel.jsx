import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchLatestSync, getLdapSyncStreamUrl, triggerLdapSync } from "./ldap-sync-api.js";
import { useToast } from "../../shared/hooks/useToast.js";

const LDAP_SYNC_STALE_MS = 15 * 60 * 1000;

const formatTimestamp = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");

  return `${d}/${m}/${y} ${hours}:${mins}`;
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

const formatCreatedUsers = (run) => {
  const count = run?.createdCount ?? 0;
  if (!count) {
    return null;
  }
  return `+${count} new`;
};

const formatCreatedUserNames = (run) => {
  const names = Array.isArray(run?.createdUsers)
    ? run.createdUsers.map((user) => user.username).filter(Boolean)
    : [];
  if (!names.length) {
    return "View audit for details";
  }
  return `${names.join(", ")}${run?.createdUsersHasMore ? ", ..." : ""}`;
};

const isSyncStale = (value) => {
  if (!value) {
    return true;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  return Date.now() - date.getTime() > LDAP_SYNC_STALE_MS;
};

const isSyncInProgressError = (error) => {
  return /currently in progress|already running/i.test(error?.message ?? "");
};

export default function LdapSyncPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const autoSyncStartedRef = useRef(false);
  const toastedRunsRef = useRef(new Set());
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
    },
    onError: (syncError) => {
      if (isSyncInProgressError(syncError)) {
        queryClient.invalidateQueries({ queryKey: ["ldap-sync-latest"] });
      }
    }
  });

  const handleCompletedRun = (run) => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    if (!run?.id || !run.createdCount || toastedRunsRef.current.has(run.id)) {
      return;
    }
    toastedRunsRef.current.add(run.id);
    toast.success(
      `${run.createdCount} new LDAP users synced`,
      formatCreatedUserNames(run)
    );
  };

  useEffect(() => {
    const url = getLdapSyncStreamUrl();
    const source = new EventSource(url, { withCredentials: true });

    const handleEvent = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const run = payload?.data?.run;
        if (run) {
          queryClient.setQueryData(["ldap-sync-latest"], run);
          if (run.status === "completed") {
            handleCompletedRun(run);
          }
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
  }, [queryClient, toast]);

  const status = data?.status ?? "not-run";
  const lastUpdated = data?.completedAt ?? data?.startedAt;
  const isRunning = status === "started";
  const createdUsersLabel = formatCreatedUsers(data);
  const title = data?.errorMessage
    ? `LDAP sync failed: ${data.errorMessage}`
    : isRunning
      ? "LDAP sync running"
      : "Sync LDAP";

  // Fallback: poll while a run is in-progress in case SSE disconnects or events are dropped.
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["ldap-sync-latest"] });
    }, 4000);

    return () => clearInterval(interval);
  }, [isRunning, queryClient]);

  useEffect(() => {
    if (isLoading || autoSyncStartedRef.current || isRunning) {
      return;
    }

    const lastSyncAt = data?.completedAt ?? data?.startedAt;
    if (data && !isSyncStale(lastSyncAt)) {
      return;
    }

    autoSyncStartedRef.current = true;
    mutation.mutate();
  }, [data, isLoading, isRunning, mutation]);

  return (
    <div
      className={`ldap-sync-toolbar ldap-sync-toolbar-${status}`}
      role="group"
      aria-label="LDAP sync"
    >
      <button
        className="ldap-sync-icon-button"
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        aria-label={isRunning ? "LDAP sync running" : "Sync LDAP"}
        title={title}
      >
        <span className={isRunning ? "ldap-sync-icon is-spinning" : "ldap-sync-icon"} aria-hidden="true">
          ↻
        </span>
      </button>
      <span className="ldap-sync-status-dot" aria-hidden="true" />
      <span className="ldap-sync-status-label">
        {isLoading ? "Syncing..." : `${formatStatus(status)} ${formatTimestamp(lastUpdated)}`}
      </span>
      {createdUsersLabel ? (
        <Link className="ldap-sync-created-chip" to="/audit-logs?action=user.ldap_create">
          {createdUsersLabel}
        </Link>
      ) : null}
      {error || (mutation.error && !isSyncInProgressError(mutation.error)) ? (
        <span className="ldap-sync-error">{error?.message || mutation.error?.message}</span>
      ) : null}
    </div>
  );
}
