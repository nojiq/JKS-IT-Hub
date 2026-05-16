import { useState } from 'react';
import {
    useSystemConfigs,
    useCreateSystemConfig,
    useUpdateSystemConfig,
    useDeleteSystemConfig,
    useAvailableLdapFields
} from './hooks/useSystemConfigs.js';
import {
    useNormalizationRules,
    useCreateNormalizationRule,
    useUpdateNormalizationRule,
    useDeleteNormalizationRule,
    useReorderNormalizationRules
} from '../normalization-rules/hooks/useNormalizationRules.js';
import SystemConfigList from './components/SystemConfigList.jsx';
import SystemConfigForm from './components/SystemConfigForm.jsx';
import {
    NormalizationRuleList,
    NormalizationRuleForm,
    NormalizationPreviewer
} from '../normalization-rules';
import { useToast } from '../../shared/hooks/useToast.js';
import { DataStateBlock } from '../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePageHeader } from '../../shared/workspace/WorkspacePageHeader.jsx';
import { WorkspacePanel } from '../../shared/workspace/WorkspacePanel.jsx';
import '../../shared/workspace/workspace.css';

export default function SystemManagementPage() {
    const [activeSystemId, setActiveSystemId] = useState(null); // null means global rules
    const [showSystemForm, setShowSystemForm] = useState(false);
    const [editingSystem, setEditingSystem] = useState(null);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const toast = useToast();

    // System Config Queries/Mutations
    const { data: systemsResponse, isLoading: systemsLoading } = useSystemConfigs();
    const { data: ldapFieldsResponse } = useAvailableLdapFields();
    const createSystem = useCreateSystemConfig();
    const updateSystem = useUpdateSystemConfig();
    const deleteSystem = useDeleteSystemConfig();

    // Normalization Rule Queries/Mutations
    const { data: rulesResponse, isLoading: rulesLoading } = useNormalizationRules();
    const createRule = useCreateNormalizationRule();
    const updateRule = useUpdateNormalizationRule();
    const deleteRule = useDeleteNormalizationRule();
    const reorderRules = useReorderNormalizationRules();

    const systems = systemsResponse?.data || [];
    const availableFields = ldapFieldsResponse?.data || [];
    const allRules = rulesResponse?.data || { global: [], systems: {} };

    const handleSystemSubmit = async (data) => {
        try {
            if (editingSystem) {
                await updateSystem.mutateAsync({ systemId: editingSystem.systemId, data });
                toast.success("System updated", `Updated ${editingSystem.systemId}.`);
            } else {
                await createSystem.mutateAsync(data);
                toast.success("System created", `Created ${data.systemId}.`);
            }
            setShowSystemForm(false);
            setEditingSystem(null);
        } catch (err) {
            console.error('System config save failed:', err);
            toast.error("System save failed", err?.message || "Unable to save system configuration.");
        }
    };

    const handleSystemDelete = async (systemId) => {
        if (!confirm(`Delete system "${systemId}"?`)) return;
        try {
            await deleteSystem.mutateAsync(systemId);
            toast.success("System deleted", `Deleted ${systemId}.`);
        } catch (err) {
            console.error('System config delete failed:', err);
            const userList = err?.problemDetails?.affectedUsers
                ?.map((user) => user.username || user.id)
                ?.filter(Boolean)
                ?.slice(0, 5)
                ?.join(", ");
            const detail = userList
                ? `In use by: ${userList}`
                : (err?.message || "Unable to delete system configuration.");
            toast.error("Delete blocked", detail);
        }
    };

    const handleRuleSubmit = async (data) => {
        try {
            if (editingRule) {
                await updateRule.mutateAsync({ ruleId: editingRule.id, data });
            } else {
                await createRule.mutateAsync({ ...data, systemId: activeSystemId });
            }
            setShowRuleForm(false);
            setEditingRule(null);
        } catch (err) {
            console.error('Rule save failed:', err);
        }
    };

    if (systemsLoading || rulesLoading) {
        return (
            <section className="workspace-page system-management-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading systems workspace"
                    description="Preparing system mappings and normalization rules."
                />
            </section>
        );
    }

    const currentRules = activeSystemId
        ? (allRules.systems[activeSystemId] || [])
        : allRules.global;

    return (
        <section className="workspace-page system-management-page">
            <WorkspacePageHeader
                eyebrow="Administration"
                title="Systems"
                titleHint="Set up connected systems, choose where usernames come from, and tidy how they appear."
            />

            <div className="management-layout">
                <aside className="management-sidebar">
                    <WorkspacePanel
                        variant="detail"
                        title="Scope"
                        titleHint="Pick shared settings for every system, or open one system to adjust its own."
                    >
                        <div className="sidebar-section">
                            <button
                                className={`scope-selector ${activeSystemId === null ? 'active' : ''}`}
                                onClick={() => setActiveSystemId(null)}
                                type="button"
                            >
                                Global Rules
                            </button>
                            <div className="system-list-mini">
                                {systems.map(sys => (
                                    <button
                                        key={sys.id}
                                        className={`scope-selector ${activeSystemId === sys.systemId ? 'active' : ''}`}
                                        onClick={() => setActiveSystemId(sys.systemId)}
                                        type="button"
                                    >
                                        {sys.systemId}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </WorkspacePanel>

                    <WorkspacePanel
                        variant="detail"
                        title="Preview Username Rules"
                        titleHint="Try a sample username to see how your rules change it before you save."
                    >
                        <NormalizationPreviewer systemId={activeSystemId} />
                    </WorkspacePanel>
                </aside>

                <main className="management-main">
                    <WorkspacePanel
                        variant="table"
                        title="System Catalog"
                        titleHint="List each system, where its usernames come from, and who can see it."
                        actions={(
                            <button
                                className="workspace-inline-button is-primary"
                                onClick={() => { setEditingSystem(null); setShowSystemForm(true); }}
                                type="button"
                            >
                                Add System
                            </button>
                        )}
                    >
                        <SystemConfigList
                            configs={systems}
                            onEdit={(sys) => { setEditingSystem(sys); setShowSystemForm(true); }}
                            onDelete={handleSystemDelete}
                            showHeader={false}
                        />
                    </WorkspacePanel>

                    <WorkspacePanel
                        variant="content"
                        title="Normalization Rules"
                        titleHint={
                            activeSystemId
                                ? `Rules for ${activeSystemId} only. They run after the shared rules.`
                                : 'These rules run for every system first. System-specific rules run after.'
                        }
                        actions={(
                            <button
                                className="workspace-inline-button"
                                onClick={() => { setEditingRule(null); setShowRuleForm(true); }}
                                type="button"
                            >
                                Add Rule
                            </button>
                        )}
                    >
                        <NormalizationRuleList
                            rules={currentRules}
                            systemId={activeSystemId}
                            onEdit={(rule) => { setEditingRule(rule); setShowRuleForm(true); }}
                            onDelete={(id) => { if (confirm('Are you sure?')) deleteRule.mutate(id); }}
                            onReorder={(ids) => reorderRules.mutate(ids)}
                        />
                    </WorkspacePanel>
                </main>
            </div>

            {/* Modals */}
            {showSystemForm && (
                <div className="modal-overlay" onClick={() => setShowSystemForm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <SystemConfigForm
                            initialData={editingSystem}
                            availableFields={availableFields}
                            isSubmitting={createSystem.isPending || updateSystem.isPending}
                            onSubmit={handleSystemSubmit}
                            onCancel={() => setShowSystemForm(false)}
                        />
                    </div>
                </div>
            )}

            {showRuleForm && (
                <div className="modal-overlay" onClick={() => setShowRuleForm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingRule ? 'Edit Rule' : 'Add Rule'}</h3>
                        </div>
                        <NormalizationRuleForm
                            initialData={editingRule}
                            systemId={activeSystemId}
                            isSubmitting={createRule.isPending || updateRule.isPending}
                            onSubmit={handleRuleSubmit}
                            onCancel={() => setShowRuleForm(false)}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
