/* eslint-disable react/prop-types */
import { useEffect, useId, useState } from 'react';
import {
    useCompleteMaintenanceRun,
    useMaintenanceRun,
    useStartMaintenanceRun,
    useUpdateMaintenanceRunItem,
    useUploadMaintenanceRunItemEvidence
} from '../hooks/useMaintenance.js';
import { buildApiUrl } from '../../../shared/utils/api-client.js';
import { formatTechnician } from '../utils/maintenanceDisplay.js';
import { formatTaskAssetLabel, formatTaskPolicyLabel } from '../utils/taskUrgency.js';
import { formatDisplayDate } from '../../../shared/utils/date-format.js';
import './MaintenanceTaskDrawer.css';

const RESULT = Object.freeze({
    pass: 'pass',
    fail: 'fail',
    repair: 'repair',
    na: 'na',
    pending: 'pending'
});

const BATTERY_WARNING_HEALTH_PERCENT = 80;
const BATTERY_WARNING_CYCLE_COUNT = 800;
const HARD_DRIVE_WARNING_PERCENT = 80;

const toInputValue = (value) => (value === undefined || value === null ? '' : String(value));

const normalizeMeasurementState = (item) => {
    const measurements = item.measurements || {};
    if (item.measurementType === 'battery') {
        return {
            batteryModel: measurements.batteryModel || '',
            designCapacityMwh: toInputValue(measurements.designCapacityMwh),
            fullChargeCapacityMwh: toInputValue(measurements.fullChargeCapacityMwh),
            cycleCount: toInputValue(measurements.cycleCount)
        };
    }
    if (item.measurementType === 'hard_drive') {
        return {
            model: measurements.model || '',
            sizeGb: toInputValue(measurements.sizeGb),
            performancePercent: toInputValue(measurements.performancePercent),
            healthPercent: toInputValue(measurements.healthPercent)
        };
    }
    return {};
};

const parseOptionalNumber = (value) => {
    if (value === '' || value === undefined || value === null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const serializeMeasurements = (measurementType, values = {}) => {
    if (measurementType === 'battery') {
        return {
            batteryModel: String(values.batteryModel || '').trim() || null,
            designCapacityMwh: parseOptionalNumber(values.designCapacityMwh),
            fullChargeCapacityMwh: parseOptionalNumber(values.fullChargeCapacityMwh),
            cycleCount: parseOptionalNumber(values.cycleCount)
        };
    }
    if (measurementType === 'hard_drive') {
        return {
            model: String(values.model || '').trim() || null,
            sizeGb: parseOptionalNumber(values.sizeGb),
            performancePercent: parseOptionalNumber(values.performancePercent),
            healthPercent: parseOptionalNumber(values.healthPercent)
        };
    }
    return undefined;
};

const batteryWarnings = (values = {}) => {
    const designCapacity = parseOptionalNumber(values.designCapacityMwh);
    const fullChargeCapacity = parseOptionalNumber(values.fullChargeCapacityMwh);
    const cycleCount = parseOptionalNumber(values.cycleCount);
    const warnings = [];

    if (designCapacity !== null && designCapacity <= 0) warnings.push('Design capacity must be greater than 0.');
    if (fullChargeCapacity !== null && fullChargeCapacity < 0) warnings.push('Full charge capacity is invalid.');
    if (cycleCount !== null && cycleCount < 0) warnings.push('Cycle count is invalid.');
    if (designCapacity > 0 && fullChargeCapacity !== null) {
        const health = (fullChargeCapacity / designCapacity) * 100;
        if (fullChargeCapacity > designCapacity) warnings.push('Full charge capacity is higher than design capacity.');
        if (health < BATTERY_WARNING_HEALTH_PERCENT) warnings.push(`Battery health is ${health.toFixed(0)}%, below ${BATTERY_WARNING_HEALTH_PERCENT}%.`);
    }
    if (cycleCount > BATTERY_WARNING_CYCLE_COUNT) warnings.push(`Cycle count is above ${BATTERY_WARNING_CYCLE_COUNT}.`);

    return warnings;
};

const hardDriveWarnings = (values = {}) => {
    const size = parseOptionalNumber(values.sizeGb);
    const performance = parseOptionalNumber(values.performancePercent);
    const health = parseOptionalNumber(values.healthPercent);
    const warnings = [];

    if (size !== null && size <= 0) warnings.push('Size must be greater than 0 GB.');
    if (performance !== null && (performance < 0 || performance > 100)) warnings.push('Performance must be between 0 and 100%.');
    if (health !== null && (health < 0 || health > 100)) warnings.push('Health must be between 0 and 100%.');
    if (performance !== null && performance < HARD_DRIVE_WARNING_PERCENT) warnings.push(`Performance is below ${HARD_DRIVE_WARNING_PERCENT}%.`);
    if (health !== null && health < HARD_DRIVE_WARNING_PERCENT) warnings.push(`Health is below ${HARD_DRIVE_WARNING_PERCENT}%.`);

    return warnings;
};

const statusFromResult = (result) => {
    if (result === RESULT.pass) return 'pass';
    if (result === RESULT.fail) return 'fail';
    if (result === RESULT.repair) return 'repair';
    if (result === RESULT.na) return 'na';
    return 'pending';
};

const resultFromStatus = (status) => {
    if (status === 'pass' || status === 'fail' || status === 'repair' || status === 'na') return status;
    return null;
};

function SegmentButtons({ value, onChange, disabled }) {
    return (
        <div className="maintenance-task-drawer__segments" role="group" aria-label="Checklist result">
            {[
                { id: RESULT.pass, label: 'Pass' },
                { id: RESULT.fail, label: 'Fail' },
                { id: RESULT.repair, label: 'Repair' },
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

function MeasurementWarnings({ warnings }) {
    if (!warnings.length) return null;
    return (
        <div className="maintenance-task-drawer__measurement-warnings" role="status">
            {warnings.map((warning) => (
                <span key={warning}>{warning}</span>
            ))}
        </div>
    );
}

function MeasurementField({ id, label, unit, type = 'text', value, readOnly, onChange, onBlur }) {
    return (
        <label className="maintenance-task-drawer__measurement-field" htmlFor={id}>
            <span>{label}</span>
            <div className="maintenance-task-drawer__measurement-control">
                <input
                    id={id}
                    type={type}
                    value={value}
                    readOnly={readOnly}
                    min={type === 'number' ? 0 : undefined}
                    max={type === 'number' && unit === '%' ? 100 : undefined}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                />
                {unit ? <small>{unit}</small> : null}
            </div>
        </label>
    );
}

function BatteryMeasurementFields({ item, values, readOnly, onChange, onSave }) {
    const warnings = batteryWarnings(values);
    const update = (field) => (value) => onChange(item.id, field, value);
    const health =
        parseOptionalNumber(values.designCapacityMwh) > 0 && parseOptionalNumber(values.fullChargeCapacityMwh) !== null
            ? ((parseOptionalNumber(values.fullChargeCapacityMwh) / parseOptionalNumber(values.designCapacityMwh)) * 100).toFixed(0)
            : null;

    return (
        <div className="maintenance-task-drawer__measurement-panel">
            <div className="maintenance-task-drawer__measurement-grid">
                <MeasurementField id={`battery-model-${item.id}`} label="Battery model" value={values.batteryModel || ''} readOnly={readOnly} onChange={update('batteryModel')} onBlur={onSave} />
                <MeasurementField id={`battery-design-${item.id}`} label="Design capacity" unit="mWh" type="number" value={values.designCapacityMwh || ''} readOnly={readOnly} onChange={update('designCapacityMwh')} onBlur={onSave} />
                <MeasurementField id={`battery-full-${item.id}`} label="Full charge capacity" unit="mWh" type="number" value={values.fullChargeCapacityMwh || ''} readOnly={readOnly} onChange={update('fullChargeCapacityMwh')} onBlur={onSave} />
                <MeasurementField id={`battery-cycles-${item.id}`} label="Cycle count" type="number" value={values.cycleCount || ''} readOnly={readOnly} onChange={update('cycleCount')} onBlur={onSave} />
            </div>
            {health ? <p className="maintenance-task-drawer__measurement-derived">Battery health: {health}%</p> : null}
            <MeasurementWarnings warnings={warnings} />
        </div>
    );
}

function HardDriveMeasurementFields({ item, values, readOnly, onChange, onSave }) {
    const warnings = hardDriveWarnings(values);
    const update = (field) => (value) => onChange(item.id, field, value);

    return (
        <div className="maintenance-task-drawer__measurement-panel">
            <div className="maintenance-task-drawer__measurement-grid">
                <MeasurementField id={`drive-model-${item.id}`} label="Model" value={values.model || ''} readOnly={readOnly} onChange={update('model')} onBlur={onSave} />
                <MeasurementField id={`drive-size-${item.id}`} label="Size" unit="GB" type="number" value={values.sizeGb || ''} readOnly={readOnly} onChange={update('sizeGb')} onBlur={onSave} />
                <MeasurementField id={`drive-performance-${item.id}`} label="Performance" unit="%" type="number" value={values.performancePercent || ''} readOnly={readOnly} onChange={update('performancePercent')} onBlur={onSave} />
                <MeasurementField id={`drive-health-${item.id}`} label="Health" unit="%" type="number" value={values.healthPercent || ''} readOnly={readOnly} onChange={update('healthPercent')} onBlur={onSave} />
            </div>
            <MeasurementWarnings warnings={warnings} />
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
    const uploadEvidence = useUploadMaintenanceRunItemEvidence();
    const completeRun = useCompleteMaintenanceRun();

    const run = runDetail || task;
    const [itemNotes, setItemNotes] = useState({});
    const [itemMeasurements, setItemMeasurements] = useState({});
    const [itemEvidenceUrls, setItemEvidenceUrls] = useState({});
    const [uploadingItemId, setUploadingItemId] = useState(null);
    const [uploadErrors, setUploadErrors] = useState({});
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
    const assetUserName = run?.asset?.userName || '—';
    const assetDepartment = run?.asset?.department || '—';

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

    useEffect(() => {
        setItemMeasurements((prev) => {
            const next = { ...prev };
            for (const item of items) {
                if (!next[item.id]) {
                    next[item.id] = normalizeMeasurementState(item);
                }
            }
            return next;
        });
    }, [items]);

    const handleMeasurementChange = (itemId, field, value) => {
        setItemMeasurements((prev) => ({
            ...prev,
            [itemId]: {
                ...(prev[itemId] || {}),
                [field]: value
            }
        }));
    };

    const getMeasurementsForSave = (item) => (
        serializeMeasurements(item.measurementType, itemMeasurements[item.id] || normalizeMeasurementState(item))
    );

    const saveItem = async (item, status = item.status) => {
        const measurements = getMeasurementsForSave(item);
        await updateItem.mutateAsync({
            itemId: item.id,
            data: {
                status,
                notes: itemNotes[item.id] || undefined,
                ...(measurements !== undefined ? { measurements } : {})
            }
        });
    };

    const handleItemResult = async (item, result) => {
        if (readOnly) return;
        const status = statusFromResult(result);
        try {
            await saveItem(item, status);
        } catch (err) {
            setError(err.message || 'Failed to save checklist item');
        }
    };

    const handleMeasurementSave = async (item) => {
        if (readOnly || !item.measurementType || item.measurementType === 'none') return;
        try {
            await saveItem(item, item.status || RESULT.pending);
        } catch (err) {
            setError(err.message || 'Failed to save measurements');
        }
    };

    const getRemarksPlaceholder = (result, item) => {
        if (result === RESULT.repair) return 'What was repaired?';
        return 'Add a short note if needed.';
    };

    const handleEvidenceUpload = async (item, file) => {
        if (!file || readOnly) return;
        setUploadingItemId(item.id);
        setUploadErrors((prev) => ({ ...prev, [item.id]: null }));
        try {
            const uploaded = await uploadEvidence.mutateAsync({ itemId: item.id, file });
            setItemEvidenceUrls((prev) => ({
                ...prev,
                [item.id]: uploaded.evidenceUrl
            }));
        } catch (err) {
            setUploadErrors((prev) => ({
                ...prev,
                [item.id]: err.message || 'Failed to upload file.'
            }));
        } finally {
            setUploadingItemId(null);
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
                        <MetaRow label="Name" value={assetUserName} />
                        <MetaRow label="Department" value={assetDepartment} />
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
                                const evidenceUrl = itemEvidenceUrls[item.id] || item.evidenceUrl;
                                const measurementValues = itemMeasurements[item.id] || normalizeMeasurementState(item);
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
                                        {item.measurementType === 'battery' ? (
                                            <BatteryMeasurementFields
                                                item={item}
                                                values={measurementValues}
                                                readOnly={readOnly}
                                                onChange={handleMeasurementChange}
                                                onSave={() => handleMeasurementSave(item)}
                                            />
                                        ) : null}
                                        {item.measurementType === 'hard_drive' ? (
                                            <HardDriveMeasurementFields
                                                item={item}
                                                values={measurementValues}
                                                readOnly={readOnly}
                                                onChange={handleMeasurementChange}
                                                onSave={() => handleMeasurementSave(item)}
                                            />
                                        ) : null}
                                        <div className="maintenance-task-drawer__attachment">
                                            {!readOnly ? (
                                                <label className="maintenance-task-drawer__file-button">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                                                        disabled={uploadingItemId === item.id}
                                                        onChange={(event) => {
                                                            const file = event.target.files?.[0];
                                                            event.target.value = '';
                                                            handleEvidenceUpload(item, file);
                                                        }}
                                                    />
                                                    {evidenceUrl ? 'Replace file' : 'Attach file'}
                                                </label>
                                            ) : null}
                                            {uploadingItemId === item.id ? (
                                                <span className="maintenance-task-drawer__uploading">Uploading…</span>
                                            ) : null}
                                            {evidenceUrl ? (
                                                <a
                                                    className="maintenance-task-drawer__evidence-link"
                                                    href={buildApiUrl(evidenceUrl)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    View attached file
                                                </a>
                                            ) : null}
                                            {uploadErrors[item.id] ? (
                                                <p className="maintenance-task-drawer__upload-error" role="alert">
                                                    {uploadErrors[item.id]}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="maintenance-task-drawer__evidence">
                                            <label className="maintenance-task-drawer__notes-label" htmlFor={`remarks-${item.id}`}>
                                                Remarks
                                            </label>
                                            <textarea
                                                id={`remarks-${item.id}`}
                                                className="maintenance-task-drawer__evidence-input"
                                                rows={3}
                                                readOnly={readOnly}
                                                placeholder={getRemarksPlaceholder(result, item)}
                                                value={itemNotes[item.id] ?? item.notes ?? ''}
                                                onChange={(event) =>
                                                    setItemNotes((prev) => ({
                                                        ...prev,
                                                        [item.id]: event.target.value
                                                    }))
                                                }
                                                onBlur={() => {
                                                    if (!readOnly && itemNotes[item.id] != null && result) {
                                                        handleItemResult(item, result);
                                                    }
                                                }}
                                            />
                                        </div>
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
