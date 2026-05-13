import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchCatalogItems,
  fetchDepartmentBundles
} from "../onboarding-api.js";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import "../onboarding.css";

const EMPTY_BUNDLES = [];
const EMPTY_ITEMS = [];

const formatDepartmentLabel = (department) => department || "No department selected";

export default function OnboardingHomePage() {
  const bundlesQuery = useQuery({
    queryKey: ["onboarding", "department-bundles"],
    queryFn: fetchDepartmentBundles
  });

  const catalogItemsQuery = useQuery({
    queryKey: ["onboarding", "catalog-items"],
    queryFn: fetchCatalogItems
  });

  const bundles = bundlesQuery.data ?? EMPTY_BUNDLES;
  const catalogItems = catalogItemsQuery.data ?? EMPTY_ITEMS;

  const activeBundles = bundles.filter((bundle) => bundle.isActive);

  return (
    <div className="onboarding-panel">
      <div className="onboarding-split-grid onboarding-home-grid">
        <WorkspacePanel
          variant="detail"
          title="Start New Joiner"
          meta="Launch the guided setup flow or adjust reusable defaults first."
          actions={(
            <Link className="workspace-inline-button" to="/onboarding/new-joiner">
              Open Setup Flow
            </Link>
          )}
        >
          <div className="onboarding-home-stack">
            <p className="onboarding-muted">
              Build the setup sheet, confirm passwords, and hand off laptop-ready access details.
            </p>
            <div className="onboarding-actions">
              <Link className="workspace-inline-link" to="/onboarding/defaults">
                Review reusable defaults
              </Link>
              <Link className="workspace-inline-link" to="/onboarding/catalog">
                Open app catalog
              </Link>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Direct User Creation"
          meta="Manual joiners are created as real users immediately"
        >
          <p className="onboarding-muted">
            Saving a new joiner now creates the user record and stores generated credentials in one flow.
          </p>
        </WorkspacePanel>
      </div>

      <div className="onboarding-split-grid onboarding-home-grid">
        <WorkspacePanel
          variant="detail"
          title="Reusable Defaults"
          meta={`${activeBundles.length} active department bundle${activeBundles.length === 1 ? "" : "s"}`}
        >
          {activeBundles.length ? (
            <ul className="onboarding-home-list">
              {activeBundles.slice(0, 4).map((bundle) => (
                <li key={bundle.id}>{formatDepartmentLabel(bundle.department)}</li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-muted">Create department bundles so common app access is preselected automatically.</p>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Catalog Coverage"
          meta={`${catalogItems.length} catalog item${catalogItems.length === 1 ? "" : "s"} available for setup sheets`}
        >
          {catalogItems.length ? (
            <ul className="onboarding-home-list">
              {catalogItems.slice(0, 4).map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-muted">Add app records and login URLs before relying on the setup sheet for new joiners.</p>
          )}
        </WorkspacePanel>
      </div>
    </div>
  );
}
