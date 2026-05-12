import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { fetchAllRequests } from "../api/requestsApi.js";
import { WorkspacePanel } from "../../../shared/workspace/WorkspacePanel";
import "./RequestsHomePage.css";

import { DEV_ROLE } from "../../../shared/auth/workspaceRoles.js";

const getTotal = (payload) => Number(payload?.meta?.total ?? payload?.data?.length ?? 0);

export default function RequestsHomePage() {
  const { user } = useOutletContext() ?? {};
  const isDevUser = user?.role === DEV_ROLE;
  const showApprovals = isDevUser;

  const needsReviewQuery = useQuery({
    queryKey: ["requests", "overview", { status: "SUBMITTED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "SUBMITTED", page: "1", perPage: "5" }),
    enabled: isDevUser,
    retry: false
  });

  const approvalsQuery = useQuery({
    queryKey: ["requests", "overview", { status: "IT_REVIEWED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "IT_REVIEWED", page: "1", perPage: "5" }),
    enabled: showApprovals,
    retry: false
  });

  const blockedQuery = useQuery({
    queryKey: ["requests", "overview", { status: "REJECTED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "REJECTED", page: "1", perPage: "5" }),
    enabled: isDevUser,
    retry: false
  });

  const completedQuery = useQuery({
    queryKey: ["requests", "overview", { status: "APPROVED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "APPROVED", page: "1", perPage: "5" }),
    enabled: isDevUser,
    retry: false
  });

  const cards = [
    {
      title: "Needs Review",
      value: getTotal(needsReviewQuery.data),
      description: "Submitted requests waiting for IT review.",
      actionLabel: "Open review queue",
      actionTo: "/requests/review"
    },
    {
      title: "Waiting for Approval",
      value: getTotal(approvalsQuery.data),
      description: showApprovals
        ? "Requests already reviewed by IT and ready for approval."
        : "Approval routing is limited to the developer role.",
      actionLabel: showApprovals ? "Open approvals" : "Open review queue",
      actionTo: showApprovals ? "/requests/approvals" : "/requests/review"
    },
    {
      title: "Blocked",
      value: getTotal(blockedQuery.data),
      description: "Rejected or otherwise blocked requests that need follow-up.",
      actionLabel: "Review blocked items",
      actionTo: "/requests/review"
    },
    {
      title: "Recently Completed",
      value: getTotal(completedQuery.data),
      description: "Approved requests that have recently cleared the workflow.",
      actionLabel: "Review completed items",
      actionTo: "/requests/review"
    }
  ];

  return (
    <section className="requests-home-page">
      <div className="requests-overview-grid">
        {cards.map((card) => (
          <WorkspacePanel
            key={card.title}
            variant="content"
            className="requests-overview-card"
            title={card.title}
            meta={card.description}
            actions={
              <Link className="workspace-inline-link" to={card.actionTo}>
                {card.actionLabel}
              </Link>
            }
          >
            <p className="requests-overview-value">{card.value}</p>
          </WorkspacePanel>
        ))}
      </div>
    </section>
  );
}
