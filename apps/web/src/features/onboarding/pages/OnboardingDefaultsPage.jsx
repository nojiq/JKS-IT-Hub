import TemplateList from "../../credentials/templates/TemplateList.jsx";

export function OnboardingDefaultsPage() {
  return (
    <TemplateList
      pageTitle="Reusable Default Sets"
      pageDescription="Maintain the reusable rule sets that prefill common onboarding decisions for each department."
      createLabel="Create Default Set"
      emptyTitle="No onboarding defaults found."
      emptyActionLabel="Create Your First Default Set"
    />
  );
}
