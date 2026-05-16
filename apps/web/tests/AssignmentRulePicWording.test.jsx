import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AssignmentRuleForm from '../src/features/maintenance/components/AssignmentRuleForm.jsx';
import AssignmentRuleList from '../src/features/maintenance/components/AssignmentRuleList.jsx';
import ManualAssignmentModal from '../src/features/maintenance/components/ManualAssignmentModal.jsx';
import { fetchUsers } from '../src/features/users/users-api.js';

vi.mock('../src/features/users/users-api.js', () => ({
    fetchUsers: vi.fn()
}));

vi.mock('../src/shared/hooks/useToast.js', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn()
    })
}));

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    useCreateAssignmentRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateAssignmentRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useManuallyAssignWindow: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

const users = [
    { id: 'user-1', username: 'alex.pic', displayName: 'Alex PIC' }
];

describe('maintenance assignment PIC wording', () => {
    it('uses PIC wording in assignment rule setup', async () => {
        fetchUsers.mockResolvedValue({ users });

        render(<AssignmentRuleForm onClose={vi.fn()} />);

        expect(document.getElementById('pics-label')).toHaveTextContent(/PICs/);
        expect(await screen.findByRole('option', { name: 'Add PIC…' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Fixed — always assign to first PIC' })).toBeInTheDocument();
        expect(screen.queryByText(/Technician/i)).not.toBeInTheDocument();
    });

    it('uses PIC wording in assignment rule list and manual assignment modal', async () => {
        fetchUsers.mockResolvedValue({ users });

        const { rerender } = render(
            <AssignmentRuleList
                rules={[
                    {
                        id: 'rule-1',
                        department: 'Engineering',
                        assignmentStrategy: 'ROTATION',
                        technicians: [{ id: 'assignment-1' }],
                        rotationState: { currentTechnicianIndex: 0 },
                        isActive: true
                    }
                ]}
                onEdit={vi.fn()}
                onDeactivate={vi.fn()}
                onResetRotation={vi.fn()}
            />
        );

        expect(screen.getByRole('columnheader', { name: 'PICs' })).toBeInTheDocument();
        expect(screen.getByText('1 PIC(s)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset rotation' })).toHaveAttribute(
            'title',
            'Reset rotation to first PIC'
        );

        rerender(
            <ManualAssignmentModal
                window={{ id: 'window-1', scheduledStartDate: '2026-05-16T04:00:00.000Z' }}
                onClose={vi.fn()}
            />
        );

        expect(await screen.findByLabelText(/Select PIC/i)).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '-- Select PIC --' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText(/Technician/i)).not.toBeInTheDocument();
        });
    });
});
