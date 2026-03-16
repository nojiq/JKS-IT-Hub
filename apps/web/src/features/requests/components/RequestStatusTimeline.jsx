
import React from 'react';

const RequestStatusTimeline = ({ request }) => {
    if (!request) return null;

    const getTimelineSteps = (request) => {
        const steps = [
            {
                label: 'Submitted',
                status: 'completed',
                timestamp: request.createdAt,
                actor: request.requester?.username || 'Requester',
                detail: null
            },
            {
                label: 'IT Review',
                status: request.itReviewedAt ? 'completed' :
                    ['SUBMITTED'].includes(request.status) ? 'pending' : 'skipped',
                timestamp: request.itReviewedAt,
                actor: request.itReviewedBy?.username,
                detail: request.itReview || request.rejectionReason
            },
            {
                label: 'Final Decision',
                status: ['APPROVED', 'REJECTED', 'ALREADY_PURCHASED'].includes(request.status) ? 'completed' : 'pending',
                timestamp: request.approvedAt || (request.status === 'REJECTED' || request.status === 'ALREADY_PURCHASED' ? request.updatedAt : null),
                actor: request.approvedBy?.username,
                detail: request.status === 'REJECTED' ? request.rejectionReason :
                    request.status === 'APPROVED' ? 'Request approved' : null,
                outcome: request.status
            }
        ];

        // If ALREADY_PURCHASED, modify timeline
        if (request.status === 'ALREADY_PURCHASED') {
            steps[1].label = 'Marked as Already Purchased';
            steps[1].status = 'completed';
            // The step logic above handles status completed, but detail might be in itReview field
            // The 3rd step (Final Decision) is handled above
        }

        return steps;
    };

    const steps = getTimelineSteps(request);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="timeline-container">
            <div className="timeline">
                {steps.map((step, index) => (
                    <div key={index} className={`timeline-step ${step.status}`}>
                        <div className="step-marker">
                            {step.status === 'completed' ? '✓' : index + 1}
                        </div>
                        <div className="step-content">
                            <div className="step-header">
                                <span className="step-label">{step.label}</span>
                                {step.timestamp && <span className="step-time">{formatDate(step.timestamp)}</span>}
                            </div>
                            {step.actor && <div className="step-actor">By: {step.actor}</div>}
                            {step.detail && <div className="step-detail">{step.detail}</div>}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .timeline {
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    padding-left: 12px;
                }
                .timeline-step {
                    position: relative;
                    padding-bottom: 32px;
                    padding-left: 24px;
                }
                .timeline-step:last-child {
                    padding-bottom: 0;
                }
                
                /* Connecting Line */
                .timeline-step::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 24px;
                    width: 2px;
                    height: calc(100% - 24px);
                    background: var(--color-border);
                    transform: translateX(-50%);
                }
                .timeline-step:last-child::after {
                    display: none;
                }

                /* Marker Circle */
                .step-marker {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--color-surface-hover);
                    color: var(--color-text-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    transform: translateX(-50%);
                    z-index: 1;
                    border: 2px solid var(--color-surface);
                }

                .timeline-step.completed .step-marker {
                    background: var(--color-success);
                    color: var(--color-success-foreground);
                }
                .timeline-step.pending .step-marker {
                    background: var(--color-surface-hover);
                    color: var(--color-text-secondary);
                }
                .timeline-step.skipped .step-marker {
                    background: var(--color-surface);
                    color: var(--color-text-secondary);
                    opacity: 0.5;
                }

                .step-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .step-header {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }
                .step-label {
                    font-weight: 600;
                    color: var(--color-text-primary);
                }
                .step-time {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }
                .step-actor {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }
                .step-detail {
                    font-size: 0.875rem;
                    color: var(--color-text-primary);
                    background: var(--color-surface-hover);
                    padding: 8px;
                    border-radius: 8px;
                    border-left: 3px solid var(--color-border);
                    margin-top: 4px;
                }
                
                /* Status specific detail styling */
                .timeline-step.completed:last-child .step-detail {
                    border-left-color: var(--color-success);
                    background: var(--color-success-muted);
                }

                @media (min-width: 640px) {
                    .step-header {
                        flex-direction: row;
                        justify-content: space-between;
                        align-items: center;
                    }
                }

            `}</style>
        </div>
    );
};

export default RequestStatusTimeline;
