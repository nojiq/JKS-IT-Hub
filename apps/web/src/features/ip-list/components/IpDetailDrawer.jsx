import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { fetchIpDetail } from "../api/ipListApi.js";
import { IpDetailBody } from "./IpDetailBody.jsx";

export function IpDetailDrawer({ ipAddress, previewRow = null, onClose }) {
  const panelRef = useRef(null);

  const detailQuery = useQuery({
    queryKey: ["ip-list", "detail", ipAddress],
    queryFn: () => fetchIpDetail(ipAddress),
    enabled: Boolean(ipAddress),
    initialData: previewRow?.ipAddress === ipAddress ? previewRow : undefined
  });

  const row = detailQuery.data;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, [ipAddress]);

  return (
    <div className="ip-list-drawer-root" role="presentation">
      <button
        type="button"
        className="ip-list-drawer-backdrop"
        aria-label="Close IP detail"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="ip-list-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`IP detail ${ipAddress}`}
        tabIndex={-1}
      >
        <header className="ip-list-drawer__header">
          <p className="ip-list-drawer__eyebrow">IP detail</p>
          <div className="ip-list-drawer__actions">
            <Link
              className="workspace-inline-button"
              to={`/ip-list/${encodeURIComponent(ipAddress)}`}
            >
              Open full page
            </Link>
            <button
              type="button"
              className="workspace-inline-button"
              onClick={onClose}
              aria-label="Close drawer"
            >
              Close
            </button>
          </div>
        </header>

        <div className="ip-list-drawer__body">
          {detailQuery.isLoading && !row ? (
            <DataStateBlock variant="loading" title="Loading IP" description="Fetching record details." />
          ) : detailQuery.error || !row ? (
            <DataStateBlock
              variant="error"
              title="IP address not found"
              description={detailQuery.error?.message ?? "This IP has no asset or manual record."}
            />
          ) : (
            <IpDetailBody row={row} variant="drawer" compactHero onDeleted={onClose} />
          )}
        </div>
      </aside>
    </div>
  );
}
