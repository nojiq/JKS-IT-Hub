import React from 'react';
import { Link } from 'react-router-dom';
import { useTemplates } from '../hooks/useTemplates.js';
import './templates.css';

export default function TemplateList({
    pageTitle = 'Credential Templates',
    pageDescription = '',
    createLabel = 'Create Template',
    emptyTitle = 'No credential templates found.',
    emptyActionLabel = 'Create Your First Template'
}) {
    const { data: templates, isLoading, error } = useTemplates();

    if (isLoading) return <div className="loading">Loading templates...</div>;
    if (error) return <div className="error">Error loading templates: {error.message}</div>;

    return (
        <div className="template-page">
            <header className="page-header">
                <div>
                    <h1>{pageTitle}</h1>
                    {pageDescription ? <p className="description">{pageDescription}</p> : null}
                </div>
                <Link to="new" className="btn btn-primary">{createLabel}</Link>
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
                            <span>History: v1 - v{template.version}</span>
                            <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="actions">
                            <Link to={`${template.id}/edit`} className="btn btn-secondary">Edit</Link>
                        </div>
                    </div>
                ))}
                {(templates || []).length === 0 && (
                    <div className="empty-state">
                        <p>{emptyTitle}</p>
                        <Link to="new" className="btn btn-primary">{emptyActionLabel}</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
