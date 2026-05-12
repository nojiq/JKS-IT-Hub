import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WorkspaceModuleTabs } from '../src/shared/workspace/WorkspaceModuleTabs.jsx';

const requestsItems = [
    { label: 'Overview', to: '/requests' },
    {
        label: 'My Requests',
        to: '/requests/my-requests',
        matches: (pathname) => {
            if (pathname === '/requests/my-requests') {
                return true;
            }

            const detailMatch = pathname.match(/^\/requests\/([^/]+)$/);
            return !!detailMatch && !['new', 'my-requests', 'review', 'approvals'].includes(detailMatch[1]);
        }
    },
    { label: 'Review Queue', to: '/requests/review' },
    { label: 'Approvals', to: '/requests/approvals' }
];

const usersItems = [
    { label: 'Overview', to: '/users' },
    { label: 'Directory', to: '/users/directory' },
    { label: 'History', to: '/users/history' }
];

const onboardingItems = [
    { label: 'Overview', to: '/onboarding' },
    { label: 'New Joiner', to: '/onboarding/new-joiner' },
    { label: 'Defaults', to: '/onboarding/defaults' },
    { label: 'Catalog', to: '/onboarding/catalog' }
];

const maintenanceItems = [
    { label: 'Overview', to: '/maintenance' },
    { label: 'Schedule', to: '/maintenance/schedule' },
    { label: 'My Tasks', to: '/maintenance/my-tasks' },
    { label: 'History', to: '/maintenance/history' },
    { label: 'Config', to: '/maintenance/config' },
    { label: 'Rules', to: '/maintenance/assignment-rules' },
    { label: 'Checklists', to: '/maintenance/checklists' }
];

function renderTabs(initialEntry, items) {
    const router = createMemoryRouter([
        {
            path: '*',
            element: <WorkspaceModuleTabs items={items} ariaLabel="Module sections" />
        }
    ], {
        initialEntries: [initialEntry]
    });

    render(<RouterProvider router={router} />);
}

function expectOnlyActiveLink(name) {
    const activeLinks = screen.getAllByRole('link', { current: 'page' });
    expect(activeLinks).toHaveLength(1);
    expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
}

describe('WorkspaceModuleTabs', () => {
    it('renders a navigation landmark with links and no ARIA tab widget semantics', () => {
        renderTabs('/requests', requestsItems);

        expect(screen.getByRole('navigation', { name: /sections/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'My Requests' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Review Queue' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Approvals' })).toBeInTheDocument();
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });

    it.each([
        ['/requests', requestsItems, 'Overview'],
        ['/requests/my-requests', requestsItems, 'My Requests'],
        ['/requests/123', requestsItems, 'My Requests'],
        ['/requests/review', requestsItems, 'Review Queue'],
        ['/requests/approvals', requestsItems, 'Approvals'],
        ['/users', usersItems, 'Overview'],
        ['/users/directory', usersItems, 'Directory'],
        ['/users/history', usersItems, 'History'],
        ['/onboarding', onboardingItems, 'Overview'],
        ['/onboarding/new-joiner', onboardingItems, 'New Joiner'],
        ['/onboarding/defaults', onboardingItems, 'Defaults'],
        ['/onboarding/defaults/new', onboardingItems, 'Defaults'],
        ['/onboarding/defaults/abc/edit', onboardingItems, 'Defaults'],
        ['/onboarding/catalog', onboardingItems, 'Catalog'],
        ['/maintenance', maintenanceItems, 'Overview'],
        ['/maintenance/schedule', maintenanceItems, 'Schedule'],
        ['/maintenance/schedule/abc', maintenanceItems, 'Schedule'],
        ['/maintenance/my-tasks', maintenanceItems, 'My Tasks'],
        ['/maintenance/history', maintenanceItems, 'History'],
        ['/maintenance/config', maintenanceItems, 'Config'],
        ['/maintenance/assignment-rules', maintenanceItems, 'Rules'],
        ['/maintenance/checklists', maintenanceItems, 'Checklists']
    ])('marks %s active for %s', (path, items, activeLabel) => {
        renderTabs(path, items);

        expectOnlyActiveLink(activeLabel);
    });

    it.each([
        ['/requests/new', requestsItems],
        ['/users/123', usersItems],
        ['/users/123/credentials/history', usersItems]
    ])('does not mark any tab active for detail route %s', (path, items) => {
        renderTabs(path, items);

        expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
    });
});
