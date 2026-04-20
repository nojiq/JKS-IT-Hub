import { Link } from "react-router-dom";
import { WorkspaceNavIcon } from "./WorkspaceIcons";
import "./workspace.css";

export function ModuleLauncherCard({
  title,
  description,
  to,
  icon,
  actionLabel,
  metrics = []
}) {
  return (
    <Link className="workspace-module-card" to={to} aria-label={actionLabel}>
      <div className="workspace-module-card-header">
        <span className="workspace-module-card-icon" aria-hidden="true">
          <WorkspaceNavIcon icon={icon} className="workspace-module-card-icon-svg" />
        </span>
        <span className="workspace-module-card-kicker">Priority Workflow</span>
      </div>

      <div className="workspace-module-card-copy">
        <h2 className="workspace-module-card-title">{title}</h2>
        <p className="workspace-module-card-description">{description}</p>
      </div>

      {metrics.length ? (
        <ul className="workspace-module-card-metrics">
          {metrics.map((metric) => (
            <li className="workspace-module-card-metric" key={`${title}-${metric.label}`}>
              <span className="workspace-module-card-metric-copy">
                <span className="workspace-module-card-metric-value">{metric.value}</span>{" "}
                <span>{metric.label}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <span className="workspace-module-card-action">{actionLabel}</span>
    </Link>
  );
}
