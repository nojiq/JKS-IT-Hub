import { NavLink } from 'react-router-dom';

/** Order aligned with `workspaceModules` Maintenance children */
const LINKS = [
    { to: '/maintenance', label: 'Overview', end: true },
    { to: '/maintenance/schedule', label: 'Schedule' },
    { to: '/maintenance/my-tasks', label: 'My Tasks' },
    { to: '/maintenance/history', label: 'History' },
    { to: '/maintenance/config', label: 'Configuration' },
    { to: '/maintenance/assignment-rules', label: 'Rules' },
    { to: '/maintenance/checklists', label: 'Checklists' }
];

export function MaintenanceSubnav() {
    return (
        <nav className="maintenance-subnav" aria-label="Maintenance sections">
            {LINKS.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                >
                    {link.label}
                </NavLink>
            ))}
        </nav>
    );
}
