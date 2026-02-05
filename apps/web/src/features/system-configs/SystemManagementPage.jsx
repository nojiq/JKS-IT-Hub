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

export default function SystemManagementPage() {
    const [activeSystemId, setActiveSystemId] = useState(null); // null means global rules
    const [showSystemForm, setShowSystemForm] = useState(false);
    const [editingSystem, setEditingSystem] = useState(null);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

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
            } else {
                await createSystem.mutateAsync(data);
            }
            setShowSystemForm(false);
            setEditingSystem(null);
        } catch (err) {
            console.error('System config save failed:', err);
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
        return <div className="loading-container">Loading system configurations...</div>;
    }

    const currentRules = activeSystemId
        ? (allRules.systems[activeSystemId] || [])
        : allRules.global;

    return (
        <div className="system-management-page">
            <header className="page-header">
                <h2>System Management</h2>
                <p className="subtitle">Configure per-system identifiers and normalization rules.</p>
            </header>

            <div className="management-layout">
                <aside className="management-sidebar">
                    <div className="sidebar-section">
                        <h4>Scope</h4>
                        <button
                            className={`scope-selector ${activeSystemId === null ? 'active' : ''}`}
                            onClick={() => setActiveSystemId(null)}
                        >
                            Global Rules
                        </button>
                        <div className="system-list-mini">
                            {systems.map(sys => (
                                <button
                                    key={sys.id}
                                    className={`scope-selector ${activeSystemId === sys.systemId ? 'active' : ''}`}
                                    onClick={() => setActiveSystemId(sys.systemId)}
                                >
                                    {sys.systemId}
                                </button>
                            ))}
                        </div>
                    </div>

                    <NormalizationPreviewer systemId={activeSystemId} />
                </aside>

                <main className="management-main">
                    {/* System Config section only shown for global or specific systems */}
                    <section className="management-section">
                        <SystemConfigList
                            configs={systems}
                            onCreate={() => { setEditingSystem(null); setShowSystemForm(true); }}
                            onEdit={(sys) => { setEditingSystem(sys); setShowSystemForm(true); }}
                            onDelete={(id) => { if (confirm('Are you sure?')) deleteSystem.mutate(id); }}
                        />
                    </section>

                    <hr className="section-divider" />

                    <section className="management-section">
                        <div className="section-header">
                            <div>
                                <h3>Normalization Rules</h3>
                                <p className="section-subtitle">
                                    {activeSystemId
                                        ? `Rules specific to ${activeSystemId}. These apply AFTER global rules.`
                                        : 'Rules applied to ALL usernames across all systems.'}
                                </p>
                            </div>
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setEditingRule(null); setShowRuleForm(true); }}
                            >
                                Add Rule
                            </button>
                        </div>

                        <NormalizationRuleList
                            rules={currentRules}
                            systemId={activeSystemId}
                            onEdit={(rule) => { setEditingRule(rule); setShowRuleForm(true); }}
                            onDelete={(id) => { if (confirm('Are you sure?')) deleteRule.mutate(id); }}
                            onReorder={(ids) => reorderRules.mutate(ids)}
                        />
                    </section>
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
        </div>
    );
}
