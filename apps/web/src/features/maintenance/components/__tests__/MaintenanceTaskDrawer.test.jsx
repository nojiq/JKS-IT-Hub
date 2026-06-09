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

    it('captures battery measurements and warns on low health', async () => {
        updateItem.mockResolvedValue({});
        render(
            <MaintenanceTaskDrawer
                task={{
                    ...baseTask,
                    items: [{
                        ...baseTask.items[0],
                        title: 'Battery',
                        measurementType: 'battery',
                        status: 'pending',
                        notes: null,
                        measurements: {
                            batteryModel: 'L20M4PC0',
                            designCapacityMwh: 50000,
                            fullChargeCapacityMwh: 35000,
                            cycleCount: 901
                        }
                    }]
                }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByLabelText('Battery model')).toHaveValue('L20M4PC0');
        expect(screen.getByText('Battery health: 70%')).toBeInTheDocument();
        expect(screen.getByText('Battery health is 70%, below 80%.')).toBeInTheDocument();
        expect(screen.getByText('Cycle count is above 800.')).toBeInTheDocument();

        const fullChargeInput = screen.getByRole('spinbutton', { name: /full charge capacity/i });
        fireEvent.change(fullChargeInput, {
            target: { value: '34000' }
        });
        fireEvent.blur(fullChargeInput);

        await waitFor(() => {
            expect(updateItem).toHaveBeenCalledWith({
                itemId: 'item-1',
                data: {
                    status: 'pending',
                    notes: undefined,
                    measurements: {
                        batteryModel: 'L20M4PC0',
                        designCapacityMwh: 50000,
                        fullChargeCapacityMwh: 34000,
                        cycleCount: 901
                    }
                }
            });
        });
    });

    it('captures HDSentinel hard drive measurements and warnings', async () => {
        updateItem.mockResolvedValue({});
        render(
            <MaintenanceTaskDrawer
                task={{
                    ...baseTask,
                    items: [{
                        ...baseTask.items[0],
                        title: 'Hard drive',
                        measurementType: 'hard_drive',
                        status: 'pending',
                        notes: null,
                        measurements: {
                            model: 'Samsung SSD 870',
                            sizeGb: 512,
                            performancePercent: 75,
                            healthPercent: 92
                        }
                    }]
                }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByLabelText('Model')).toHaveValue('Samsung SSD 870');
        expect(screen.getByRole('spinbutton', { name: /performance/i })).toHaveValue(75);
        expect(screen.getByText('Performance is below 80%.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Pass' }));

        await waitFor(() => {
            expect(updateItem).toHaveBeenCalledWith({
                itemId: 'item-1',
                data: {
                    status: 'pass',
                    notes: undefined,
                    measurements: {
                        model: 'Samsung SSD 870',
                        sizeGb: 512,
                        performancePercent: 75,
                        healthPercent: 92
                    }
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
