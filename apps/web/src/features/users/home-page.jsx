import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { fetchAuditLogs } from "../audit/audit-api.js";
import { fetchWindows } from "../maintenance/api/maintenanceApi.js";
import { getNotifications, getUnreadCount } from "../notifications/api/notifications.js";
import { fetchAllRequests, fetchMyRequests } from "../requests/api/requestsApi.js";
import { fetchUsers } from "./users-api.js";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import "../../shared/workspace/workspace.css";

const IT_ROLES = ["it", "admin", "head_it"];
const ADMIN_ROLES = ["admin", "head_it"];

const formatRoleLabel = (role) =>
  String(role || "user")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());

const getUnreadCountValue = (payload) =>
  Number(payload?.data?.count ?? payload?.count ?? payload?.meta?.count ?? 0);

const getListItems = (payload) => payload?.data ?? [];

const getListTotal = (payload) => Number(payload?.meta?.total ?? getListItems(payload).length ?? 0);

const formatStatusLabel = (status) =>
  String(status || "unknown")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());

const formatDateTime = (value) => {
  if (!value) {
    return "Unknown time";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString();
};

const requestTitleFor = (isItUser) => (isItUser ? "Review Queue" : "My Requests");
const requestDescriptionFor = (isItUser) =>
  isItUser ? "Submitted requests awaiting IT action." : "Track the requests you have submitted.";

export default function HomePage() {
  const { user } = useOutletContext() ?? {};

  if (!user) {
    return null;
  }

  const isItUser = IT_ROLES.includes(user.role);
  const isAdminUser = ADMIN_ROLES.includes(user.role);

  const usersQuery = useQuery({
    queryKey: ["users", { page: "1", perPage: "100" }],
    queryFn: () => fetchUsers({ page: "1", perPage: "100" }),
    retry: false
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    retry: false
  });

  const requestsQuery = useQuery({
    queryKey: [
      "requests",
      isItUser ? "admin" : "my",
      isItUser ? { status: "SUBMITTED", page: "1", perPage: "5" } : { page: "1", perPage: "5" }
    ],
    queryFn: () =>
      isItUser
        ? fetchAllRequests({ status: "SUBMITTED", page: "1", perPage: "5" })
        : fetchMyRequests({ page: "1", perPage: "5" }),
    retry: false
  });

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance", "windows", "status-overview"],
    queryFn: () => fetchWindows({ page: "1", perPage: "20", status: ["SCHEDULED", "UPCOMING", "OVERDUE"] }),
    enabled: isItUser,
    retry: false
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs", "recent"],
    queryFn: () => fetchAuditLogs({ page: 1, limit: 4 }),
    enabled: isAdminUser,
    retry: false
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => getNotifications({ page: 1, limit: 4 }),
    enabled: !isItUser,
    retry: false
  });

  const users = usersQuery.data?.users ?? [];
  const totalUsers = Number(usersQuery.data?.meta?.total ?? users.length ?? 0);
  const activeUsers = users.filter((entry) => String(entry.status).toLowerCase() === "active").length;
  const disabledUsers = users.filter((entry) => String(entry.status).toLowerCase() === "disabled").length;
  const unreadCount = getUnreadCountValue(unreadCountQuery.data);
  const requestItems = getListItems(requestsQuery.data);
  const requestTotal = getListTotal(requestsQuery.data);
  const maintenanceItems = getListItems(maintenanceQuery.data);
  const upcomingMaintenance = maintenanceItems.filter((entry) => entry.status === "UPCOMING").length;
  const overdueMaintenance = maintenanceItems.filter((entry) => entry.status === "OVERDUE").length;
  const auditItems = getListItems(auditQuery.data);
  const notificationItems = getListItems(notificationsQuery.data);
  const requestsPath = isItUser ? "/requests/review" : "/requests/my-requests";
  const maintenancePath = isItUser ? "/maintenance/schedule" : "/maintenance/my-tasks";

  return (
    <section className="workspace-page dashboard-page">
      <WorkspacePageHeader
        title="Dashboard"
        description="Operational overview for current workload, directory health, and recent activity."
        meta={`${formatRoleLabel(user.role)} workspace`}
      />

      <section className="dashboard-stat-grid" aria-label="Dashboard summary">
        <article className="dashboard-stat-card">
          <p className="dashboard-stat-label">Unread Notifications</p>
          <p className="dashboard-stat-value">{unreadCount}</p>
          <p className="dashboard-stat-meta">
            {unreadCount > 0 ? "Unread updates need attention." : "You're caught up for now."}
          </p>
        </article>

        <article className="dashboard-stat-card">
          <p className="dashboard-stat-label">Users in Directory</p>
          <p className="dashboard-stat-value">{totalUsers}</p>
          <p className="dashboard-stat-meta">
            {activeUsers} active, {disabledUsers} disabled
          </p>
        </article>

        <article className="dashboard-stat-card">
          <p className="dashboard-stat-label">{requestTitleFor(isItUser)}</p>
          <p className="dashboard-stat-value">{requestTotal}</p>
          <p className="dashboard-stat-meta">{requestDescriptionFor(isItUser)}</p>
        </article>

        {isItUser ? (
          <article className="dashboard-stat-card">
            <p className="dashboard-stat-label">Maintenance Status</p>
            <p className="dashboard-stat-value">{upcomingMaintenance + overdueMaintenance}</p>
            <p className="dashboard-stat-meta">
              {upcomingMaintenance} upcoming, {overdueMaintenance} overdue
            </p>
          </article>
        ) : null}
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>{requestTitleFor(isItUser)}</h2>
              <p>
                {isItUser
                  ? "Prioritize submitted requests waiting for IT review."
                  : "Keep track of your latest request activity."}
              </p>
            </div>
            <Link className="workspace-inline-link" to={requestsPath}>
              Open {requestTitleFor(isItUser)}
            </Link>
          </div>

          {requestItems.length ? (
            <div className="dashboard-list">
              {requestItems.slice(0, 4).map((request) => (
                <article className="dashboard-list-item" key={request.id}>
                  <div>
                    <p className="dashboard-list-title">
                      {request.itemName || request.title || request.id}
                    </p>
                    <p className="dashboard-list-meta">
                      {formatStatusLabel(request.status)}
                      {request.priority ? ` • ${formatStatusLabel(request.priority)}` : ""}
                    </p>
                  </div>
                  <span className="dashboard-list-timestamp">
                    {formatDateTime(request.createdAt || request.updatedAt)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty-copy">No request activity to show.</p>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Quick Actions</h2>
              <p>Jump into the desktop workflows used most often.</p>
            </div>
          </div>

          <div className="dashboard-actions">
            <Link className="workspace-inline-link is-primary" to="/users">
              Open Users Directory
            </Link>
            <Link className="workspace-inline-link" to={requestsPath}>
              Open Requests
            </Link>
            <Link className="workspace-inline-link" to="/notifications">
              Open Notifications
            </Link>
            {isItUser ? (
              <Link className="workspace-inline-link" to={maintenancePath}>
                Open Maintenance
              </Link>
            ) : null}
            {isItUser ? (
              <Link className="workspace-inline-link" to="/systems">
                Manage Systems &amp; Rules
              </Link>
            ) : null}
            {isAdminUser ? (
              <Link className="workspace-inline-link" to="/audit-logs">
                Review Audit Logs
              </Link>
            ) : null}
          </div>
        </article>

        {isAdminUser ? (
          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>Recent Audit Activity</h2>
                <p>Latest administrative events affecting the workspace.</p>
              </div>
              <Link className="workspace-inline-link" to="/audit-logs">
                View Audit Logs
              </Link>
            </div>

            {auditItems.length ? (
              <div className="dashboard-list">
                {auditItems.map((entry) => (
                  <article className="dashboard-list-item" key={entry.id ?? `${entry.action}-${entry.createdAt}`}>
                    <div>
                      <p className="dashboard-list-title">{formatStatusLabel(entry.action)}</p>
                      <p className="dashboard-list-meta">{entry.actor?.username || "System event"}</p>
                    </div>
                    <span className="dashboard-list-timestamp">{formatDateTime(entry.createdAt)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty-copy">No recent audit entries available.</p>
            )}
          </article>
        ) : (
          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h2>Recent Notifications</h2>
                <p>Latest in-app alerts relevant to your account.</p>
              </div>
              <Link className="workspace-inline-link" to="/notifications">
                View Notifications
              </Link>
            </div>

            {notificationItems.length ? (
              <div className="dashboard-list">
                {notificationItems.map((entry) => (
                  <article className="dashboard-list-item" key={entry.id}>
                    <div>
                      <p className="dashboard-list-title">{entry.title || entry.type || "Notification"}</p>
                      <p className="dashboard-list-meta">{entry.message || "Open notifications for details."}</p>
                    </div>
                    <span className="dashboard-list-timestamp">
                      {formatDateTime(entry.createdAt || entry.updatedAt)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty-copy">No recent notifications available.</p>
            )}
          </article>
        )}
      </section>
    </section>
  );
}
