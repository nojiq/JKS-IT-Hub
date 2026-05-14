import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchCatalogItems,
  fetchDepartmentBundles
} from "../onboarding-api.js";
import "../onboarding.css";

const EMPTY_BUNDLES = [];
const EMPTY_ITEMS = [];

const formatDepartmentLabel = (department) => department || "No department selected";

function IconUserPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function IconLayers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="m12.83 2.18 8 3.12A1 1 0 0 1 22 6.1v1.82a1 1 0 0 1-.65.94l-8 3.12a1 1 0 0 1-.7 0l-8-3.12A1 1 0 0 1 2 7.92V6.1a1 1 0 0 1 .35-.76l8-3.16a1 1 0 0 1 .48-.01Z" />
      <path d="M2 12.05v1.87a1 1 0 0 0 .65.93l8 3.12a1 1 0 0 0 .7 0l8-3.12a1 1 0 0 0 .65-.93v-1.87" />
      <path d="M2 17.05v1.87a1 1 0 0 0 .65.93l8 3.12a1 1 0 0 0 .7 0l8-3.12a1 1 0 0 0 .65-.93v-1.87" />
    </svg>
  );
}

function IconLibrary(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function IconChevronEnd(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

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
    <article className="onboarding-panel onboarding-home-page">
      <header className="onboarding-home-hero" aria-labelledby="onboarding-home-primary-heading">
        <p className="onboarding-home-kicker">Overview</p>
        <h2 className="onboarding-home-title" id="onboarding-home-primary-heading">
          Start New Joiner
        </h2>
        <div className="onboarding-home-cta">
          <Link className="onboarding-home-primary-button" to="/onboarding/new-joiner">
            <IconUserPlus className="onboarding-home-icon" />
            Create new user
          </Link>
        </div>
      </header>

      <div className="onboarding-home-rule" aria-hidden />

      <section className="onboarding-home-section" aria-labelledby="onboarding-home-direct-heading">
        <h2 className="onboarding-home-title is-sub" id="onboarding-home-direct-heading">
          Direct User Creation
        </h2>
        <p className="onboarding-home-body">
          Saving a new joiner now creates the user record and stores generated credentials in one flow.
        </p>
      </section>

      <div className="onboarding-home-rule" aria-hidden />

      <section className="onboarding-home-section" aria-labelledby="onboarding-home-shortcuts-heading">
        <h3 className="onboarding-home-section-label" id="onboarding-home-shortcuts-heading">
          Go to
        </h3>
        <nav className="onboarding-home-rows" aria-label="Onboarding destinations">
          <Link className="onboarding-home-row" to="/onboarding/defaults">
            <span className="onboarding-home-row-main">
              <IconLayers className="onboarding-home-row-icon" />
              <span className="onboarding-home-row-copy">
                <span className="onboarding-home-row-title">Review reusable defaults</span>
                <span className="onboarding-home-row-desc">Department bundles and preset access</span>
              </span>
            </span>
            <IconChevronEnd className="onboarding-home-row-chevron" />
          </Link>
          <Link className="onboarding-home-row" to="/onboarding/catalog">
            <span className="onboarding-home-row-main">
              <IconLibrary className="onboarding-home-row-icon" />
              <span className="onboarding-home-row-copy">
                <span className="onboarding-home-row-title">Open app catalog</span>
                <span className="onboarding-home-row-desc">Apps, URLs, and notes on the setup sheet</span>
              </span>
            </span>
            <IconChevronEnd className="onboarding-home-row-chevron" />
          </Link>
        </nav>
      </section>

      <div className="onboarding-home-rule" aria-hidden />

      <section className="onboarding-home-section" aria-labelledby="onboarding-home-glance-heading">
        <h3 className="onboarding-home-section-label" id="onboarding-home-glance-heading">
          At a glance
        </h3>
        <div className="onboarding-home-metrics">
          <div className="onboarding-home-metric">
            <div className="onboarding-home-metric-top">
              <span className="onboarding-home-metric-label">Reusable Defaults</span>
              <Link className="onboarding-home-metric-action" to="/onboarding/defaults">
                Manage
              </Link>
            </div>
            <p className="onboarding-home-metric-value" aria-live="polite">
              {activeBundles.length}
            </p>
            {activeBundles.length ? (
              <ul className="onboarding-home-metric-list">
                {activeBundles.slice(0, 4).map((bundle) => (
                  <li key={bundle.id}>{formatDepartmentLabel(bundle.department)}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="onboarding-home-metric">
            <div className="onboarding-home-metric-top">
              <span className="onboarding-home-metric-label">Catalog Coverage</span>
              <Link className="onboarding-home-metric-action" to="/onboarding/catalog">
                Manage
              </Link>
            </div>
            <p className="onboarding-home-metric-value" aria-live="polite">
              {catalogItems.length}
            </p>
            {catalogItems.length ? (
              <ul className="onboarding-home-metric-list">
                {catalogItems.slice(0, 4).map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </article>
  );
}
