export function IpListSummaryStrip({
  total = 0,
  assetCount = 0,
  manualCount = 0,
  subnetCount = 0,
  isLoading = false
}) {
  return (
    <dl className="ip-list-summary-strip" aria-label="IP inventory summary">
      <SummaryItem label="Known IPs" value={total} isLoading={isLoading} />
      <SummaryItem label="Asset-sourced" value={assetCount} isLoading={isLoading} />
      <SummaryItem label="Manual" value={manualCount} isLoading={isLoading} />
      <SummaryItem label="Mapped subnets" value={subnetCount} isLoading={isLoading} />
    </dl>
  );
}

function SummaryItem({ label, value, isLoading }) {
  return (
    <div className="ip-list-summary-item">
      <dt>{label}</dt>
      <dd>{isLoading ? "…" : value}</dd>
    </div>
  );
}
