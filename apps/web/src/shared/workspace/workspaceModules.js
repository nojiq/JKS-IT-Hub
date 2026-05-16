import { ADMIN_NAV_ROLES, DEV_ONLY_ROLES, IT_STAFF_ROLES } from "../auth/workspaceRoles.js";

const IT_ROLES = IT_STAFF_ROLES;
const ADMIN_ROLES = ADMIN_NAV_ROLES;

export const workspaceGroups = [
  {
    id: "core",
    label: "Core Operations",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard", to: "/" },
      {
        id: "requests",
        label: "Requests",
        icon: "requests",
        to: "/requests",
        roles: DEV_ONLY_ROLES,
        launcherPriority: 1,
        launcherDescription: "Review purchase requests, move approvals forward, and resolve blocked items.",
        launcherActionLabel: "Open Requests",
        children: [
          { label: "Overview", to: "/requests" },
          {
            label: "My Requests",
            to: "/requests/my-requests",
            matches: (pathname) => {
              if (pathname === "/requests/my-requests") return true;
              const detailMatch = pathname.match(/^\/requests\/([^/]+)$/);
              const excluded = new Set(["new", "my-requests", "review", "approvals"]);
              return !!detailMatch && !excluded.has(detailMatch[1]);
            }
          },
          { label: "Review Queue", to: "/requests/review" },
          { label: "Approvals", to: "/requests/approvals", roles: DEV_ONLY_ROLES }
        ]
      },
      {
        id: "onboarding",
        label: "Onboarding",
        icon: "onboarding",
        to: "/onboarding",
        launcherPriority: 2,
        launcherDescription: "Prepare access, assign defaults, and generate credentials for new joiners.",
        launcherActionLabel: "Open Onboarding",
        children: [
          { label: "Overview", to: "/onboarding" },
          { label: "New Joiner", to: "/onboarding/new-joiner" },
          { label: "Defaults", to: "/onboarding/defaults" },
          { label: "Catalog", to: "/onboarding/catalog" }
        ]
      },
      {
        id: "assets",
        label: "Assets",
        icon: "assets",
        to: "/assets",
        launcherPriority: 5,
        launcherDescription: "Browse hardware inventory synced from Snipe-IT and review user assignments.",
        launcherActionLabel: "Open Assets"
      },
      {
        id: "users",
        label: "Users & Credentials",
        icon: "users",
        to: "/users",
        roles: IT_ROLES,
        launcherPriority: 3,
        launcherDescription: "Manage user status, passwords, and generated access details.",
        launcherActionLabel: "Open Users & Credentials",
        children: [
          { label: "Overview", to: "/users" },
          { label: "Directory", to: "/users/directory" },
          { label: "Credential Generator", to: "/users/credential-generator" },
          { label: "History", to: "/users/history" }
        ]
      },
      {
        id: "maintenance",
        label: "Maintenance",
        icon: "maintenance",
        to: "/maintenance",
        roles: DEV_ONLY_ROLES,
        launcherPriority: 4,
        launcherDescription: "Schedule preventive work, assign tasks, and close overdue actions.",
        launcherActionLabel: "Open Maintenance",
        children: [
          { label: "Dashboard", to: "/maintenance" },
          { label: "History", to: "/maintenance/history" },
          { label: "Assignments", to: "/maintenance/assignments" },
          { label: "Policies & Checklists", to: "/maintenance/policies" }
        ]
      }
    ]
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { id: "systems", label: "Systems", icon: "systems", to: "/systems", roles: DEV_ONLY_ROLES },
      { id: "approvals", label: "Approvals", icon: "approvals", to: "/requests/approvals", roles: DEV_ONLY_ROLES },
      { id: "audit", label: "Audit", icon: "audit", to: "/audit-logs", roles: ADMIN_ROLES }
    ]
  }
];

export function resolveWorkspaceGroups(user) {
  return workspaceGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.roles || item.roles.includes(user?.role))
        .map((item) => ({
          ...item,
          to: typeof item.to === "function" ? item.to(user ?? {}) : item.to,
          children: item.children
            ? item.children.filter((child) => !child.roles || child.roles.includes(user?.role))
            : undefined
        }))
    }))
    .filter((group) => group.items.length > 0);
}

export function resolveLauncherModules(user) {
  return resolveWorkspaceGroups(user)
    .flatMap((group) => group.items)
    .filter((item) => typeof item.launcherPriority === "number")
    .sort((left, right) => left.launcherPriority - right.launcherPriority);
}
