# Maintenance Module Documentation

## Overview
The Maintenance Module manages scheduled maintenance tasks for IT assets, including recurring cycles (quarterly/biannual), checklist templates, and technician assignments.

## Notifications & Alerts

The system provides automated notifications to ensure maintenance tasks are completed on time.

### 1. Upcoming Maintenance Alerts
- **Trigger**: Sent when a window enters the `UPCOMING` state (within 30 days of `scheduledStartDate`).
- **Recipient**: Assigned Technician.
- **Content**: 
  - Reminder of the upcoming task.
  - Due date.
  - Link to the maintenance window.
- **Method**: Email and In-App Notification.
- **Mechanism**: The `scheduler.js` job checks for windows with status `SCHEDULED` or `UPCOMING` that are within the notification window and haven't been notified yet.

### 2. Overdue Maintenance Alerts
- **Trigger**: Sent immediately when a window becomes `OVERDUE` (past start date without completion) and notification hasn't been sent.
- **Recipients**: 
  - Assigned Technician.
  - **Escalation**: Copies sent to `admin` and `head_it` users.
- **Content**: 
  - Urgent "OVERDUE" warning.
  - Days overdue count.
  - Link to complete maintenance.
- **Method**: Email and In-App Notification.
- **Mechanism**: The `scheduler.js` job identifies overdue windows and triggers the `notifyOverdueMaintenance` service.

### Technical Implementation

- **Service**: `apps/api/src/features/notifications/maintenanceNotifications.js`
- **Scheduler**: `apps/api/src/features/maintenance/scheduler.js` (runs periodically to update statuses and send alerts).
- **Templates**:
  - Email: `apps/api/src/features/notifications/email/maintenanceTemplates.js`
  - In-App: `apps/api/src/features/notifications/inApp/maintenanceNotifications.js`

### Configuration
- Upcoming notification threshold currently follows the scheduler rule (`UPCOMING` within 30 days) and can be externalized to environment/config if needed.

## Auto-Assignment Rules

The system supports automatic technician assignment for maintenance windows based on department-specific rules.

### Assignment Strategies

1.  **FIXED**: All windows for the department are assigned to a specific technician (the first one in the rule's list).
2.  **ROTATION**: Windows are assigned in a round-robin fashion among all technicians in the rule's list. The system tracks the next index for each department to ensure fair distribution.

### Rule Management

- **Management**: IT Admins can create and manage rules via the **Maintenance > Settings** section.
- **Activation**: Rules can be deactivated at any time to stop automatic assignment for a department.
- **Rotation Reset**: The rotation can be reset to start from the first technician in the list.

### Manual Overrides

Technicians or Admins can manually reassign a maintenance window at any time. 
- Manually assigning a window does **not** advance the automatic rotation index.
- Manual assignments are tracked with a "manual-override" reason.

### Technical Details

- **Database Models**: `DepartmentAssignmentRule`, `DepartmentAssignmentTechnician`, `DepartmentRotationState`.
- **Scheduler Integration**: The scheduler automatically checks for active rules when generating new maintenance windows.

#### Data Dictionary: Department Assignment Rule

| Field | Type | Description |
|---|---|---|
| `department` | String | Unique name of the department (e.g., "Engineering") |
| `assignmentStrategy` | ENUM | `FIXED` (always first technician) or `ROTATION` (round-robin) |
| `technicians` | Array | Ordered list of technicians eligible for assignment |
| `isActive` | Boolean | Whether the rule is currently active |

#### API Usage Examples

**Create Assignment Rule (POST /api/v1/maintenance/assignment-rules)**
```json
{
  "department": "IT Support",
  "assignmentStrategy": "ROTATION",
  "technicianIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Manual Assignment Override (POST /api/v1/maintenance/windows/{windowId}/assign)**
```json
{
  "userId": "uuid-new-tech"
}
```

### User Guide: Managing Assignment Rules

1.  **Access**: Go to **Maintenance > Assignment Rules**.
2.  **Create Rule**: 
    - Click "New Rule".
    - Enter Department Name.
    - Select Strategy (Fixed vs Rotation).
    - Add Technicians from the dropdown.
3.  **Technician Order**:
    - The order of technicians matters.
    - **Fixed Strategy**: The first technician in the list is *always* assigned.
    - **Rotation Strategy**: Assignment cycles through the list (1 → 2 → 3 → 1).
4.  **Manual Override**:
    - Go to any Maintenance Window.
    - Click "Assign" or "Reassign".
    - Select a technician.
    - *Note*: This does NOT affect the automatic rotation order for future windows.

## Maintenance Cycles Scheduling (Story 4.1)

### API Endpoints

Base path: `/api/v1/maintenance`

- `POST /cycles` - Create maintenance cycle config
- `GET /cycles` - List cycles (`includeInactive=true` supported)
- `GET /cycles/:id` - Get one cycle by id
- `PATCH /cycles/:id` - Update cycle config
- `DELETE /cycles/:id` - Deactivate cycle
- `POST /cycles/:id/generate-schedule` - Generate future windows (default 12 months)
- `POST /windows` - Create ad-hoc maintenance window
- `GET /windows` - List windows with filters (`cycleId`, `status`, `startDateFrom`, `startDateTo`, `page`, `perPage`, `deviceType`, `search`)
- `GET /windows/:id` - Get one window by id
- `PATCH /windows/:id` - Update window dates/checklist/device scope (status updates are blocked here)
- `POST /windows/:id/cancel` - Cancel a maintenance window

### Cycle Configuration Schema

Request body (`POST /cycles`):

```json
{
  "name": "Quarterly Minor Maintenance",
  "description": "Routine quarterly maintenance checks",
  "intervalMonths": 3,
  "defaultChecklistTemplateId": "optional-uuid"
}
```

Validation:

- `name`: required, 1-100 chars
- `description`: optional, max 500 chars
- `intervalMonths`: integer, range 1-24
- `defaultChecklistTemplateId`: optional UUID

### Maintenance Config Frontend Contract

Frontend maintenance configuration pages (`MaintenanceConfigPage`, schedule filters/forms, and related hooks) consume cycle records using this stable response shape from `GET /api/v1/maintenance/cycles` and `GET /api/v1/maintenance/cycles/:id`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string (UUID) | Yes | Cycle identifier |
| `name` | string | Yes | User-visible cycle name |
| `description` | string \| null | Yes | Optional cycle description |
| `intervalMonths` | number | Yes | Recurrence interval |
| `isActive` | boolean | Yes | Active/inactive status |
| `defaultChecklistTemplateId` | string \| null | Yes | Default checklist link |
| `defaultChecklist` | object \| null | Yes | Checklist summary for UI |
| `defaultChecklist.id` | string \| null | Conditional | Present when checklist exists |
| `defaultChecklist.name` | string \| null | Conditional | Present when checklist exists |
| `defaultChecklist.version` | number \| null | Conditional | Present when checklist exists |
| `defaultChecklist.itemCount` | number | Conditional | Checklist item count |
| `createdAt` | ISO datetime \| null | Yes | Record creation timestamp |
| `updatedAt` | ISO datetime \| null | Yes | Last update timestamp |

`GET /cycles` also returns metadata to describe the contract:

```json
{
  "meta": {
    "contract": "maintenance-cycle-config.v1",
    "requiredFields": ["id", "name", "description", "intervalMonths", "isActive", "defaultChecklistTemplateId", "defaultChecklist", "createdAt", "updatedAt"]
  }
}
```

### Maintenance Config Error Contract

Maintenance endpoints return RFC 9457-style problem details with explicit linkage metadata so frontend pages can surface backend failures without ambiguous fallback states:

| Field | Type | Required |
|---|---|---|
| `status` | number | Yes |
| `detail` | string | Yes |
| `type` | string | Yes |

Validation failures use `type: "/problems/validation-error"`. Route and auth failures include maintenance/auth problem types (for example `"/problems/maintenance/forbidden"` or `"/problems/auth/unauthorized"`).

### Maintenance Window Status Lifecycle

- `SCHEDULED`: default state on creation/generation
- `UPCOMING`: auto-set when window is within 30 days of start date
- `OVERDUE`: auto-set when scheduled date is in the past and not completed
- `COMPLETED`: set via sign-off flow
- `CANCELLED`: set via cancel endpoint

Transition rules:

- `SCHEDULED -> UPCOMING` (automated scheduler)
- `SCHEDULED/UPCOMING -> OVERDUE` (automated scheduler)
- `SCHEDULED/UPCOMING/OVERDUE -> COMPLETED` (sign-off workflow)
- `SCHEDULED/UPCOMING/OVERDUE -> CANCELLED` (cancel workflow)

### Schedule Generation Example

Request:

```json
POST /api/v1/maintenance/cycles/{cycleId}/generate-schedule
{
  "monthsAhead": 12
}
```

Response:

```json
{
  "data": {
    "cycleId": "cycle-uuid",
    "generated": 4,
    "windows": [
      { "id": "w1", "status": "SCHEDULED", "scheduledStartDate": "2026-05-10T00:00:00.000Z" }
    ]
  }
}
```

### Cron Job Configuration

Environment variables:

- `MAINTENANCE_SCHEDULE_ENABLED=true`
- `MAINTENANCE_SCHEDULE_CRON="0 0 * * *"` (daily at midnight)
- `MAINTENANCE_SCHEDULE_TIMEZONE="UTC"`
- `MAINTENANCE_SCHEDULE_RETRY_ATTEMPTS=3`
- `MAINTENANCE_SCHEDULE_RETRY_DELAY_MS=1000`

Runtime behavior:

- Job entrypoint: `apps/api/src/features/maintenance/jobs.js`
- Scheduler logic: `apps/api/src/features/maintenance/scheduler.js`
- Retries use exponential backoff per attempt.

### User Guide: Cycle Config & Schedule UI

1. Open `Maintenance > Config`.
2. Create or edit cycle entries (name, description, interval, checklist, active state).
3. Trigger `Generate Schedule` from cycle actions to create future windows.
4. Open `Maintenance > Schedule` to view windows grouped by cycle.
5. Filter by status, cycle type, and device type.
6. Open window details to edit date or cancel when needed.

## Device Type Coverage (Story 4.5)

Maintenance windows now carry explicit device coverage so teams can scope work across laptops, desktop PCs, and servers.

### Device Type Enum

- `LAPTOP`
- `DESKTOP_PC`
- `SERVER`

### API Behavior

- `POST /api/v1/maintenance/windows` requires `deviceTypes` with at least one enum value.
- `PATCH /api/v1/maintenance/windows/:id` accepts optional `deviceTypes` to replace coverage.
- `GET /api/v1/maintenance/windows` supports `deviceType` query filtering.
- `GET /api/v1/maintenance/windows/:id` and completion responses include `deviceTypes`.
- `GET /api/v1/maintenance/completions/my-history?deviceType=...` filters using completion snapshot data.

### Example Requests

Create window with multi-device coverage:

```json
{
  "cycleConfigId": "cycle-uuid",
  "scheduledStartDate": "2026-03-01T00:00:00.000Z",
  "deviceTypes": ["LAPTOP", "SERVER"]
}
```

Filter scheduled windows for servers:

`GET /api/v1/maintenance/windows?status=SCHEDULED&deviceType=SERVER`

Validation failure when omitted:

```json
{
  "type": "/problems/validation-error",
  "status": 400,
  "detail": "deviceTypes: At least one device type is required"
}
```

### UI Behavior

- **Maintenance Window Form**: multi-select device type selector is required before submit.
- **Schedule List + Detail**: device type badges are shown on cards and detail pages.
- **History View**: completion history shows device types from completion snapshots.
- **Filtering**: device type filter works with status and date filters.
