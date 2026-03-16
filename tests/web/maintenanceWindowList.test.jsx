import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MaintenanceWindowList from '../../apps/web/src/features/maintenance/components/MaintenanceWindowList.jsx';

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
});
