# Email Notifications

This document describes the email notification system in IT-Hub.

## Overview

The notification system sends transactional emails for key workflow events:
- New Item Request Submitted -> IT Team
- Item Request Reviewed -> Requester
- Item Request Approved/Rejected -> Requester
- Approval Required -> Admin/Head of IT

## Configuration

The email service uses Nodemailer. Configure SMTP settings in `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_SECURE=false # true for 465, false for 587
EMAIL_FROM="IT-Hub <noreply@example.com>"
APP_URL="http://localhost:5176" # For links in emails
```

## Templates

Templates are defined in `apps/api/src/features/notifications/email/emailTemplates.js`.
Base template is responsive and standardizes header/footer.

### Available Templates:
- `newRequestSubmitted`: Sent to IT staff when a new request is created.
- `requestReviewed`: Sent to requester when IT updates status (Reviewed, Rejected, Already Purchased).
- `pendingApproval`: Sent to Admin/Head of IT when request status becomes IT_REVIEWED.
- `requestApproved`: Sent to requester when request is Approved.
- `requestRejected`: Sent to requester when request is Rejected (by Admin).

## Architecture

- **Service**: `apps/api/src/features/notifications/service.js` handles logic, recipient resolution, and orchestration.
- **Repository**: `apps/api/src/features/notifications/repo.js` manages `EmailNotification` database records.
- **Email Provider**: `apps/api/src/features/notifications/email/emailService.js` wraps Nodemailer.
- **Recipient Resolver**: `apps/api/src/features/notifications/recipientResolver.js` resolves emails from User LDAP attributes.

## Audit Logging

All notification attempts are logged in `audit_logs` table:
- Action: `notification.email.sent` or `notification.email.failed`
- Metadata: Includes recipient count, template type, error details.

## Troubleshooting

1. **Emails not sending?**
   - Check `.env` SMTP_HOST and credentials.
   - Check if `recipients` have `mail` attribute in LDAP/User record.
   - Check application logs for "Failed to send email".

2. **Integration Tests**
   - Run `npm test tests/api/requests_notifications.test.mjs` to verify workflow integration.

## Maintenance Notifications

New in v6.3: Automated alerts for maintenance schedules.

### Triggers
1. **Upcoming**: Sent when window is in `UPCOMING` status (within 30 days) and has not been notified yet.
2. **Overdue**: Sent when status becomes OVERDUE (past due date). Escalates to Admin.

### Templates
- `upcomingMaintenance`: Reminder with due date (Blue/Info).
- `overdueMaintenance`: Urgent alert with escalation logic (Red/Warning).

### Deduplication
- `maintenance_windows` table tracks `upcomingNotificationSentAt` and `overdueNotificationSentAt`.
- Notifications are only sent if these timestamps are NULL.

### Audit Trail
- Action: `notification.maintenance.upcoming` or `notification.maintenance.overdue`.
- Metadata includes delivery status (`success`, `partial`, `failed`, `skipped`) and recipient delivery details for email and in-app channels.

### Real-time Events
- Maintenance notification SSE event types:
  - `notification.maintenance.upcoming`
  - `notification.maintenance.overdue`
