
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegenerationBlockedModal from '../RegenerationBlockedModal';

describe('RegenerationBlockedModal', () => {
    const mockCredentials = [
        {
            systemId: 'email',
            systemName: 'Email',
            lockedBy: 'admin',
            lockedAt: '2026-02-01T10:00:00Z',
            lockReason: 'Security check'
        },
        {
            systemId: 'vpn',
            systemName: 'VPN',
            lockedBy: 'admin',
            lockedAt: '2026-02-01T11:00:00Z'
        }
    ];

    const defaultProps = {
        isOpen: true,
        lockedCredentials: mockCredentials,
        onCancel: vi.fn(),
        onSkipLocked: vi.fn(),
        onUnlockSelected: vi.fn(),
        isProcessing: false,
        error: null
    };

    it('should render correctly with locked credentials', () => {
        render(<RegenerationBlockedModal {...defaultProps} />);
        expect(screen.getByText('Credentials Locked')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('VPN')).toBeInTheDocument();
        expect(screen.getByText(/Security check/)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
        render(<RegenerationBlockedModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByText('Credentials Locked')).not.toBeInTheDocument();
    });

    it('should handle selection of credentials', () => {
        render(<RegenerationBlockedModal {...defaultProps} />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).not.toBeChecked();

        // Select first credential
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0]).toBeChecked();

        // Unlock button should become enabled
        const unlockButton = screen.getByText('Unlock Selected');
        expect(unlockButton).toBeEnabled();
    });

    it('should call onUnlockSelected with selected items only', () => {
        render(<RegenerationBlockedModal {...defaultProps} />);

        const checkboxes = screen.getAllByRole('checkbox');
        // Select first one (Email)
        fireEvent.click(checkboxes[0]);

        const unlockButton = screen.getByText('Unlock Selected');
        fireEvent.click(unlockButton);

        expect(defaultProps.onUnlockSelected).toHaveBeenCalledWith([mockCredentials[0]]);
    });

    it('should call onSkipLocked when skip button is clicked', () => {
        render(<RegenerationBlockedModal {...defaultProps} />);
        const skipButton = screen.getByText('Skip Locked');
        fireEvent.click(skipButton);
        expect(defaultProps.onSkipLocked).toHaveBeenCalled();
    });

    it('should show loading/processing state', () => {
        render(<RegenerationBlockedModal {...defaultProps} isProcessing={true} />);
        expect(screen.getByText('Unlocking...')).toBeDisabled();
        expect(screen.getByText('Skip Locked')).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes[0]).toBeDisabled();
    });

    it('should show error message', () => {
        const error = new Error('Unlock failed');
        render(<RegenerationBlockedModal {...defaultProps} error={error} />);
        expect(screen.getByText('Unlock failed')).toBeInTheDocument();
    });
});
