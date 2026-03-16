import React from 'react';

const EMPTY_ITEM = {
    title: '',
    description: '',
    isRequired: true,
    orderIndex: 0
};

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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ margin: 0 }}>Checklist Items</label>
                <button type="button" className="btn-secondary" onClick={addItem}>Add Item</button>
            </div>

            {items.length === 0 ? (
                <p style={{ marginTop: 0 }}>No items yet. Add at least one checklist item.</p>
            ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {items.map((item, index) => (
                        <div key={`item-${index}`} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>Item {index + 1}</strong>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="btn-secondary" onClick={() => moveItem(index, -1)} disabled={index === 0}>↑</button>
                                    <button type="button" className="btn-secondary" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>↓</button>
                                    <button type="button" className="btn-danger" onClick={() => removeItem(index)}>Remove</button>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                <label>Title</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={item.title || ''}
                                    onChange={(event) => updateItem(index, { title: event.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Description (Optional)</label>
                                <textarea
                                    className="form-control"
                                    rows={2}
                                    value={item.description || ''}
                                    onChange={(event) => updateItem(index, { description: event.target.value })}
                                />
                            </div>

                            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={item.isRequired !== false}
                                    onChange={(event) => updateItem(index, { isRequired: event.target.checked })}
                                />
                                Required item
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChecklistItemEditor;
