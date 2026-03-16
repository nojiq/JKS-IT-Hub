/* eslint-disable react/prop-types */
import React from 'react';
import RequestStatusBadge from './RequestStatusBadge';

const RequestListItem = ({ request, onClick }) => {
    return (
        <div className="request-item" onClick={() => onClick(request.id)}>
            <div className="request-header">
                <h3>{request.itemName}</h3>
                <RequestStatusBadge status={request.status} />
            </div>

            <div className="request-body">
                <p className="meta">
                    Submitted: {new Date(request.createdAt).toLocaleDateString()}
                    {request.priority && <span className={`priority ${request.priority.toLowerCase()}`}> • {request.priority} Priority</span>}
                    <span className="updated-at"> • Updated: {new Date(request.updatedAt).toLocaleDateString()}</span>
                </p>
                <p className="preview">{request.justification ? request.justification.substring(0, 100) : 'No justification provided'}...</p>
            </div>

            <div className="request-actions">
                <span className="view-link">View Details</span>
            </div>

            <style>{`
                .request-item {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    background-color: white;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .request-item:hover {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    background-color: #f9fafb;
                    transform: translateY(-1px);
                }
                .request-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.5rem;
                }
                .request-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #111827;
                }
                .request-body {
                    margin-bottom: 0.75rem;
                }
                .meta {
                    font-size: 0.875rem;
                    color: #6b7280;
                    margin-bottom: 0.5rem;
                }
                .priority {
                    font-weight: 500;
                }
                .priority.urgent { color: #dc2626; }
                .priority.high { color: #ea580c; }
                .priority.medium { color: #d97706; }
                .priority.low { color: #059669; }
                
                .preview {
                    color: #374151;
                    font-size: 0.875rem;
                    line-height: 1.5;
                    margin-top: 0;
                }
                .view-link {
                    color: #4f46e5;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .request-item:hover .view-link {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
};

export default RequestListItem;
