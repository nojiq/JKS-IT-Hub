import { Link } from "react-router-dom";
import {
  useMaintenanceHistory,
  useMyMaintenanceWindows,
  useWindows
} from "../hooks/useMaintenance.js";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import "./MaintenanceHomePage.css";

const EMPTY_ITEMS = [];

const getList = (payload) => payload?.data ?? EMPTY_ITEMS;
const getCount = (payload) => Number(payload?.meta?.total ?? getList(payload).length ?? 0);

export default function MaintenanceHomePage() {
  const windowsQuery = useWindows({ page: "1", perPage: "10" });
  const tasksQuery = useMyMaintenanceWindows({ page: "1", limit: "10" });
  const historyQuery = useMaintenanceHistory({ page: "1", perPage: "10" });

  const windows = getList(windowsQuery.data);
  const overdueWindows = windows.filter((entry) => String(entry.status).toUpperCase() === "OVERDUE");
  const upcomingWindows = windows.filter((entry) => {
    const status = String(entry.status).toUpperCase();
    return status === "UPCOMING" || status === "SCHEDULED";
  });

  const cards = [
    {
      title: "Upcoming Windows",
      value: upcomingWindows.length,
      description: "Scheduled and upcoming maintenance windows that need preparation or coordination.",
      actionLabel: "Open schedule",
      actionTo: "/maintenance/schedule"
    },
    {
      title: "My Tasks",
      value: getCount(tasksQuery.data),
      description: "Assigned maintenance work for the current operator queue.",
      actionLabel: "Open my tasks",
      actionTo: "/maintenance/my-tasks"
    },
    {
      title: "Overdue",
      value: overdueWindows.length,
      description: "Maintenance work that has missed its planned window and needs follow-up.",
      actionLabel: "Review overdue work",
      actionTo: "/maintenance/schedule"
    },
    {
      title: "History",
      value: getCount(historyQuery.data),
      description: "Recently completed maintenance records and sign-off history.",
      actionLabel: "Open history",
      actionTo: "/maintenance/history"
    }
  ];

  return (
    <section className="maintenance-home-page">
      <div className="maintenance-overview-grid">
        {cards.map((card) => (
          <WorkspacePanel
            key={card.title}
            variant="detail"
            className="maintenance-overview-card"
            title={card.title}
            meta={card.description}
            actions={(
              <Link className="workspace-inline-link" to={card.actionTo}>
                {card.actionLabel}
              </Link>
            )}
          >
            <p className="maintenance-overview-value">{card.value}</p>
          </WorkspacePanel>
        ))}
      </div>

      <div className="maintenance-support-grid">
        <WorkspacePanel
          variant="detail"
          title="Task Workspace"
          meta="Technician assignments, overdue windows, and execution updates stay together."
        >
          <div className="maintenance-inline-stack">
            <p className="maintenance-muted">
              Use the schedule to plan future work, then move into My Tasks to complete assigned windows and capture sign-off.
            </p>
            <div className="maintenance-home-actions">
              <Link className="workspace-inline-link" to="/maintenance/schedule">
                Open schedule board
              </Link>
              <Link className="workspace-inline-link" to="/maintenance/my-tasks">
                Review assigned work
              </Link>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Configuration Tools"
          meta="Cycles, assignment rules, and checklists define how the maintenance workspace behaves."
        >
          <div className="maintenance-inline-stack">
            <p className="maintenance-muted">
              Keep cycle timing, department assignment rules, and checklist templates aligned before generating more windows.
            </p>
            <div className="maintenance-home-actions">
              <Link className="workspace-inline-link" to="/maintenance/config">
                Open configuration
              </Link>
              <Link className="workspace-inline-link" to="/maintenance/assignment-rules">
                Review rules
              </Link>
              <Link className="workspace-inline-link" to="/maintenance/checklists">
                Manage checklists
              </Link>
            </div>
          </div>
        </WorkspacePanel>
      </div>
    </section>
  );
}
