# Submit Item Request (Story 5.1)

## Overview
Story 5.1 introduces the base request-submission flow for internal users:
- request creation
- requester visibility
- IT visibility
- validation and RFC 9457 error handling
- audit logging for creation

## API Endpoints

### POST `/api/v1/requests`
Create a new item request for the signed-in user.

Request body:
- `itemName` (string, required, 1..200)
- `description` (string, optional, max 1000)
- `justification` (string, required, 1..1000)
- `priority` (enum, optional: `LOW|MEDIUM|HIGH|URGENT`)
- `category` (string, optional, max 100)

Success response:
- `200 OK`
- `{ data: ItemRequest }`

Validation/error response:
- `400 application/problem+json`
- RFC 9457 Problem Details with `errors[]` for field-level issues

### GET `/api/v1/requests/my-requests`
List requests for the signed-in requester.

Supported query params:
- `status`
- `priority`
- `dateFrom`
- `dateTo`
- `search`
- `page` (default 1)
- `perPage` (default 20, max 100)

Success response:
- `{ data: ItemRequest[], meta: { total, page, perPage, totalPages } }`

### GET `/api/v1/requests`
List requests for IT/Admin/Head IT.

Same filters as `/my-requests` with optional `requesterId`.

Success response:
- `{ data: ItemRequest[], meta: { total, page, perPage, totalPages } }`

### GET `/api/v1/requests/:id`
Get request detail (owner or IT/Admin/Head IT).

Success response:
- `{ data: ItemRequest }`

## Request Submission Schema

```json
{
  "itemName": "Dell Latitude 7420 Laptop",
  "description": "14-inch business laptop with i7, 16GB RAM",
  "justification": "Current laptop is failing and blocks daily work.",
  "priority": "HIGH",
  "category": "Laptops"
}
```

## Request Status Lifecycle
Base lifecycle in Story 5.1:
1. `SUBMITTED` on creation

Extended lifecycle across subsequent stories:
1. `SUBMITTED`
2. `IT_REVIEWED` (Story 5.3)
3. `APPROVED` or `REJECTED` (Story 5.4)
4. `ALREADY_PURCHASED` (Story 5.3 alternate IT outcome)

## Examples

### Create request

```bash
curl -X POST http://localhost:3000/api/v1/requests \
  -H "Content-Type: application/json" \
  -H "Cookie: it-hub-session=<session-cookie>" \
  -d '{
    "itemName": "External Monitor",
    "justification": "Need dual-screen workflow",
    "priority": "MEDIUM",
    "category": "Peripherals"
  }'
```

### RFC 9457 validation response example

```json
{
  "type": "/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed.",
  "errors": [
    {
      "field": "itemName",
      "message": "Item name is required"
    }
  ]
}
```

## User Guide (Submission UI)

1. Open `Requests` -> `New Request`.
2. Fill required fields: `Item Name`, `Justification`.
3. Optionally fill `Description`, `Priority`, and `Category`.
4. Optionally attach an invoice file.
5. Click `Submit Request`.
6. On success, you are redirected to `My Requests` and can view status/details.

## RBAC Rules

- Any authenticated active user: can submit requests.
- Request owner: can view their own request details and list.
- IT/Admin/Head IT: can view all requests.
- Disabled users: cannot submit requests.

## Audit Logging

On successful creation, an audit entry is written:
- `action`: `request_created`
- `actorUserId`: requester user id
- `entityType`: `ItemRequest`
- `entityId`: request id
- `metadata`: includes item name
