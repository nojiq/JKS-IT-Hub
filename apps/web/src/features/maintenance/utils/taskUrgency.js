const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const URGENCY = Object.freeze({
    overdue: 'overdue',
    dueThisWeek: 'dueThisWeek',
    upcoming: 'upcoming'
});

const OPEN_STATUSES = new Set(['scheduled', 'due', 'in_progress', 'overdue']);

export const classifyTaskUrgency = (task, now = new Date()) => {
    const status = String(task?.status || '').toLowerCase();
    if (status === 'overdue') return URGENCY.overdue;
    if (status === 'due' || status === 'in_progress') return URGENCY.dueThisWeek;

    const due = task?.dueDate ? new Date(task.dueDate) : null;
    if (!due || Number.isNaN(due.getTime())) {
        return URGENCY.upcoming;
    }

    const diffDays = Math.ceil((due.getTime() - now.getTime()) / MS_PER_DAY);
    if (diffDays < 0) return URGENCY.overdue;
    if (diffDays <= 7) return URGENCY.dueThisWeek;
    return URGENCY.upcoming;
};

const urgencyRank = {
    [URGENCY.overdue]: 0,
    [URGENCY.dueThisWeek]: 1,
    [URGENCY.upcoming]: 2
};

const statusRank = {
    overdue: 0,
    due: 1,
    in_progress: 2,
    scheduled: 3
};

export const sortTasksByUrgency = (tasks, now = new Date()) =>
    [...tasks].sort((a, b) => {
        const rankA = urgencyRank[classifyTaskUrgency(a, now)] ?? 9;
        const rankB = urgencyRank[classifyTaskUrgency(b, now)] ?? 9;
        if (rankA !== rankB) return rankA - rankB;

        const statusA = statusRank[String(a.status || '').toLowerCase()] ?? 9;
        const statusB = statusRank[String(b.status || '').toLowerCase()] ?? 9;
        if (statusA !== statusB) return statusA - statusB;

        return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
    });

export const formatTaskDueLabel = (task, now = new Date()) => {
    const status = String(task?.status || '').toLowerCase();
    if (status === 'in_progress') return 'In progress';

    const urgency = classifyTaskUrgency(task, now);
    const due = task?.dueDate ? new Date(task.dueDate) : null;
    if (!due || Number.isNaN(due.getTime())) {
        return urgency === URGENCY.overdue ? 'Overdue' : 'Due date TBD';
    }

    const diffDays = Math.ceil((due.getTime() - now.getTime()) / MS_PER_DAY);
    if (urgency === URGENCY.overdue) {
        const days = Math.abs(diffDays);
        return days <= 1 ? 'Overdue' : `Overdue by ${days} days`;
    }
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatTaskAssetLabel = (task) => {
    const asset = task?.asset;
    if (asset?.name && asset?.assetTag) return `${asset.name} (${asset.assetTag})`;
    if (asset?.assetTag) return asset.assetTag;
    if (asset?.name) return asset.name;

    const types = (task?.deviceTypes || [])
        .map((entry) => (typeof entry === 'string' ? entry : entry?.deviceType))
        .filter(Boolean);
    const labels = {
        LAPTOP: 'Laptop fleet',
        DESKTOP_PC: 'Desktop fleet',
        SERVER: 'Server fleet'
    };
    if (types.length === 0) return 'General maintenance';
    if (types.length === 1) return labels[types[0]] || types[0];
    return `${labels[types[0]] || types[0]} +${types.length - 1}`;
};

export const formatTaskPolicyLabel = (task) => task?.profile?.name || task?.cycleConfig?.name || 'Maintenance policy';

export const isOpenMaintenanceTask = (task) => OPEN_STATUSES.has(String(task?.status || '').toLowerCase());
