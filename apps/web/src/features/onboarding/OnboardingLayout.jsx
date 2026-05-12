import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader";
import "./onboarding.css";

const IT_ROLES = ["it", "admin", "head_it"];

export function OnboardingLayout() {
  const { user } = useOutletContext() ?? {};

  if (!user || !IT_ROLES.includes(user.role)) {
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
