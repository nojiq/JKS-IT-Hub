import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader";
import "./onboarding.css";

export function OnboardingLayout() {
  const { user } = useOutletContext() ?? {};

  if (!user) {
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
