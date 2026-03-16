# System Configurations

## Overview

System configurations map each credential system to the LDAP attribute used as username input during credential generation.

## API Endpoints

All endpoints are under `/api/v1/system-configs` and require an authenticated `it`, `admin`, or `head_it` role.

### GET /

List all configured systems.

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "systemId": "corporate-vpn",
      "usernameLdapField": "sAMAccountName",
      "description": "VPN credentials",
      "isItOnly": false
    }
  ],
  "meta": { "count": 1 }
}
```

### GET /:systemId

Get one system configuration.

### POST /

Create a new system configuration.

Request body:

```json
{
  "systemId": "corporate-vpn",
  "usernameLdapField": "sAMAccountName",
  "description": "VPN credentials",
  "isItOnly": false
}
```

### PUT /:systemId

Update an existing system configuration.

### DELETE /:systemId

Delete a system configuration. Deletion is blocked when active credentials still reference the system.

Blocked-delete response (RFC 9457):

```json
{
  "type": "/problems/system-in-use",
  "title": "System Cannot Be Deleted",
  "status": 409,
  "detail": "Cannot delete system 'corporate-vpn' because it has 2 active credentials",
  "systemId": "corporate-vpn",
  "credentialCount": 2,
  "affectedUsers": [
    { "id": "uuid-1", "username": "jane" },
    { "id": "uuid-2", "username": "mike" }
  ]
}
```

### GET /ldap-fields/available

Return available LDAP attributes discovered from synced users.

## Credential Generation Integration

- The credential preview and generation flow accepts optional `systemId` for targeted generation.
- If `systemId` is set and a mapping exists, that mapping is used.
- If no mapping exists, generation falls back to `mail` and includes fallback metadata in the preview.

## Troubleshooting

- `LDAP_FIELD_NOT_FOUND`: the selected LDAP field does not exist in synced LDAP attributes.
- `SYSTEM_IN_USE`: remove or rotate active credentials first, then retry delete.
- `INVALID_SYSTEM_ID_FORMAT`: use kebab-case `systemId` (example: `corporate-vpn`).
