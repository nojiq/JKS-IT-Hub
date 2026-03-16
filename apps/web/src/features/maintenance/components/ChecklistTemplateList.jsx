import React from 'react';

const ChecklistTemplateList = ({ templates = [], onEdit }) => {
    if (!templates.length) {
        return <div className="cycle-list-empty">No checklist templates found.</div>;
    }

    return (
        <table className="cycle-list-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Version</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {templates.map((template) => {
                    const count = template._count?.items ?? template.items?.length ?? 0;
                    return (
                        <tr key={template.id}>
                            <td>{template.name}</td>
                            <td>{template.description || '-'}</td>
                            <td>{template.version}</td>
                            <td>{count}</td>
                            <td>
                                <span className={`status-badge ${template.isActive ? 'active' : 'inactive'}`}>
                                    {template.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>
                                <button type="button" className="btn-secondary" onClick={() => onEdit(template.id)}>
                                    Edit
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default ChecklistTemplateList;
