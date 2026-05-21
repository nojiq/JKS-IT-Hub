import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { fetchAllRequests } from "../api/requestsApi.js";
import "./RequestsHomePage.css";

import { DEV_ROLE } from "../../../shared/auth/workspaceRoles.js";

const getTotal = (payload) => Number(payload?.meta?.total ?? payload?.data?.length ?? 0);
const formatCount = (query) => (query.isLoading && !query.data ? "..." : getTotal(query.data));

export default function RequestsHomePage() {
  const { user } = useOutletContext() ?? {};
  const isDevUser = user?.role === DEV_ROLE;

  const needsReviewQuery = useQuery({
    queryKey: ["requests", "overview", { status: "SUBMITTED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "SUBMITTED", page: "1", perPage: "5" }),
    enabled: isDevUser,
    retry: false
  });

  const approvalsQuery = useQuery({
    queryKey: ["requests", "overview", { status: "IT_REVIEWED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "IT_REVIEWED", page: "1", perPage: "5" }),
    enabled: isDevUser,
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

  const selfServiceCards = [
    {
      title: "Create Request",
      value: "New",
      tone: "info",
      kicker: "Self service",
      description: "Submit a purchase request with the required e-invoice attached.",
      actionLabel: "Start request",
      actionTo: "/requests/new"
    },
    {
      title: "Track My Requests",
      value: "Mine",
      tone: "neutral",
      kicker: "Personal queue",
      description: "Review your submitted requests and follow status changes.",
      actionLabel: "View my requests",
      actionTo: "/requests/my-requests"
    }
  ];

  const operationsCards = [
    {
      title: "Needs Review",
      value: formatCount(needsReviewQuery),
      tone: "review",
      kicker: "Intake",
      description: "Submitted requests waiting for IT review.",
      actionLabel: "Open review queue",
      actionTo: "/requests/review"
    },
    {
      title: "Waiting for Approval",
      value: formatCount(approvalsQuery),
      tone: "approval",
      kicker: "Ready",
      description: "Requests already reviewed by IT and ready for approval.",
      actionLabel: "Open approvals",
      actionTo: "/requests/approvals"
    },
    {
      title: "Blocked",
      value: formatCount(blockedQuery),
      tone: "blocked",
      kicker: "Follow-up",
      description: "Rejected or otherwise blocked requests that need follow-up.",
      actionLabel: "Review blocked items",
      actionTo: "/requests/review"
    },
    {
      title: "Recently Completed",
      value: formatCount(completedQuery),
      tone: "complete",
      kicker: "Closed",
      description: "Approved requests that have recently cleared the workflow.",
      actionLabel: "Review completed items",
      actionTo: "/requests/review"
    }
  ];

  const cards = isDevUser ? operationsCards : selfServiceCards;
  const activeTotal = getTotal(needsReviewQuery.data) + getTotal(approvalsQuery.data) + getTotal(blockedQuery.data);
  const activeTotalValue = [needsReviewQuery, approvalsQuery, blockedQuery].some(
    (query) => query.isLoading && !query.data
  )
    ? "..."
    : activeTotal;
  const overview = isDevUser
    ? {
      title: "Workflow overview",
      description: "Monitor request movement from intake through approval and closure.",
      metric: activeTotalValue,
      metricLabel: "Active items",
      metricMeta: "Across review, approval, and blocked queues"
    }
    : {
      title: "Request center",
      description: "Create purchase requests and follow your submitted items from one place.",
      metric: cards.length,
      metricLabel: "Available actions",
      metricMeta: "Self-service request tools"
    };

  return (
    <section className="requests-home-page">
      <div className="requests-overview-hero">
        <div className="requests-overview-hero-copy">
          <p className="requests-overview-eyebrow">Requests workspace</p>
          <h2>{overview.title}</h2>
          <p>{overview.description}</p>
        </div>
        <div className="requests-overview-summary" aria-label={`${overview.metricLabel}: ${overview.metric}`}>
          <span>{overview.metricLabel}</span>
          <strong>{overview.metric}</strong>
          <span>{overview.metricMeta}</span>
        </div>
      </div>

      <div className={`requests-overview-grid${isDevUser ? "" : " is-self-service"}`}>
        {cards.map((card) => (
          <article
            key={card.title}
            className={`requests-overview-card requests-overview-card--${card.tone}`}
          >
            <div className="requests-overview-card-topline">
              <span className="requests-overview-kicker">{card.kicker}</span>
              <span className="requests-overview-status-dot" aria-hidden="true" />
            </div>
            <div className="requests-overview-card-copy">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
            <div className="requests-overview-card-footer">
              <p className="requests-overview-value">{card.value}</p>
              <Link className="requests-overview-action" to={card.actionTo}>
                {card.actionLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
