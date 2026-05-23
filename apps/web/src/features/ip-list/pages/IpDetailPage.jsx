import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataStateBlock } from "../../../shared/workspace/DataStateBlock.jsx";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { fetchIpDetail } from "../api/ipListApi.js";
import { IpDetailBody } from "../components/IpDetailBody.jsx";
import { getRowHostname } from "../utils/ipListDisplay.js";
import "../ip-list-workspace.css";

export default function IpDetailPage() {
  const { ipAddress } = useParams();
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ["ip-list", "detail", ipAddress],
    queryFn: () => fetchIpDetail(ipAddress),
    enabled: Boolean(ipAddress)
  });

  if (detailQuery.isLoading) {
    return (
      <section className="workspace-page ip-list-page ip-list-detail-page">
        <DataStateBlock variant="loading" title="Loading IP" description="Fetching record details." />
      </section>
    );
  }

  const row = detailQuery.data;
  if (detailQuery.error || !row) {
    return (
      <section className="workspace-page ip-list-page ip-list-detail-page">
        <DataStateBlock
          variant="error"
          title="IP address not found"
          description={detailQuery.error?.message ?? "This IP has no asset or manual record."}
          actionLabel="Back to IP list"
          onAction={() => navigate("/ip-list")}
        />
      </section>
    );
  }

  const hostname = getRowHostname(row);

  return (
    <section className="workspace-page ip-list-page ip-list-detail-page">
      <WorkspacePageHeader
        eyebrow="IP List"
        title={row.ipAddress}
        description={hostname ? `Owned by ${hostname}` : undefined}
        actions={(
          <Link className="workspace-inline-link ip-list-back" to="/ip-list">
            <BackIcon /> Back to IP list
          </Link>
        )}
      />

      <IpDetailBody
        row={row}
        variant="page"
        onDeleted={() => navigate("/ip-list")}
      />
    </section>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
