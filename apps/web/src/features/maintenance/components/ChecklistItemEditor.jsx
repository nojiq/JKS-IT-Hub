import React, { useState } from 'react';
import './ChecklistItemEditor.css';

const EMPTY_ITEM = {
    taskPresetId: null,
    title: '',
    description: '',
    isRequired: true,
    orderIndex: 0
};

function IconChevronDown(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden {...props}>
            <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function IconChevronUp() {
    return (
        <span className="checklist-item-editor__flip-y" aria-hidden>
            <IconChevronDown />
        </span>
    );
}

const findPresetByTitle = (taskPresets, value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    return taskPresets.find((preset) => preset.title?.trim().toLowerCase() === normalized) || null;
};

const ChecklistItemEditor = ({ items = [], taskPresets = [], onChange, onCreateTaskPreset, onDeleteTaskPreset }) => {
    const [creatingPresetIndex, setCreatingPresetIndex] = useState(null);
    const [deletingPresetId, setDeletingPresetId] = useState(null);
    const sync = (next) => {
        onChange(next.map((item, index) => ({ ...item, isRequired: true, orderIndex: index })));
    };

    const addItem = () => {
        sync([...items, { ...EMPTY_ITEM, orderIndex: items.length }]);
    };

    const updateItem = (index, patch) => {
        const next = [...items];
        next[index] = { ...next[index], ...patch };
        sync(next);
    };

    const updateTaskTitle = (index, value) => {
        const preset = findPresetByTitle(taskPresets, value);
        updateItem(index, {
            taskPresetId: preset?.id ?? null,
            title: value,
            description: preset ? preset.description || '' : items[index]?.description || ''
        });
    };

    const handleCreatePreset = async (index) => {
        if (!onCreateTaskPreset) return;
        const item = items[index];
        const title = item?.title?.trim();
        if (!title || findPresetByTitle(taskPresets, title)) return;

        setCreatingPresetIndex(index);
        try {
            const preset = await onCreateTaskPreset({
                title,
                description: item.description?.trim() || undefined,
                category: 'Other'
            });
            updateItem(index, {
                taskPresetId: preset?.id ?? null,
                title: preset?.title || title,
                description: preset?.description ?? item.description ?? ''
            });
        } finally {
            setCreatingPresetIndex(null);
        }
    };

    const handleDeletePreset = async (index, presetId) => {
        if (!onDeleteTaskPreset || !presetId) return;
        setDeletingPresetId(presetId);
        try {
            await onDeleteTaskPreset(presetId);
            updateItem(index, { taskPresetId: null });
        } finally {
            setDeletingPresetId(null);
        }
    };

    const removeItem = (index) => {
        sync(items.filter((_, i) => i !== index));
    };

    const moveItem = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        sync(next);
    };

    return (
        <div className="checklist-item-editor">
            <div className="checklist-item-editor__toolbar">
                <p className="checklist-item-editor__heading" id="checklist-items-heading">
                    Checklist items
                </p>
                <button type="button" className="workspace-inline-button" onClick={addItem}>
                    Add item
                </button>
            </div>
            <p className="checklist-item-editor__note">All tasks must be completed before finishing.</p>

            {items.length === 0 ? (
                <p className="checklist-item-editor__empty" role="status">
                    No items yet. Add at least one step for this template.
                </p>
            ) : (
                <div className="checklist-item-editor__list" role="list">
                    {items.map((item, index) => {
                        const isUnsavedTask = Boolean(
                            onCreateTaskPreset &&
                            item.title?.trim() &&
                            !item.taskPresetId &&
                            !findPresetByTitle(taskPresets, item.title)
                        );

                        return (
                            <div
                                key={`item-${index}-${item.orderIndex ?? index}`}
                                className="checklist-item-card"
                                role="listitem"
                            >
                            <div className="checklist-item-card__top">
                                <p className="checklist-item-card__index">Item {index + 1}</p>
                                <div className="checklist-item-card__controls">
                                    <button
                                        type="button"
                                        className="checklist-item-editor__icon-btn"
                                        onClick={() => moveItem(index, -1)}
                                        disabled={index === 0}
                                        aria-label={`Move item ${index + 1} up`}
                                    >
                                        <IconChevronUp />
                                    </button>
                                    <button
                                        type="button"
                                        className="checklist-item-editor__icon-btn"
                                        onClick={() => moveItem(index, 1)}
                                        disabled={index === items.length - 1}
                                        aria-label={`Move item ${index + 1} down`}
                                    >
                                        <IconChevronDown />
                                    </button>
                                    <button
                                        type="button"
                                        className="checklist-item-editor__remove"
                                        onClick={() => removeItem(index)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor={`checklist-item-title-${index}`}>Task</label>
                                <div className="checklist-item-card__task-field">
                                    <input
                                        id={`checklist-item-title-${index}`}
                                        list={`checklist-task-options-${index}`}
                                        role="combobox"
                                        aria-autocomplete="list"
                                        type="text"
                                        className="form-control"
                                        value={item.title || ''}
                                        onChange={(event) => updateTaskTitle(index, event.target.value)}
                                        placeholder="Choose a saved task or type a new one"
                                        required
                                        aria-required="true"
                                    />
                                    <datalist id={`checklist-task-options-${index}`}>
                                        {taskPresets.map((preset) => (
                                            <option key={preset.id} value={preset.title}>
                                                {preset.description || preset.category || preset.title}
                                            </option>
                                        ))}
                                    </datalist>
                                    {item.taskPresetId && onDeleteTaskPreset ? (
                                        <button
                                            type="button"
                                            className="checklist-item-editor__secondary-action"
                                            onClick={() => handleDeletePreset(index, item.taskPresetId)}
                                            disabled={deletingPresetId === item.taskPresetId}
                                        >
                                            {deletingPresetId === item.taskPresetId ? 'Removing…' : 'Remove saved task'}
                                        </button>
                                    ) : null}
                                    {isUnsavedTask ? (
                                        <button
                                            type="button"
                                            className="checklist-item-editor__save-task"
                                            onClick={() => handleCreatePreset(index)}
                                            disabled={creatingPresetIndex === index}
                                        >
                                            {creatingPresetIndex === index ? 'Saving task…' : 'Save as task'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor={`checklist-item-desc-${index}`}>Description (optional)</label>
                                <textarea
                                    id={`checklist-item-desc-${index}`}
                                    className="form-control"
                                    rows={2}
                                    value={item.description || ''}
                                    onChange={(event) => updateItem(index, { description: event.target.value })}
                                />
                            </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ChecklistItemEditor;
