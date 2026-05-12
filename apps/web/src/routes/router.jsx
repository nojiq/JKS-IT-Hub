import { createBrowserRouter, Navigate, useOutletContext } from "react-router-dom";
import App from "../app.jsx";
import { RouteErrorPage } from "./RouteErrorPage.jsx";
import { WorkspaceLayout } from "../shared/workspace/WorkspaceLayout";
import HomePage from "../features/users/home-page.jsx";
import LoginPage from "../features/users/login-page.jsx";
import UserDetailPage from "../features/users/user-detail-page.jsx";
import { UsersLayout } from "../features/users/UsersLayout.jsx";
import UsersHomePage from "../features/users/UsersHomePage.jsx";
import UsersListPage from "../features/users/users-list-page.jsx";
import TemplateList from "../features/credentials/templates/TemplateList.jsx";
import TemplateEditor from "../features/credentials/templates/TemplateEditor.jsx";
import { CredentialHistory } from "../features/credentials/history";
import LockedCredentialsList from "../features/credentials/components/LockedCredentialsList.jsx";
import CredentialGeneratorPage from "../features/credentials/credential-generator/CredentialGeneratorPage.jsx";
import AuditLogPage from "../features/audit/audit-log-page.jsx";
import SystemManagementPage from "../features/system-configs/SystemManagementPage.jsx";
import MaintenanceConfigPage from "../features/maintenance/pages/MaintenanceConfigPage.jsx";
import MaintenanceSchedulePage from "../features/maintenance/pages/MaintenanceSchedulePage.jsx";
import MaintenanceWindowDetailPage from "../features/maintenance/pages/MaintenanceWindowDetailPage.jsx";
import MaintenanceHistoryPage from "../features/maintenance/pages/MaintenanceHistoryPage.jsx";
import AssignmentRulesPage from "../features/maintenance/pages/AssignmentRulesPage.jsx";
import MyMaintenanceTasksPage from "../features/maintenance/pages/MyMaintenanceTasksPage.jsx";
import ChecklistManagementPage from "../features/maintenance/pages/ChecklistManagementPage.jsx";
import { MaintenanceLayout } from "../features/maintenance/pages/MaintenanceLayout.jsx";
import MaintenanceHomePage from "../features/maintenance/pages/MaintenanceHomePage.jsx";
import SubmitRequestPage from "../features/requests/pages/SubmitRequestPage.jsx";
import MyRequestsPage from "../features/requests/pages/MyRequestsPage.jsx";
import ReviewRequestsPage from "../features/requests/pages/ReviewRequestsPage.jsx";
import AdminApprovalPage from "../features/requests/pages/AdminApprovalPage.jsx";
import NotificationsPage from "../features/notifications/pages/NotificationsPage.jsx";
import { OnboardingLayout } from "../features/onboarding/OnboardingLayout.jsx";
import { CatalogPage } from "../features/onboarding/pages/CatalogPage.jsx";
import { OnboardingDefaultsPage } from "../features/onboarding/pages/OnboardingDefaultsPage.jsx";
import { OnboardingDefaultsEditor } from "../features/onboarding/pages/OnboardingDefaultsEditor.jsx";
import OnboardingHomePage from "../features/onboarding/pages/OnboardingHomePage.jsx";
import { NewJoinerPage } from "../features/onboarding/pages/NewJoinerPage.jsx";
import { RequestsLayout } from "../features/requests/pages/RequestsLayout.jsx";
import RequestsHomePage from "../features/requests/pages/RequestsHomePage.jsx";
import { RequestsAccessGate } from "../features/requests/pages/RequestsAccessGate.jsx";
import { DEV_ONLY_ROLES } from "../shared/auth/workspaceRoles.js";

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
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <LoginPage /> }]
  },
  {
    path: "/",
    element: <WorkspaceLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "audit-logs", element: <AuditLogPage /> },
      {
        path: "systems",
        element: (
          <RequireRoles roles={DEV_ONLY_ROLES}>
            <SystemManagementPage />
          </RequireRoles>
        )
      },
      {
        path: "maintenance",
        element: <MaintenanceLayout />,
        children: [
          { index: true, element: <MaintenanceHomePage /> },
          { path: "config", element: <MaintenanceConfigPage /> },
          { path: "checklists", element: <ChecklistManagementPage /> },
          { path: "schedule", element: <MaintenanceSchedulePage /> },
          { path: "schedule/:id", element: <MaintenanceWindowDetailPage /> },
          { path: "history", element: <MaintenanceHistoryPage /> },
          { path: "assignment-rules", element: <AssignmentRulesPage /> },
          { path: "my-tasks", element: <MyMaintenanceTasksPage /> }
        ]
      },
      {
        path: "requests",
        element: <RequestsAccessGate />,
        children: [
          {
            element: <RequestsLayout />,
            children: [
              { index: true, element: <RequestsHomePage /> },
              { path: "new", element: <SubmitRequestPage /> },
              { path: "my-requests", element: <MyRequestsPage /> },
              { path: ":id", element: <MyRequestsPage /> },
              { path: "review", element: <ReviewRequestsPage /> },
              {
                path: "approvals",
                element: (
                  <RequireRoles roles={DEV_ONLY_ROLES}>
                    <AdminApprovalPage />
                  </RequireRoles>
                )
              }
            ]
          }
        ]
      },
      {
        path: "onboarding",
        element: <OnboardingLayout />,
        children: [
          { index: true, element: <OnboardingHomePage /> },
          { path: "catalog", element: <CatalogPage /> },
          { path: "defaults", element: <OnboardingDefaultsPage /> },
          { path: "defaults/new", element: <OnboardingDefaultsEditor /> },
          { path: "defaults/:id/edit", element: <OnboardingDefaultsEditor /> },
          { path: "new-joiner", element: <NewJoinerPage /> }
        ]
      },
      {
        path: "users",
        element: <UsersLayout />,
        children: [
          { index: true, element: <UsersHomePage /> },
          { path: "directory", element: <UsersListPage /> },
          { path: "imap-generator", element: <CredentialGeneratorPage /> },
          { path: "credential-generator", element: <CredentialGeneratorPage /> },
          { path: "locked", element: <LockedCredentialsList /> },
          { path: "history", element: <CredentialHistory /> },
          { path: ":id", element: <UserDetailPage /> },
          { path: ":userId/credentials/history", element: <CredentialHistory /> }
        ]
      },
      { path: "credential-templates", element: <TemplateList /> },
      { path: "credentials/locked", element: <Navigate replace to="/users/locked" /> },
      { path: "credential-templates/new", element: <TemplateEditor /> },
      { path: "credential-templates/:id/edit", element: <TemplateEditor /> },
      {
        path: "admin/requests/review",
        element: <Navigate replace to="/requests/review" />
      },
      {
        path: "admin/approvals",
        element: <Navigate replace to="/requests/approvals" />
      },
      { path: "notifications", element: <NotificationsPage /> }
    ]
  }
]);
