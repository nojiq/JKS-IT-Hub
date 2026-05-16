import React from 'react';
import './ChecklistItemEditor.css';

const EMPTY_ITEM = {
    title: '',
    description: '',
    isRequired: true,
    evidenceRequired: false,
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

const ChecklistItemEditor = ({ items = [], onChange }) => {
    const sync = (next) => {
        onChange(next.map((item, index) => ({ ...item, orderIndex: index })));
    };

    const addItem = () => {
        sync([...items, { ...EMPTY_ITEM, orderIndex: items.length }]);
    };

    const updateItem = (index, patch) => {
        const next = [...items];
        next[index] = { ...next[index], ...patch };
        sync(next);
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

            {items.length === 0 ? (
                <p className="checklist-item-editor__empty" role="status">
                    No items yet. Add at least one step for this template.
                </p>
            ) : (
                <div className="checklist-item-editor__list" role="list">
                    {items.map((item, index) => (
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
                                <label htmlFor={`checklist-item-title-${index}`}>Title</label>
                                <input
                                    id={`checklist-item-title-${index}`}
                                    type="text"
                                    className="form-control"
                                    value={item.title || ''}
                                    onChange={(event) => updateItem(index, { title: event.target.value })}
                                    required
                                    aria-required="true"
                                />
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

                            <label className="checklist-item-card__required">
                                <input
                                    type="checkbox"
                                    checked={item.isRequired !== false}
                                    onChange={(event) => updateItem(index, { isRequired: event.target.checked })}
                                />
                                Required for sign-off
                            </label>
                            <label className="checklist-item-card__required">
                                <input
                                    type="checkbox"
                                    checked={Boolean(item.evidenceRequired)}
                                    onChange={(event) => updateItem(index, { evidenceRequired: event.target.checked })}
                                />
                                Require evidence
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChecklistItemEditor;
