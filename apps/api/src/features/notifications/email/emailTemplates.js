
const BASE_URL = process.env.APP_URL || 'http://localhost:5176';

export const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IT-Hub Notification</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .status-reviewed { background: #fef3c7; color: #92400e; }
        .status-submitted { background: #dbeafe; color: #1e40af; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-label { color: #6b7280; font-size: 14px; }
        .detail-value { font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IT-Hub</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>This is an automated message from IT-Hub. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} IT-Hub - Internal IT Management System</p>
        </div>
    </div>
</body>
</html>
`;

export const templates = {
    newRequestSubmitted: (data) => ({
        subject: `[IT-Hub] New Item Request: ${data.itemName}`,
        html: baseTemplate(`
            <h2>New Item Request Submitted</h2>
            <p>A new item request requires your review.</p>
            
            <div class="detail-row">
                <span class="detail-label">Requested by:</span>
                <span class="detail-value">${data.requesterName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Item:</span>
                <span class="detail-value">${data.itemName}</span>
            </div>
            ${data.description ? `
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${data.description}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value">${data.priority || 'Medium'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Submitted:</span>
                <span class="detail-value">${new Date(data.submittedAt).toLocaleString()}</span>
            </div>
            
            <a href="${BASE_URL}/requests/${data.requestId}" class="button">Review Request</a>
        `),
        text: `
New Item Request Submitted

A new item request requires your review.

Requested by: ${data.requesterName}
Item: ${data.itemName}
${data.description ? `Description: ${data.description}\n` : ''}Priority: ${data.priority || 'Medium'}
Submitted: ${new Date(data.submittedAt).toLocaleString()}

Review the request: ${BASE_URL}/requests/${data.requestId}

---
This is an automated message from IT-Hub.
        `.trim()
    }),

    requestReviewed: (data) => ({
        subject: `[IT-Hub] Request Update: ${data.itemName} - ${data.statusLabel}`,
        html: baseTemplate(`
            <h2>Request Status Update</h2>
            <p>Your item request has been reviewed.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge status-${data.statusClass}">${data.statusLabel}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Item:</span>
                <span class="detail-value">${data.itemName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reviewed by:</span>
                <span class="detail-value">${data.reviewerName}</span>
            </div>
            ${data.reviewNotes ? `
            <div class="detail-row">
                <span class="detail-label">Review Notes:</span>
                <span class="detail-value">${data.reviewNotes}</span>
            </div>
            ` : ''}
            ${data.nextSteps ? `
            <p style="margin-top: 16px;"><strong>Next Steps:</strong> ${data.nextSteps}</p>
            ` : ''}
            
            <a href="${BASE_URL}/requests/my-requests" class="button">View My Requests</a>
        `),
        text: `
Request Status Update

Your item request has been reviewed.

Status: ${data.statusLabel}
Item: ${data.itemName}
Reviewed by: ${data.reviewerName}
${data.reviewNotes ? `Review Notes: ${data.reviewNotes}\n` : ''}${data.nextSteps ? `Next Steps: ${data.nextSteps}` : ''}

View your requests: ${BASE_URL}/requests/my-requests

---
This is an automated message from IT-Hub.
        `.trim()
    }),

    pendingApproval: (data) => ({
        subject: `[IT-Hub] Approval Required: ${data.itemName}`,
        html: baseTemplate(`
            <h2>Approval Required</h2>
            <p>An item request has passed IT review and requires your approval.</p>
            
            <div class="detail-row">
                <span class="detail-label">Requested by:</span>
                <span class="detail-value">${data.requesterName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Item:</span>
                <span class="detail-value">${data.itemName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value">${data.priority || 'Medium'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">IT Reviewed by:</span>
                <span class="detail-value">${data.reviewerName}</span>
            </div>
            ${data.reviewNotes ? `
            <div class="detail-row">
                <span class="detail-label">IT Review Notes:</span>
                <span class="detail-value">${data.reviewNotes}</span>
            </div>
            ` : ''}
            
            <a href="${BASE_URL}/requests/${data.requestId}/approve" class="button">Review & Approve</a>
        `),
        text: `
Approval Required

An item request has passed IT review and requires your approval.

Requested by: ${data.requesterName}
Item: ${data.itemName}
Priority: ${data.priority || 'Medium'}
IT Reviewed by: ${data.reviewerName}
${data.reviewNotes ? `IT Review Notes: ${data.reviewNotes}\n` : ''}

Review and approve: ${BASE_URL}/requests/${data.requestId}/approve

---
This is an automated message from IT-Hub.
        `.trim()
    }),

    requestApproved: (data) => ({
        subject: `[IT-Hub] Request Approved: ${data.itemName}`,
        html: baseTemplate(`
            <h2>Request Approved! 🎉</h2>
            <p>Great news! Your item request has been approved.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge status-approved">Approved</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Item:</span>
                <span class="detail-value">${data.itemName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Approved by:</span>
                <span class="detail-value">${data.approverName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Approved on:</span>
                <span class="detail-value">${new Date(data.approvedAt).toLocaleString()}</span>
            </div>
            
            <p style="margin-top: 16px;">IT will follow up with procurement details.</p>
            
            <a href="${BASE_URL}/requests/my-requests" class="button">View My Requests</a>
        `),
        text: `
Request Approved!

Great news! Your item request has been approved.

Item: ${data.itemName}
Approved by: ${data.approverName}
Approved on: ${new Date(data.approvedAt).toLocaleString()}

IT will follow up with procurement details.

View your requests: ${BASE_URL}/requests/my-requests

---
This is an automated message from IT-Hub.
        `.trim()
    }),

    requestRejected: (data) => ({
        subject: `[IT-Hub] Request Not Approved: ${data.itemName}`,
        html: baseTemplate(`
            <h2>Request Not Approved</h2>
            <p>Unfortunately, your item request could not be approved at this time.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge status-rejected">Rejected</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Item:</span>
                <span class="detail-value">${data.itemName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reviewed by:</span>
                <span class="detail-value">${data.reviewerName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reason:</span>
                <span class="detail-value">${data.rejectionReason || 'Not specified'}</span>
            </div>
            
            <p style="margin-top: 16px;">If you have questions about this decision, please contact IT directly.</p>
            
            <a href="${BASE_URL}/requests/my-requests" class="button">View My Requests</a>
        `),
        text: `
Request Not Approved

Unfortunately, your item request could not be approved at this time.

Item: ${data.itemName}
Reviewed by: ${data.reviewerName}
Reason: ${data.rejectionReason || 'Not specified'}

If you have questions about this decision, please contact IT directly.

View your requests: ${BASE_URL}/requests/my-requests

---
This is an automated message from IT-Hub.
        `.trim()
    })
};
