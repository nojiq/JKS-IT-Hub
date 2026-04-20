import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { fetchWindows } from "../maintenance/api/maintenanceApi.js";
import { fetchAllRequests } from "../requests/api/requestsApi.js";
import { WorkspacePageHeader } from "../../shared/workspace/WorkspacePageHeader.jsx";
import { ModuleLauncherCard } from "../../shared/workspace/ModuleLauncherCard.jsx";
import { resolveLauncherModules } from "../../shared/workspace/workspaceModules.js";
import { fetchUsers } from "./users-api.js";
import "../../shared/workspace/workspace.css";

const ADMIN_ROLES = ["admin", "head_it"];
const EMPTY_USERS = [];
const EMPTY_REQUESTS = [];
const EMPTY_WINDOWS = [];

const formatRoleLabel = (role) =>
  String(role || "user")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());

const getListItems = (payload) => payload?.data ?? EMPTY_REQUESTS;
const getListTotal = (payload) => Number(payload?.meta?.total ?? getListItems(payload).length ?? 0);

export default function HomePage() {
  const { user } = useOutletContext() ?? {};

  if (!user) {
    return null;
  }

  const isAdminUser = ADMIN_ROLES.includes(user.role);
  const launcherModules = resolveLauncherModules(user);

  const usersQuery = useQuery({
    queryKey: ["users", { page: "1", perPage: "100" }],
    queryFn: () => fetchUsers({ page: "1", perPage: "100" }),
    retry: false
  });

  const requestsReviewQuery = useQuery({
    queryKey: ["requests", "review-home", { status: "SUBMITTED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "SUBMITTED", page: "1", perPage: "5" }),
    retry: false
  });

  const requestsApprovalQuery = useQuery({
    queryKey: ["requests", "approval-home", { status: "IT_REVIEWED", page: "1", perPage: "5" }],
    queryFn: () => fetchAllRequests({ status: "IT_REVIEWED", page: "1", perPage: "5" }),
    enabled: isAdminUser,
    retry: false
  });

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance", "windows", "module-launcher"],
    queryFn: () => fetchWindows({ page: "1", perPage: "20", status: ["SCHEDULED", "UPCOMING", "OVERDUE"] }),
    retry: false
  });

  const users = usersQuery.data?.users ?? EMPTY_USERS;
  const totalUsers = Number(usersQuery.data?.meta?.total ?? users.length ?? 0);
  const disabledUsers = users.filter((entry) => String(entry.status).toLowerCase() === "disabled").length;
  const requestReviewCount = getListTotal(requestsReviewQuery.data);
  const requestApprovalCount = getListTotal(requestsApprovalQuery.data);
  const maintenanceItems = getListItems(maintenanceQuery.data) ?? EMPTY_WINDOWS;
  const upcomingMaintenance = maintenanceItems.filter((entry) => entry.status === "UPCOMING").length;
  const overdueMaintenance = maintenanceItems.filter((entry) => entry.status === "OVERDUE").length;

  const metricsByModule = {
    requests: [
      { value: String(requestReviewCount), label: "need IT review" },
      { value: String(requestApprovalCount), label: "waiting for approval" }
    ],
    onboarding: [],
    users: [
      { value: String(totalUsers), label: "total users" },
      { value: String(disabledUsers), label: "disabled" }
    ],
    maintenance: [
      { value: String(overdueMaintenance), label: "overdue" },
      { value: String(upcomingMaintenance), label: "upcoming" }
    ]
  };

  const descriptionOverrides = {
    onboarding: "Start a new joiner setup or manage defaults."
  };

  return (
    <section className="workspace-page dashboard-page">
      <WorkspacePageHeader
        title="Operations"
        description="Choose a workflow to continue. Each module owns its own search, filters, and next-step context."
        meta={`${formatRoleLabel(user.role)} workspace`}
      />

      <section className="workspace-module-launcher-grid" aria-label="Operations modules">
        {launcherModules.map((module) => (
          <ModuleLauncherCard
            key={module.id}
            actionLabel={module.launcherActionLabel}
            description={descriptionOverrides[module.id] ?? module.launcherDescription}
            icon={module.icon}
            metrics={metricsByModule[module.id] ?? []}
            title={module.label}
            to={module.to}
          />
        ))}
      </section>
    </section>
  );
}
