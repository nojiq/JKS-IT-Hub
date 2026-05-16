import { useEffect, useId, useMemo, useState } from 'react';
import {
    useCreateMaintenanceProfile,
    useMaintenanceProfiles,
    useSaveProfileChecklist,
    useUpdateMaintenanceProfile
} from '../hooks/useMaintenance.js';
import ChecklistItemEditor from '../components/ChecklistItemEditor.jsx';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { useToast } from '../../../shared/hooks/useToast.js';
import '../../../shared/workspace/workspace.css';
import './MaintenancePoliciesPage.css';
import './MaintenanceHomePage.css';

const INTERVAL_OPTIONS = [1, 2, 3, 6, 12, 24];

const emptyPolicyForm = () => ({
    name: '',
    description: '',
    intervalMonths: 3,
    gracePeriodDays: 0,
    checklistItems: [{ title: '', description: '', isRequired: true, evidenceRequired: false }]
});

const MaintenancePoliciesPage = () => {
    const policiesHintId = useId();
    const toast = useToast();
    const { data: profiles = [], isLoading, error, refetch } = useMaintenanceProfiles(true);
    const createProfile = useCreateMaintenanceProfile();
    const updateProfile = useUpdateMaintenanceProfile();
    const saveChecklist = useSaveProfileChecklist();

    const [selectedPolicyId, setSelectedPolicyId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyPolicyForm);
    const [isSavingChecklist, setIsSavingChecklist] = useState(false);

    const selectedPolicy = useMemo(
        () => profiles.find((p) => p.id === selectedPolicyId) || null,
        [profiles, selectedPolicyId]
    );

    useEffect(() => {
        if (isCreating) return;
        if (!selectedPolicy) {
            setForm(emptyPolicyForm());
            return;
        }
        setForm({
            name: selectedPolicy.name,
            description: selectedPolicy.description || '',
            intervalMonths: selectedPolicy.intervalMonths,
            gracePeriodDays: selectedPolicy.gracePeriodDays ?? 0,
            checklistItems:
                selectedPolicy.checklistTemplate?.items?.map((item) => ({
                    title: item.title,
                    description: item.description || '',
                    isRequired: item.required ?? true,
                    evidenceRequired: Boolean(item.evidenceRequired)
                })) || emptyPolicyForm().checklistItems
        });
    }, [selectedPolicy, isCreating]);

    const handleCreateNew = () => {
        setIsCreating(true);
        setSelectedPolicyId(null);
        setForm(emptyPolicyForm());
    };

    const handleSelectPolicy = (id) => {
        setIsCreating(false);
        setSelectedPolicyId(id);
    };

    const handleSavePolicy = async () => {
        try {
            if (isCreating) {
                const created = await createProfile.mutateAsync({
                    name: form.name,
                    description: form.description,
                    intervalMonths: form.intervalMonths,
                    gracePeriodDays: form.gracePeriodDays,
                    checklistItems: form.checklistItems
                        .filter((item) => item.title.trim())
                        .map((item) => ({
                            title: item.title.trim(),
                            description: item.description,
                            required: item.isRequired !== false,
                            evidenceRequired: Boolean(item.evidenceRequired)
                        }))
                });
                toast.success('Policy created', `"${created.name}" is ready for assignments.`);
                setIsCreating(false);
                setSelectedPolicyId(created.id);
            } else if (selectedPolicy) {
                await updateProfile.mutateAsync({
                    id: selectedPolicy.id,
                    data: {
                        name: form.name,
                        description: form.description,
                        intervalMonths: form.intervalMonths,
                        gracePeriodDays: form.gracePeriodDays
                    }
                });
                toast.success('Policy updated', 'Maintenance policy settings saved.');
            }
            refetch();
        } catch (err) {
            toast.error('Failed to save policy', err.message);
        }
    };

    const handleSaveChecklist = async () => {
        if (!selectedPolicy) return;
        setIsSavingChecklist(true);
        try {
            await saveChecklist.mutateAsync({
                profileId: selectedPolicy.id,
                items: form.checklistItems
                    .filter((item) => item.title.trim())
                    .map((item) => ({
                        title: item.title.trim(),
                        description: item.description,
                        required: item.isRequired !== false,
                        evidenceRequired: Boolean(item.evidenceRequired)
                    }))
            });
            toast.success('Checklist saved', 'Checklist template version updated.');
            refetch();
        } catch (err) {
            toast.error('Failed to save checklist', err.message);
        } finally {
            setIsSavingChecklist(false);
        }
    };

    if (isLoading) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="loading" title="Loading policies" description="Preparing maintenance policies and checklists." />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="error" title="Unable to load policies" description={error.message} />
            </section>
        );
    }

    const showEditor = isCreating || selectedPolicy;

    return (
        <div className="maintenance-module-page maintenance-policies-page">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span className="workspace-panel-title-hint" tabIndex={0} aria-describedby={policiesHintId}>
                            Policies &amp; checklists
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={policiesHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Define how often assets are maintained and what technicians must verify on each run.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>

            <div className="maintenance-policies-layout">
                <aside className="maintenance-policies-sidebar" aria-label="Maintenance policies">
                    <div className="maintenance-policies-sidebar__head">
                        <p className="maintenance-policies-sidebar__title">Policies</p>
                        <button type="button" className="workspace-inline-button is-primary" onClick={handleCreateNew}>
                            Create new policy
                        </button>
                    </div>
                    <ul className="maintenance-policies-list">
                        {profiles.map((policy) => (
                            <li key={policy.id}>
                                <button
                                    type="button"
                                    className={`maintenance-policies-list__item${
                                        !isCreating && policy.id === selectedPolicyId ? ' is-active' : ''
                                    }`}
                                    onClick={() => handleSelectPolicy(policy.id)}
                                >
                                    <span>{policy.name}</span>
                                    <small>Every {policy.intervalMonths} mo</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                <section className="maintenance-policies-detail">
                    {!showEditor ? (
                        <p className="maintenance-empty-note">Select a policy or create a new one.</p>
                    ) : (
                        <>
                            <motionlessPolicySettings
                                form={form}
                                setForm={setForm}
                                isCreating={isCreating}
                                onSave={handleSavePolicy}
                                isSaving={createProfile.isPending || updateProfile.isPending}
                            />
                            <div className="maintenance-policies-detail__checklist">
                                <motionlessChecklistHead
                                    isCreating={isCreating}
                                    isSavingChecklist={isSavingChecklist}
                                    onSaveChecklist={handleSaveChecklist}
                                    form={form}
                                />
                                <ChecklistItemEditor
                                    items={form.checklistItems}
                                    onChange={(items) => setForm((prev) => ({ ...prev, checklistItems: items }))}
                                />
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

function motionlessPolicySettings({ form, setForm, isCreating, onSave, isSaving }) {
    return (
        <div className="maintenance-policies-detail__policy">
            <h3>{isCreating ? 'New maintenance policy' : 'Policy settings'}</h3>
            <div className="maintenance-policy-form">
                <label htmlFor="policy-name">Policy name</label>
                <input
                    id="policy-name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Quarterly network switch audit"
                />

                <label htmlFor="policy-description">Description</label>
                <textarea
                    id="policy-description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />

                <div className="maintenance-policy-interval">
                    <span className="maintenance-policy-interval__label">Interval</span>
                    <span>Every</span>
                    <select
                        value={form.intervalMonths}
                        onChange={(e) => setForm((p) => ({ ...p, intervalMonths: Number(e.target.value) }))}
                        aria-label="Interval months"
                    >
                        {INTERVAL_OPTIONS.map((months) => (
                            <option key={months} value={months}>
                                {months}
                            </option>
                        ))}
                    </select>
                    <span>Months</span>
                </div>

                <button
                    type="button"
                    className="workspace-inline-button is-primary"
                    disabled={!form.name.trim() || isSaving}
                    onClick={onSave}
                >
                    {isSaving ? 'Saving…' : isCreating ? 'Save policy' : 'Update policy'}
                </button>
            </div>
        </div>
    );
}

function motionlessChecklistHead({ isCreating, isSavingChecklist, onSaveChecklist, form }) {
    return (
        <div className="maintenance-policies-detail__checklist-head">
            <h3>Checklist builder</h3>
            {!isCreating ? (
                <button
                    type="button"
                    className="workspace-inline-button"
                    disabled={isSavingChecklist || form.checklistItems.every((i) => !i.title.trim())}
                    onClick={onSaveChecklist}
                >
                    {isSavingChecklist ? 'Saving…' : 'Save checklist'}
                </button>
            ) : null}
        </div>
    );
}

export default MaintenancePoliciesPage;
