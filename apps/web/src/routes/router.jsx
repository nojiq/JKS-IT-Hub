import { createBrowserRouter } from "react-router-dom";
import App from "../app.jsx";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "users", element: <UsersListPage /> },
      { path: "users/:id", element: <UserDetailPage /> },
      { path: "users/:userId/credentials/history", element: <CredentialHistory /> },
      { path: "audit-logs", element: <AuditLogPage /> },
      { path: "systems", element: <SystemManagementPage /> },
      { path: "credential-templates", element: <TemplateList /> },
      { path: "credentials/locked", element: <LockedCredentialsList /> },
      { path: "credential-templates/new", element: <TemplateEditor /> },
      { path: "credential-templates/:id/edit", element: <TemplateEditor /> }
    ]
  }
]);
