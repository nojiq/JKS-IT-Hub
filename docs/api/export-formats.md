# IT-Hub Credential Export Formats

This document specifies the credential export formats supported by the IT-Hub system.

## Overview

IT-Hub supports two export formats for credential exports:

1. **Standard Format** - Human-readable text format with labels and delimiters
2. **Compressed Format** - Machine-parseable CSV-style format with pipe delimiters

## Character Encoding

All exports use **UTF-8** character encoding to support international characters in usernames, passwords, and system names.

## Line Endings

All exports use **LF (`\n`)** line endings (Unix-style), not CRLF.

---

## Standard Format (Human-Readable)

### Content-Type
```
text/plain; charset=utf-8
```

### File Extension
```
.txt
```

### Single-User Export Structure

```
IT-HUB CREDENTIAL EXPORT
Generated: <ISO 8601 timestamp>
User: <display name> (<email>)
Systems: <count>

---------------------------------
<System Name/Description>
Username: <username>
Password: <password>
---------------------------------

---------------------------------
<System Name/Description>
Username: <username>
Password: <password>
---------------------------------

End of export
```

### Example: Single-User Export

```
IT-HUB CREDENTIAL EXPORT
Generated: 2026-02-08T14:23:11Z
User: John Doe (john.doe@company.com)
Systems: 3

---------------------------------
Active Directory
Username: jdoe
Password: AbCdEfGh12#!
---------------------------------

---------------------------------
File Server
Username: john.doe
Password: P@ssw0rd2026!
---------------------------------

---------------------------------
VPN
Username: jdoe
Password: XyZ987$%^&
---------------------------------

End of export
```

### Batch Export Structure

```
IT-HUB BATCH CREDENTIAL EXPORT
Generated: <ISO 8601 timestamp>
Batch ID: <batch-id>
Total Users: <count>
Successful Exports: <count>
Skipped Users: <count>

=================================
USER <n> OF <total>
=================================
User: <display name> (<email>)
User ID: <user-id>
Systems: <count>

---------------------------------
<System Name/Description>
Username: <username>
Password: <password>
---------------------------------

... (additional systems)

=================================
USER <n> OF <total>
=================================
... (next user)

=================================
SKIPPED USERS
=================================
User: <display name> (<email>)
User ID: <user-id>
Reason: <reason>

... (additional skipped users)

=================================
End of batch export
```

### Delimiters

- **Entry Separator**: `---------------------------------` (33 dashes)
- **Section Separator**: `=================================` (33 equals signs)

### Sorting

Systems are sorted **alphabetically by system ID** for consistency.

---

## Compressed Format (Machine-Parseable)

### Content-Type
```
text/csv; charset=utf-8
```

### File Extension
```
.csv
```

### Single-User Export Structure

```
IT-HUB|EXPORT|SINGLE|<timestamp>|<user-name>|<user-email>
<system-id>|<username>|<password>
<system-id>|<username>|<password>
...
```

### Example: Single-User Export

```
IT-HUB|EXPORT|SINGLE|2026-02-08T14:23:11Z|John Doe|john.doe@company.com
active-directory|jdoe|AbCdEfGh12#!
file-server|john.doe|P@ssw0rd2026!
vpn|jdoe|XyZ987$%^&
```

### Batch Export Structure

```
IT-HUB|EXPORT|BATCH|<timestamp>|<batch-id>|<total-users>|<successful>|<skipped>
USER|<user-id>|<user-name>|<user-email>
<system-id>|<username>|<password>
<system-id>|<username>|<password>
USER|<user-id>|<user-name>|<user-email>
<system-id>|<username>|<password>
...
```

### Example: Batch Export

```
IT-HUB|EXPORT|BATCH|2026-02-08T14:23:11Z|batch-abc123-20260208|2|2|0
USER|user-uuid-1|John Doe|john.doe@company.com
active-directory|jdoe|AbCdEfGh12#!
file-server|john.doe|P@ssw0rd2026!
vpn|jdoe|XyZ987$%^&
USER|user-uuid-2|Jane Smith|jane.smith@company.com
active-directory|jsmith|SecurePass123!
vpn|jsmith|VpnPass456#
```

### Field Separator

The pipe character `|` is used as the field separator.

### Escaping Rules

Special characters in field values are escaped as follows:

| Character | Escaped As | Description |
|-----------|------------|-------------|
| `\` | `\\` | Backslash (must be escaped first) |
| `\|` | `\\\|` | Pipe character |
| Newline | `\\n` | Line feed |
| Carriage return | `\\r` | Carriage return |

### Example: Escaping

If a password contains special characters:

```
Original password: Pass|word\nWith|Special
Escaped password: Pass\|word\\nWith\|Special
```

### Sorting

Systems are sorted **alphabetically by system ID** for consistency.

---

## API Usage

### Single-User Export

**Endpoint**: `GET /api/v1/users/:userId/credentials/export`

**Query Parameters**:
- `format` (optional): `standard` (default) or `compressed`

**Examples**:

```bash
# Standard format (default)
GET /api/v1/users/user-123/credentials/export

# Explicit standard format
GET /api/v1/users/user-123/credentials/export?format=standard

# Compressed format
GET /api/v1/users/user-123/credentials/export?format=compressed
```

### Batch Export

**Endpoint**: `POST /api/v1/credentials/export/batch`

**Request Body**:
```json
{
  "userIds": ["user-1", "user-2", "user-3"],
  "format": "standard"  // optional, defaults to "standard"
}
```

**Examples**:

```bash
# Standard format (default)
POST /api/v1/credentials/export/batch
{
  "userIds": ["user-1", "user-2"]
}

# Compressed format
POST /api/v1/credentials/export/batch
{
  "userIds": ["user-1", "user-2"],
  "format": "compressed"
}
```

---

## Response Headers

### Standard Format

```
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="credentials-{userId}-{date}.txt"
Cache-Control: no-store, no-cache, must-revalidate, private
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Pragma: no-cache
```

### Compressed Format

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="credentials-{userId}-{date}.csv"
Cache-Control: no-store, no-cache, must-revalidate, private
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Pragma: no-cache
```

---

## Security Considerations

1. **Plain Text Passwords**: Both formats contain plain text passwords. This is by design for IT delivery purposes.
2. **No Caching**: All exports include cache-control headers to prevent browser/proxy caching.
3. **IMAP Exclusion**: IMAP credentials are automatically excluded from all exports (IT-only access).
4. **Audit Logging**: All exports are logged in the audit trail, including the format type used.
5. **RBAC**: Only users with IT role can perform exports.

---

## Parsing Examples

### Python: Parse Compressed Format

```python
def split_escaped_fields(line):
    parts = []
    current = []
    escaped = False
    for ch in line:
        if escaped:
            current.append(ch)
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            current.append(ch)
            continue
        if ch == '|':
            parts.append(''.join(current))
            current = []
            continue
        current.append(ch)
    parts.append(''.join(current))
    return parts

def parse_compressed_export(content):
    lines = content.strip().split('\n')
    header = split_escaped_fields(lines[0])
    
    if header[2] == 'SINGLE':
        user_info = {
            'timestamp': header[3],
            'name': header[4],
            'email': header[5]
        }
        credentials = []
        for line in lines[1:]:
            parts = split_escaped_fields(line)
            credentials.append({
                'system': parts[0],
                'username': parts[1],
                'password': unescape(parts[2])
            })
        return {'user': user_info, 'credentials': credentials}

def unescape(value):
    return value.replace('\\|', '|').replace('\\n', '\n').replace('\\r', '\r').replace('\\\\', '\\')
```

### JavaScript: Parse Compressed Format

```javascript
function splitEscapedFields(line) {
    const parts = [];
    let current = '';
    let escaped = false;

    for (const ch of line) {
        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            current += ch;
            continue;
        }
        if (ch === '|') {
            parts.push(current);
            current = '';
            continue;
        }
        current += ch;
    }

    parts.push(current);
    return parts;
}

function parseCompressedExport(content) {
    const lines = content.trim().split('\n');
    const header = splitEscapedFields(lines[0]);
    
    if (header[2] === 'SINGLE') {
        const userInfo = {
            timestamp: header[3],
            name: header[4],
            email: header[5]
        };
        const credentials = lines.slice(1).map(line => {
            const [system, username, password] = splitEscapedFields(line);
            return { system, username, password: unescape(password) };
        });
        return { user: userInfo, credentials };
    }
}

function unescape(value) {
    return value
        .replace(/\\\|/g, '|')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-08 | Initial specification with standard and compressed formats |

---

## Related Documentation

- [OpenAPI Specification](./openapi.yaml)
- [Export Security Notes](./export-security.md)
