import { NavLink, Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader";
import "./onboarding.css";

const IT_ROLES = ["it", "admin", "head_it"];

export function OnboardingLayout() {
  const { user } = useOutletContext() ?? {};
  const navItems = [
    { label: "Overview", to: "/onboarding" },
    { label: "New Joiner", to: "/onboarding/new-joiner" },
    { label: "Defaults", to: "/onboarding/defaults" },
    { label: "Catalog", to: "/onboarding/catalog" }
  ];

  if (!user || !IT_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page onboarding-layout">
      <WorkspacePageHeader
        eyebrow="Core Operations"
        title="Onboarding"
        description="Prepare access, defaults, and credential packs for new joiners."
        meta="Department bundles preselect the right apps, while the module keeps overview, setup, defaults, and catalog work together."
      />

      <div className="onboarding-shell">
        <nav className="onboarding-subnav" aria-label="Onboarding sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/onboarding"}
              className={({ isActive }) => `onboarding-subnav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="onboarding-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
