import React from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../hooks/useTemplates.js';
import './templates.css';

export default function TemplateList() {
    const { data: templates, isLoading, error } = useTemplates();

    if (isLoading) return <div className="loading">Loading templates...</div>;
    if (error) return <div className="error">Error loading templates: {error.message}</div>;

    return (
        <div className="template-page">
            <header className="page-header">
                <h1>Credential Templates</h1>
                <Link to="new" className="btn btn-primary">Create Template</Link>
            </header>

            <div className="template-grid">
                {templates.map(template => (
                    <div key={template.id} className="template-card">
                        <div className="card-header">
                            <h3>{template.name}</h3>
                            <span className={`badge ${template.isActive ? 'active' : 'inactive'}`}>
                                {template.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <p className="description">{template.description || "No description provided."}</p>
                        <div className="meta">
                            <span>Version: {template.version}</span>
                            <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="actions">
                            <Link to={`${template.id}/edit`} className="btn btn-secondary">Edit</Link>
                        </div>
                    </div>
                ))}
                {(templates || []).length === 0 && (
                    <div className="empty-state">
                        <p>No credential templates found.</p>
                        <Link to="new" className="btn btn-primary">Create Your First Template</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
