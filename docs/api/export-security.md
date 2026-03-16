# Export Security Design

## No-Archive Policy (FR25)

Per User Requirement FR25, credentials exports are generated on-demand and streamed directly to the client. The system must NOT archive or store these exports.

The system ensures:
- **No File Storage**: Export content is never written to disk.
- **No Database Storage**: Export content is never saved to the database.
- **No Caching**: Export content is not cached on the server.
- **No Logging**: Sensitive credential data is never logged (only metadata).

## Implementation Details

### In-Memory Generation
Exports are generated entirely in memory using string concatenation in `apps/api/src/features/exports/service.js`.

### Streaming Response
The API endpoint in `apps/api/src/features/exports/routes.js` streams the content directly to the client using `reply.send(stringContent)`. Fastify handles the underlying stream.

### Garbage Collection
Once the response is sent, the string content goes out of scope and is eligible for garbage collection by the Node.js runtime.

## Audit Logging

Audit logs track the *action* of exporting but exclude sensitive content.

**Logged Metadata:**
- Action: `credentials.export.single_user` or `credentials.export.batch`
- Actor: ID of the user performing the export
- Entity: Target user ID or Batch ID
- Metadata: Count of credentials, system IDs, timestamp, format

**Explicitly Excluded:**
- Passwords
- Usernames (from credentials)
- Full export content

## Security Headers

To prevent client-side caching of sensitive exports, the following headers are enforced:
- `Cache-Control: no-store, no-cache, must-revalidate, private`
- `Pragma: no-cache`
- `Expires: 0`
- `X-Content-Type-Options: nosniff`

## Developer Guidelines

1. **NEVER** use `fs.writeFile`, `fs.createWriteStream`, or any file I/O in the export feature.
2. **NEVER** add caching mechanisms for export content.
3. **NEVER** log the `exportContent` variable or credential arrays.
4. **ALWAYS** review audit log changes to ensure no sensitive data handling regressions.
