import { baseTemplate } from './emailTemplates.js';

const BASE_URL = process.env.APP_URL || 'http://localhost:5176';

export const templates = {
    upcomingMaintenance: (data) => ({
        subject: `[IT-Hub] Upcoming Maintenance: ${data.cycleName} - Due ${data.dueDate || new Date(data.scheduledDate).toLocaleDateString()}`,
        html: baseTemplate(`
            <h2>Upcoming Maintenance Scheduled</h2>
            <p>You have a maintenance task coming up that requires your attention.</p>
            
            <div style="background: #dbeafe; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="font-size: 14px; color: #1e40af;">Due in ${data.daysUntilDue} days</div>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Maintenance Type:</span>
                <span class="detail-value">${data.cycleName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Scheduled Date:</span>
                <span class="detail-value">${new Date(data.scheduledDate).toLocaleDateString()}</span>
            </div>
            ${data.deviceTypes ? `
            <div class="detail-row">
                <span class="detail-label">Device Types:</span>
                <span class="detail-value">${data.deviceTypes.join(', ')}</span>
            </div>
            ` : ''}
            ${data.assignedTechnicians ? `
            <div class="detail-row">
                <span class="detail-label">Assigned To:</span>
                <span class="detail-value">${data.assignedTechnicians.join(', ')}</span>
            </div>
            ` : ''}
            
            <a href="${BASE_URL}/maintenance/windows/${data.windowId}" class="button">View Maintenance Details</a>
        `),
        text: `
Upcoming Maintenance Scheduled

You have a maintenance task coming up that requires your attention.

Due in ${data.daysUntilDue} days

Maintenance Type: ${data.cycleName}
Scheduled Date: ${new Date(data.scheduledDate).toLocaleDateString()}
${data.deviceTypes ? `Device Types: ${data.deviceTypes.join(', ')}\n` : ''}${data.assignedTechnicians ? `Assigned To: ${data.assignedTechnicians.join(', ')}` : ''}

View details: ${BASE_URL}/maintenance/windows/${data.windowId}

---
This is an automated message from IT-Hub.
        `.trim()
    }),

    overdueMaintenance: (data) => ({
        subject: `🚨 [IT-Hub] OVERDUE Maintenance: ${data.cycleName}`,
        html: baseTemplate(`
            <h2 style="color: #dc2626;">⚠️ Overdue Maintenance Alert</h2>
            <p>A maintenance task is overdue and requires immediate attention.</p>
            
            <div style="background: #fee2e2; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="font-size: 18px; color: #991b1b; font-weight: bold;">OVERDUE by ${data.daysOverdue} days</div>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Maintenance Type:</span>
                <span class="detail-value">${data.cycleName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Originally Scheduled:</span>
                <span class="detail-value">${new Date(data.scheduledDate).toLocaleDateString()}</span>
            </div>
            ${data.deviceTypes ? `
            <div class="detail-row">
                <span class="detail-label">Device Types:</span>
                <span class="detail-value">${data.deviceTypes.join(', ')}</span>
            </div>
            ` : ''}
            ${data.assignedTechnicians ? `
            <div class="detail-row">
                <span class="detail-label">Assigned To:</span>
                <span class="detail-value">${data.assignedTechnicians.join(', ')}</span>
            </div>
            ` : ''}
            ${data.isEscalation ? `
            <p style="margin-top: 16px; color: #6b7280; font-style: italic;">
                You are receiving this as an escalation because the maintenance is overdue.
            </p>
            ` : ''}
            
            <a href="${BASE_URL}/maintenance/windows/${data.windowId}/complete" class="button" style="background: #dc2626;">Complete Maintenance Now</a>
        `),
        text: `
⚠️ OVERDUE Maintenance Alert

A maintenance task is overdue and requires immediate attention.

OVERDUE by ${data.daysOverdue} days

Maintenance Type: ${data.cycleName}
Originally Scheduled: ${new Date(data.scheduledDate).toLocaleDateString()}
${data.deviceTypes ? `Device Types: ${data.deviceTypes.join(', ')}\n` : ''}${data.assignedTechnicians ? `Assigned To: ${data.assignedTechnicians.join(', ')}\n` : ''}
${data.isEscalation ? 'You are receiving this as an escalation because the maintenance is overdue.\n' : ''}

Complete maintenance: ${BASE_URL}/maintenance/windows/${data.windowId}/complete

---
This is an automated message from IT-Hub.
        `.trim()
    })
};
