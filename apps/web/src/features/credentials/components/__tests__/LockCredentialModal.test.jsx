
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LockCredentialModal from '../LockCredentialModal';

describe('LockCredentialModal', () => {
    const defaultProps = {
        isOpen: true,
        credential: {
            id: 'cred-123',
            system: 'email',
            systemName: 'Email System',
            userId: 'user-1',
            userName: 'John Doe'
        },
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        isLoading: false,
        error: null
    };

    it('should calculate system label correctly', () => {
        const { rerender } = render(<LockCredentialModal {...defaultProps} />);
        expect(screen.getByText('Email System')).toBeInTheDocument();

        rerender(<LockCredentialModal {...defaultProps} credential={{ ...defaultProps.credential, systemName: null, systemId: 'sys-id' }} />);
        expect(screen.getByText('sys-id')).toBeInTheDocument();

        rerender(<LockCredentialModal {...defaultProps} credential={{ ...defaultProps.credential, systemName: null, systemId: null }} />);
        expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('should render correctly when open', () => {
        render(<LockCredentialModal {...defaultProps} />);
        expect(screen.getByRole('heading', { name: 'Lock Credential' })).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Email System')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
        render(<LockCredentialModal {...defaultProps} isOpen={false} />);
        expect(screen.queryByRole('heading', { name: 'Lock Credential' })).not.toBeInTheDocument();
    });

    it('should handle reason input', () => {
        render(<LockCredentialModal {...defaultProps} />);
        const textarea = screen.getByPlaceholderText(/reason/i);
        fireEvent.change(textarea, { target: { value: 'Security breach' } });
        expect(textarea.value).toBe('Security breach');
    });

    it('should call onConfirm with reason when submitted', () => {
        render(<LockCredentialModal {...defaultProps} />);
        const textarea = screen.getByPlaceholderText(/reason/i);
        fireEvent.change(textarea, { target: { value: 'Security breach' } });

        const lockButton = screen.getByRole('button', { name: 'Lock Credential' });
        fireEvent.click(lockButton);

        expect(defaultProps.onConfirm).toHaveBeenCalledWith('Security breach');
    });

    it('should show loading state', () => {
        render(<LockCredentialModal {...defaultProps} isLoading={true} />);
        const lockButton = screen.getByText('Locking...');
        expect(lockButton).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
    });

    it('should show error message', () => {
        const error = new Error('Lock failed');
        render(<LockCredentialModal {...defaultProps} error={error} />);
        expect(screen.getByText('Lock failed')).toBeInTheDocument();
    });
});
