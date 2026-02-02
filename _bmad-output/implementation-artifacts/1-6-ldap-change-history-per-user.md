# Story 1.6: LDAP Change History per User

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to view LDAP change history per user,
So that I can trace profile updates over time.

## Acceptance Criteria

1. **Given** LDAP fields have changed during sync
   **When** the sync determines a difference between LDAP and local data
   **Then** an audit log entry is created with the diff (field, old value, new value)

2. **Given** a user has history records
   **When** IT views the user's details
   **Then** a "History" tab list changes with timestamp, field name, old value, and new value

3. **Given** no changes occurred during sync
   **When** the sync runs
   **Then** no history entries are created

## Tasks / Subtasks

- [x] Schema Updates
  - [x] Modify `AuditLog`: Make `actorUserId` nullable to support "System" actions (or null actor)
  - [x] Modify `LdapSyncRun`: Make `triggeredByUserId` nullable (fix from Story 1.5 issues)
  - [x] Run `npx prisma migrate dev --name allow_null_audit_actor`

- [x] Implement Change Detection Logic
  - [x] Update `apps/api/src/features/ldap/syncService.js`
  - [x] Fetch existing user before upsert
  - [x] Compare `ldapAttributes` (deep equality check or per-field)
  - [x] If changed, calculate specific field diffs
  - [x] Call `auditRepo.createAuditLog` with `action: 'user.ldap_update'`, `metadata: { changes: [...] }`, `actor: null`

- [x] Implement History API
  - [x] Create `apps/api/src/features/audit/repo.js` (if not exists) to fetch logs by `entityId` (`userId`)
  - [x] Create endpoint `GET /api/users/:id/audit-logs` (or `/history`) in `apps/api/src/features/users/routes.js`
  - [x] Ensure endpoint returns formatted diffs

- [x] Implement History UI
  - [x] Create `HistoryTab` component in `apps/web/src/features/users/UserDetail.jsx` (or similar)
  - [x] Fetch data from history endpoint
  - [x] Display table/list of changes: Timestamp | Field | Old Value | New Value
  - [x] Handle "System" actor display in UI

- [x] Tests
  - [x] Unit Test: `syncService` detects changes and logs audit entry
  - [x] Unit Test: `syncService` ignores identical data
  - [x] Integration Test: Full sync flow creates audit records
  - [x] Integration Test: History endpoint returns correct data structure

## Dev Notes

### Technical Implementation Guide
- **Data Storage**: Use the existing `AuditLog` table.
  - Action: `user.ldap_update`
  - EntityType: `user`
  - EntityId: `userId`
  - Metadata: `{ changes: [{ field: 'department', old: 'Sales', new: 'Marketing' }] }`
- **Schema Issues**: Story 1.5 implemented system sync with `actor: null` but schema has `String` (required) for `triggeredByUserId`. You MUST fix this by making it `String?` (optional). Same for `AuditLog.actorUserId`.
- **Diff Logic**: 
  - Be careful with array order or null vs undefined.
  - Only log actual semantic changes.
- **Frontend**:
  - Re-use any existing table components if available.
  - Use `dayjs` or similar for friendly timestamp formatting.

### Project Structure Notes
- Audit logic belongs in `features/audit` or `shared/logging`? Architecture says `features/audit`.
- Keep the `auditRepo` flexible.

### References
- [Source: apps/api/prisma/schema.prisma] - Current schema
- [Source: apps/api/src/features/ldap/syncService.js] - Sync logic to modify
- [Source: _bmad-output/planning-artifacts/epics.md#Section-Story-1.6] - Requirements

## Dev Agent Record

### Agent Model Used

Antigravity

### Debug Log References

### Completion Notes List

- [2026-01-29] Implemented schema updates to allow nullable `actorUserId` in `AuditLog` and `triggeredByUserId` in `LdapSyncRun`. Created integration test `tests/api/audit_schema.test.mjs` to verify.
- [2026-01-30] Implemented LDAP change detection logic in `syncService.js` with `calculateDiff` helper and optimized `getExistingUsersMap`. Verified with `tests/api/ldap_change_detection.test.mjs`.
- [2026-01-30] Implemented History API `GET /users/:id/audit-logs` in `users/routes.js`, recovering missing route file and updating `audit/repo.js` with retrieval logic. Verified with `tests/api/users_history.test.mjs`.
- [2026-01-30] Implemented History UI with `HistoryTab` in `user-detail-page.jsx` and updated `users-api.js` to fetch history.
- [2026-01-30] Expanded `tests/api/ldap_change_detection.test.mjs` to verify identical data handling. Confirmed all relevant tests pass.

- [2026-01-30] Code Review: Addressed findings by improving `calculateDiff` in `syncService.js` (array sorting), adding ID sanity check before audit log, and cleaning up styles in `user-detail-page.jsx`. Added `apps/api/src/server.js` to file list.

### File List

- apps/api/prisma/schema.prisma
- tests/api/audit_schema.test.mjs
- apps/api/src/features/ldap/syncService.js
- tests/api/ldap_change_detection.test.mjs
- apps/api/src/features/users/repo.js
- apps/api/src/features/audit/repo.js
- apps/api/src/features/users/routes.js
- tests/api/users_history.test.mjs
- apps/web/src/features/users/users-api.js
- apps/web/src/features/users/user-detail-page.jsx
- apps/api/src/server.js
