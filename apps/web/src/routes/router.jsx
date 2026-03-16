import { createBrowserRouter, Navigate, useOutletContext } from "react-router-dom";
import App from "../app.jsx";
import { WorkspaceLayout } from "../shared/workspace/WorkspaceLayout";
import HomePage from "../features/users/home-page.jsx";
import LoginPage from "../features/users/login-page.jsx";
import UserDetailPage from "../features/users/user-detail-page.jsx";
import UsersListPage from "../features/users/users-list-page.jsx";
import TemplateList from "../features/credentials/templates/TemplateList.jsx";
import TemplateEditor from "../features/credentials/templates/TemplateEditor.jsx";
import { CredentialHistory } from "../features/credentials/history";
import LockedCredentialsList from "../features/credentials/components/LockedCredentialsList.jsx";
import AuditLogPage from "../features/audit/audit-log-page.jsx";
import SystemManagementPage from "../features/system-configs/SystemManagementPage.jsx";
import MaintenanceConfigPage from "../features/maintenance/pages/MaintenanceConfigPage.jsx";
import MaintenanceSchedulePage from "../features/maintenance/pages/MaintenanceSchedulePage.jsx";
import MaintenanceWindowDetailPage from "../features/maintenance/pages/MaintenanceWindowDetailPage.jsx";
import MaintenanceHistoryPage from "../features/maintenance/pages/MaintenanceHistoryPage.jsx";
import AssignmentRulesPage from "../features/maintenance/pages/AssignmentRulesPage.jsx";
import MyMaintenanceTasksPage from "../features/maintenance/pages/MyMaintenanceTasksPage.jsx";
import ChecklistManagementPage from "../features/maintenance/pages/ChecklistManagementPage.jsx";
import SubmitRequestPage from "../features/requests/pages/SubmitRequestPage.jsx";
import MyRequestsPage from "../features/requests/pages/MyRequestsPage.jsx";
import ReviewRequestsPage from "../features/requests/pages/ReviewRequestsPage.jsx";
import AdminApprovalPage from "../features/requests/pages/AdminApprovalPage.jsx";
import NotificationsPage from "../features/notifications/pages/NotificationsPage.jsx";
import { OnboardingLayout } from "../features/onboarding/OnboardingLayout.jsx";
import { CatalogPage } from "../features/onboarding/pages/CatalogPage.jsx";
import { OnboardingDefaultsPage } from "../features/onboarding/pages/OnboardingDefaultsPage.jsx";
import { OnboardingDefaultsEditor } from "../features/onboarding/pages/OnboardingDefaultsEditor.jsx";
import { NewJoinerPage } from "../features/onboarding/pages/NewJoinerPage.jsx";

const ADMIN_ROLES = ["admin", "head_it"];

const RequireRoles = ({ roles, children }) => {
  const { user } = useOutletContext() ?? {};

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <App />,
    children: [{ index: true, element: <LoginPage /> }]
  },
  {
    path: "/",
    element: <WorkspaceLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "users", element: <UsersListPage /> },
      { path: "users/:id", element: <UserDetailPage /> },
      { path: "users/:userId/credentials/history", element: <CredentialHistory /> },
      { path: "audit-logs", element: <AuditLogPage /> },
      { path: "systems", element: <SystemManagementPage /> },
      { path: "maintenance/config", element: <MaintenanceConfigPage /> },
      { path: "maintenance/checklists", element: <ChecklistManagementPage /> },
      { path: "maintenance/schedule", element: <MaintenanceSchedulePage /> },
      { path: "maintenance/schedule/:id", element: <MaintenanceWindowDetailPage /> },
      { path: "maintenance/history", element: <MaintenanceHistoryPage /> },
      { path: "maintenance/assignment-rules", element: <AssignmentRulesPage /> },
      { path: "maintenance/my-tasks", element: <MyMaintenanceTasksPage /> },
      {
        path: "onboarding",
        element: <OnboardingLayout />,
        children: [
          { index: true, element: <Navigate replace to="new-joiner" /> },
          { path: "catalog", element: <CatalogPage /> },
          { path: "defaults", element: <OnboardingDefaultsPage /> },
          { path: "defaults/new", element: <OnboardingDefaultsEditor /> },
          { path: "defaults/:id/edit", element: <OnboardingDefaultsEditor /> },
          { path: "new-joiner", element: <NewJoinerPage /> }
        ]
      },
      { path: "credential-templates", element: <TemplateList /> },
      { path: "credentials/locked", element: <LockedCredentialsList /> },
      { path: "credential-templates/new", element: <TemplateEditor /> },
      { path: "credential-templates/:id/edit", element: <TemplateEditor /> },
      { path: "requests/new", element: <SubmitRequestPage /> },
      { path: "requests/my-requests", element: <MyRequestsPage /> },
      { path: "requests/:id", element: <MyRequestsPage /> },
      { path: "requests/review", element: <ReviewRequestsPage /> },
      {
        path: "admin/requests/review",
        element: (
          <RequireRoles roles={ADMIN_ROLES}>
            <ReviewRequestsPage />
          </RequireRoles>
        )
      },
      {
        path: "admin/approvals",
        element: (
          <RequireRoles roles={ADMIN_ROLES}>
            <AdminApprovalPage />
          </RequireRoles>
        )
      },
      { path: "notifications", element: <NotificationsPage /> }
    ]
  }
]);
