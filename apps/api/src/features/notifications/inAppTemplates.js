/**
 * Notification content templates for in-app notifications
 * Each template returns an object with title, message, type, referenceType, and referenceId
 */

export const notificationTemplates = {
    requestSubmitted: (data) => ({
        title: 'New Item Request',
        message: `${data.requesterName} submitted a request for "${data.itemName}"`,
        type: 'request_submitted',
        referenceType: 'item_request',
        referenceId: data.requestId
    }),

    requestReviewed: (data) => ({
        title: `Request ${data.statusLabel}`,
        message: `Your request for "${data.itemName}" has been ${data.statusLabel.toLowerCase()} by IT`,
        type: 'request_reviewed',
        referenceType: 'item_request',
        referenceId: data.requestId
    }),

    pendingApproval: (data) => ({
        title: 'Approval Required',
        message: `Request for "${data.itemName}" from ${data.requesterName} needs your approval`,
        type: 'pending_approval',
        referenceType: 'item_request',
        referenceId: data.requestId
    }),

    requestApproved: (data) => ({
        title: 'Request Approved! 🎉',
        message: `Your request for "${data.itemName}" has been approved`,
        type: 'request_approved',
        referenceType: 'item_request',
        referenceId: data.requestId
    }),

    requestRejected: (data) => ({
        title: 'Request Not Approved',
        message: `Your request for "${data.itemName}" was not approved`,
        type: 'request_rejected',
        referenceType: 'item_request',
        referenceId: data.requestId
    })
};
