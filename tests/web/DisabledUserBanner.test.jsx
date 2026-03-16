import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DisabledUserBanner from '../../apps/web/src/features/credentials/components/DisabledUserBanner.jsx';
import CredentialGenerator from '../../apps/web/src/features/credentials/generation/CredentialGenerator.jsx';
import CredentialRegeneration from '../../apps/web/src/features/credentials/regeneration/CredentialRegeneration.jsx';
import CredentialOverrideModal from '../../apps/web/src/features/credentials/override/CredentialOverrideModal.jsx';
import * as credentialHooks from '../../apps/web/src/features/credentials/hooks/useCredentials.js';

vi.mock('../../apps/web/src/features/credentials/hooks/useCredentials.js', () => ({
    usePreviewCredentials: vi.fn(),
    useConfirmCredentials: vi.fn(),
    useUserCredentials: vi.fn(),
    usePreviewOverride: vi.fn(),
    useConfirmOverride: vi.fn()
}));

vi.mock('../../apps/web/src/features/credentials/generation/GenerationError.jsx', () => ({
    default: ({ error }) => <div data-testid="generation-error">{error?.message || 'error'}</div>
}));

vi.mock('../../apps/web/src/features/credentials/components/CredentialList.jsx', () => ({
    default: () => <div data-testid="credential-list">credential-list</div>
}));

vi.mock('../../apps/web/src/features/credentials/preview/CredentialPreview.jsx', () => ({
    default: () => <div data-testid="credential-preview">preview</div>
}));

vi.mock('../../apps/web/src/shared/hooks/useToast.js', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        showToast: vi.fn(),
        hideToast: vi.fn()
    })
}));

/**
 * Story 2.10: Disabled User Guardrails - Frontend Component Tests
 * 
 * Tests for AC4: Visual indicators in UI for disabled users
 */

describe('DisabledUserBanner Component', () => {
    const defaultProps = {
        userName: 'John Doe',
        userStatus: 'disabled',
        canEnableUser: false
    };

    it('should render banner when user is disabled', () => {
        render(<DisabledUserBanner {...defaultProps} />);
        
        const banner = screen.getByTestId('disabled-user-banner');
        expect(banner).toBeInTheDocument();
        expect(screen.getByText('Credential Operations Blocked')).toBeInTheDocument();
        expect(banner).toHaveTextContent('John Doe is currently disabled');
    });

    it('should not render when user is not disabled', () => {
        const props = { ...defaultProps, userStatus: 'active' };
        const { container } = render(<DisabledUserBanner {...props} />);
        
        expect(container.firstChild).toBeNull();
    });

    it('should not render when userStatus is undefined', () => {
        const props = { ...defaultProps, userStatus: undefined };
        const { container } = render(<DisabledUserBanner {...props} />);
        
        expect(container.firstChild).toBeNull();
    });

    it('should display enable user button when canEnableUser is true', () => {
        const props = { ...defaultProps, canEnableUser: true, onEnableUser: vi.fn() };
        render(<DisabledUserBanner {...props} />);
        
        expect(screen.getByTestId('enable-user-button')).toBeInTheDocument();
        expect(screen.getByText('Enable User')).toBeInTheDocument();
    });

    it('should not display enable user button when canEnableUser is false', () => {
        render(<DisabledUserBanner {...defaultProps} />);
        
        expect(screen.queryByTestId('enable-user-button')).not.toBeInTheDocument();
    });

    it('should call onEnableUser when enable button is clicked', () => {
        const mockEnableUser = vi.fn();
        const props = {
            ...defaultProps,
            canEnableUser: true,
            onEnableUser: mockEnableUser
        };
        
        render(<DisabledUserBanner {...props} />);
        
        const enableButton = screen.getByTestId('enable-user-button');
        fireEvent.click(enableButton);
        
        expect(mockEnableUser).toHaveBeenCalledTimes(1);
    });

    it('should show correct icon and styling', () => {
        render(<DisabledUserBanner {...defaultProps} />);
        
        const banner = screen.getByTestId('disabled-user-banner');
        expect(banner).toHaveClass('disabled-user-banner');
    });
});

describe('CredentialGenerator Disabled State', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        credentialHooks.useUserCredentials.mockReturnValue({
            data: { data: [] },
            isLoading: false,
            refetch: vi.fn()
        });
        credentialHooks.usePreviewCredentials.mockReturnValue({
            isPending: false,
            mutateAsync: vi.fn()
        });
        credentialHooks.useConfirmCredentials.mockReturnValue({
            isPending: false,
            mutateAsync: vi.fn(),
            error: null
        });
        credentialHooks.usePreviewOverride.mockReturnValue({
            isPending: false,
            mutateAsync: vi.fn()
        });
        credentialHooks.useConfirmOverride.mockReturnValue({
            isPending: false,
            mutateAsync: vi.fn()
        });
    });

    it('should disable generate button for disabled user', () => {
        render(
            <CredentialGenerator
                userId="user-id"
                userName="Disabled User"
                userStatus="disabled"
            />
        );

        const button = screen.getByRole('button', { name: 'Generate Credentials' });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('title', 'Cannot generate credentials for disabled users');
    });

    it('should show DisabledUserBanner when user is disabled', () => {
        render(
            <CredentialGenerator
                userId="user-id"
                userName="Disabled User"
                userStatus="disabled"
            />
        );

        expect(screen.getByTestId('disabled-user-banner')).toBeInTheDocument();
        expect(screen.getByText(/Credential generation is disabled while user account is disabled/i)).toBeInTheDocument();
    });

    it('should surface enable user action in generator when permission is provided', () => {
        const onEnableUser = vi.fn();
        render(
            <CredentialGenerator
                userId="user-id"
                userName="Disabled User"
                userStatus="disabled"
                canEnableUser
                onEnableUser={onEnableUser}
            />
        );

        const enableButton = screen.getByTestId('enable-user-button');
        fireEvent.click(enableButton);
        expect(onEnableUser).toHaveBeenCalledTimes(1);
    });
});

describe('CredentialRegeneration Disabled State', () => {
    it('should show blocked state when user is disabled', () => {
        render(
            <CredentialRegeneration
                userId="user-id"
                userName="Disabled User"
                userStatus="disabled"
                onInitiateRegeneration={vi.fn()}
                onConfirmRegeneration={vi.fn()}
                onCancel={vi.fn()}
                onSuccess={vi.fn()}
            />
        );

        expect(screen.getByText('Regeneration Blocked')).toBeInTheDocument();
        expect(screen.getByText(/cannot have credentials regenerated/i)).toBeInTheDocument();
    });

    it('should not show start button when user is disabled', () => {
        render(
            <CredentialRegeneration
                userId="user-id"
                userName="Disabled User"
                userStatus="disabled"
                onInitiateRegeneration={vi.fn()}
                onConfirmRegeneration={vi.fn()}
                onCancel={vi.fn()}
                onSuccess={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: 'Start Regeneration' })).not.toBeInTheDocument();
    });
});

describe('CredentialOverrideModal Disabled State', () => {
    it('should show blocked state when user is disabled', () => {
        render(
            <CredentialOverrideModal
                isOpen
                onClose={vi.fn()}
                credential={{ id: 'cred-1', system: 'vpn', username: 'demo' }}
                userId="user-id"
                userStatus="disabled"
                onPreview={vi.fn()}
                onConfirm={vi.fn()}
                isLoading={false}
            />
        );

        expect(screen.getByRole('heading', { name: /Override Blocked - User Disabled/i })).toBeInTheDocument();
        expect(screen.getByText(/not allowed for disabled users/i)).toBeInTheDocument();
    });

    it('should hide form fields when user is disabled', () => {
        render(
            <CredentialOverrideModal
                isOpen
                onClose={vi.fn()}
                credential={{ id: 'cred-1', system: 'vpn', username: 'demo' }}
                userId="user-id"
                userStatus="disabled"
                onPreview={vi.fn()}
                onConfirm={vi.fn()}
                isLoading={false}
            />
        );

        expect(screen.queryByLabelText('Reason for Override *')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Preview Changes' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
});
