import { useId } from "react";
import "./workspace.css";

const normalizeClassName = (...parts) => parts.filter(Boolean).join(" ");

export function WorkspacePanel({
  variant = "content",
  eyebrow,
  title,
  titleHint,
  meta,
  actions,
  footer,
  className,
  children
}) {
  const hasHeader = eyebrow || title || meta || actions;
  const titleId = useId();
  const titleHintId = useId();

  return (
    <section
      className={normalizeClassName("workspace-panel", `workspace-panel-${variant}`, className)}
      data-variant={variant}
      aria-labelledby={title ? titleId : undefined}
    >
      {hasHeader ? (
        <header className="workspace-panel-header-band">
          <div className="workspace-panel-header-copy">
            {eyebrow ? <p className="workspace-panel-eyebrow">{eyebrow}</p> : null}
            {title ? (
              <h2 className="workspace-panel-title" id={titleId}>
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
              </h2>
            ) : null}
            {meta ? <p className="workspace-panel-meta">{meta}</p> : null}
          </div>
          {actions ? <div className="workspace-panel-header-actions">{actions}</div> : null}
        </header>
      ) : null}

      <div className="workspace-panel-body">{children}</div>

      {footer ? <footer className="workspace-panel-footer">{footer}</footer> : null}
    </section>
  );
}
