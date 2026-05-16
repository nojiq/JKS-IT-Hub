import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsers } from "../../users/users-api.js";
import { clearAssetUserLink, linkAssetToUser } from "../api/assetsApi.js";
import { AssignmentSourceBadge } from "./AssignmentSourceBadge.jsx";
import { getLinkedUserLabel, getSnipeAssigneeSummary } from "../utils/assetDisplay.js";

const canManualLink = (source) =>
  ["unmatched", "manual", "auto_username", "auto_email"].includes(source);

export function AssetManualLinkPanel({ asset, canManage = false }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [feedback, setFeedback] = useState(null);

  const usersQuery = useQuery({
    queryKey: ["users", "asset-link-search", search],
    queryFn: () => fetchUsers({ search, page: "1", perPage: "10", status: "active" }),
    enabled: canManage && search.trim().length >= 2
  });

  const linkMutation = useMutation({
    mutationFn: ({ assetId, userId }) => linkAssetToUser(assetId, userId),
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Asset linked to IT Hub user." });
      setSelectedUserId("");
      setSearch("");
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      setFeedback({ type: "error", message: error.message });
    }
  });

  const resetMutation = useMutation({
    mutationFn: (assetId) => clearAssetUserLink(assetId),
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Manual link cleared. Assignment reverted from Snipe data." });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error) => {
      setFeedback({ type: "error", message: error.message });
    }
  });

  const userOptions = useMemo(() => {
    const users = usersQuery.data?.users ?? [];
    return users.map((user) => ({
      id: user.id,
      label: getLinkedUserLabel({ assignedToUser: user }) ?? user.username
    }));
  }, [usersQuery.data]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!canManage) {
    return null;
  }

  const showControls = canManualLink(asset?.assignmentSource) || asset?.assignmentSource === "manual";

  return (
    <section className="assets-manual-link-panel" aria-label="Manual asset linking">
      <p className="assets-manual-link-intro">
        Link unmatched or incorrect assignments to an IT Hub user. Reset returns assignment to Snipe-derived matching.
      </p>
      <p className="assets-snipe-assignee">
        <span className="assets-detail-label">Snipe assignee</span>
        <span>{getSnipeAssigneeSummary(asset)}</span>
      </p>
      {asset?.assignedToUser ? (
        <p className="assets-current-link">
          Current link: <strong>{getLinkedUserLabel(asset)}</strong>{" "}
          <AssignmentSourceBadge source={asset.assignmentSource} />
        </p>
      ) : null}

      {showControls ? (
        <div className="assets-manual-link-form">
          <label className="assets-manual-link-field" htmlFor="asset-link-user-search">
            <span className="assets-detail-label">Search IT Hub user</span>
            <input
              id="asset-link-user-search"
              type="search"
              className="assets-filter-input"
              placeholder="Username, email, or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="assets-manual-link-field" htmlFor="asset-link-user-select">
            <span className="assets-detail-label">Select user</span>
            <select
              id="asset-link-user-select"
              className="assets-filter-input"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={!userOptions.length || usersQuery.isFetching}
            >
              <option value="">
                {search.trim().length < 2
                  ? "Type at least 2 characters to search"
                  : usersQuery.isFetching
                    ? "Searching…"
                    : userOptions.length
                      ? "Choose a user"
                      : "No users found"}
              </option>
              {userOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="assets-manual-link-actions" role="group" aria-label="Link actions">
            <button
              type="button"
              className="workspace-inline-button is-primary"
              disabled={!selectedUserId || linkMutation.isPending}
              onClick={() => linkMutation.mutate({ assetId: asset.id, userId: selectedUserId })}
            >
              {linkMutation.isPending ? "Linking…" : "Link user"}
            </button>
            {asset.assignmentSource === "manual" || asset.assignedToUserId ? (
              <button
                type="button"
                className="workspace-inline-button"
                disabled={resetMutation.isPending}
                onClick={() => resetMutation.mutate(asset.id)}
              >
                {resetMutation.isPending ? "Resetting…" : "Reset link"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="assets-muted">
          Manual linking is available when Snipe reports a user assignee that did not match IT Hub, or after a manual link was set.
        </p>
      )}

      {feedback ? (
        <p className={feedback.type === "error" ? "assets-feedback is-error" : "assets-feedback is-success"} role="status">
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
