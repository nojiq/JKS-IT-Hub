/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from 'react';
import { signOffWindow } from '../api/maintenanceApi.js';
import { useSignOffEligibility } from '../hooks/useMaintenance.js';
import { MobileModal } from '../../../shared/ui/MobileModal/MobileModal';
import { TouchCheckbox } from '../../../shared/ui/TouchCheckbox/TouchCheckbox';
import './MaintenanceCompletionModal.css';

const MaintenanceCompletionModal = ({ window: maintenanceWindow, onClose, onSuccess }) => {
    const [checklistItems, setChecklistItems] = useState([]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [serverIncompleteItems, setServerIncompleteItems] = useState([]);
    const [isDraftHydrated, setIsDraftHydrated] = useState(false);
    const [useAssistedSigner, setUseAssistedSigner] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [hasSignature, setHasSignature] = useState(false);
    const [signerValidationError, setSignerValidationError] = useState('');
    const signatureCanvasRef = useRef(null);
    const isDrawingRef = useRef(false);
    const { data: eligibility } = useSignOffEligibility(maintenanceWindow?.id);

    const initializeSignaturePad = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.strokeStyle = '#0f172a';
        context.beginPath();
        setHasSignature(false);
        setSignerValidationError('');
    };

    useEffect(() => {
        if (!maintenanceWindow) return;
        setIsDraftHydrated(false);

        // Try to find checklist in window object
        // Depending on API response, it might be 'checklist' or 'checklistTemplate'
        // Repo getMaintenanceWindowById uses `include: { checklist: ... }` if requested.
        const items = maintenanceWindow.checklistSnapshot?.items || maintenanceWindow.checklist?.items || maintenanceWindow.checklistTemplate?.items || [];
        const storageKey = `maintenance-signoff:${maintenanceWindow.id}`;
        let saved = null;
        try {
            const raw = localStorage.getItem(storageKey);
            saved = raw ? JSON.parse(raw) : null;
        } catch {
            saved = null;
        }

        const completedById = new Set(saved?.completedChecklistItemIds || []);

        setChecklistItems(items.map(item => ({
            checklistItemId: item.id || item.checklistItemId, // Handle different shapes
            itemTitle: item.title,
            itemDescription: item.description,
            isRequired: item.isRequired,
            isCompleted: completedById.has(item.id || item.checklistItemId)
        })));

        setNotes(saved?.notes || '');
        setUseAssistedSigner(false);
        setSignerName('');
        setSignerValidationError('');
        setHasSignature(false);
        setIsDraftHydrated(true);
    }, [maintenanceWindow]);

    useEffect(() => {
        if (!maintenanceWindow?.id || !isDraftHydrated) return;
        const storageKey = `maintenance-signoff:${maintenanceWindow.id}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify({
                completedChecklistItemIds: checklistItems
                    .filter((item) => item.isCompleted)
                    .map((item) => item.checklistItemId),
                notes
            }));
        } catch {
            // Ignore storage failures (private mode/quota).
        }
    }, [maintenanceWindow?.id, checklistItems, notes, isDraftHydrated]);

    const handleCheckboxChange = (id) => {
        setChecklistItems(prev => prev.map(item =>
            item.checklistItemId === id ? { ...item, isCompleted: !item.isCompleted } : item
        ));
        setServerIncompleteItems([]);
    };

    useEffect(() => {
        if (!useAssistedSigner) {
            isDrawingRef.current = false;
            return;
        }

        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const displayWidth = Math.max(Math.floor(rect.width), 1);
        const displayHeight = 180;
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(displayWidth * pixelRatio);
        canvas.height = Math.floor(displayHeight * pixelRatio);
        canvas.style.height = `${displayHeight}px`;

        const context = canvas.getContext('2d');
        if (!context) return;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        initializeSignaturePad();
    }, [useAssistedSigner]);

    const getCanvasPoint = (event) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const startDrawing = (event) => {
        const canvas = signatureCanvasRef.current;
        const context = canvas?.getContext('2d');
        const point = getCanvasPoint(event);
        if (!canvas || !context || !point) return;

        isDrawingRef.current = true;
        if (canvas.setPointerCapture) {
            canvas.setPointerCapture(event.pointerId);
        }
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        setHasSignature(true);
        setSignerValidationError('');
        event.preventDefault();
    };

    const draw = (event) => {
        if (!isDrawingRef.current) return;
        const canvas = signatureCanvasRef.current;
        const context = canvas?.getContext('2d');
        const point = getCanvasPoint(event);
        if (!canvas || !context || !point) return;

        context.lineTo(point.x, point.y);
        context.stroke();
        event.preventDefault();
    };

    const stopDrawing = (event) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const canvas = signatureCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (context) {
            context.beginPath();
        }
        if (canvas?.releasePointerCapture) {
            canvas.releasePointerCapture(event.pointerId);
        }
    };

    const missingRequiredItems = checklistItems.filter(
        (item) => item.isRequired && !item.isCompleted
    );

    const isFormValid = () => {
        if (missingRequiredItems.length > 0) return false;
        if (!useAssistedSigner) return true;
        return signerName.trim().length > 0 && hasSignature;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid()) return;

        setIsSubmitting(true);
        setError(null);
        setSignerValidationError('');

        try {
            let assistedSigner = undefined;
            if (useAssistedSigner) {
                if (!signerName.trim()) {
                    setSignerValidationError('Signer full name is required.');
                    setIsSubmitting(false);
                    return;
                }
                if (!hasSignature || !signatureCanvasRef.current) {
                    setSignerValidationError('Signer signature is required.');
                    setIsSubmitting(false);
                    return;
                }
                assistedSigner = {
                    name: signerName.trim(),
                    signatureDataUrl: signatureCanvasRef.current.toDataURL('image/png')
                };
            }

            const payload = {
                completedItems: checklistItems,
                notes
            };
            if (assistedSigner) {
                payload.assistedSigner = assistedSigner;
            }

            await signOffWindow(maintenanceWindow.id, payload);
            try {
                localStorage.removeItem(`maintenance-signoff:${maintenanceWindow.id}`);
            } catch {
                // Ignore storage failures.
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            setServerIncompleteItems(err?.problem?.incompleteRequiredItems || []);
            setError(err.message || "Failed to complete maintenance");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!maintenanceWindow) return null;

    return (
        <MobileModal
            isOpen={true}
            onClose={onClose}
            title="Maintenance Sign-Off"
        >
            <div className="window-summary">
                <p><strong>Cycle:</strong> {maintenanceWindow.cycleConfig?.name}</p>
                <p><strong>Scheduled:</strong> {new Date(maintenanceWindow.scheduledStartDate).toLocaleDateString()}</p>
                {maintenanceWindow.assignedTo && <p><strong>Assigned To:</strong> {maintenanceWindow.assignedTo.username}</p>}
            </div>

            {error && <div className="error-message">{error}</div>}
            {eligibility && !eligibility.canSignOff && (
                <div className="error-message">{eligibility.reason || 'Sign-off is not currently allowed for this window.'}</div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="checklist-section">
                    <h3>Checklist</h3>
                    {missingRequiredItems.length > 0 && (
                        <div className="error-message" style={{ marginBottom: '0.75rem' }}>
                            Please complete required items before sign-off:
                            <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                                {missingRequiredItems.map((item) => (
                                    <li key={item.checklistItemId}>{item.itemTitle}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {serverIncompleteItems.length > 0 && (
                        <div className="error-message" style={{ marginBottom: '0.75rem' }}>
                            Server validation failed for required items:
                            <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                                {serverIncompleteItems.map((item) => (
                                    <li key={item.itemId}>{item.itemTitle}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {checklistItems.length === 0 ? (
                        <p>No checklist items found for this window. Please ensure checklist is configured.</p>
                    ) : (
                        <ul className="checklist-items">
                            {checklistItems.map(item => (
                                <li key={item.checklistItemId} className="checklist-item">
                                    <TouchCheckbox
                                        id={`item-${item.checklistItemId}`}
                                        checked={item.isCompleted}
                                        onChange={() => handleCheckboxChange(item.checklistItemId)}
                                        label={
                                            <span className={item.isRequired ? 'required' : ''}>
                                                {item.itemTitle}
                                                {item.isRequired && <span className="req-star">*</span>}
                                            </span>
                                        }
                                    />
                                    {item.itemDescription && <p className="item-desc">{item.itemDescription}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="notes-section">
                    <label htmlFor="notes">Completion Notes (Optional)</label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="Any observations or issues..."
                    />
                </div>

                <div className="assisted-signoff-section">
                    <label className="assisted-toggle" htmlFor="use-assisted-signer">
                        <input
                            id="use-assisted-signer"
                            type="checkbox"
                            checked={useAssistedSigner}
                            onChange={(event) => {
                                const checked = event.target.checked;
                                setUseAssistedSigner(checked);
                                if (!checked) {
                                    setSignerName('');
                                    setSignerValidationError('');
                                    setHasSignature(false);
                                }
                            }}
                        />
                        <span>Use handover signer</span>
                    </label>

                    {useAssistedSigner && (
                        <div className="assisted-fields">
                            <label htmlFor="signer-name">
                                Signer Full Name <span className="req-star">*</span>
                            </label>
                            <input
                                id="signer-name"
                                type="text"
                                value={signerName}
                                onChange={(event) => {
                                    setSignerName(event.target.value);
                                    setSignerValidationError('');
                                }}
                                maxLength={200}
                                placeholder="Enter signer full name"
                            />

                            <label htmlFor="signature-pad">
                                Signature <span className="req-star">*</span>
                            </label>
                            <canvas
                                id="signature-pad"
                                className="signature-pad"
                                ref={signatureCanvasRef}
                                aria-label="Signer signature pad"
                                data-testid="signature-pad"
                                onPointerDown={startDrawing}
                                onPointerMove={draw}
                                onPointerUp={stopDrawing}
                                onPointerLeave={stopDrawing}
                            />
                            <div className="signature-actions">
                                <button type="button" className="clear-signature-btn" onClick={initializeSignaturePad}>
                                    Clear Signature
                                </button>
                            </div>
                            <p className="signature-hint">Hand device to signer and ask them to draw their signature.</p>
                        </div>
                    )}

                    {signerValidationError && (
                        <div className="error-message" style={{ marginTop: '0.75rem' }}>
                            {signerValidationError}
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={!isFormValid() || isSubmitting || checklistItems.length === 0 || (eligibility && !eligibility.canSignOff)}
                    >
                        {isSubmitting ? 'Signing Off...' : 'Complete & Sign-Off'}
                    </button>
                </div>
            </form>
        </MobileModal>
    );
};

export default MaintenanceCompletionModal;
