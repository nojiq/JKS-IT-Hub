import { Link, useNavigate } from "react-router-dom";
import {
  useMaintenanceHistory,
  useMyMaintenanceWindows,
  useWindows
} from "../hooks/useMaintenance.js";
import { MaintenanceWindowsTable } from "../components/MaintenanceWindowsTable.jsx";
import "./MaintenanceHomePage.css";

const EMPTY_ITEMS = [];

const getList = (payload) => payload?.data ?? EMPTY_ITEMS;

const DashboardSection = ({ title, linkTo, linkLabel, windows, onView, emptyMessage }) => (
  <section className="maintenance-section">
    <header className="maintenance-section__header">
      <h3>{title}</h3>
      <Link to={linkTo} className="workspace-inline-link">{linkLabel}</Link>
    </header>
    {windows.length > 0 ? (
      <MaintenanceWindowsTable
        windows={windows}
        dense
        onView={onView}
        ariaLabel={`${title} preview`}
      />
    ) : (
      <p className="maintenance-muted">{emptyMessage}</p>
    )}
  </section>
);

export default function MaintenanceHomePage() {
  const navigate = useNavigate();
  const windowsQuery = useWindows({ page: "1", perPage: "20" });
  const tasksQuery = useMyMaintenanceWindows({ page: "1", limit: "5" });
  const historyQuery = useMaintenanceHistory({ page: "1", perPage: "5" });

  const windows = getList(windowsQuery.data);
  const overdueWindows = windows.filter((entry) => String(entry.status).toUpperCase() === "OVERDUE");
  const upcomingWindows = windows.filter((entry) => {
    const status = String(entry.status).toUpperCase();
    return status === "UPCOMING" || status === "SCHEDULED";
  });

  const nextMaintenance = upcomingWindows.slice(0, 5);
  const myTasks = getList(tasksQuery.data).slice(0, 5);
  const overdue = overdueWindows.slice(0, 5);
  const historyCompletions = getList(historyQuery.data);
  const historyWindows = historyCompletions
    .map((entry) => entry.window)
    .filter(Boolean)
    .slice(0, 5);

  const handleView = () => {
    navigate("/maintenance/schedule");
  };

  return (
    <section className="maintenance-home-page maintenance-module-page">
      <header className="maintenance-page-header">
        <div>
          <h2>Overview</h2>
          <p>At-a-glance view of upcoming work, assignments, overdue windows, and recent sign-offs.</p>
        </div>
        <div className="maintenance-page-actions">
          <Link className="workspace-inline-button" to="/maintenance/config">Configuration</Link>
          <Link className="workspace-inline-button" to="/maintenance/assignment-rules">Rules</Link>
          <Link className="workspace-inline-button" to="/maintenance/checklists">Checklists</Link>
        </div>
      </header>

      <dl className="maintenance-summary-strip">
        <div className="maintenance-summary-item">
          <dt>Upcoming</dt>
          <dd>{upcomingWindows.length}</dd>
        </div>
        <div className="maintenance-summary-item">
          <dt>My tasks</dt>
          <dd>{getList(tasksQuery.data).length}</dd>
        </div>
        <div className="maintenance-summary-item">
          <dt>Overdue</dt>
          <dd>{overdueWindows.length}</dd>
        </div>
        <div className="maintenance-summary-item">
          <dt>History</dt>
          <dd>{historyQuery.data?.meta?.total ?? historyCompletions.length}</dd>
        </div>
      </dl>

      <DashboardSection
        title="Next maintenance"
        linkTo="/maintenance/schedule"
        linkLabel="View schedule"
        windows={nextMaintenance}
        onView={handleView}
        emptyMessage="No upcoming maintenance scheduled."
      />

      <DashboardSection
        title="My tasks"
        linkTo="/maintenance/my-tasks"
        linkLabel="View all"
        windows={myTasks}
        onView={handleView}
        emptyMessage="You have no pending tasks."
      />

      <DashboardSection
        title="Overdue"
        linkTo="/maintenance/schedule"
        linkLabel="Review overdue"
        windows={overdue}
        onView={handleView}
        emptyMessage="No overdue maintenance windows."
      />

      <section className="maintenance-section">
        <header className="maintenance-section__header">
          <h3>Recent history</h3>
          <Link to="/maintenance/history" className="workspace-inline-link">View history</Link>
        </header>
        {historyWindows.length > 0 ? (
          <MaintenanceWindowsTable
            windows={historyWindows}
            dense
            onView={handleView}
            ariaLabel="Recent maintenance history"
          />
        ) : (
          <p className="maintenance-muted">No recently completed maintenance.</p>
        )}
      </section>
    </section>
  );
}
