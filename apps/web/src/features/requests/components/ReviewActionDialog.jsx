import React from 'react';

const ACTION_CONFIG = {
    REVIEW: {
        title: 'Approve for Head/Admin Review',
        placeholder: 'Add optional review notes...',
        confirmLabel: 'Submit Review',
        confirmClass: 'btn-primary'
    },
    ALREADY_PURCHASED: {
        title: 'Mark as Already Purchased',
        placeholder: 'Explain why/when this was purchased... (Required)',
        confirmLabel: 'Confirm Purchase',
        confirmClass: 'btn-warning'
    },
    REJECT: {
        title: 'Reject Request',
        placeholder: 'Reason for rejection... (Required)',
        confirmLabel: 'Reject Request',
        confirmClass: 'btn-danger'
    }
};

const ReviewActionDialog = ({
    action,
    notes,
    onNotesChange,
    onCancel,
    onConfirm,
    isLoading,
    errorMessage
}) => {
    const config = ACTION_CONFIG[action];
    if (!config) {
        return null;
    }

    return (
        <div className="action-form">
            <h3>{config.title}</h3>
            <textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder={config.placeholder}
                rows={4}
                disabled={isLoading}
                className="action-input"
            />
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <div className="action-buttons">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="btn-secondary"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isLoading}
                    className={`btn-submit ${config.confirmClass}`}
                >
                    {isLoading ? 'Processing...' : config.confirmLabel}
                </button>
            </div>
        </div>
    );
};

export default ReviewActionDialog;
