import "./workspace.css";

const TITLES = {
  loading: "Loading",
  empty: "No results",
  error: "Something went wrong"
};

export function DataStateBlock({
  variant,
  title,
  description,
  actionLabel,
  onAction
}) {
  const resolvedVariant = variant || "empty";
  const role = resolvedVariant === "error" ? "alert" : "status";
  const ariaLive = resolvedVariant === "error" ? "assertive" : "polite";

  return (
    <div
      className={`workspace-state-block workspace-state-${resolvedVariant}${actionLabel && onAction ? " has-action" : ""}`}
      role={role}
      aria-live={ariaLive}
    >
      <h2 className="workspace-state-title">{title || TITLES[resolvedVariant] || TITLES.empty}</h2>
      {description ? <p className="workspace-state-description">{description}</p> : null}
      {actionLabel && onAction ? (
        <button className="workspace-state-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
