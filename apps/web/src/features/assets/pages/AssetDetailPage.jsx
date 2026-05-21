import { Link, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IT_STAFF_ROLES } from "../../../shared/auth/workspaceRoles.js";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { WorkspaceNavIcon } from "../../../shared/workspace/WorkspaceIcons.jsx";
import { fetchAssetDetail } from "../api/assetsApi.js";
import { AssetManualLinkPanel } from "../components/AssetManualLinkPanel.jsx";
import { AssetEntityLink } from "../components/AssetEntityLink.jsx";
import { AssignmentSourceBadge } from "../components/AssignmentSourceBadge.jsx";
import {
  formatAssetDateTime,
  formatAssetValue,
  getAssetMacAddressRows,
  getAssetModelLabel,
  getAssetStatusTone,
  getLinkedUserLabel,
  getSnipeAssigneeSummary
} from "../utils/assetDisplay.js";
import "../assets-workspace.css";

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext() ?? {};
  const canManage = IT_STAFF_ROLES.includes(user?.role);

  const assetQuery = useQuery({
    queryKey: ["assets", "detail", id],
    queryFn: () => fetchAssetDetail(id),
    enabled: Boolean(id)
  });

  const asset = assetQuery.data;

  if (assetQuery.isLoading) {
    return (
      <section className="workspace-page assets-page">
        <DataStateBlock variant="loading" title="Loading asset" description="Fetching asset details." />
      </section>
    );
  }

  if (assetQuery.error || !asset) {
    return (
      <section className="workspace-page assets-page">
        <DataStateBlock
          variant="error"
          title="Asset not found"
          description={assetQuery.error?.message ?? "This asset may have been removed."}
          actionLabel="Back to inventory"
          onAction={() => navigate("/assets")}
        />
      </section>
    );
  }

  const modelLabel = getAssetModelLabel(asset);
  const statusTone = getAssetStatusTone(asset.statusLabel);
  const linkedUserLabel = getLinkedUserLabel(asset);
  const hasLinkedUser = Boolean(asset.assignedToUser?.id);
  const macAddressRows = getAssetMacAddressRows(asset);

  return (
    <section className="workspace-page assets-page assets-detail-page">
      <WorkspacePageHeader
        className="assets-detail-header"
        eyebrow="Assets"
        title={formatAssetValue(asset.assetTag)}
        description={modelLabel !== "—" ? modelLabel : undefined}
        actions={(
          <Link className="workspace-inline-link assets-detail-back" to="/assets">
            <BackIcon />
            Back to inventory
          </Link>
        )}
      />

      <article className="assets-detail-hero" aria-label="Asset overview">
        <div className="assets-detail-hero__lead">
          <div className="assets-detail-hero__icon" aria-hidden="true">
            <WorkspaceNavIcon icon="assets" className="assets-detail-hero__icon-svg" />
          </div>
          <div className="assets-detail-hero__copy">
            <p className="assets-detail-hero__tag">{formatAssetValue(asset.assetTag)}</p>
            {asset.name && asset.name !== asset.assetTag ? (
              <p className="assets-detail-hero__name">{formatAssetValue(asset.name)}</p>
            ) : null}
            <div className="assets-detail-hero__chips">
              {asset.statusLabel ? (
                <span className={`assets-status-pill assets-status-pill--${statusTone}`}>
                  {asset.statusLabel}
                </span>
              ) : null}
              {asset.categoryName ? (
                <span className="assets-detail-chip">{asset.categoryName}</span>
              ) : null}
              <AssignmentSourceBadge source={asset.assignmentSource} className="assets-detail-hero__source" />
            </div>
          </div>
        </div>

        <div className="assets-detail-hero__metrics" role="list" aria-label="Quick facts">
          <HeroMetric label="Serial" value={formatAssetValue(asset.serial)} />
          <HeroMetric label="Snipe ID" value={formatAssetValue(asset.snipeAssetId)} />
          <HeroMetric label="Last synced" value={formatAssetDateTime(asset.lastSyncedAt)} />
        </div>
      </article>

      <div className="assets-detail-layout">
        <div className="assets-detail-main">
          <AssetSpecCard title="Identity" description="Tags and display names from Snipe-IT.">
            <SpecTable
              rows={[
                ["Asset tag", formatAssetValue(asset.assetTag)],
                ["Display name", formatAssetValue(asset.name)]
              ]}
            />
          </AssetSpecCard>

          <AssetSpecCard title="Hardware" description="Model, serial, and category.">
            <SpecTable
              rows={[
                ["Model", formatAssetValue(asset.modelName)],
                ["Serial", formatAssetValue(asset.serial)],
                ["Category", formatAssetValue(asset.categoryName)]
              ]}
            />
          </AssetSpecCard>

          <AssetSpecCard title="Network" description="IP and MAC addresses synced from Snipe-IT custom fields.">
            <SpecTable
              rows={[
                ["IP address", formatAssetValue(asset.ipAddress)],
                ...macAddressRows.map(([label, value]) => [`MAC address ${label}`, formatAssetValue(value)])
              ]}
            />
          </AssetSpecCard>

          <AssetSpecCard title="Lifecycle" description="Deployment status and sync metadata.">
            <SpecTable
              rows={[
                ["Status", asset.statusLabel ? (
                  <span className={`assets-status-pill assets-status-pill--${statusTone}`}>
                    {asset.statusLabel}
                  </span>
                ) : "—"],
                ["Snipe-IT asset ID", formatAssetValue(asset.snipeAssetId)],
                ["Last synced", formatAssetDateTime(asset.lastSyncedAt)]
              ]}
            />
          </AssetSpecCard>
        </div>

        <aside className="assets-detail-aside" aria-label="Assignment">
          <WorkspacePanel
            variant="detail"
            className="assets-assignment-panel"
            title="IT Hub assignment"
            meta="Who holds this asset in IT Hub and how the link was resolved."
          >
            <div className={`assets-assignment-card${hasLinkedUser ? " is-linked" : " is-empty"}`}>
              <p className="assets-assignment-card__label">Linked user</p>
              {hasLinkedUser ? (
                <div className="assets-assignment-card__user">
                  <span className="assets-assignment-card__avatar" aria-hidden="true">
                    {getUserInitials(asset.assignedToUser)}
                  </span>
                  <div className="assets-assignment-card__user-copy">
                    <AssetEntityLink
                      to={`/users/${asset.assignedToUser.id}`}
                      kind="user"
                      className="assets-assignment-card__link"
                      title={`Open profile for ${asset.assignedToUser.username}`}
                    >
                      {linkedUserLabel}
                    </AssetEntityLink>
                    {asset.assignedToUser.email ? (
                      <p className="assets-assignment-card__email">{asset.assignedToUser.email}</p>
                    ) : null}
                  </div>
                  <AssignmentSourceBadge source={asset.assignmentSource} />
                </div>
              ) : (
                <p className="assets-assignment-card__empty">
                  No IT Hub user linked yet. Use Snipe data below or manual linking when eligible.
                </p>
              )}
            </div>

            <details className="assets-snipe-details">
              <summary className="assets-snipe-details__summary">
                <span>Snipe assignee details</span>
                <ChevronIcon />
              </summary>
              <SpecTable
                className="assets-snipe-details__table"
                rows={[
                  ["Assignee", getSnipeAssigneeSummary(asset)],
                  ["Assignee type", formatAssetValue(asset.snipeAssignedType)],
                  ["Username", formatAssetValue(asset.snipeAssignedUsername)],
                  ["Email", formatAssetValue(asset.snipeAssignedEmail)]
                ]}
              />
            </details>

            {canManage ? (
              <AssetManualLinkPanel asset={asset} canManage showSnipeSummary={false} />
            ) : null}
          </WorkspacePanel>
        </aside>
      </div>
    </section>
  );
}

function AssetSpecCard({ title, description, children }) {
  return (
    <section className="assets-spec-card">
      <header className="assets-spec-card__header">
        <h2 className="assets-spec-card__title">{title}</h2>
        {description ? <p className="assets-spec-card__description">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function SpecTable({ rows, className = "" }) {
  return (
    <dl className={`assets-spec-table${className ? ` ${className}` : ""}`}>
      {rows.map(([label, value]) => (
        <div className="assets-spec-table__row" key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function HeroMetric({ label, value }) {
  return (
    <div className="assets-detail-hero__metric" role="listitem">
      <p className="assets-detail-hero__metric-label">{label}</p>
      <p className="assets-detail-hero__metric-value">{value}</p>
    </div>
  );
}

function getUserInitials(user) {
  const ldap = user?.ldapAttributes ?? user?.ldapFields ?? {};
  const displayName = ldap.displayName ?? ldap.cn ?? ldap.name ?? user?.username ?? "?";
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return String(displayName).slice(0, 2).toUpperCase();
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="assets-snipe-details__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
