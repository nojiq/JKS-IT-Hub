import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchCatalogItems,
  fetchDepartmentBundles,
  fetchOnboardingDrafts
} from "../onboarding-api.js";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import "../onboarding.css";

const EMPTY_DRAFTS = [];
const EMPTY_BUNDLES = [];
const EMPTY_ITEMS = [];

const formatDepartmentLabel = (department) => department || "No department selected";

const formatDraftLabel = (draft) => {
  if (!draft?.fullName) {
    return "Untitled draft";
  }

  if (!draft?.department) {
    return draft.fullName;
  }

  return `${draft.fullName} • ${draft.department}`;
};

export default function OnboardingHomePage() {
  const draftsQuery = useQuery({
    queryKey: ["onboarding", "drafts"],
    queryFn: () => fetchOnboardingDrafts("all")
  });

  const bundlesQuery = useQuery({
    queryKey: ["onboarding", "department-bundles"],
    queryFn: fetchDepartmentBundles
  });

  const catalogItemsQuery = useQuery({
    queryKey: ["onboarding", "catalog-items"],
    queryFn: fetchCatalogItems
  });

  const drafts = draftsQuery.data ?? EMPTY_DRAFTS;
  const bundles = bundlesQuery.data ?? EMPTY_BUNDLES;
  const catalogItems = catalogItemsQuery.data ?? EMPTY_ITEMS;

  const { inProgressDrafts, readyDrafts, completedDrafts } = useMemo(() => {
    const inProgress = [];
    const ready = [];
    const completed = [];

    drafts.forEach((draft) => {
      if (draft.status === "completed" || draft.linkedUserId) {
        completed.push(draft);
        return;
      }

      if ((draft.setupSheet?.entries?.length ?? 0) > 0) {
        ready.push(draft);
      }

      inProgress.push(draft);
    });

    return {
      inProgressDrafts: inProgress.slice(0, 3),
      readyDrafts: ready.slice(0, 3),
      completedDrafts: completed.slice(0, 3)
    };
  }, [drafts]);

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
          title="In Progress"
          meta={inProgressDrafts.length ? `${inProgressDrafts.length} active draft${inProgressDrafts.length === 1 ? "" : "s"}` : "No active drafts"}
        >
          {inProgressDrafts.length ? (
            <ul className="onboarding-home-list">
              {inProgressDrafts.map((draft) => (
                <li key={draft.id}>{formatDraftLabel(draft)}</li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-muted">Manual onboarding drafts will appear here after the first preview or save.</p>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Ready for Credential Generation"
          meta={readyDrafts.length ? `${readyDrafts.length} draft${readyDrafts.length === 1 ? "" : "s"} already have a setup sheet` : "No setup sheets waiting"}
        >
          {readyDrafts.length ? (
            <ul className="onboarding-home-list">
              {readyDrafts.map((draft) => (
                <li key={draft.id}>{formatDraftLabel(draft)}</li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-muted">Preview a setup sheet to stage usernames, passwords, and app notes before saving.</p>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          variant="detail"
          title="Completed Recently"
          meta={completedDrafts.length ? `${completedDrafts.length} recent completion${completedDrafts.length === 1 ? "" : "s"}` : "No completed onboarding records yet"}
        >
          {completedDrafts.length ? (
            <ul className="onboarding-home-list">
              {completedDrafts.map((draft) => (
                <li key={draft.id}>{formatDraftLabel(draft)}</li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-muted">Completed onboarding runs will surface here after they are linked or promoted.</p>
          )}
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
