import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { APP_ACCESS_ROLES } from "../../../shared/auth/workspaceRoles.js";

const RESERVED_SEGMENTS = new Set(["new", "my-requests", "review", "approvals"]);

function isRequestDetailPath(pathname) {
  const match = pathname.match(/^\/requests\/([^/]+)$/);
  if (!match) {
    return false;
  }
  return !RESERVED_SEGMENTS.has(match[1]);
}

/**
 * Dev role: full Requests module (overview, review, approvals).
 * Other authenticated users: overview, submit flow, and own request detail paths.
 */
export function RequestsAccessGate() {
  const { user } = useOutletContext() ?? {};
  const { pathname } = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (APP_ACCESS_ROLES.includes(user.role)) {
    return <Outlet context={{ user }} />;
  }

  if (user.role === "user") {
    return <Navigate to="/" replace />;
  }

  if (pathname === "/requests" || pathname === "/requests/new" || pathname === "/requests/my-requests") {
    return <Outlet context={{ user }} />;
  }

  if (isRequestDetailPath(pathname)) {
    return <Outlet context={{ user }} />;
  }

  return <Navigate to="/" replace />;
}
