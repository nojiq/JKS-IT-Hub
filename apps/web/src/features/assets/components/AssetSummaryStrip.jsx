import { formatAssetDateTime } from "../utils/assetDisplay.js";

export function AssetSummaryStrip({
  total = 0,
  assigned = 0,
  unmatched = 0,
  lastSyncedAt = null,
  isLoading = false
}) {
  return (
    <dl className="assets-summary-strip" aria-label="Asset inventory summary">
      <SummaryItem label="Total assets" value={total} isLoading={isLoading} />
      <SummaryItem label="Assigned" value={assigned} isLoading={isLoading} />
      <SummaryItem label="Unmatched" value={unmatched} isLoading={isLoading} />
      <SummaryItem
        label="Last sync"
        value={lastSyncedAt ? formatAssetDateTime(lastSyncedAt) : "Not synced yet"}
        isLoading={isLoading}
        isText
      />
    </dl>
  );
}

function SummaryItem({ label, value, isLoading, isText = false }) {
  return (
    <div className="assets-summary-item">
      <dt>{label}</dt>
      <dd className={isText ? "assets-summary-value-text" : undefined}>
        {isLoading ? "…" : value}
      </dd>
    </div>
  );
}

