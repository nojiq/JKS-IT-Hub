import { createBrowserRouter } from "react-router-dom";
import App from "../app.jsx";
import HomePage from "../features/users/home-page.jsx";
import LoginPage from "../features/users/login-page.jsx";
import UserDetailPage from "../features/users/user-detail-page.jsx";
import UsersListPage from "../features/users/users-list-page.jsx";
import TemplateList from "../features/credentials/templates/TemplateList.jsx";
import TemplateEditor from "../features/credentials/templates/TemplateEditor.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "users", element: <UsersListPage /> },
      { path: "users/:id", element: <UserDetailPage /> },
      { path: "credential-templates", element: <TemplateList /> },
      { path: "credential-templates/new", element: <TemplateEditor /> },
      { path: "credential-templates/:id/edit", element: <TemplateEditor /> }
    ]
  }
]);
