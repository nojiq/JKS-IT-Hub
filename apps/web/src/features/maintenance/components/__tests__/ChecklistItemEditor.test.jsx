import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChecklistItemEditor from '../ChecklistItemEditor.jsx';

describe('ChecklistItemEditor', () => {
    it('fills the task and description when a preset is selected', () => {
        const onChange = vi.fn();

        render(
            <ChecklistItemEditor
                items={[{ title: '', description: '', isRequired: true, evidenceRequired: false }]}
                taskPresets={[
                    {
                        id: 'preset-monitor',
                        title: 'Monitor',
                        description: 'Test and clean the monitor.'
                    }
                ]}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByRole('combobox', { name: /task/i }), {
            target: { value: 'Monitor' }
        });

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                taskPresetId: 'preset-monitor',
                title: 'Monitor',
                description: 'Test and clean the monitor.'
            })
        ]);
    });

    it('explains that all tasks must be completed without showing a required checkbox', () => {
        render(
            <ChecklistItemEditor
                items={[{ title: 'Battery', description: '', isRequired: true, evidenceRequired: false }]}
                taskPresets={[]}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('All tasks must be completed before finishing.')).toBeInTheDocument();
        expect(screen.queryByLabelText('Must complete before finishing')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Required for sign-off')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Require evidence')).not.toBeInTheDocument();
    });
});
