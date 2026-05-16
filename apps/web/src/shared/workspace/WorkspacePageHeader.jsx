import { useId } from "react";
import "./workspace.css";

export function WorkspacePageHeader({
  className,
  eyebrow,
  title,
  titleHint,
  description,
  meta,
  actions
}) {
  const titleId = useId();
  const titleHintId = useId();

  return (
    <header className={`workspace-page-header${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <div className="workspace-page-header-copy">
        {eyebrow ? <p className="workspace-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="workspace-page-title" id={titleId}>
          {titleHint ? (
            <span
              className="workspace-panel-title-hint"
              tabIndex={0}
              aria-describedby={titleHintId}
            >
              {title}
              <span
                className="workspace-panel-title-hint-popup"
                id={titleHintId}
                role="tooltip"
                aria-hidden="true"
              >
                {titleHint}
              </span>
            </span>
          ) : (
            title
          )}
        </h1>
        {description ? <p className="workspace-page-description">{description}</p> : null}
        {meta ? <p className="workspace-page-meta">{meta}</p> : null}
      </div>
      {actions ? <div className="workspace-page-header-actions">{actions}</div> : null}
    </header>
  );
}
