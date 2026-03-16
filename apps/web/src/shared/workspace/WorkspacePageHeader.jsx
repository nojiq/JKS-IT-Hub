import "./workspace.css";

export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions
}) {
  return (
    <header className="workspace-page-header">
      <div>
        {eyebrow ? <p className="workspace-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="workspace-page-title">{title}</h1>
        {description ? <p className="workspace-page-description">{description}</p> : null}
        {meta ? <p className="workspace-page-meta">{meta}</p> : null}
      </div>
      {actions ? <div className="workspace-page-header-actions">{actions}</div> : null}
    </header>
  );
}
