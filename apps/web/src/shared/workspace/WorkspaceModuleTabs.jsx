import { Link, useLocation } from "react-router-dom";

function isRootModulePath(to) {
  return to.split("/").filter(Boolean).length === 1;
}

function matchesPath(pathname, to) {
  if (isRootModulePath(to)) {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export function WorkspaceModuleTabs({ items, ariaLabel, className = "" }) {
  const location = useLocation();
  const navClassName = ["workspace-module-tabs", className].filter(Boolean).join(" ");

  return (
    <nav className={navClassName} aria-label={ariaLabel}>
      <div className="workspace-module-tabs-scroll">
        {items.map((item) => {
          const isActive = typeof item.matches === "function"
            ? item.matches(location.pathname)
            : matchesPath(location.pathname, item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`workspace-module-tab${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
