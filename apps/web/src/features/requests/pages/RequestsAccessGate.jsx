import { Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";

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
 * Other authenticated users: only submit flow and own request detail paths.
 */
export function RequestsAccessGate() {
  const { user } = useOutletContext() ?? {};
  const { pathname } = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "dev") {
    return <Outlet context={{ user }} />;
  }

  if (pathname === "/requests/new" || pathname === "/requests/my-requests") {
    return <Outlet context={{ user }} />;
  }

  if (isRequestDetailPath(pathname)) {
    return <Outlet context={{ user }} />;
  }

  return <Navigate to="/" replace />;
}
