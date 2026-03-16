# Maintenance Feature API Documentation

## Endpoints

### Maintenance Cycles

- **GET /api/v1/maintenance/cycles**
  - Query Params: `includeInactive=true|false`
  - Returns: List of cycle configurations.

- **POST /api/v1/maintenance/cycles**
  - Body: `{ name, description, intervalMonths }`
  - Returns: Created cycle.

- **GET /api/v1/maintenance/cycles/:id**
  - Returns: Cycle details.

- **PATCH /api/v1/maintenance/cycles/:id**
  - Body: `{ name, description, intervalMonths, isActive }`
  - Returns: Updated cycle.

- **DELETE /api/v1/maintenance/cycles/:id**
  - Deactivates the cycle.

- **POST /api/v1/maintenance/cycles/:id/generate-schedule**
  - Body: `{ monthsAhead: 12 }`
  - Returns: Generated windows.

### Maintenance Windows

- **GET /api/v1/maintenance/windows**
  - Query Params:
    - `cycleId`
    - `status` (can be array)
    - `startDateFrom`, `startDateTo`
    - `page`, `perPage`
    - `deviceType` (`LAPTOP` | `DESKTOP_PC` | `SERVER`)
  - Returns: `{ data: [...], meta: { page, total, ... } }`

- **POST /api/v1/maintenance/windows**
  - Body: `{ cycleConfigId, scheduledStartDate, scheduledEndDate, deviceTypes }`
  - Returns: Created window.

- **PATCH /api/v1/maintenance/windows/:id**
  - Body: `{ scheduledStartDate, scheduledEndDate, checklistTemplateId, departmentId, deviceTypes }`
  - Returns: Updated window.

- **GET /api/v1/maintenance/windows/:id**
  - Returns: Window detail including `deviceTypes: DeviceType[]`.

- **POST /api/v1/maintenance/windows/:id/cancel**
  - Body: `{ reason }`
  - Returns: Window with status CANCELLED.

## Schema

### MaintenanceCycleConfig
- `id`: UUID
- `name`: String
- `intervalMonths`: Integer (1-24)
- `isActive`: Boolean

### MaintenanceWindow
- `id`: UUID
- `cycleConfigId`: UUID
- `scheduledStartDate`: DateTime (ISO 8601)
- `status`: SCHEDULED | UPCOMING | OVERDUE | COMPLETED | CANCELLED
- `deviceTypes`: `DeviceType[]` (required for create, optional for update)

### DeviceType
- `LAPTOP`
- `DESKTOP_PC`
- `SERVER`

## Device Type Examples

### Create Window

```json
{
  "cycleConfigId": "cycle-uuid",
  "scheduledStartDate": "2026-03-01T00:00:00.000Z",
  "deviceTypes": ["LAPTOP", "DESKTOP_PC"]
}
```

### Filter Window List

`GET /api/v1/maintenance/windows?status=SCHEDULED&deviceType=SERVER`

### Validation Error (RFC 9457)

When `deviceTypes` is missing or empty:

```json
{
  "type": "/problems/validation-error",
  "title": "Invalid Input",
  "status": 400,
  "detail": "deviceTypes: At least one device type is required"
}
```

## Status Lifecycle

1. **SCHEDULED**: Default status when created for future date (> 30 days).
2. **UPCOMING**: Automatically set by cron job when `scheduledStartDate` is within 30 days.
3. **OVERDUE**: Automatically set by cron job when `scheduledStartDate` is in the past and status was UPCOMING or SCHEDULED.
4. **COMPLETED**: Manually set when maintenance is done.
5. **CANCELLED**: Manually set if maintenance is skipped.

## Cron Jobs

- **Maintenance Status Update**: Runs daily at midnight (UTC). Updates status based on dates.
