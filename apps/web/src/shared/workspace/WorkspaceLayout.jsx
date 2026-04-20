import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchSession, logout } from "../../features/users/auth-api";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";
import { ThemeToggle } from "../ui/ThemeToggle/ThemeToggle";
import { DataStateBlock } from "./DataStateBlock";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { SidebarCollapseIcon, SidebarMenuIcon, WorkspaceNavIcon } from "./WorkspaceIcons";
import { resolveWorkspaceGroups } from "./workspaceModules";
import "./workspace.css";

const SIDEBAR_STORAGE_KEY = "workspace-sidebar-collapsed";

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
  const isDesktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (isDesktop) {
      setIsDrawerOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
  const resolvedGroups = resolveWorkspaceGroups(user).map((group) => ({
    ...group,
    items: group.items.filter((item) => hasRole(user.role, item.roles))
  }));

  const handleSidebarToggle = () => {
    if (isDesktop) {
      setIsSidebarCollapsed((current) => !current);
      return;
    }

    setIsDrawerOpen((current) => !current);
  };

  return (
    <div className={`workspace-shell${isDesktop ? "" : " is-mobile-shell"}`}>
      {!isDesktop && isDrawerOpen ? (
        <button
          type="button"
          className="workspace-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setIsDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={`workspace-sidebar${isSidebarCollapsed ? " is-collapsed" : ""}${isDrawerOpen ? " is-drawer-open" : ""}`}
        aria-label="Workspace sections"
      >
        <div className="workspace-brand">
          <span className="workspace-brand-mark">ITH</span>
          <strong className="workspace-brand-name">IT Hub</strong>
          {isSidebarCollapsed ? null : <p className="workspace-brand-subtitle">IT Operations Console</p>}
        </div>

        <nav className="workspace-nav">
          {resolvedGroups.map((group) => (
            <section key={group.id} className="workspace-nav-group" aria-label={group.label}>
              <p className="workspace-nav-group-label">{group.label}</p>
              <div className="workspace-nav-group-items">
                {group.items.map((item) => {
                  return (
                    <div key={item.id} className="workspace-nav-item">
                      <NavLink
                        to={item.to}
                        aria-label={item.label}
                        className={({ isActive }) =>
                          `workspace-nav-link${isActive ? " is-active" : ""}`
                        }
                      >
                        <span className="workspace-nav-link-icon" aria-hidden="true">
                          <WorkspaceNavIcon icon={item.icon} className="workspace-nav-icon" />
                        </span>
                        <span className="workspace-nav-link-label">{item.label}</span>
                      </NavLink>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-sidebar-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={isDesktop ? !isSidebarCollapsed : isDrawerOpen}
            onClick={handleSidebarToggle}
          >
            {isDesktop ? (
              <SidebarCollapseIcon className="workspace-sidebar-toggle-icon" collapsed={isSidebarCollapsed} />
            ) : (
              <SidebarMenuIcon className="workspace-sidebar-toggle-icon" />
            )}
          </button>

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
