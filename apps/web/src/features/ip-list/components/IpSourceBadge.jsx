import { SOURCE_BADGE_CLASS, getSourceLabel } from "../utils/ipListDisplay.js";

export function IpSourceBadge({ source, className = "" }) {
  const tone = SOURCE_BADGE_CLASS[source] ?? "is-muted";
  const label = getSourceLabel(source);
  return (
    <span className={`ip-source-badge ${tone}${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}
