import { useId, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyMaintenanceRuns } from '../hooks/useMaintenance.js';
import { DataStateBlock } from '../../../shared/workspace/DataStateBlock.jsx';
import { WorkspacePanel } from '../../../shared/workspace/WorkspacePanel.jsx';
import MaintenanceTaskDrawer from '../components/MaintenanceTaskDrawer.jsx';
import {
    URGENCY,
    classifyTaskUrgency,
    formatTaskAssetLabel,
    formatTaskDueLabel,
    formatTaskPolicyLabel,
    isOpenMaintenanceTask,
    sortTasksByUrgency
} from '../utils/taskUrgency.js';
import '../../../shared/workspace/workspace.css';
import './MaintenanceHomePage.css';

const PAGE_SIZE = 100;

function MetricCard({ label, count, tone, isActive, onClick }) {
    return (
        <button
            type="button"
            className={`maintenance-metric-card maintenance-metric-card--${tone}${isActive ? ' is-active' : ''}`}
            onClick={onClick}
            aria-pressed={isActive}
            aria-label={`${label}: ${count}`}
        >
            <span className="maintenance-metric-card__label">{label}</span>
            <span className="maintenance-metric-card__value">{count}</span>
        </button>
    );
}

function TaskRow({ task, onOpen }) {
    const urgency = classifyTaskUrgency(task);

    return (
        <button type="button" className="maintenance-task-row" onClick={() => onOpen(task)}>
            <div className="maintenance-task-row__main">
                <p className="maintenance-task-row__asset">{formatTaskAssetLabel(task)}</p>
                <p className="maintenance-task-row__policy">{formatTaskPolicyLabel(task)}</p>
            </div>
            <TaskMeta urgency={urgency} task={task} />
        </button>
    );
}

function TaskMeta({ urgency, task }) {
    return (
        <div className="maintenance-task-row__meta">
            <span className={`maintenance-status-badge ${urgency}`}>{formatTaskDueLabel(task)}</span>
            <span className="maintenance-task-row__status">{task.status}</span>
        </div>
    );
}

export default function MaintenanceHomePage() {
    const dashboardHintId = useId();
    const queryClient = useQueryClient();
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [activeTask, setActiveTask] = useState(null);

    const { data: result, isLoading, error, isFetching } = useMyMaintenanceRuns({
        page: 1,
        perPage: PAGE_SIZE
    });

    const tasks = useMemo(() => {
        const rows = (result?.data || []).filter(isOpenMaintenanceTask);
        return sortTasksByUrgency(rows);
    }, [result?.data]);

    const counts = useMemo(() => {
        const now = new Date();
        return tasks.reduce(
            (acc, task) => {
                const bucket = classifyTaskUrgency(task, now);
                acc[bucket] += 1;
                return acc;
            },
            { [URGENCY.overdue]: 0, [URGENCY.dueThisWeek]: 0, [URGENCY.upcoming]: 0 }
        );
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        if (urgencyFilter === 'all') return tasks;
        return tasks.filter((task) => classifyTaskUrgency(task) === urgencyFilter);
    }, [tasks, urgencyFilter]);

    const handleDrawerSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['maintenance'] });
        setActiveTask(null);
    };

    if (isLoading && !result) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock
                    variant="loading"
                    title="Loading dashboard"
                    description="Gathering your maintenance tasks and due dates."
                />
            </section>
        );
    }

    if (error) {
        return (
            <section className="maintenance-module-page">
                <DataStateBlock variant="error" title="Unable to load dashboard" description={error.message} />
            </section>
        );
    }

    return (
        <section className="maintenance-home-page maintenance-module-page maintenance-dashboard">
            <header className="maintenance-page-header">
                <div>
                    <h2>
                        <span
                            className="workspace-panel-title-hint"
                            tabIndex={0}
                            aria-describedby={dashboardHintId}
                        >
                            Dashboard
                            <span
                                className="workspace-panel-title-hint-popup"
                                id={dashboardHintId}
                                role="tooltip"
                                aria-hidden="true"
                            >
                                Your work queue sorted by urgency. Open a task to complete its checklist without leaving this view.
                            </span>
                        </span>
                    </h2>
                </div>
            </header>

            <div className="maintenance-metric-strip" role="group" aria-label="Task urgency filters">
                <MetricCard
                    label="Overdue"
                    count={counts[URGENCY.overdue]}
                    tone="overdue"
                    isActive={urgencyFilter === URGENCY.overdue}
                    onClick={() => setUrgencyFilter((c) => (c === URGENCY.overdue ? 'all' : URGENCY.overdue))}
                />
                <MetricCard
                    label="Due this week"
                    count={counts[URGENCY.dueThisWeek]}
                    tone="week"
                    isActive={urgencyFilter === URGENCY.dueThisWeek}
                    onClick={() => setUrgencyFilter((c) => (c === URGENCY.dueThisWeek ? 'all' : URGENCY.dueThisWeek))}
                />
                <MetricCard
                    label="Upcoming"
                    count={counts[URGENCY.upcoming]}
                    tone="upcoming"
                    isActive={urgencyFilter === URGENCY.upcoming}
                    onClick={() => setUrgencyFilter((c) => (c === URGENCY.upcoming ? 'all' : URGENCY.upcoming))}
                />
            </div>

            <WorkspacePanel
                variant="detail"
                title="Your maintenance tasks"
                meta={
                    isFetching
                        ? 'Refreshing…'
                        : `${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} · sorted by urgency`
                }
            >
                {filteredTasks.length === 0 ? (
                    <p className="maintenance-empty-note">
                        {urgencyFilter === 'all'
                            ? 'No open maintenance tasks assigned to you.'
                            : 'No tasks match this urgency filter.'}
                    </p>
                ) : (
                    <div className="maintenance-task-list">
                        {filteredTasks.map((task) => (
                            <TaskRow key={task.id} task={task} onOpen={setActiveTask} />
                        ))}
                    </div>
                )}
            </WorkspacePanel>

            {activeTask ? (
                <MaintenanceTaskDrawer
                    task={activeTask}
                    onClose={() => setActiveTask(null)}
                    onSuccess={handleDrawerSuccess}
                />
            ) : null}
        </section>
    );
}
