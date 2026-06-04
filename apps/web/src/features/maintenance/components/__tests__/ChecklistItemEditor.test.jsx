import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ChecklistItemEditor from '../ChecklistItemEditor.jsx';

function StatefulChecklistItemEditor({ initialItems, taskPresets = [], onCreateTaskPreset }) {
    const [items, setItems] = useState(initialItems);

    return (
        <ChecklistItemEditor
            items={items}
            taskPresets={taskPresets}
            onCreateTaskPreset={onCreateTaskPreset}
            onChange={setItems}
        />
    );
}

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

    it('saves a typed task as a reusable preset and links it to the item', async () => {
        const onCreateTaskPreset = vi.fn().mockResolvedValue({
            id: 'preset-usb',
            title: 'USB ports',
            description: 'Confirm all USB ports are working.'
        });

        render(
            <StatefulChecklistItemEditor
                initialItems={[{ title: '', description: '', isRequired: true, evidenceRequired: false }]}
                taskPresets={[]}
                onCreateTaskPreset={onCreateTaskPreset}
            />
        );

        fireEvent.change(screen.getByRole('combobox', { name: /task/i }), {
            target: { value: 'USB ports' }
        });
        fireEvent.change(screen.getByLabelText(/description/i), {
            target: { value: 'Confirm all USB ports are working.' }
        });

        fireEvent.click(screen.getByRole('button', { name: /save as task/i }));

        expect(onCreateTaskPreset).toHaveBeenCalledWith({
            title: 'USB ports',
            description: 'Confirm all USB ports are working.',
            category: 'Other'
        });
        expect(await screen.findByDisplayValue('USB ports')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save as task/i })).not.toBeInTheDocument();
    });
});
