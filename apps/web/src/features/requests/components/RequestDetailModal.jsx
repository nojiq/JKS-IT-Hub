import React, { useEffect, useState } from 'react';
import RequestStatusBadge from './RequestStatusBadge';
import RequestStatusTimeline from './RequestStatusTimeline';
import InvoiceDisplay from './InvoiceDisplay';
import InvoiceUploader from './InvoiceUploader';
import { MobileModal } from '../../../shared/ui/MobileModal/MobileModal';
import { useUploadInvoice } from '../hooks/useInvoiceUpload.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import './RequestDetailModal.css';

const RequestDetailModal = ({ request, isOpen = true, onClose }) => {
    const toast = useToast();
    const uploadInvoiceMutation = useUploadInvoice();
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [showUploader, setShowUploader] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    if (!request) return null;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const canUploadInvoice = !request.invoiceFileUrl && request.status === 'SUBMITTED';

    useEffect(() => {
        setInvoiceFile(null);
        setShowUploader(false);
        setUploadError(null);
    }, [request.id]);

    const handleUploadInvoice = async () => {
        if (!invoiceFile) return;

        setUploadError(null);
        try {
            await uploadInvoiceMutation.mutateAsync({
                requestId: request.id,
                file: invoiceFile
            });
            setInvoiceFile(null);
            setShowUploader(false);
            toast.success('Invoice Uploaded', 'Invoice has been attached to this request.');
        } catch (error) {
            setUploadError(error.message);
        }
    };

    return (
        <MobileModal
            isOpen={isOpen}
            onClose={onClose}
            title={request.itemName}
        >
            <div className="request-detail-modal">
                <div className="detail-header-status">
                    <RequestStatusBadge status={request.status} />
                </div>

                <div className="modal-body-content">
                    <section className="detail-section">
                        <h3>Request Info</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Description</label>
                                <p>{request.description || 'N/A'}</p>
                            </div>
                            <div className="detail-item">
                                <label>Justification</label>
                                <p>{request.justification}</p>
                            </div>
                            <div className="detail-item">
                                <label>Priority</label>
                                <p className={`priority-tag ${request.priority?.toLowerCase()}`}>{request.priority}</p>
                            </div>
                            <div className="detail-item">
                                <label>Category</label>
                                <p>{request.category || 'N/A'}</p>
                            </div>
                            <div className="detail-item">
                                <label>Submitted</label>
                                <p>{formatDate(request.createdAt)}</p>
                            </div>
                            <div className="detail-item">
                                <label>Last Updated</label>
                                <p>{formatDate(request.updatedAt)}</p>
                            </div>
                        </div>
                    </section>

                    {request.invoiceFileUrl && (
                        <section className="detail-section">
                            <h3>Invoice</h3>
                            <div className="invoice-container">
                                <InvoiceDisplay invoiceUrl={request.invoiceFileUrl} />
                            </div>
                        </section>
                    )}

                    {canUploadInvoice && (
                        <section className="detail-section">
                            <h3>Attach Invoice</h3>
                            {!showUploader ? (
                                <button
                                    type="button"
                                    className="upload-invoice-btn"
                                    onClick={() => setShowUploader(true)}
                                >
                                    Upload Invoice
                                </button>
                            ) : (
                                <div className="invoice-upload-panel">
                                    <InvoiceUploader
                                        file={invoiceFile}
                                        onFileSelect={setInvoiceFile}
                                        onFileRemove={() => setInvoiceFile(null)}
                                        error={uploadError}
                                        uploading={uploadInvoiceMutation.isPending}
                                        uploadProgress={uploadInvoiceMutation.progress}
                                        disabled={uploadInvoiceMutation.isPending}
                                    />

                                    <div className="invoice-upload-actions">
                                        <button
                                            type="button"
                                            className="upload-invoice-btn"
                                            onClick={handleUploadInvoice}
                                            disabled={!invoiceFile || uploadInvoiceMutation.isPending}
                                        >
                                            {uploadInvoiceMutation.isPending ? 'Uploading...' : 'Save Invoice'}
                                        </button>
                                        <button
                                            type="button"
                                            className="cancel-upload-btn"
                                            onClick={() => {
                                                setShowUploader(false);
                                                setInvoiceFile(null);
                                                setUploadError(null);
                                            }}
                                            disabled={uploadInvoiceMutation.isPending}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="detail-section">
                        <h3>Status Timeline</h3>
                        <RequestStatusTimeline request={request} />
                    </section>

                    {/* Outcome Details if applicable */}
                    {['APPROVED', 'REJECTED', 'ALREADY_PURCHASED'].includes(request.status) && (
                        <section className="outcome-section">
                            <h3>Outcome</h3>
                            <div className={`outcome-box ${request.status.toLowerCase()}`}>
                                <h4>{request.status.replace('_', ' ')}</h4>
                                {request.status === 'APPROVED' && (
                                    <p>Approved by {request.approvedBy?.username} on {formatDate(request.approvedAt)}</p>
                                )}
                                {request.status === 'REJECTED' && (
                                    <p>Rejected by {request.itReviewedBy?.username}: "{request.rejectionReason}"</p>
                                )}
                                {request.status === 'ALREADY_PURCHASED' && (
                                    <p>Marked as Purchased by {request.itReviewedBy?.username}: "{request.itReview}"</p>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </MobileModal>
    );
};

export default RequestDetailModal;
