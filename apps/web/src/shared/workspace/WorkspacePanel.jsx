import { useId } from "react";
import "./workspace.css";

const normalizeClassName = (...parts) => parts.filter(Boolean).join(" ");

export function WorkspacePanel({
  variant = "content",
  eyebrow,
  title,
  meta,
  actions,
  footer,
  className,
  children
}) {
  const hasHeader = eyebrow || title || meta || actions;
  const titleId = useId();

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
            {title ? <h2 className="workspace-panel-title" id={titleId}>{title}</h2> : null}
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
