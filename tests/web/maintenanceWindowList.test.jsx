import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import MaintenanceWindowList from '../../apps/web/src/features/maintenance/components/MaintenanceWindowList.jsx';

const testDir = dirname(fileURLToPath(import.meta.url));

const baseWindow = {
    scheduledEndDate: null,
    assignedTo: null,
    assignmentReason: null,
    deviceTypes: [{ deviceType: 'LAPTOP' }]
};

describe('MaintenanceWindowList', () => {
    it('groups windows by cycle and renders cards', () => {
        const windows = [
            {
                ...baseWindow,
                id: 'w-1',
                status: 'SCHEDULED',
                scheduledStartDate: new Date().toISOString(),
                cycleConfig: { id: 'c-1', name: 'Quarterly' }
            },
            {
                ...baseWindow,
                id: 'w-2',
                status: 'UPCOMING',
                scheduledStartDate: new Date().toISOString(),
                cycleConfig: { id: 'c-1', name: 'Quarterly' }
            },
            {
                ...baseWindow,
                id: 'w-3',
                status: 'OVERDUE',
                scheduledStartDate: new Date().toISOString(),
                cycleConfig: { id: 'c-2', name: 'Biannual' }
            }
        ];

        render(
            <MaintenanceWindowList
                windows={windows}
                meta={{ page: 1, totalPages: 1 }}
                onPageChange={() => { }}
            />
        );

        expect(screen.getAllByText('Quarterly').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Biannual').length).toBeGreaterThan(0);
        expect(screen.getByText('2 window(s)')).toBeInTheDocument();
        expect(screen.getByText('1 window(s)')).toBeInTheDocument();
    });

    it('calls view and pagination handlers', () => {
        const onView = vi.fn();
        const onPageChange = vi.fn();

        render(
            <MaintenanceWindowList
                windows={[{
                    ...baseWindow,
                    id: 'w-9',
                    status: 'SCHEDULED',
                    scheduledStartDate: new Date().toISOString(),
                    cycleConfig: { id: 'c-9', name: 'Monthly' }
                }]}
                meta={{ page: 1, totalPages: 2 }}
                onPageChange={onPageChange}
                onView={onView}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
        expect(onView).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('owns styles for every maintenance card action variant', () => {
        const css = readFileSync(
            resolve(testDir, '../../apps/web/src/features/maintenance/components/MaintenanceWindowCard.css'),
            'utf8'
        );

        expect(css).toContain('.maintenance-window-card__actions .btn-primary');
        expect(css).toContain('.maintenance-window-card__actions .btn-secondary');
        expect(css).toContain('.maintenance-window-card__actions .btn-tertiary');
        expect(css).toContain('.maintenance-window-card__actions .btn-danger');
        expect(css).toContain('.maintenance-window-card__action-group--review');
        expect(css).toContain('.maintenance-window-card__action-group--manage');
        expect(css).toContain('.maintenance-window-card__action-group--danger');
    });
});
