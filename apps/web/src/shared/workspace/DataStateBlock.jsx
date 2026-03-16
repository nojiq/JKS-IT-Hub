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
  return (
    <div className={`workspace-state-block workspace-state-${variant || "empty"}`}>
      <h2 className="workspace-state-title">{title || TITLES[variant] || TITLES.empty}</h2>
      {description ? <p className="workspace-state-description">{description}</p> : null}
      {actionLabel && onAction ? (
        <button className="workspace-state-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
