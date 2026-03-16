# Admin Approval Workflow

## Overview
This document describes the workflow for Admin/Head of IT approval of purchase requests.

## Workflow

1. **Submission**: Requester submits a request.
2. **IT Review**: IT Reviews the request (Story 5.3).
   - Status changes to `IT_REVIEWED`.
3. **Admin Approval** (This Story):
   - Admin/Head of IT accesses `/admin/approvals`.
   - Views list of pending approvals.
   - Selects a request to review details and IT notes.
   - Clicks "Approve Purchase".
   - System updates status to `APPROVED`.
   - Audit log `request_approved` is created.
4. **Already Purchased**: If item was already purchased (legacy flow), IT can mark as such, bypassing Admin approval (Story 5.3).

## Technical Implementation

### Endpoints
- `POST /api/v1/requests/:id/approve`
  - Requires `admin` or `head_it` role.
  - Requires request to be in `IT_REVIEWED` status.

### Components
- `AdminApprovalPage`: Lists filtered requests.
- `AdminApprovalModal`: Details and confirmation.
- `useAdminApproval`: Hook for API interaction.
