import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MaintenanceAssignmentsPage from '../../apps/web/src/features/maintenance/pages/MaintenanceAssignmentsPage.jsx';

const matrixRows = [
    {
        assetId: 'asset-1',
        assetTag: 'DES-0030',
        deviceType: 'Desktop',
        userName: 'Aisha Rahman',
        department: 'Finance',
        technician: { displayName: 'Lim Wei' },
        profile: { name: 'Quarterly Desktop' },
        nextDueDate: null,
        status: 'ACTIVE'
    },
    {
        assetId: 'asset-2',
        assetTag: 'LAP-0099',
        deviceType: 'Laptop',
        userName: 'Daniel Tan',
        department: 'HR',
        technician: null,
        profile: null,
        nextDueDate: null,
        status: 'UNASSIGNED'
    },
    {
        assetId: 'asset-3',
        assetTag: 'PRN-0007',
        deviceType: 'Printer',
        userName: '',
        department: 'Operations',
        technician: { username: 'nora' },
        profile: { name: 'Printer Monthly' },
        nextDueDate: null,
        status: 'ACTIVE'
    }
];

vi.mock('../../apps/web/src/features/maintenance/hooks/useMaintenance.js', () => ({
    useAssignmentMatrix: () => ({
        data: matrixRows,
        isLoading: false,
        error: null,
        refetch: vi.fn()
    }),
    useMaintenanceProfiles: () => ({
        data: [{ id: 'profile-1', name: 'Quarterly Desktop' }],
        isLoading: false,
        error: null
    })
}));

vi.mock('../../apps/web/src/shared/hooks/useToast.js', () => ({
    useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() })
}));

vi.mock('../../apps/web/src/features/users/users-api.js', () => ({
    fetchUsers: vi.fn(() => new Promise(() => {}))
}));

describe('MaintenanceAssignmentsPage', () => {
    it('filters assignments by search text and filter controls', () => {
        render(<MaintenanceAssignmentsPage />);

        expect(screen.getByText('DES-0030')).toBeInTheDocument();
        expect(screen.getByText('LAP-0099')).toBeInTheDocument();
        expect(screen.getByText('PRN-0007')).toBeInTheDocument();

        fireEvent.change(screen.getByRole('searchbox', { name: /search assignments/i }), {
            target: { value: 'printer' }
        });

        expect(screen.getByText('PRN-0007')).toBeInTheDocument();
        expect(screen.queryByText('DES-0030')).not.toBeInTheDocument();
        expect(screen.queryByText('LAP-0099')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/status/i), {
            target: { value: 'UNASSIGNED' }
        });

        expect(screen.getByText('No assignments match your search or filters.')).toBeInTheDocument();

        fireEvent.change(screen.getByRole('searchbox', { name: /search assignments/i }), {
            target: { value: '' }
        });

        expect(screen.getByText('LAP-0099')).toBeInTheDocument();
        expect(screen.queryByText('DES-0030')).not.toBeInTheDocument();
    });

    it('selects all visible filtered assignments only', () => {
        render(<MaintenanceAssignmentsPage />);

        fireEvent.change(screen.getByLabelText(/device type/i), {
            target: { value: 'Desktop' }
        });
        fireEvent.click(screen.getByRole('checkbox', { name: /select all visible assets/i }));

        const desktopRow = screen.getByText('DES-0030').closest('tr');
        expect(within(desktopRow).getByRole('checkbox', { name: /select DES-0030/i })).toBeChecked();
        expect(screen.getByRole('region', { name: /bulk assignment actions/i })).toHaveTextContent('1 asset selected');
        expect(screen.queryByText('LAP-0099')).not.toBeInTheDocument();
    });

    it('filters assignments by department', () => {
        render(<MaintenanceAssignmentsPage />);

        fireEvent.change(screen.getByLabelText(/department/i), {
            target: { value: 'Finance' }
        });

        expect(screen.getByText('DES-0030')).toBeInTheDocument();
        expect(screen.queryByText('LAP-0099')).not.toBeInTheDocument();
        expect(screen.queryByText('PRN-0007')).not.toBeInTheDocument();
        expect(screen.getByText('1 of 3 shown')).toBeInTheDocument();
    });
});
