import React, { useState } from 'react';
import { useAdminApproval } from '../hooks/useAdminApproval';
import InvoiceDisplay from './InvoiceDisplay';
import { MobileModal } from '../../../shared/ui/MobileModal/MobileModal';
import './AdminApprovalModal.css';

const AdminApprovalModal = ({ request, onClose }) => {
    const { approveRequest, isApproving, error } = useAdminApproval();
    const [isConfirming, setIsConfirming] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleApprove = async () => {
        try {
            setErrorMessage(null);
            await approveRequest(request.id);
            onClose();
        } catch (err) {
            setErrorMessage(err.message || "Approval failed.");
        }
    };

    if (!request) return null;

    return (
        <MobileModal
            isOpen={true}
            onClose={onClose}
            title={`Final Approval: ${request.itemName}`}
        >
            <div className="admin-approval-modal">
                <div className="modal-body-content">
                    {/* Request Details */}
                    <div className="detail-section">
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Requester</label>
                                <div className="requester-info">
                                    {request.requester?.ldapAttributes?.displayName || request.requester?.username}
                                    <span className="dept-tag">{request.requester?.ldapAttributes?.department}</span>
                                </div>
                            </div>
                            <div className="detail-item">
                                <label>Priority</label>
                                <div className={`priority-tag ${request.priority?.toLowerCase()}`}>{request.priority}</div>
                            </div>
                            <div className="detail-item">
                                <label>Category</label>
                                <div>{request.category}</div>
                            </div>
                            <div className="detail-item">
                                <label>Submitted</label>
                                <div>{new Date(request.createdAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <label className="section-label">Description</label>
                        <p className="section-content">{request.description}</p>
                    </div>

                    <div className="detail-section">
                        <label className="section-label">Justification</label>
                        <p className="section-content">{request.justification}</p>
                    </div>

                    {/* IT Review Section */}
                    {request.itReview && (
                        <div className="detail-section review-box">
                            <label className="section-label">IT Review Notes</label>
                            <div className="review-meta">
                                Reviewed by <strong>{request.itReviewedBy?.ldapAttributes?.displayName || request.itReviewedBy?.username}</strong> on {new Date(request.itReviewedAt).toLocaleString()}
                            </div>
                            <p className="review-content">{request.itReview}</p>
                        </div>
                    )}

                    {request.invoiceFileUrl && (
                        <div className="detail-section">
                            <label className="section-label">Attached Invoice</label>
                            <div className="invoice-preview-container">
                                <InvoiceDisplay invoiceUrl={request.invoiceFileUrl} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="action-area">
                    {errorMessage && <div className="error-message">{errorMessage}</div>}

                    {!isConfirming ? (
                        <button
                            onClick={() => setIsConfirming(true)}
                            className="btn-approve-primary"
                            disabled={isApproving}
                        >
                            Approve Purchase
                        </button>
                    ) : (
                        <div className="confirmation-box">
                            <p>Are you sure you want to approve this purchase?</p>
                            <div className="confirm-buttons">
                                <button
                                    onClick={() => setIsConfirming(false)}
                                    className="btn-secondary"
                                    disabled={isApproving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApprove}
                                    className="btn-confirm"
                                    disabled={isApproving}
                                >
                                    {isApproving ? 'Approving...' : 'Confirm Approval'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MobileModal>
    );
};

export default AdminApprovalModal;
