import { NavLink } from 'react-router-dom';

const LINKS = [
    { to: '/maintenance', label: 'Dashboard', end: true },
    { to: '/maintenance/schedule', label: 'Schedule' },
    { to: '/maintenance/my-tasks', label: 'My Tasks' },
    { to: '/maintenance/history', label: 'History' },
    { to: '/maintenance/config', label: 'Configuration' }
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
