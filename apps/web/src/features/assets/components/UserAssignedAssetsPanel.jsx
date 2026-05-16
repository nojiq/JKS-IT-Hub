import { useQuery } from "@tanstack/react-query";
import { fetchAssets } from "../api/assetsApi.js";
import { formatAssetValue, getAssetModelLabel } from "../utils/assetDisplay.js";
import { AssetEntityLink } from "./AssetEntityLink.jsx";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";

export function UserAssignedAssetsPanel({ userId }) {
  const assetsQuery = useQuery({
    queryKey: ["assets", "by-user", userId],
    queryFn: () => fetchAssets({ assignedTo: userId, perPage: "50", page: "1" }),
    enabled: Boolean(userId)
  });

  const assets = assetsQuery.data?.data ?? [];
  const total = assetsQuery.data?.meta?.total ?? assets.length;

  return (
    <WorkspacePanelContent
      isLoading={assetsQuery.isLoading}
      error={assetsQuery.error}
      assets={assets}
      total={total}
      onRetry={() => assetsQuery.refetch()}
    />
  );
}

function WorkspacePanelContent({ isLoading, error, assets, total, onRetry }) {
  if (isLoading) {
    return <p className="assets-muted">Loading assigned assets…</p>;
  }

  if (error) {
    return (
      <DataStateBlock
        variant="error"
        title="Unable to load assets"
        description={error.message}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }

  if (!assets.length) {
    return <p className="assets-muted">No assets linked to this user.</p>;
  }

  return (
    <>
      <p className="assets-panel-meta">{total} asset{total === 1 ? "" : "s"} linked in IT Hub</p>
      <ul className="assets-user-list">
        {assets.map((asset) => (
          <li key={asset.id} className="assets-user-list-item">
            <AssetEntityLink to={`/assets/${asset.id}`} kind="asset">
              {formatAssetValue(asset.assetTag)}
            </AssetEntityLink>
            <span className="assets-user-list-model">{getAssetModelLabel(asset)}</span>
            <span className="assets-user-list-serial">{formatAssetValue(asset.serial)}</span>
            <span className="assets-status-pill">{formatAssetValue(asset.statusLabel)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
