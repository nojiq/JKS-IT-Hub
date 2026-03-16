
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnlockCredentialModal from '../UnlockCredentialModal';

describe('UnlockCredentialModal', () => {
    const defaultProps = {
        isOpen: true,
        credential: {
            id: 'cred-123',
            system: 'vpn',
            systemName: 'VPN Access',
            userId: 'user-1',
            userName: 'Jane Doe'
        },
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        isLoading: false,
        error: null
    };

    it('should render correctly when open', () => {
        render(<UnlockCredentialModal {...defaultProps} />);
        expect(screen.getAllByText('Unlock Credential')[0]).toBeInTheDocument(); // Header and possibly button text
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('VPN Access')).toBeInTheDocument();
        expect(screen.getByText(/allow the credential to be regenerated/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
        render(<UnlockCredentialModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByText('Unlock Credential')).not.toBeInTheDocument();
    });

    it('should call onConfirm when unlock button is clicked', () => {
        render(<UnlockCredentialModal {...defaultProps} />);
        const unlockButton = screen.getByRole('button', { name: 'Unlock Credential' });
        fireEvent.click(unlockButton);
        expect(defaultProps.onConfirm).toHaveBeenCalled();
    });

    it('should call onClose when cancel button is clicked', () => {
        render(<UnlockCredentialModal {...defaultProps} />);
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should show loading state', () => {
        render(<UnlockCredentialModal {...defaultProps} isLoading={true} />);
        const unlockButton = screen.getByRole('button', { name: 'Unlocking...' });
        expect(unlockButton).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
    });

    it('should show error message', () => {
        const error = new Error('Unlock failed');
        render(<UnlockCredentialModal {...defaultProps} error={error} />);
        expect(screen.getByText('Unlock failed')).toBeInTheDocument();
    });
});
