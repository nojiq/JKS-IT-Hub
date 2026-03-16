import "./workspace.css";

export function BulkActionsBar({ selectedCount, children }) {
  if (!selectedCount) {
    return null;
  }

  return (
    <div className="workspace-bulk-actions" role="region" aria-label="Bulk actions">
      <span className="workspace-bulk-actions-label">{selectedCount} selected</span>
      <div className="workspace-bulk-actions-actions">{children}</div>
    </div>
  );
}
