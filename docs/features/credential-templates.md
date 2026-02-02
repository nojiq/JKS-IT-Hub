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

## Security

- RBAC: Restricted to `it`, `admin`, and `head_it` roles.
- Audit Logging: All create and update actions are logged.
