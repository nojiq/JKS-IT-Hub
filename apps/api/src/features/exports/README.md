# Export Feature

This feature handles the exporting of sensitive credentials in various formats (CSV, Secure Pipe, etc.).

## Security Policy - NO ARCHIVING

**Export content must NOT be archived or stored.**

This is a critical security requirement (FR25).
- Credential content is generated on-demand.
- Credential content is streamed directly to the client.
- Export files are NEVER written to the server disk.
- Export content is NEVER saved to the database.

## Technical Implementation

- **Service**: Generates export strings entirely in memory.
- **Routes**: Sets `Cache-Control: no-store` and streams the response.
- **Audit**: Log metadata (counts, IDs) but NEVER the content.

## Maintenance Guidelines

If modifying this feature:
1. Verify no `fs.writeFile` or similar is introduced.
2. Verify audit logs do not capture sensitive fields.
3. Verify new formats do not require temporary file storage.
4. Verify tests `tests/api/export_no_archive.test.mjs` pass.
