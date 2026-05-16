/* eslint-disable react/prop-types */
import { useEffect, useId, useState } from 'react';
import {
    useCompleteMaintenanceRun,
    useMaintenanceRun,
    useStartMaintenanceRun,
    useUpdateMaintenanceRunItem
} from '../hooks/useMaintenance.js';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskAssetLabel, formatTaskPolicyLabel } from '../utils/taskUrgency.js';
import { formatDisplayDate } from '../../../shared/utils/date-format.js';
import './MaintenanceTaskDrawer.css';

const RESULT = Object.freeze({
    pass: 'pass',
    fail: 'fail',
    na: 'na',
    pending: 'pending'
});

const statusFromResult = (result) => {
    if (result === RESULT.pass) return 'pass';
    if (result === RESULT.fail) return 'fail';
    if (result === RESULT.na) return 'na';
    return 'pending';
};

const resultFromStatus = (status) => {
    if (status === 'pass' || status === 'fail' || status === 'na') return status;
    return null;
};

function SegmentButtons({ value, onChange, disabled }) {
    return (
        <div className="maintenance-task-drawer__segments" role="group" aria-label="Checklist result">
            {[
                { id: RESULT.pass, label: 'Pass' },
                { id: RESULT.fail, label: 'Fail' },
                { id: RESULT.na, label: 'N/A' }
            ].map((option) => (
                <button
                    key={option.id}
                    type="button"
                    className={`maintenance-task-drawer__segment${value === option.id ? ' is-selected' : ''}`}
                    aria-pressed={value === option.id}
                    disabled={disabled}
                    onClick={() => onChange(option.id)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function MetaRow({ label, value, secondary }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>
                {value}
                {secondary ? <code>{secondary}</code> : null}
            </dd>
        </div>
    );
}

const MaintenanceTaskDrawer = ({ task, readOnly = false, onClose, onSuccess }) => {
    const titleId = useId();
    const runId = task?.id;
    const { data: runDetail } = useMaintenanceRun(runId, Boolean(runId));
    const startRun = useStartMaintenanceRun();
    const updateItem = useUpdateMaintenanceRunItem();
    const completeRun = useCompleteMaintenanceRun();

    const run = runDetail || task;
    const [itemNotes, setItemNotes] = useState({});
    const [expandedEvidence, setExpandedEvidence] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!runId || readOnly) return;
        startRun.mutate(runId, {
            onError: (err) => setError(err.message || 'Failed to start maintenance run')
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runId, readOnly]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const items = run?.items || [];
    const assignee = formatTechnician(run?.assignedTo);
    const assetLabel = formatTaskAssetLabel(run);
    const policyLabel = formatTaskPolicyLabel(run);

    const requiredItems = items.filter((item) => item.required);
    const allRequiredAnswered = requiredItems.every(
        (item) => resultFromStatus(item.status) != null
    );
    const isTerminal = ['completed', 'cancelled', 'skipped'].includes(String(run?.status || '').toLowerCase());
    const canComplete =
        !readOnly &&
        !isTerminal &&
        allRequiredAnswered &&
        items.length > 0 &&
        !completeRun.isPending;

    const handleItemResult = async (item, result) => {
        if (readOnly) return;
        const status = statusFromResult(result);
        try {
            await updateItem.mutateAsync({
                itemId: item.id,
                data: {
                    status,
                    notes: itemNotes[item.id] || undefined
                }
            });
        } catch (err) {
            setError(err.message || 'Failed to save checklist item');
        }
    };

    const handleComplete = async (event) => {
        event.preventDefault();
        if (!canComplete || !runId) return;
        setError(null);
        try {
            await completeRun.mutateAsync(runId);
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to complete maintenance');
        }
    };

    if (!run) return null;

    return (
        <>
            <button type="button" className="maintenance-task-drawer__backdrop" aria-label="Close task panel" onClick={onClose} />
            <aside className="maintenance-task-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className="maintenance-task-drawer__header">
                    <div id={titleId} className="maintenance-task-drawer__title">
                        <h2>{assetLabel}</h2>
                        <p>{policyLabel}</p>
                        {readOnly ? <p className="maintenance-task-drawer__readonly-badge">Audit record</p> : null}
                    </div>
                    <button type="button" className="workspace-icon-button" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </header>

                <div className="maintenance-task-drawer__meta">
                    <dl>
                        <MetaRow label="Asset" value={assetLabel} />
                        <MetaRow label="Policy" value={policyLabel} />
                        <MetaRow label="Due" value={formatDisplayDate(run.dueDate, { fallback: '—' })} />
                        <MetaRow label="Technician" value={assignee.primary} secondary={assignee.secondary} />
                        <MetaRow label="Status" value={run.status} />
                        {run.completedAt ? (
                            <MetaRow
                                label="Completed"
                                value={formatDisplayDate(run.completedAt, { fallback: '—' })}
                            />
                        ) : null}
                    </dl>
                </div>

                <form className="maintenance-task-drawer__body" onSubmit={handleComplete}>
                    {error ? <p className="maintenance-task-drawer__error" role="alert">{error}</p> : null}

                    <h3 className="maintenance-task-drawer__section-title">Checklist</h3>
                    {items.length === 0 ? (
                        <p className="maintenance-task-drawer__empty">No checklist items on this task.</p>
                    ) : (
                        <ul className="maintenance-task-drawer__checklist">
                            {items.map((item) => {
                                const result = resultFromStatus(item.status);
                                return (
                                    <li key={item.id} className="maintenance-task-drawer__item">
                                        <div className="maintenance-task-drawer__item-head">
                                            <p className="maintenance-task-drawer__item-title">
                                                {item.title}
                                                {item.required ? <span className="req-star">*</span> : null}
                                            </p>
                                            {item.description ? (
                                                <p className="maintenance-task-drawer__item-desc">{item.description}</p>
                                            ) : null}
                                            {readOnly && item.completedAt ? (
                                                <p className="maintenance-task-drawer__item-audit">
                                                    {item.status?.toUpperCase()} ·{' '}
                                                    {formatDisplayDate(item.completedAt, { fallback: '—' })}
                                                    {item.completedBy?.username
                                                        ? ` · ${item.completedBy.username}`
                                                        : ''}
                                                </p>
                                            ) : null}
                                        </div>
                                        <SegmentButtons
                                            value={result}
                                            disabled={readOnly}
                                            onChange={(next) => handleItemResult(item, next)}
                                        />
                                        {item.evidenceRequired &&
                                        (result === RESULT.pass || result === RESULT.fail) ? (
                                            <div className="maintenance-task-drawer__evidence">
                                                <label className="maintenance-task-drawer__notes-label" htmlFor={`evidence-${item.id}`}>
                                                    Evidence / notes
                                                </label>
                                                <textarea
                                                    id={`evidence-${item.id}`}
                                                    className="maintenance-task-drawer__evidence-input"
                                                    rows={3}
                                                    readOnly={readOnly}
                                                    placeholder="Notes or evidence reference…"
                                                    value={itemNotes[item.id] ?? item.notes ?? ''}
                                                    onChange={(event) =>
                                                        setItemNotes((prev) => ({
                                                            ...prev,
                                                            [item.id]: event.target.value
                                                        }))
                                                    }
                                                    onBlur={() => {
                                                        if (!readOnly && itemNotes[item.id] != null) {
                                                            handleItemResult(item, result || RESULT.pass);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {!readOnly ? (
                        <footer className="maintenance-task-drawer__footer">
                            <button type="button" className="workspace-inline-button" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`workspace-inline-button is-primary${canComplete ? '' : ' is-disabled'}`}
                                disabled={!canComplete}
                            >
                                {completeRun.isPending ? 'Completing…' : 'Complete maintenance'}
                            </button>
                        </footer>
                    ) : null}
                </form>
            </aside>
        </>
    );
};

export default MaintenanceTaskDrawer;
