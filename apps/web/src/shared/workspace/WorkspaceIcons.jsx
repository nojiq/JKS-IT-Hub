export function SidebarMenuIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SidebarCollapseIcon({ className, collapsed = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 5V19" stroke="currentColor" strokeWidth="1.6" />
      {collapsed ? (
        <path d="M13 12H17M15 10L17 12L15 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M17 12H13M15 10L13 12L15 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function WorkspaceTileIcon({ className, children }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function WorkspaceNavIcon({ icon, className }) {
  switch (icon) {
    case "dashboard":
      return (
        <WorkspaceTileIcon className={className}>
          <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13" y="4.5" width="6.5" height="10.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13" y="17" width="6.5" height="2.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
        </WorkspaceTileIcon>
      );
    case "requests":
      return (
        <WorkspaceTileIcon className={className}>
          <path d="M7 5.5H17L19 7.5V18.5H7V5.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M17 5.5V8H19" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9.5 11H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M9.5 14.5H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M4.5 9.5V18.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "onboarding":
      return (
        <WorkspaceTileIcon className={className}>
          <path d="M5 7.5L12 4L19 7.5L12 11L5 7.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M7.5 9.5V15.5L12 18L16.5 15.5V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12 11V18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "users":
      return (
        <WorkspaceTileIcon className={className}>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4.5 18C5.3 15.7 7 14.5 9 14.5C11 14.5 12.7 15.7 13.5 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="16.5" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M14.5 18C15 16.4 16.1 15.6 17.5 15.4C18.8 15.2 20.1 15.8 21 17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "maintenance":
      return (
        <WorkspaceTileIcon className={className}>
          <path d="M13.5 5.5L18.5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7.2 17.8L4.8 19.2L6.2 16.8L14.8 8.2L15.8 9.2L16.8 10.2L7.2 17.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M14.8 8.2L16.8 6.2C17.6 5.4 18.9 5.4 19.7 6.2C20.5 7 20.5 8.3 19.7 9.1L17.7 11.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "systems":
      return (
        <WorkspaceTileIcon className={className}>
          <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 5V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12 17V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M5 12H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M17 12H19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7.2 7.2L8.6 8.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M15.4 15.4L16.8 16.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7.2 16.8L8.6 15.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M15.4 8.6L16.8 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "approvals":
      return (
        <WorkspaceTileIcon className={className}>
          <rect x="5" y="4.5" width="14" height="15" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 9.5L10.6 11.6L15.5 6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 15H15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    case "audit":
      return (
        <WorkspaceTileIcon className={className}>
          <path d="M7 5.5H17V18.5H7V5.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9.5 9.5H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M9.5 13H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M9.5 16.5H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </WorkspaceTileIcon>
      );
    default:
      return null;
  }
}
