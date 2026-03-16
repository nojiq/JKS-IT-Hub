import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchSession, logout } from "../../features/users/auth-api";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";
import { ThemeToggle } from "../ui/ThemeToggle/ThemeToggle";
import { DataStateBlock } from "./DataStateBlock";
import "./workspace.css";

const IT_ROLES = ["it", "admin", "head_it"];
const AUDIT_ROLES = ["admin", "head_it"];
const ONBOARDING_CHILDREN = [
  { label: "Catalog", to: "/onboarding/catalog", matchPrefix: "/onboarding/catalog" },
  { label: "Defaults", to: "/onboarding/defaults", matchPrefix: "/onboarding/defaults" },
  { label: "New Joiner", to: "/onboarding/new-joiner", matchPrefix: "/onboarding/new-joiner" }
];

const hasRole = (role, allowedRoles) => {
  if (!allowedRoles) {
    return true;
  }
  return allowedRoles.includes(role);
};

const userFromSession = (session) => {
  if (!session) {
    return null;
  }
  return session.user ?? session;
};

const initialsFor = (username) => {
  if (!username) {
    return "NA";
  }
  return username
    .split(/[._\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
};

export function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    refetchOnWindowFocus: false
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
      queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/login", { replace: true });
    }
  });

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (sessionQuery.isLoading) {
    return (
      <main className="workspace-body">
        <DataStateBlock
          variant="loading"
          title="Loading workspace"
          description="Verifying your session."
        />
      </main>
    );
  }

  if (sessionQuery.error) {
    return (
      <main className="workspace-body">
        <DataStateBlock
          variant="error"
          title="Unable to load workspace"
          description={sessionQuery.error?.message || "Please reload the page and try again."}
          actionLabel="Retry"
          onAction={() => sessionQuery.refetch()}
        />
      </main>
    );
  }

  const user = userFromSession(sessionQuery.data);

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  const requestsPath = IT_ROLES.includes(user.role) ? "/requests/review" : "/requests/my-requests";
  const maintenancePath = IT_ROLES.includes(user.role) ? "/maintenance/schedule" : "/maintenance/my-tasks";
  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");

  const navItems = [
    { label: "Dashboard", to: "/" },
    { label: "Users", to: "/users" },
    { label: "Requests", to: requestsPath },
    { label: "Admin Review", to: "/admin/requests/review", roles: AUDIT_ROLES },
    { label: "Approvals", to: "/admin/approvals", roles: AUDIT_ROLES },
    { label: "Onboarding", to: "/onboarding", roles: IT_ROLES },
    { label: "Maintenance", to: maintenancePath, roles: IT_ROLES },
    { label: "Systems", to: "/systems", roles: IT_ROLES },
    { label: "Audit", to: "/audit-logs", roles: AUDIT_ROLES }
  ];

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) {
      return;
    }

    navigate(`/users?search=${encodeURIComponent(query)}`);
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="Workspace sections">
        <div className="workspace-brand">
          <span className="workspace-brand-mark">IT</span>
          <strong className="workspace-brand-name">Hub Workspace</strong>
          <p className="workspace-brand-subtitle">Desktop operations shell</p>
        </div>

        <nav className="workspace-nav">
          {navItems
            .filter((item) => hasRole(user.role, item.roles))
            .map((item) => {
              const showChildren = item.to === "/onboarding" && isOnboardingRoute;

              return (
                <div key={item.to} className="workspace-nav-item">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `workspace-nav-link${isActive ? " is-active" : ""}`
                    }
                  >
                    <span>{item.label}</span>
                  </NavLink>

                  {showChildren ? (
                    <div className="workspace-nav-children" aria-label="Onboarding sections">
                      {ONBOARDING_CHILDREN.map((child) => {
                        const isChildActive =
                          location.pathname === child.to || location.pathname.startsWith(`${child.matchPrefix}/`);

                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={`workspace-subnav-link${isChildActive ? " is-active" : ""}`}
                          >
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
        </nav>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <form className="workspace-topbar-search" onSubmit={handleSearchSubmit}>
            <input
              className="workspace-topbar-search-input"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search users"
              aria-label="Search users"
            />
            <button className="workspace-topbar-search-btn" type="submit">
              Search
            </button>
          </form>

          <div className="workspace-topbar-utilities">
            <NotificationBell />
            <ThemeToggle />

            <div className="workspace-user-menu" ref={menuRef}>
              <button
                className="workspace-user-btn"
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="workspace-user-avatar">{initialsFor(user.username)}</span>
                <span>{user.username}</span>
              </button>

              {menuOpen ? (
                <div className="workspace-user-menu-panel" role="menu">
                  <div className="workspace-user-meta">
                    <span className="workspace-user-name">{user.username}</span>
                    <span className="workspace-user-role">{(user.role || "user").replace("_", " ")}</span>
                  </div>

                  <button
                    className="workspace-user-logout"
                    type="button"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? "Signing out" : "Sign out"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="workspace-body">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
