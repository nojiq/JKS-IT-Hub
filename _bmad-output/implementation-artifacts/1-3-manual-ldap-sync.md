# Story 1.3: Manual LDAP Sync

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to trigger a manual LDAP sync,
so that user data is up-to-date on demand.

## Acceptance Criteria

1. **Given** LDAP is configured **When** IT triggers manual sync **Then** a sync job runs and displays status (started, completed, failed) **And** user records are updated from LDAP in read-only mode.
2. **Given** a sync failure **When** the job completes **Then** the failure is recorded with a clear error message.

## Tasks / Subtasks

- [x] Define LDAP sync data model + configuration (AC: #1, #2)
  - [x] Add LDAP profile fields to the `User` model (read-only LDAP-derived fields only) and keep role/status untouched
  - [x] Add `ldap_sync_runs` table (status, timestamps, counts, error_message, triggered_by_user_id)
  - [x] Add LDAP sync env/config (filter, attributes, username attribute, page size) and update `.env.example`
- [x] Implement LDAP sync service + repo layer (AC: #1, #2)
  - [x] Extend `apps/api/src/features/ldap/service.js` to support search/listing users for sync (service bind, filter, attributes, paging)
  - [x] Add repo helpers to upsert LDAP fields and write sync run status (DB access only in repos)
  - [x] Orchestrate sync: create run (started) -> fetch entries -> upsert -> mark completed or failed with error message
- [x] Expose API endpoints + SSE status stream (AC: #1, #2)
  - [x] Add `apps/api/src/features/ldap/routes.js` with `POST /ldap/sync`, `GET /ldap/sync/latest`, and `GET /ldap/sync/stream` (SSE)
  - [x] Require authenticated session and restrict to IT roles (it/admin/head_it)
  - [x] Register `fastify-sse-v2` and emit `ldap.sync` events with `{ id, type, timestamp, data }` payloads
  - [x] Use `{ data }` success responses and RFC 9457 Problem Details on errors
- [x] Build web UI for manual sync status (AC: #1, #2)
  - [x] Add a sync panel under `apps/web/src/features/users/` with trigger button and status display
  - [x] Use TanStack Query mutation to trigger sync; show started/completed/failed with timestamps + error text
  - [x] Subscribe to SSE (EventSource) for live updates; avoid polling unless SSE not available
- [x] Tests and verification (AC: #1, #2)
  - [x] Add API integration tests for manual sync success/failure using `node:test` + `app.inject`
  - [x] Cover role gating (non-IT cannot trigger sync)
  - [x] If SSE is not easily testable, document manual verification steps in Completion Notes

## Dev Notes

### Story Foundation
- Manual LDAP sync is the first step toward the user directory. It must update local user records from LDAP without writing back to LDAP.
- Status must be visible to IT: started, completed, failed, and include a clear error message on failures.

### Scope Boundaries (Do NOT do in this story)
- Do not implement scheduled sync, retries, or alerts (Story 1.5).
- Do not implement LDAP change history (Story 1.6).
- Do not build the full Users directory UI (Story 1.4) beyond the sync status surface.
- Do not add role management UI or audit log UI (Stories 1.7-1.10).
- Do not introduce a new test framework for web.

### Developer Context (Guardrails)
- **Read-only LDAP:** Never modify LDAP; only read and update local DB fields (FR9).
- **User safety:** Do not modify `role` or `status` during sync; only update LDAP-derived fields.
- **No deletions:** If a user is missing in LDAP, do not delete locally (project rule).
- **Auth + RBAC:** Sync trigger must be authenticated and restricted to IT roles.
- **API standards:** Use `{ data }` on success and RFC 9457 Problem Details on errors.
- **Validation:** Use Zod for input validation.
- **SSE requirement:** Use SSE for live sync status updates; avoid polling unless SSE is not possible.
- **Timestamps:** Use ISO 8601 UTC strings in API payloads.
- **ESM only** and follow file location rules from architecture.
- **Audit logging:** Manual sync is a sensitive action. Record an audit log entry even if UI is not built yet.

### Technical Requirements
- **LDAP sync config (new env vars):**
  - `LDAP_SYNC_FILTER` (e.g., `(objectClass=person)`)
  - `LDAP_SYNC_ATTRIBUTES` (comma list, e.g., `uid,cn,givenName,sn,mail,employeeNumber,department,title,telephoneNumber,birthDate`)
  - `LDAP_SYNC_USERNAME_ATTRIBUTE` (e.g., `uid` or `sAMAccountName`)
  - `LDAP_SYNC_PAGE_SIZE` (optional; enables paging for large directories)
- **Reuse existing LDAP config** from `authConfig.js` (URL, bind DN, password, TLS options).
- **LDAP attributes to persist (baseline):** name fields, email, employee id, department, title, phone, birth date (from brainstorming). Use config-driven mapping so fields can be adjusted without code changes.
- **Sync status storage:** `ldap_sync_runs` with `started`, `completed`, `failed`; include timestamps, counts, and `error_message`.

### Architecture Compliance
- API routes live under `apps/api/src/features/ldap/`.
- Shared auth helpers stay under `apps/api/src/shared/auth/`.
- DB access stays in repo modules only; no raw queries in services.
- Web UI lives under `apps/web/src/features/users/` and uses shared `apiFetch`.

### Testing Requirements
- Use Node built-in test runner (`node:test`) with Fastify `inject` (match Story 1.2).
- No web test framework; document manual UI verification steps.

### Previous Story Intelligence
- LDAP client already uses `ldapts` with StartTLS/LDAPS support; reuse the same client patterns.
- ESM everywhere and Node version must satisfy Vite requirements.
- Tests use `node:test`; avoid introducing Vitest/Jest.

### Latest Tech Information (for implementation)
- `fastify-sse-v2` provides `reply.sse()` for AsyncIterable streams and supports sending individual events; close streams via `reply.sseContext.source.end()` and clean up on `request.socket.close`. [Source: https://github.com/mpetrunic/fastify-sse-v2]
- `ldapts` supports `ldap://` or `ldaps://` connections, StartTLS via `client.startTLS`, and searching for entries via `client.search` (paging available when needed). [Source: https://github.com/ldapts/ldapts]

### Open Questions (confirm if unclear)
- Which LDAP attributes are authoritative for the user directory (confirm exact field list and mapping)?
- Should manual sync create new local users for every LDAP entry, or only update existing users?
- Do we need to support partial sync (single user) in this story, or only full directory sync?

### Project Structure Notes
- Existing LDAP service lives at `apps/api/src/features/ldap/service.js`.
- Users repo is at `apps/api/src/features/users/repo.js` (DB access only here or new ldap repo).
- Tests live under `tests/api` and should follow existing `node:test` patterns.

### References
- Epic story definition and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- Functional requirements: [Source: _bmad-output/planning-artifacts/prd.md#FR5,FR9]
- NFR integration success target: [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements]
- Architecture rules + stack: [Source: _bmad-output/planning-artifacts/architecture.md]
- Project rules and versions: [Source: _bmad-output/project-context.md]
- Previous story patterns: [Source: _bmad-output/implementation-artifacts/1-2-ldap-sign-in-session.md]
- LDAP field hints: [Source: _bmad-output/analysis/brainstorming-session-2026-01-14.md]

## Dev Agent Record

### Agent Model Used

Codex CLI (GPT-5)

### Debug Log References

 - `pnpm install` (failed: `node` not found in PATH)
 - `pnpm install` with local Node (failed: EACCES removing `node_modules/.pnpm/...`)
 - `node --version` (failed: `node` not found)
 - `rmdir node_modules/.pnpm/thread-stream@4.0.0/node_modules/thread-stream` (manual cleanup for pnpm reinstall)
 - `pnpm install` (succeeded)
 - `pnpm prisma migrate dev --name ldap-sync` (succeeded; migration created/applied)
 - `pnpm prisma generate` (succeeded; Prisma client generated to `apps/api/src/generated/prisma`)
 - `node --test tests/api/*.test.mjs` (passed)
 - `pnpm -C apps/api test` (passed; script path corrected)

### Completion Notes List

 - Implemented LDAP sync data model (LDAP attributes on User, sync runs, audit logs) and added LDAP sync env config.
 - Added LDAP sync service orchestration with run tracking, upserted LDAP attributes, and SSE event publishing.
 - Added LDAP sync API routes (trigger, latest status, SSE stream) with RBAC enforcement and RFC 9457 error handling.
 - Added web UI panel for manual sync status with SSE updates and trigger button.
 - Added API integration tests for manual sync auth, RBAC, success, failure, and latest run response.
 - Sync upserts users by configured username attribute; entries missing the attribute are skipped.
 - Added Prisma client runtime dependency and updated generator/imports to ensure ESM-compatible Prisma client resolution.
 - Corrected API test script path to run root test suite from `apps/api`.
 - Updated API tests to load Fastify plugins via `createRequire` from `apps/api` so tests resolve dependencies without root node_modules.
 - Created and applied Prisma migration for LDAP sync models; generated Prisma client.
 - Tests run successfully after adding audit repo stub in tests and restoring dependencies.

### File List

- .env.example
- package.json
- pnpm-lock.yaml
- apps/api/package.json
- apps/api/prisma/migrations/20260129015758_ldap_sync/migration.sql
- apps/api/prisma/schema.prisma
- apps/api/src/config/authConfig.js
- apps/api/src/features/audit/repo.js
- apps/api/src/features/ldap/repo.js
- apps/api/src/features/ldap/routes.js
- apps/api/src/features/ldap/service.js
- apps/api/src/features/ldap/syncEvents.js
- apps/api/src/features/ldap/syncService.js
- apps/api/src/features/users/repo.js
- apps/api/src/generated/prisma/*
- apps/api/src/server.js
- apps/web/src/features/users/home-page.jsx
- apps/web/src/features/users/ldap-sync-api.js
- apps/web/src/features/users/ldap-sync-panel.jsx
- apps/web/src/shared/utils/api-client.js
- apps/web/src/styles/index.css
- tests/api/ldap-sync.test.mjs
- tests/api/auth-login.test.mjs
- _bmad-output/implementation-artifacts/1-3-manual-ldap-sync.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

- Review date: 2026-01-29
- Status: changes applied
- Summary:
  - Improved LDAP sync error propagation for clearer failure messages.
  - Prevented overlapping manual sync runs.
  - Reduced N+1 lookups by bulk-loading existing usernames.
  - Expanded tests to cover sync failure persistence and SSE event formatting.

## Change Log

- 2026-01-29: Added manual LDAP sync data model/config, sync orchestration with SSE updates, API routes, and web sync panel.
- 2026-01-29: Added Prisma migration + generated client, fixed Prisma imports for ESM, updated tests to stub audit repo, and verified API tests pass.
- 2026-01-29: Addressed code review items (clearer sync errors, in-progress guard, bulk user lookup, expanded LDAP sync tests).
