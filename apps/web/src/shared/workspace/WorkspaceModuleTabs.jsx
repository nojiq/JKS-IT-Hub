import { NavLink } from "react-router-dom";

function isRootModulePath(to) {
  return to.split("/").filter(Boolean).length === 1;
}

export function WorkspaceModuleTabs({ items, ariaLabel, className = "" }) {
  const navClassName = ["workspace-module-tabs", className].filter(Boolean).join(" ");

  return (
    <nav className={navClassName} aria-label={ariaLabel}>
      <div className="workspace-module-tabs-scroll">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={isRootModulePath(item.to)}
            className={({ isActive }) => `workspace-module-tab${isActive ? " is-active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
