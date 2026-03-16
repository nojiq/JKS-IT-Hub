export const notificationTemplates = {
    upcomingMaintenance: (data) => ({
        title: 'Upcoming Maintenance',
        message: `${data.cycleName} maintenance due in ${data.daysUntilDue} days (${new Date(data.scheduledDate).toLocaleDateString()})`,
        type: 'maintenance_upcoming',
        referenceType: 'maintenance_window',
        referenceId: data.windowId
    }),

    overdueMaintenance: (data) => ({
        title: '⚠️ Overdue Maintenance',
        message: `${data.cycleName} maintenance is ${data.daysOverdue} days overdue - requires immediate attention`,
        type: 'maintenance_overdue',
        referenceType: 'maintenance_window',
        referenceId: data.windowId
    })
};
