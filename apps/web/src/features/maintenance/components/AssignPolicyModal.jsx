/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMaintenanceProfiles, preventiveKeys } from '../hooks/useMaintenance.js';
import { createMaintenanceAssignment } from '../api/preventiveMaintenanceApi.js';
import { fetchUsers } from '../../users/users-api.js';
import { useToast } from '../../../shared/hooks/useToast.js';
import './AssignPolicyModal.css';

const AssignPolicyModal = ({ rows = [], onClose, onSuccess }) => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const { data: profiles = [] } = useMaintenanceProfiles(false);
    const [profileId, setProfileId] = useState('');
    const [technicianId, setTechnicianId] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoadingTechnicians(true);
                const result = await fetchUsers({ role: 'it', status: 'active' });
                setTechnicians(result.users || result || []);
            } catch {
                setError('Failed to load technicians');
            } finally {
                setIsLoadingTechnicians(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    const canSave = profileId && technicianId && rows.length > 0 && !isSaving;

    const handleSave = async (event) => {
        event.preventDefault();
        if (!canSave) return;

        setIsSaving(true);
        setError(null);
        try {
            for (const row of rows) {
                await createMaintenanceAssignment({
                    assetId: row.assetId,
                    profileId,
                    userId: technicianId
                });
            }
            await queryClient.invalidateQueries({ queryKey: preventiveKeys.all });
            toast.success(
                'Assignments confirmed',
                `${rows.length} asset${rows.length === 1 ? '' : 's'} linked. Cron will schedule upcoming runs.`
            );
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save assignments');
        } finally {
            setIsSaving(false);
        }
    };

    const modal = (
        <div className="assign-policy-overlay" role="presentation" onClick={onClose}>
            <div
                className="assign-policy-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-policy-title"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="maintenance-window-detail-header">
                    <div>
                        <h2 id="assign-policy-title">Assign policy</h2>
                        <p className="assign-policy-modal__subtitle">
                            {rows.length} asset{rows.length === 1 ? '' : 's'} selected
                        </p>
                    </div>
                    <button type="button" className="workspace-icon-button" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </header>

                <form className="assign-policy-modal__form" onSubmit={handleSave}>
                    {error ? <p className="maintenance-task-drawer__error" role="alert">{error}</p> : null}

                    <label className="form-group" htmlFor="assign-policy-select">
                        Select policy
                    </label>
                    <select
                        id="assign-policy-select"
                        value={profileId}
                        onChange={(event) => setProfileId(event.target.value)}
                        required
                    >
                        <option value="">Choose maintenance policy…</option>
                        {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.name}
                            </option>
                        ))}
                    </select>

                    {profiles.length === 0 ? (
                        <p className="assign-policy-modal__handoff">
                            No policies yet. Create one under Policies &amp; Checklists first.
                        </p>
                    ) : null}

                    <label className="form-group" htmlFor="assign-technician-select">
                        Assign technician
                    </label>
                    {isLoadingTechnicians ? (
                        <p className="maintenance-muted">Loading technicians…</p>
                    ) : (
                        <select
                            id="assign-technician-select"
                            value={technicianId}
                            onChange={(event) => setTechnicianId(event.target.value)}
                            required
                        >
                            <option value="">Choose technician…</option>
                            {technicians.map((tech) => (
                                <option key={tech.id} value={tech.id}>
                                    {tech.displayName || tech.username}
                                </option>
                            ))}
                        </select>
                    )}

                    <p className="assign-policy-modal__handoff">
                        After confirm, scheduling is automatic — tasks appear on the technician dashboard when due.
                    </p>

                    <div className="maintenance-window-detail-actions">
                        <button type="button" className="workspace-inline-button" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="workspace-inline-button is-primary" disabled={!canSave}>
                            {isSaving ? 'Confirming…' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default AssignPolicyModal;
