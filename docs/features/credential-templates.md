# Credential Templates

## Overview

Credential templates enable IT staff to define standard formats for generating credentials across different systems. These templates ensure consistency and reduce manual errors during credential creation.

## Features

- **Template Management**: Create, view, update, and manage credential templates.
- **Flexible Structure**: Define fields with different types (static, generated, LDAP-sourced).
- **Versioning**: All template updates are versioned to track changes over time.
- **Normalization**: Apply rules like lowercase, trim, and remove spaces to field values.
- **Active State**: Only one template can be active at a time for automatic generation.

## Data Model

### CredentialTemplate

| Field | Type | Description |
|Struture|---|---|
| id | UUID | Unique identifier |
| name | String | Human-readable name |
| description | String | Optional description |
| structure | JSON | Field definitions and configuration |
| version | Int | Incremental version number |
| isActive | Boolean | Whether this is the currently active template |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### Template Structure

The `structure` JSON field follows this schema:

```json
{
  "systems": ["email", "vpn", "jira"],
  "fields": [
    {
      "name": "username",
      "type": "generated", // or 'static', 'ldap'
      "pattern": "...",    // for generated type
      "ldapSource": "...", // for ldap type
      "normalization": ["lowercase", "trim"],
      "required": true
    }
  ],
  "normalizationRules": {
     "lowercase": true
  }
}
```

## API Endpoints

### GET /api/v1/credential-templates

List all credential templates.

**Auth**: IT Role required

**Response**:
```json
{
  "data": [
    { "id": "...", "name": "Standard", "version": 1, "isActive": true }
  ]
}
```

### POST /api/v1/credential-templates

Create a new credential template.

**Auth**: IT Role required

**Body**:
```json
{
  "name": "New Template",
  "description": "...",
  "structure": { ... },
  "isActive": true
}
```

### GET /api/v1/credential-templates/:id

Get a specific credential template.

### PUT /api/v1/credential-templates/:id

Update a credential template. Updates increment the version number.

## Credential Regeneration

Story 2.4: Regeneration with Confirmation

IT staff can regenerate credentials when LDAP data or templates change. The system:

1. **Detects Changes**: Compares current LDAP attributes and template version with last generation
2. **Shows Comparison**: Displays old vs new credentials side-by-side
3. **Requires Confirmation**: Explicit confirmation required before overwriting
4. **Preserves History**: Previous credentials are saved in `credential_versions` with reason "regeneration"
5. **Enforces Guardrails**: Disabled users cannot have credentials regenerated
6. **Respects Locks**: Locked credentials are flagged and require unlock or explicit skip

### API Endpoints

#### POST /api/v1/users/:userId/credentials/regenerate

Initiate credential regeneration and return comparison preview.

**Auth**: IT Role required

**Response**:
```json
{
  "data": {
    "userId": "uuid",
    "changeType": "ldap_update|template_change|both",
    "changedLdapFields": ["mail", "cn"],
    "oldTemplateVersion": 2,
    "newTemplateVersion": 3,
    "hasLockedCredentials": false,
    "lockedCredentials": [],
    "comparisons": [
      {
        "system": "email",
        "old": { "username": "old@company.com", "password": "oldpass" },
        "new": { "username": "new@company.com", "password": "newpass" },
        "changes": ["username", "password"],
        "skipped": false
      }
    ],
    "previewToken": "regen_...",
    "expiresAt": "2026-02-02T10:35:00Z"
  }
}
```

**Errors**:
- `403` - User disabled (RFC 9457: `/problems/regeneration-blocked`)
- `400` - No changes detected (RFC 9457: `/problems/no-changes-detected`)
- `422` - Missing LDAP fields (RFC 9457: `/problems/credential-generation-failed`)
- `422` - Locked credentials present (RFC 9457: `/problems/credentials-locked`)

#### POST /api/v1/users/:userId/credentials/regenerate/confirm

Confirm and execute credential regeneration.

**Auth**: IT Role required

**Body**:
```json
{
  "previewToken": "regen_...",
  "confirmed": true,
  "skipLocked": true,
  "force": false
}
```

**Response**:
```json
{
  "data": {
    "userId": "uuid",
    "changeType": "ldap_update",
    "regeneratedCredentials": [
      { "id": "uuid", "system": "email", "username": "new@company.com" }
    ],
    "preservedHistory": [
      { "system": "email", "previousUsername": "old@company.com" }
    ],
    "skippedCredentials": [],
    "templateVersion": 3,
    "performedBy": "admin-uuid",
    "performedAt": "2026-02-02T10:30:00Z"
  }
}
```

**Errors**:
- `400` - Confirmation required or user mismatch
- `410` - Preview session expired (RFC 9457: `/problems/preview-expired`)
- `422` - Locked credentials present (RFC 9457: `/problems/credentials-locked`)

## Credential Locking

Story 2.9: Credential Lock/Unlock

Locking prevents credentials from being regenerated until explicitly unlocked. Locks can include an optional reason and are fully audit logged.

### API Endpoints

#### POST /api/v1/credentials/:userId/:systemId/lock

Lock a credential with an optional reason.

**Auth**: IT Role required

**Body**:
```json
{
  "reason": "Protected admin account - do not regenerate"
}
```

**Errors**:
- `404` - Credential not found (RFC 9457: `/problems/credential-not-found`)
- `409` - Already locked (RFC 9457: `/problems/credential-already-locked`)

#### POST /api/v1/credentials/:userId/:systemId/unlock

Unlock a credential.

**Auth**: IT Role required

**Errors**:
- `409` - Not locked (RFC 9457: `/problems/credential-not-locked`)

#### GET /api/v1/credentials/:userId/:systemId/lock-status

Check lock status and details.

**Response**:
```json
{
  "data": {
    "isLocked": true,
    "lockDetails": {
      "lockedBy": "uuid",
      "lockedByName": "John Smith",
      "lockedAt": "2026-02-03T10:30:00Z",
      "lockReason": "Protected admin account",
      "daysLocked": 5
    }
  }
}
```

#### GET /api/v1/credentials/locked

List all locked credentials (IT only).

#### GET /api/v1/credentials/users/:userId/locked

List locked credentials for a single user (IT only).

## User Guide: Regenerating Credentials

### When to Regenerate

Regenerate credentials when:
- LDAP attributes change (email, name, department)
- Credential template is updated
- User reports credential issues

### Process

1. Navigate to the user's detail page
2. Click "Regenerate Credentials" button (IT staff only)
3. Review the comparison showing old vs new credentials
4. Check the acknowledgment checkbox
5. Click "Confirm Regeneration"

### Important Notes

- **Always review the comparison** before confirming
- **Previous credentials are preserved** in history
- **Disabled users cannot be regenerated** - re-enable the user first
- **Session expires in 5 minutes** - start over if expired
- **All actions are audit logged** for compliance
- **Locked credentials require unlock or explicit skip** before regeneration

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "No Changes Detected" | Verify LDAP sync has run and template has changed |
| "Regeneration Blocked" | Re-enable the user if disabled |
| "Session Expired" | Start the regeneration process again |
| Missing LDAP fields | Ensure user has all required LDAP attributes |
| "Credentials Cannot Be Regenerated" | Unlock credentials or use Skip Locked in the regeneration modal |
| "Credential Already Locked" | The credential is already protected; unlock first if changes are required |

## Security

- RBAC: Restricted to `it`, `admin`, and `head_it` roles.
- Audit Logging: All create, update, and regeneration actions are logged.
- Disabled User Guardrail: Regeneration is blocked for disabled users (FR19).
- Explicit Confirmation: Users must explicitly acknowledge before overwriting.
- History Preservation: All previous credentials are maintained with version tracking.
