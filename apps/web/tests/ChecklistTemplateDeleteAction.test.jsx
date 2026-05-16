import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChecklistTemplateForm from '../src/features/maintenance/components/ChecklistTemplateForm.jsx';

const mocks = vi.hoisted(() => ({
    deleteChecklistTemplate: vi.fn(),
    template: {
        id: 'template-1',
        name: 'Template to delete',
        description: '',
        isActive: true,
        items: [
            {
                id: 'item-1',
                title: 'Item 1',
                description: '',
                isRequired: true,
                orderIndex: 0
            }
        ]
    }
}));

vi.mock('../src/shared/hooks/useToast.js', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('../src/features/maintenance/hooks/useMaintenance.js', () => ({
    useChecklistTemplate: () => ({
        data: mocks.template,
        isLoading: false
    }),
    useCreateChecklistTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateChecklistTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeactivateChecklistTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteChecklistTemplate: () => ({ mutateAsync: mocks.deleteChecklistTemplate, isPending: false })
}));

describe('ChecklistTemplateForm delete action', () => {
    it('lets users confirm and permanently delete an existing checklist template', async () => {
        mocks.deleteChecklistTemplate.mockResolvedValue({ id: 'template-1', deleted: true });
        const onClose = vi.fn();

        render(<ChecklistTemplateForm templateId="template-1" onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Delete this template?');

        fireEvent.click(screen.getByRole('button', { name: 'Delete template' }));

        await waitFor(() => {
            expect(mocks.deleteChecklistTemplate).toHaveBeenCalledWith('template-1');
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
