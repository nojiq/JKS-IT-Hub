import React, { useState } from 'react';
import { useITReview } from '../hooks/useITReview';
import InvoiceDisplay from './InvoiceDisplay';
import ReviewActionDialog from './ReviewActionDialog';
import { MobileModal } from '../../../shared/ui/MobileModal/MobileModal';
import { useToast } from '../../../shared/hooks/useToast.js';
import { formatDisplayDateTime } from '../../../shared/utils/date-format.js';
import {
    deriveLegacyStatus,
    getItemCountLabel,
    getPurchaseItemImageUrl,
    getPrimaryItemName,
    getRecordReason
} from '../utils/purchaseRecordUtils.js';
import './RequestReviewModal.css';

const EMPTY_VALUE = '—';

const formatUnitCost = (item, currency = 'MYR') => {
    if (item?.unitCost === undefined || item?.unitCost === null || item?.unitCost === '') {
        return null;
    }
    return `${currency} ${item.unitCost}`;
};

const formatLineTotal = (item, currency = 'MYR') => {
    if (item?.lineTotal !== undefined && item?.lineTotal !== null && item?.lineTotal !== '') {
        return `${currency} ${item.lineTotal}`;
    }
    const qty = Number(item?.quantity) || 1;
    const unit = Number(item?.unitCost);
    if (!Number.isFinite(unit)) return null;
    return `${currency} ${(unit * qty).toFixed(2)}`;
};

const RequestReviewModal = ({ request, onClose }) => {
    const { itReview, markAlreadyPurchased, rejectRequest, isReviewing, isMarkingPurchased, isRejecting } = useITReview();
    const [action, setAction] = useState(null);
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
                    setErrorMessage('Reason is required.');
                    return;
                }
                await markAlreadyPurchased({ id: request.id, data: { reason: notes.trim() } });
                toast.success('Marked as Purchased', 'Request marked as ALREADY_PURCHASED.');
            } else if (action === 'REJECT') {
                if (!notes.trim()) {
                    setErrorMessage('Rejection reason is required.');
                    return;
                }
                await rejectRequest({ id: request.id, data: { rejectionReason: notes.trim() } });
                toast.warning('Request Rejected', 'Request moved to REJECTED.');
            }
            onClose();
        } catch (err) {
            setErrorMessage(err.message || 'Action failed.');
        }
    };

    const isLoading = isReviewing || isMarkingPurchased || isRejecting;

    if (!request) return null;

    const legacyStatus = deriveLegacyStatus(request);
    const items = request.items ?? [];
    const currency = request.currency ?? 'MYR';
    const requesterName = request.requester?.ldapAttributes?.displayName || request.requester?.username || EMPTY_VALUE;
    const department = request.requester?.ldapAttributes?.department;

    return (
        <MobileModal
            isOpen={true}
            onClose={onClose}
            containerClassName="is-wide"
            title="Review purchase request"
        >
            <div className="request-review-modal">
                <div className="modal-body-content">
                    {!action ? (
                        <>
                            <header className="request-review-modal__hero">
                                <h2 className="request-review-modal__title">{getPrimaryItemName(request)}</h2>
                                <div className="request-review-modal__hero-meta">
                                    <span>{requesterName}</span>
                                    {department && <span className="request-review-modal__dept">{department}</span>}
                                    <span>{formatDisplayDateTime(request.createdAt)}</span>
                                </div>
                            </header>

                            <section className="request-review-modal__section" aria-labelledby="review-section-details">
                                <h3 id="review-section-details" className="request-review-modal__section-title">
                                    Purchase details
                                </h3>
                                <div className="request-review-modal__panel">
                                    <div className="request-review-modal__field request-review-modal__field--full">
                                        <span className="request-review-modal__label">Reason</span>
                                        <p className="request-review-modal__value">{getRecordReason(request) || EMPTY_VALUE}</p>
                                    </div>
                                    <div className="request-review-modal__grid">
                                        <div className="request-review-modal__field">
                                            <span className="request-review-modal__label">Vendor</span>
                                            <p className="request-review-modal__value">{request.vendorName?.trim() || EMPTY_VALUE}</p>
                                        </div>
                                        <div className="request-review-modal__field">
                                            <span className="request-review-modal__label">Notes</span>
                                            <p className="request-review-modal__value">{request.notes?.trim() || EMPTY_VALUE}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="request-review-modal__section" aria-labelledby="review-section-items">
                                <h3 id="review-section-items" className="request-review-modal__section-title">
                                    Line items
                                    <span className="request-review-modal__count">{getItemCountLabel(request)}</span>
                                </h3>
                                <div className="request-review-modal__items">
                                    {items.length > 0 ? items.map((item, index) => {
                                        const imageUrl = getPurchaseItemImageUrl(item);
                                        const unitCost = formatUnitCost(item, currency);
                                        const lineTotal = formatLineTotal(item, currency);

                                        return (
                                            <article
                                                key={item.id ?? `${item.itemName}-${index}`}
                                                className="request-review-modal__item"
                                            >
                                                <div className="request-review-modal__item-body">
                                                    {imageUrl && (
                                                        <img
                                                            className="request-review-modal__item-image"
                                                            src={imageUrl}
                                                            alt=""
                                                        />
                                                    )}
                                                    <div className="request-review-modal__item-content">
                                                        <div className="request-review-modal__item-head">
                                                            <strong>{item.itemName || EMPTY_VALUE}</strong>
                                                            <span>Qty {item.quantity ?? 1}</span>
                                                        </div>
                                                        {item.description && (
                                                            <p className="request-review-modal__item-description">{item.description}</p>
                                                        )}
                                                        <div className="request-review-modal__item-meta">
                                                            {item.category && <span>{item.category}</span>}
                                                            {unitCost && <span>{unitCost} each</span>}
                                                            {lineTotal && <span>Line {lineTotal}</span>}
                                                            {item.sourceMarketplace && item.sourceUrl && (
                                                                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                                                                    {item.sourceMarketplace}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    }) : (
                                        <p className="request-review-modal__empty">No line items returned.</p>
                                    )}
                                </div>
                            </section>

                            {request.invoiceFileUrl && (
                                <section className="request-review-modal__section" aria-labelledby="review-section-invoice">
                                    <h3 id="review-section-invoice" className="request-review-modal__section-title">
                                        E-invoice
                                    </h3>
                                    <div className="request-review-modal__invoice">
                                        <InvoiceDisplay invoiceUrl={request.invoiceFileUrl} />
                                    </div>
                                </section>
                            )}

                            {legacyStatus === 'SUBMITTED' && (
                                <div className="request-review-modal__actions">
                                    <button type="button" onClick={() => setAction('REVIEW')} className="btn-action btn-review">
                                        Approve for Review
                                    </button>
                                    <button type="button" onClick={() => setAction('ALREADY_PURCHASED')} className="btn-action btn-purchased">
                                        Already Purchased
                                    </button>
                                    <button type="button" onClick={() => setAction('REJECT')} className="btn-action btn-reject">
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
