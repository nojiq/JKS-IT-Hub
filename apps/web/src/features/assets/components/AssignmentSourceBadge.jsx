import {
  ASSIGNMENT_SOURCE_BADGE_CLASS,
  getAssignmentSourceLabel
} from "../utils/assetDisplay.js";

export function AssignmentSourceBadge({ source, className = "" }) {
  const label = getAssignmentSourceLabel(source);
  const tone = ASSIGNMENT_SOURCE_BADGE_CLASS[source] ?? "is-muted";

  return (
    <span className={`asset-source-badge ${tone}${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}
