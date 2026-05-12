import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader";
import "./onboarding.css";

import { DEV_ONLY_ROLES } from "../../shared/auth/workspaceRoles.js";

const ONBOARDING_ROLES = DEV_ONLY_ROLES;
export function OnboardingLayout() {
  const { user } = useOutletContext() ?? {};

  if (!user || !ONBOARDING_ROLES.includes(user.role)) {
    return <Navigate replace to="/" />;
  }

  return (
    <section className="workspace-page onboarding-layout">
      <WorkspacePageHeader
        title="Onboarding"
      />

      <div className="onboarding-shell">
        <div className="onboarding-panel">
          <Outlet context={{ user }} />
        </div>
      </div>
    </section>
  );
}
