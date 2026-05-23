import React, { useEffect, useState } from "react";
import RequestStatusBadge from "./RequestStatusBadge";
import RequestStatusTimeline from "./RequestStatusTimeline";
import InvoiceDisplay from "./InvoiceDisplay";
import InvoiceUploader from "./InvoiceUploader";
import { MobileModal } from "../../../shared/ui/MobileModal/MobileModal";
import { useUploadInvoice } from "../hooks/useInvoiceUpload.js";
import { useToast } from "../../../shared/hooks/useToast.js";
import { formatDisplayDateTime } from "../../../shared/utils/date-format.js";
import {
    deriveLegacyStatus,
    getPurchaseItemImageUrl,
    getPrimaryItemName,
    getRecordDisplayStatus,
    getRecordReason
} from "../utils/purchaseRecordUtils.js";
import "./RequestDetailModal.css";

const RequestDetailModal = ({ request, isOpen = true, onClose }) => {
    const toast = useToast();
    const uploadInvoiceMutation = useUploadInvoice();
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [showUploader, setShowUploader] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    if (!request) return null;

    const { recordStatus, approvalStatus } = getRecordDisplayStatus(request);
    const legacyStatus = deriveLegacyStatus(request);
    const reason = getRecordReason(request);
    const items = request.items ?? [];

    const canUploadInvoice = !request.invoiceFileUrl && legacyStatus === "SUBMITTED";

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
            toast.success("Invoice Uploaded", "Invoice has been attached to this record.");
        } catch (error) {
            setUploadError(error.message);
        }
    };

    return (
        <MobileModal
            isOpen={isOpen}
            onClose={onClose}
            title={getPrimaryItemName(request)}
        >
            <div className="request-detail-modal">
                <div className="detail-header-status">
                    <RequestStatusBadge recordStatus={recordStatus} approvalStatus={approvalStatus} />
                </div>

                <div className="modal-body-content">
                    <section className="detail-section">
                        <h3>Record Info</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <label>Reason</label>
                                <p>{reason || "N/A"}</p>
                            </div>
                            <div className="detail-item">
                                <label>Vendor</label>
                                <p>{request.vendorName || "N/A"}</p>
                            </div>
                            <div className="detail-item">
                                <label>Record status</label>
                                <p>{recordStatus}</p>
                            </div>
                            <div className="detail-item">
                                <label>Approval status</label>
                                <p>{approvalStatus}</p>
                            </div>
                            <div className="detail-item">
                                <label>Submitted</label>
                                <p>{formatDisplayDateTime(request.createdAt)}</p>
                            </div>
                            <div className="detail-item">
                                <label>Last updated</label>
                                <p>{formatDisplayDateTime(request.updatedAt)}</p>
                            </div>
                        </div>
                    </section>

                    <section className="detail-section">
                        <h3>Items ({items.length})</h3>
                        <div className="purchase-record-items">
                            {items.length > 0 ? items.map((item) => (
                                <article key={item.id ?? `${item.itemName}-${item.quantity}`} className="purchase-record-item-row">
                                    <div className="purchase-record-item-row__body">
                                        {getPurchaseItemImageUrl(item) && (
                                            <img className="purchase-record-item-row__image" src={getPurchaseItemImageUrl(item)} alt="" />
                                        )}
                                        <div>
                                            <div className="purchase-record-item-row__head">
                                                <strong>{item.itemName}</strong>
                                                <span>Qty {item.quantity ?? 1}</span>
                                            </div>
                                            {item.description && <p>{item.description}</p>}
                                            <div className="purchase-record-item-row__meta">
                                                {item.category && <span>{item.category}</span>}
                                                {item.unitCost && <span>{request.currency ?? "MYR"} {item.unitCost}</span>}
                                                {item.sourceMarketplace && item.sourceUrl && (
                                                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                                                        {item.sourceMarketplace}
                                                    </a>
                                                )}
                                                {item.snipeVerificationStatus && (
                                                    <span className={`snipe-status is-${item.snipeVerificationStatus.toLowerCase()}`}>
                                                        Snipe: {item.snipeVerificationStatus}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            )) : (
                                <p className="purchase-record-items__empty">No line items returned.</p>
                            )}
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
                                            {uploadInvoiceMutation.isPending ? "Uploading..." : "Save Invoice"}
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

                    {["APPROVED", "REJECTED", "ALREADY_PURCHASED"].includes(legacyStatus) && (
                        <section className="outcome-section">
                            <h3>Outcome</h3>
                            <div className={`outcome-box ${legacyStatus.toLowerCase()}`}>
                                <h4>{legacyStatus.replace("_", " ")}</h4>
                                {legacyStatus === "APPROVED" && request.approvedAt && (
                                    <p>Approved on {formatDisplayDateTime(request.approvedAt)}</p>
                                )}
                                {legacyStatus === "REJECTED" && request.approvalNote && (
                                    <p>{request.approvalNote}</p>
                                )}
                                {legacyStatus === "ALREADY_PURCHASED" && (
                                    <p>{request.approvalSkipReason || request.approvalNote || "Marked as already purchased"}</p>
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
