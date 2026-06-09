import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MaintenanceTaskDrawer from '../MaintenanceTaskDrawer.jsx';

const updateItem = vi.fn();
const uploadEvidence = vi.fn();

vi.mock('../../hooks/useMaintenance.js', () => ({
    useMaintenanceRun: () => ({ data: null }),
    useStartMaintenanceRun: () => ({ mutate: vi.fn() }),
    useUpdateMaintenanceRunItem: () => ({ mutateAsync: updateItem }),
    useUploadMaintenanceRunItemEvidence: () => ({ mutateAsync: uploadEvidence, isPending: false }),
    useCompleteMaintenanceRun: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

const baseTask = {
    id: 'run-1',
    status: 'in_progress',
    dueDate: '2026-05-16T00:00:00.000Z',
    asset: {
        assetTag: 'JKS-001',
        name: 'Laptop',
        userName: 'Afiq Rahman',
        department: 'Finance'
    },
    profile: { name: 'Quarterly maintenance' },
    assignedTo: { username: 'tech.user' },
    items: [
        {
            id: 'item-1',
            title: 'Keyboard',
            description: 'Test and clean the keyboard.',
            required: true,
            evidenceRequired: false,
            status: 'repair',
            notes: 'Cleaned stuck key.'
        }
    ]
};

describe('MaintenanceTaskDrawer', () => {
    beforeEach(() => {
        updateItem.mockReset();
        uploadEvidence.mockReset();
    });

    it('shows repair as a clear result and keeps remarks visible', () => {
        render(<MaintenanceTaskDrawer task={baseTask} onClose={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Repair' })).toBeInTheDocument();
        expect(screen.getByText('Afiq Rahman')).toBeInTheDocument();
        expect(screen.getByText('Finance')).toBeInTheDocument();
        expect(screen.getByLabelText(/remarks/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('What was repaired?')).toBeInTheDocument();
        expect(screen.getByLabelText('Attach file')).toBeInTheDocument();
    });

    it('saves repair when the technician chooses it', async () => {
        updateItem.mockResolvedValueOnce({});
        render(
            <MaintenanceTaskDrawer
                task={{
                    ...baseTask,
                    items: [{ ...baseTask.items[0], status: 'pending', notes: null }]
                }}
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Repair' }));

        await waitFor(() => {
            expect(updateItem).toHaveBeenCalledWith({
                itemId: 'item-1',
                data: {
                    status: 'repair',
                    notes: undefined
                }
            });
        });
    });

    it('uploads optional evidence and shows the file link', async () => {
        uploadEvidence.mockResolvedValueOnce({
            id: 'item-1',
            evidenceUrl: '/api/v1/uploads/pm-evidence-keyboard.png'
        });
        render(<MaintenanceTaskDrawer task={baseTask} onClose={vi.fn()} />);

        const file = new File(['proof'], 'keyboard.png', { type: 'image/png' });
        fireEvent.change(screen.getByLabelText('Attach file'), {
            target: { files: [file] }
        });

        await waitFor(() => {
            expect(uploadEvidence).toHaveBeenCalledWith({ itemId: 'item-1', file });
        });
        expect(await screen.findByRole('link', { name: 'View attached file' })).toHaveAttribute(
            'href',
            '/api/v1/uploads/pm-evidence-keyboard.png'
        );
    });

    it('shows a readable evidence upload error', async () => {
        uploadEvidence.mockRejectedValueOnce(new Error('File too large. Maximum size: 5MB'));
        render(<MaintenanceTaskDrawer task={baseTask} onClose={vi.fn()} />);

        const file = new File(['proof'], 'large.pdf', { type: 'application/pdf' });
        fireEvent.change(screen.getByLabelText('Attach file'), {
            target: { files: [file] }
        });

        expect(await screen.findByText('File too large. Maximum size: 5MB')).toBeInTheDocument();
    });
});
