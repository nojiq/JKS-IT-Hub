import { NavLink, useOutletContext } from 'react-router-dom';
import { isMaintenanceAdmin } from '../utils/maintenanceTerminology.js';

const LINKS = [
    { to: '/maintenance', label: 'Dashboard', end: true },
    { to: '/maintenance/history', label: 'History' },
    { to: '/maintenance/assignments', label: 'Assignments', adminOnly: true },
    { to: '/maintenance/policies', label: 'Policies & Checklists', adminOnly: true }
];

export function MaintenanceSubnav() {
    const { user } = useOutletContext() ?? {};
    const showAdmin = isMaintenanceAdmin(user);
    const links = LINKS.filter((link) => !link.adminOnly || showAdmin);

    return (
        <nav className="maintenance-subnav" aria-label="Maintenance sections">
            {links.map((link) => (
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
