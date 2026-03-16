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
        eyebrow="Onboarding"
        title="Onboarding"
        description="Prepare department-aware credential packs and reusable defaults for laptop setup."
        meta="Department bundles preselect the right apps. IT can still adjust the final setup sheet before saving."
      />

      <div className="onboarding-panel">
        <Outlet context={{ user }} />
      </div>
    </section>
  );
}
