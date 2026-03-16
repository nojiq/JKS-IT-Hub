import React, { useEffect, useState } from 'react';
import './InvoiceDisplay.css';

/**
 * Invoice Display Component
 * 
 * Displays invoice files attached to requests
 * - Images: Shows thumbnail with expand/lightbox view
 * - PDFs: Shows icon with download link
 */
const InvoiceDisplay = ({ invoiceUrl, fileName }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [imageLoadFailed, setImageLoadFailed] = useState(false);

    if (!invoiceUrl) {
        return null;
    }

    // Determine file type from URL
    const isPDF = invoiceUrl.toLowerCase().endsWith('.pdf');
    const isImage = /\.(png|jpg|jpeg|webp)$/i.test(invoiceUrl);

    // Get display filename
    const displayName = fileName || invoiceUrl.split('/').pop();

    useEffect(() => {
        if (isImage) {
            setIsImageLoading(true);
            setImageLoadFailed(false);
        }
    }, [invoiceUrl, isImage]);

    const handleDownload = () => {
        // Open in new tab for download/viewing
        window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    };

    const handleOpenFullSize = () => {
        window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
    };

    if (isPDF) {
        return (
            <div className="invoice-display pdf-display">
                <div className="pdf-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--error-text)" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6" />
                        <text x="7" y="17" fontSize="6" fill="var(--error-text)" fontWeight="bold">PDF</text>
                    </svg>
                </div>
                <span className="file-name" title={displayName}>{displayName}</span>
                <div className="invoice-actions">
                    <button
                        type="button"
                        className="btn-action"
                        onClick={handleDownload}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7,10 12,15 17,10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                    </button>
                </div>
            </div>
        );
    }

    if (isImage) {
        return (
            <>
                <div className="invoice-display image-display">
                    <div
                        className="image-thumbnail-container"
                        onClick={() => setLightboxOpen(true)}
                    >
                        {isImageLoading && (
                            <div className="thumbnail-loading" role="status" aria-live="polite">
                                Loading invoice preview...
                            </div>
                        )}
                        {imageLoadFailed && (
                            <div className="thumbnail-error" role="alert">
                                Unable to load preview image.
                            </div>
                        )}
                        <img
                            src={invoiceUrl}
                            alt="Invoice"
                            className="thumbnail"
                            onLoad={() => setIsImageLoading(false)}
                            onError={() => {
                                setIsImageLoading(false);
                                setImageLoadFailed(true);
                            }}
                        />
                        <div className="thumbnail-overlay">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--surface-card)" strokeWidth="2">
                                <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" />
                            </svg>
                        </div>
                    </div>
                    <span className="file-name" title={displayName}>{displayName}</span>
                    <div className="invoice-actions">
                        <button
                            type="button"
                            className="btn-action"
                            onClick={handleOpenFullSize}
                        >
                            View Full Size
                        </button>
                        <button
                            type="button"
                            className="btn-action"
                            onClick={handleDownload}
                        >
                            Download
                        </button>
                    </div>
                </div>

                {/* Lightbox */}
                {lightboxOpen && (
                    <div
                        className="lightbox-overlay"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                            <img
                                src={invoiceUrl}
                                alt="Invoice full view"
                                className="lightbox-image"
                            />
                            <button
                                className="lightbox-close"
                                onClick={() => setLightboxOpen(false)}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--surface-card)" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Fallback for unknown type
    return (
        <div className="invoice-display unknown-display">
            <span className="file-name">{displayName}</span>
            <button
                type="button"
                className="btn-action"
                onClick={handleDownload}
            >
                Download
            </button>
        </div>
    );
};

export default InvoiceDisplay;
