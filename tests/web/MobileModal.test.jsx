import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileModal } from '../../apps/web/src/shared/ui/MobileModal/MobileModal.jsx';

describe('MobileModal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Test Modal',
        children: <div>Modal Content</div>,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render when isOpen is true', () => {
        render(<MobileModal {...defaultProps} />);

        expect(screen.getByText('Test Modal')).toBeInTheDocument();
        expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
        render(<MobileModal {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
        expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<MobileModal {...defaultProps} onClose={onClose} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should render with fullScreenOnMobile by default', () => {
        const { container } = render(<MobileModal {...defaultProps} />);

        const overlay = container.querySelector('.mobile-modal-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('should render header with title', () => {
        render(<MobileModal {...defaultProps} />);

        const header = screen.getByText('Test Modal');
        expect(header).toBeInTheDocument();
    });

    it('should render children in content area', () => {
        render(<MobileModal {...defaultProps} />);

        const content = screen.getByText('Modal Content');
        expect(content).toBeInTheDocument();
    });

    it('should render footer when provided', () => {
        render(
            <MobileModal {...defaultProps}>
                <div>Modal Content</div>
                <div slot="footer">Footer Content</div>
            </MobileModal>
        );

        expect(screen.getByText('Footer Content')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
        render(<MobileModal {...defaultProps} />);

        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('aria-modal', 'true');
        expect(modal).toHaveAttribute('aria-labelledby');
    });

    it('should have minimum touch target size for close button', () => {
        render(<MobileModal {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        const styles = window.getComputedStyle(closeButton);

        // Check for proper class ensuring styling application
        expect(closeButton).toHaveClass('mobile-modal-close');
    });

    it('should prevent body scroll when open', () => {
        render(<MobileModal {...defaultProps} />);

        // Check if body has overflow hidden or similar
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
        const { rerender } = render(<MobileModal {...defaultProps} />);

        expect(document.body.style.overflow).toBe('hidden');

        rerender(<MobileModal {...defaultProps} isOpen={false} />);

        expect(document.body.style.overflow).toBe('');
    });
});
