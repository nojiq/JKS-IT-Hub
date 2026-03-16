import { useEffect } from 'react';
import { useIsMobile } from '../../hooks';
import './MobileModal.css';

/**
 * Mobile-optimized modal component
 * Renders as full-screen overlay on mobile, standard modal on desktop
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal content
 * @param {boolean} [props.fullScreenOnMobile=true] - Whether to use full-screen on mobile
 * @param {React.ReactNode} [props.footer] - Optional footer content
 */
export function MobileModal({
    isOpen,
    onClose,
    title,
    children,
    fullScreenOnMobile = true,
    footer
}) {
    const isMobile = useIsMobile();

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle ESC key to close
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        // Only close if clicking the overlay itself, not the modal content
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className={`mobile-modal-overlay ${isMobile && fullScreenOnMobile ? 'full-screen' : ''}`}
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-modal-title"
        >
            <div className="mobile-modal-container">
                <div className="mobile-modal-header">
                    <h2 id="mobile-modal-title" className="mobile-modal-title">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="mobile-modal-close"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="mobile-modal-content">
                    {children}
                </div>

                {footer && (
                    <div className="mobile-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
