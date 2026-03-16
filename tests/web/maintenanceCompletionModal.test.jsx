import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MaintenanceCompletionModal from '../../apps/web/src/features/maintenance/components/MaintenanceCompletionModal.jsx';
import { signOffWindow } from '../../apps/web/src/features/maintenance/api/maintenanceApi.js';
import { useSignOffEligibility } from '../../apps/web/src/features/maintenance/hooks/useMaintenance.js';

vi.mock('../../apps/web/src/features/maintenance/api/maintenanceApi.js', () => ({
    signOffWindow: vi.fn()
}));

vi.mock('../../apps/web/src/features/maintenance/hooks/useMaintenance.js', () => ({
    useSignOffEligibility: vi.fn()
}));

const baseWindow = {
    id: 'window-1',
    scheduledStartDate: new Date().toISOString(),
    cycleConfig: { name: 'Quarterly PM' },
    checklist: {
        items: [
            {
                id: 'item-1',
                title: 'Check This',
                description: 'Must be completed',
                isRequired: true
            }
        ]
    }
};

const renderModal = (props = {}) => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
        <MaintenanceCompletionModal
            window={baseWindow}
            onClose={onClose}
            onSuccess={onSuccess}
            {...props}
        />
    );

    return { onClose, onSuccess };
};

describe('MaintenanceCompletionModal assisted sign-off', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        useSignOffEligibility.mockReturnValue({
            data: { canSignOff: true }
        });

        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            fillStyle: '#fff',
            fillRect: vi.fn(),
            lineWidth: 2,
            lineCap: 'round',
            strokeStyle: '#000',
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            setTransform: vi.fn()
        }));

        HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AAAA');
    });

    const completeRequiredChecklistItem = async () => {
        const checkbox = await screen.findByRole('checkbox', { name: /Check This/i });
        fireEvent.keyDown(checkbox, { key: ' ', code: 'Space' });
        await waitFor(() => {
            expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
    };

    it('renders assisted toggle', () => {
        renderModal();
        expect(screen.getByLabelText('Use handover signer')).toBeInTheDocument();
    });

    it('enabling assisted mode requires signer name and signature before submit', async () => {
        renderModal();

        await completeRequiredChecklistItem();

        const submitButton = screen.getByRole('button', { name: 'Complete & Sign-Off' });
        expect(submitButton).toBeEnabled();

        fireEvent.click(screen.getByLabelText('Use handover signer'));
        expect(submitButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/Signer Full Name/i), { target: { value: 'Device Owner' } });
        expect(submitButton).toBeDisabled();

        const signaturePad = screen.getByTestId('signature-pad');
        fireEvent.pointerDown(signaturePad, { pointerId: 1, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(signaturePad, { pointerId: 1, clientX: 20, clientY: 20 });
        fireEvent.pointerUp(signaturePad, { pointerId: 1, clientX: 20, clientY: 20 });

        expect(submitButton).toBeEnabled();
    });

    it('submits standard payload without assistedSigner', async () => {
        signOffWindow.mockResolvedValue({ id: 'completion-1' });
        const { onClose, onSuccess } = renderModal();

        await completeRequiredChecklistItem();
        fireEvent.click(screen.getByRole('button', { name: 'Complete & Sign-Off' }));

        await waitFor(() => {
            expect(signOffWindow).toHaveBeenCalledTimes(1);
        });

        const [, payload] = signOffWindow.mock.calls[0];
        expect(payload).not.toHaveProperty('assistedSigner');
        expect(payload.completedItems[0].isCompleted).toBe(true);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('submits assisted payload only when toggle is enabled', async () => {
        signOffWindow.mockResolvedValue({ id: 'completion-2' });
        renderModal();

        await completeRequiredChecklistItem();
        fireEvent.click(screen.getByLabelText('Use handover signer'));
        fireEvent.change(screen.getByLabelText(/Signer Full Name/i), { target: { value: 'Device Owner' } });

        const signaturePad = screen.getByTestId('signature-pad');
        fireEvent.pointerDown(signaturePad, { pointerId: 1, clientX: 12, clientY: 12 });
        fireEvent.pointerMove(signaturePad, { pointerId: 1, clientX: 30, clientY: 20 });
        fireEvent.pointerUp(signaturePad, { pointerId: 1, clientX: 30, clientY: 20 });

        fireEvent.click(screen.getByRole('button', { name: 'Complete & Sign-Off' }));

        await waitFor(() => {
            expect(signOffWindow).toHaveBeenCalledTimes(1);
        });

        const [, payload] = signOffWindow.mock.calls[0];
        expect(payload).toHaveProperty('assistedSigner');
        expect(payload.assistedSigner).toEqual({
            name: 'Device Owner',
            signatureDataUrl: 'data:image/png;base64,AAAA'
        });
    });

    it('clear signature resets assisted-mode validity state', async () => {
        renderModal();

        await completeRequiredChecklistItem();
        fireEvent.click(screen.getByLabelText('Use handover signer'));
        fireEvent.change(screen.getByLabelText(/Signer Full Name/i), { target: { value: 'Device Owner' } });

        const signaturePad = screen.getByTestId('signature-pad');
        fireEvent.pointerDown(signaturePad, { pointerId: 1, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(signaturePad, { pointerId: 1, clientX: 18, clientY: 18 });
        fireEvent.pointerUp(signaturePad, { pointerId: 1, clientX: 18, clientY: 18 });

        const submitButton = screen.getByRole('button', { name: 'Complete & Sign-Off' });
        expect(submitButton).toBeEnabled();

        fireEvent.click(screen.getByRole('button', { name: 'Clear Signature' }));
        expect(submitButton).toBeDisabled();
    });
});
