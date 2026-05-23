import { Link } from "react-router-dom";
import { WorkspacePageHeader } from "../../../shared/workspace/WorkspacePageHeader.jsx";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel.jsx";
import { SubnetRulesManager } from "../components/SubnetRulesManager.jsx";
import "../ip-list-workspace.css";

export default function SubnetsPage() {
  return (
    <section className="workspace-page ip-list-page ip-list-subnets-page">
      <WorkspacePageHeader
        eyebrow="IP List"
        title="Subnet rules"
        description="Define CIDR ranges and purposes so known IPs group correctly on the inventory list."
        actions={(
          <Link className="workspace-inline-link ip-list-back" to="/ip-list">
            <BackIcon />
            Back to IP list
          </Link>
        )}
      />

      <WorkspacePanel variant="content" className="ip-list-subnets-panel">
        <SubnetRulesManager />
      </WorkspacePanel>
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
