/** User-facing labels — API still uses cycle/window internally. */
export const MAINTENANCE_TERMS = Object.freeze({
    policy: 'Maintenance policy',
    policies: 'Maintenance policies',
    task: 'Maintenance task',
    tasks: 'Maintenance tasks',
    run: 'Maintenance run',
    technician: 'Technician',
    assignee: 'Assignee',
    assignment: 'Assignment',
    assignments: 'Assignments',
    checklist: 'Checklist'
});

export const isMaintenanceAdmin = (user) =>
    Boolean(user?.role) && ['dev', 'it', 'admin', 'head_it'].includes(user.role);
