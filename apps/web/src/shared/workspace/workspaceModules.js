const IT_ROLES = ["it", "admin", "head_it"];
const ADMIN_ROLES = ["admin", "head_it"];

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
        launcherPriority: 1,
        launcherDescription: "Review purchase requests, move approvals forward, and resolve blocked items.",
        launcherActionLabel: "Open Requests"
      },
      {
        id: "onboarding",
        label: "Onboarding",
        icon: "onboarding",
        to: "/onboarding",
        roles: IT_ROLES,
        launcherPriority: 2,
        launcherDescription: "Prepare access, assign defaults, and generate credentials for new joiners.",
        launcherActionLabel: "Open Onboarding"
      },
      {
        id: "users",
        label: "Users & Credentials",
        icon: "users",
        to: "/users",
        roles: IT_ROLES,
        launcherPriority: 3,
        launcherDescription: "Manage user status, passwords, and generated access details.",
        launcherActionLabel: "Open Users & Credentials"
      },
      {
        id: "maintenance",
        label: "Maintenance",
        icon: "maintenance",
        to: "/maintenance",
        roles: IT_ROLES,
        launcherPriority: 4,
        launcherDescription: "Schedule preventive work, assign tasks, and close overdue actions.",
        launcherActionLabel: "Open Maintenance"
      }
    ]
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { id: "systems", label: "Systems", icon: "systems", to: "/systems", roles: IT_ROLES },
      { id: "approvals", label: "Approvals", icon: "approvals", to: "/requests/approvals", roles: ADMIN_ROLES },
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
          to: typeof item.to === "function" ? item.to(user ?? {}) : item.to
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
