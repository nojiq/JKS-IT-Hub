import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ChecklistItemEditor from '../ChecklistItemEditor.jsx';

function StatefulChecklistItemEditor({ initialItems, taskPresets = [], onChange }) {
    const [items, setItems] = useState(initialItems);

    const handleChange = (nextItems) => {
        setItems(nextItems);
        onChange?.(nextItems);
    };

    return (
        <ChecklistItemEditor
            items={items}
            taskPresets={taskPresets}
            onChange={handleChange}
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
                        description: 'Test and clean the monitor.',
                        measurementType: 'none'
                    }
                ]}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText(/task/i), {
            target: { value: 'preset-monitor' }
        });

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                taskPresetId: 'preset-monitor',
                title: 'Monitor',
                description: 'Test and clean the monitor.',
                measurementType: 'none'
            })
        ]);
    });

    it('copies measurement type from a saved battery task', () => {
        const onChange = vi.fn();

        render(
            <ChecklistItemEditor
                items={[{ title: '', description: '', isRequired: true, evidenceRequired: false }]}
                taskPresets={[
                    {
                        id: 'preset-battery',
                        title: 'Battery',
                        description: 'Check battery health.',
                        measurementType: 'battery'
                    }
                ]}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText(/task/i), {
            target: { value: 'preset-battery' }
        });

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                taskPresetId: 'preset-battery',
                title: 'Battery',
                measurementType: 'battery'
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
        expect(screen.getByLabelText('Measurement fields')).toBeInTheDocument();
    });

    it('allows a new task to be entered after choosing add new task from the dropdown', () => {
        const onChange = vi.fn();

        render(
            <StatefulChecklistItemEditor
                initialItems={[{ title: '', description: '', isRequired: true, evidenceRequired: false }]}
                taskPresets={[]}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText(/task/i), {
            target: { value: '__add_new_task__' }
        });
        fireEvent.change(screen.getByLabelText(/new task name/i), {
            target: { value: 'USB ports' }
        });

        expect(screen.getByDisplayValue('USB ports')).toBeInTheDocument();
        expect(onChange).toHaveBeenLastCalledWith([
            expect.objectContaining({
                taskPresetId: null,
                title: 'USB ports',
                measurementType: 'none',
                isNewTask: true
            })
        ]);
    });
});
