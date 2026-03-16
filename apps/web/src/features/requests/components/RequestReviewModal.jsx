import React, { useState } from 'react';
import { useITReview } from '../hooks/useITReview';
import InvoiceDisplay from './InvoiceDisplay';
import ReviewActionDialog from './ReviewActionDialog';
import { MobileModal } from '../../../shared/ui/MobileModal/MobileModal';
import { useToast } from '../../../shared/hooks/useToast.js';
import './RequestReviewModal.css';

const RequestReviewModal = ({ request, onClose }) => {
    const { itReview, markAlreadyPurchased, rejectRequest, isReviewing, isMarkingPurchased, isRejecting } = useITReview();
    const [action, setAction] = useState(null); // 'REVIEW', 'ALREADY_PURCHASED', 'REJECT'
    const [notes, setNotes] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const toast = useToast();

    const handleSubmit = async () => {
        try {
            setErrorMessage(null);
            if (action === 'REVIEW') {
                await itReview({ id: request.id, data: { itReview: notes } });
                toast.success('Request Reviewed', 'Request moved to IT_REVIEWED.');
            } else if (action === 'ALREADY_PURCHASED') {
                if (!notes.trim()) {
                    setErrorMessage("Reason is required.");
                    return;
                }
                await markAlreadyPurchased({ id: request.id, data: { reason: notes.trim() } });
                toast.success('Marked as Purchased', 'Request marked as ALREADY_PURCHASED.');
            } else if (action === 'REJECT') {
                if (!notes.trim()) {
                    setErrorMessage("Rejection reason is required.");
                    return;
                }
                await rejectRequest({ id: request.id, data: { rejectionReason: notes.trim() } });
                toast.warning('Request Rejected', 'Request moved to REJECTED.');
            }
            onClose(); // Close modal on success
        } catch (err) {
            setErrorMessage(err.message || "Action failed.");
        }
    };

    const isLoading = isReviewing || isMarkingPurchased || isRejecting;

    if (!request) return null;

    return (
        <MobileModal
            isOpen={true}
            onClose={onClose}
            title={`Review: ${request.itemName}`}
        >
            <div className="request-review-modal">
                <div className="modal-body-content">
                    {!action ? (
                        <>
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
                                        <div>{new Date(request.createdAt).toLocaleString()}</div>
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

                            {request.invoiceFileUrl && (
                                <div className="detail-section">
                                    <label className="section-label">Attached Invoice</label>
                                    <div className="invoice-preview-container">
                                        <InvoiceDisplay invoiceUrl={request.invoiceFileUrl} />
                                    </div>
                                </div>
                            )}

                            {request.status === 'SUBMITTED' && (
                                <div className="main-actions">
                                    <button onClick={() => setAction('REVIEW')} className="btn-action btn-review">
                                        Approve for Review
                                    </button>
                                    <button onClick={() => setAction('ALREADY_PURCHASED')} className="btn-action btn-purchased">
                                        Already Purchased
                                    </button>
                                    <button onClick={() => setAction('REJECT')} className="btn-action btn-reject">
                                        Reject Request
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <ReviewActionDialog
                            action={action}
                            notes={notes}
                            onNotesChange={setNotes}
                            onCancel={() => {
                                setAction(null);
                                setNotes('');
                                setErrorMessage(null);
                            }}
                            onConfirm={handleSubmit}
                            isLoading={isLoading}
                            errorMessage={errorMessage}
                        />
                    )}
                </div>
            </div>
        </MobileModal>
    );
};

export default RequestReviewModal;
