import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { IT_STAFF_ROLES } from "../../../shared/auth/workspaceRoles.js";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { fetchAssetDetail } from "../api/assetsApi.js";
import { AssetManualLinkPanel } from "../components/AssetManualLinkPanel.jsx";
import { AssetEntityLink } from "../components/AssetEntityLink.jsx";
import { AssignmentSourceBadge } from "../components/AssignmentSourceBadge.jsx";
import {
  formatAssetDateTime,
  formatAssetValue,
  getAssetModelLabel,
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

  return (
    <section className="workspace-page assets-page assets-detail-page">
      <WorkspacePageHeader
        eyebrow="Assets"
        title={formatAssetValue(asset.assetTag)}
        description={getAssetModelLabel(asset)}
        actions={(
          <Link className="workspace-inline-link" to="/assets">
            Back to inventory
          </Link>
        )}
      />

      <div className="assets-detail-grid">
        <WorkspacePanel variant="detail" title="Asset details" meta="Core identifiers and status from Snipe-IT.">
          <dl className="assets-detail-list">
            <DetailRow label="Asset tag" value={asset.assetTag} />
            <DetailRow label="Name" value={asset.name} />
            <DetailRow label="Model" value={asset.modelName} />
            <DetailRow label="Serial" value={asset.serial} />
            <DetailRow label="Category" value={asset.categoryName} />
            <DetailRow label="Status" value={asset.statusLabel} />
            <DetailRow label="Snipe-IT asset ID" value={asset.snipeAssetId} />
            <DetailRow label="Last synced" value={formatAssetDateTime(asset.lastSyncedAt)} />
          </dl>
        </WorkspacePanel>

        <WorkspacePanel variant="detail" title="Assignment" meta="Snipe assignee data and IT Hub user link.">
          <dl className="assets-detail-list">
            <DetailRow label="Snipe assignee" value={getSnipeAssigneeSummary(asset)} />
            <DetailRow label="Snipe assignee type" value={asset.snipeAssignedType} />
            <DetailRow label="Snipe username" value={asset.snipeAssignedUsername} />
            <DetailRow label="Snipe email" value={asset.snipeAssignedEmail} />
            <DetailRow
              label="IT Hub user"
              value={
                asset.assignedToUser?.id ? (
                  <AssetEntityLink
                    to={`/users/${asset.assignedToUser.id}`}
                    kind="user"
                    title={`Open profile for ${asset.assignedToUser.username}`}
                  >
                    {getLinkedUserLabel(asset)}
                  </AssetEntityLink>
                ) : (
                  "—"
                )
              }
            />
            <div className="assets-detail-row">
              <dt>Assignment source</dt>
              <dd>
                <AssignmentSourceBadge source={asset.assignmentSource} />
              </dd>
            </div>
          </dl>

          {canManage ? (
            <AssetManualLinkPanel asset={asset} canManage />
          ) : null}
        </WorkspacePanel>
      </div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="assets-detail-row">
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}
