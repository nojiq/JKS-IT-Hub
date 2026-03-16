import TemplateList from "../../credentials/templates/TemplateList.jsx";

export function OnboardingDefaultsPage() {
  return (
    <TemplateList
      pageTitle="Onboarding Defaults"
      pageDescription="Reuse the advanced credential template editor as the canonical rule set for future new joiners."
      createLabel="Create Default Rule Set"
      emptyTitle="No onboarding defaults found."
      emptyActionLabel="Create Your First Default"
    />
  );
}
