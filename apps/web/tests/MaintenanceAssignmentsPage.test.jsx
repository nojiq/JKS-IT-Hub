import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MaintenanceAssignmentsPage from '../src/features/maintenance/pages/MaintenanceAssignmentsPage.jsx';
import { useAssignmentMatrix, useMaintenanceProfiles } from '../src/features/maintenance/hooks/useMaintenance.js';
import { createMaintenanceAssignment } from '../src/features/maintenance/api/preventiveMaintenanceApi.js';
import { fetchUsers } from '../src/features/users/users-api.js';

const toast = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
};

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    useAssignmentMatrix: vi.fn(),
    useMaintenanceProfiles: vi.fn()
}));

vi.mock('../src/features/maintenance/api/preventiveMaintenanceApi.js', () => ({
    createMaintenanceAssignment: vi.fn()
}));

vi.mock('../src/features/users/users-api.js', () => ({
    fetchUsers: vi.fn()
}));

vi.mock('../src/shared/hooks/useToast.js', () => ({
    useToast: () => toast
}));

const rows = [
    {
        assetId: 'asset-1',
        assetTag: 'LAP-001',
        deviceType: 'Laptop',
        userName: 'Afiq',
        department: 'Finance',
        profile: null,
        technician: null,
        status: 'unassigned'
    },
    {
        assetId: 'asset-2',
        assetTag: 'LAP-002',
        deviceType: 'Laptop',
        userName: 'Nora',
        department: 'Sales',
        profile: null,
        technician: null,
        status: 'unassigned'
    }
];

describe('MaintenanceAssignmentsPage bulk assignment', () => {
    const refetch = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        refetch.mockResolvedValue({});
        createMaintenanceAssignment.mockResolvedValue({});
        fetchUsers.mockResolvedValue({
            users: [
                { id: 'tech-1', username: 'it.one', displayName: 'I.T One', orgSnapshot: { department: { name: 'IT' } } },
                { id: 'tech-2', username: 'it.two', displayName: 'I.T Two', orgSnapshot: { department: { name: 'IT' } } },
                { id: 'user-1', username: 'nwt', displayName: 'nwt', orgSnapshot: { department: { name: 'OPERATIONAL EXCELLENCE' } } }
            ]
        });
        useAssignmentMatrix.mockReturnValue({
            data: rows,
            isLoading: false,
            error: null,
            refetch
        });
        useMaintenanceProfiles.mockReturnValue({
            data: [{ id: 'profile-1', name: 'Quarterly PM' }],
            isLoading: false,
            error: null
        });
    });

    it('assigns the selected assets to one policy and technician from the bulk bar', async () => {
        render(<MaintenanceAssignmentsPage />);

        fireEvent.click(screen.getByLabelText('Select LAP-001'));
        fireEvent.click(screen.getByLabelText('Select LAP-002'));

        fireEvent.change(screen.getByLabelText('Bulk policy'), { target: { value: 'profile-1' } });
        fireEvent.change(await screen.findByLabelText(/assign to technician/i), { target: { value: 'tech-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

        await waitFor(() => {
            expect(createMaintenanceAssignment).toHaveBeenCalledTimes(2);
        });

        expect(createMaintenanceAssignment).toHaveBeenNthCalledWith(1, {
            assetId: 'asset-1',
            profileId: 'profile-1',
            userId: 'tech-1'
        });
        expect(createMaintenanceAssignment).toHaveBeenNthCalledWith(2, {
            assetId: 'asset-2',
            profileId: 'profile-1',
            userId: 'tech-1'
        });
        expect(refetch).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Assignments confirmed', '2 assets linked to I.T One.');
    });
});
