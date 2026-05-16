import { AssignmentSourceBadge } from "./AssignmentSourceBadge.jsx";
import { AssetEntityLink } from "./AssetEntityLink.jsx";
import {
  formatAssetDateTime,
  formatAssetValue,
  getAssetModelLabel,
  getLinkedUserLabel
} from "../utils/assetDisplay.js";

export function AssetTable({ assets = [], ariaLabel = "Asset inventory" }) {
  if (!assets.length) {
    return null;
  }

  return (
    <div className="assets-table-wrap">
      <table className="assets-table workspace-data-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col">Asset tag</th>
            <th scope="col">Model / name</th>
            <th scope="col">Serial</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Assigned user</th>
            <th scope="col">Assignment source</th>
            <th scope="col">Last synced</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const linkedUser = getLinkedUserLabel(asset);
            return (
              <tr key={asset.id}>
                <td>
                  <AssetEntityLink to={`/assets/${asset.id}`} kind="asset">
                    {formatAssetValue(asset.assetTag)}
                  </AssetEntityLink>
                </td>
                <td>{getAssetModelLabel(asset)}</td>
                <td>{formatAssetValue(asset.serial)}</td>
                <td>{formatAssetValue(asset.categoryName)}</td>
                <td>
                  <span className="assets-status-pill">{formatAssetValue(asset.statusLabel)}</span>
                </td>
                <td>
                  {asset.assignedToUser?.id ? (
                    <AssetEntityLink
                      to={`/users/${asset.assignedToUser.id}`}
                      kind="user"
                      title={`Open profile for ${asset.assignedToUser.username}`}
                    >
                      {linkedUser}
                    </AssetEntityLink>
                  ) : (
                    <span className="assets-muted">{linkedUser ?? "—"}</span>
                  )}
                </td>
                <td>
                  <AssignmentSourceBadge source={asset.assignmentSource} />
                </td>
                <td className="assets-date-cell">{formatAssetDateTime(asset.lastSyncedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

