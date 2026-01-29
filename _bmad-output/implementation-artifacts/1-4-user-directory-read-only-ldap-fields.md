# Story 1.4: User Directory (Read-Only LDAP Fields)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to view a directory of users with LDAP-derived fields,
so that I can understand the current user profile data.

## Acceptance Criteria

1. **Given** LDAP data has been synced **When** IT opens the Users list **Then** they see a list of users and configured LDAP fields.
2. **Given** a user record **When** IT opens the user detail **Then** LDAP fields are displayed as read-only with a "source: LDAP" indicator.

## Tasks / Subtasks

- [x] Build user directory API endpoints (AC: #1, #2)
  - [x] Add `apps/api/src/features/users/routes.js` with `GET /users` and `GET /users/:id`
  - [x] Enforce IT-only access (it/admin/head_it) and reject disabled users using shared auth helper
  - [x] Extend `apps/api/src/features/users/repo.js` for list + detail reads (DB access only in repo)
  - [x] Return `{ data: { users, fields, meta? } }` for list and `{ data: { user, fields } }` for detail; include LDAP fields + `ldapSyncedAt`
  - [x] Register users routes in `apps/api/src/server.js` and keep RFC 9457 errors on auth/forbidden/not-found
- [x] Build Users directory UI (AC: #1, #2)
  - [x] Add API client helpers under `apps/web/src/features/users/users-api.js`
  - [x] Add list + detail components under `apps/web/src/features/users/` (table/grid list + read-only detail view)
  - [x] Add routes in `apps/web/src/routes/router.jsx` for `/users` and `/users/:id`
  - [x] Add a navigation path from the home page to the Users list (simple link/button is fine)
  - [x] Show LDAP fields as read-only with "source: LDAP" indicator in detail view
- [x] UI polish and empty states (AC: #1, #2)
  - [x] Handle "not synced yet" state when `ldapSyncedAt` is null (prompt to run manual sync)
  - [x] Display missing LDAP field values as `—` without breaking layout
  - [x] Add CSS styles in `apps/web/src/styles/index.css` for list/detail components (keep existing visual language)
  - [x] Ensure responsive layout for wide LDAP field sets (allow horizontal scroll or stacked layout on small screens)
- [x] Tests and verification (AC: #1, #2)
  - [x] Add API integration tests under `tests/api` for auth + RBAC + list + detail payloads
  - [x] If web tests are skipped, document manual verification steps in Completion Notes

## Dev Notes

### Story Foundation
- The Users directory reads from local DB records created/updated by LDAP sync and must not write back to LDAP.
- List view must surface configured LDAP fields (from `LDAP_SYNC_ATTRIBUTES`).
- Detail view must show LDAP fields as read-only and label them with a visible "source: LDAP" indicator.

### Scope Boundaries (Do NOT do in this story)
- Do not add search/filtering (Story 7.1).
- Do not add LDAP change history (Story 1.6).
- Do not add role management UI (Story 1.7).
- Do not add audit log UI (Stories 1.9-1.10).
- Do not allow edits to LDAP fields or user data here.

### Developer Context (Guardrails)
- **Read-only LDAP:** never write to LDAP; only read from `User.ldapAttributes` and related fields.
- **RBAC:** Users directory is IT-only (roles: it/admin/head_it). Non-IT should receive 403 Problem Details.
- **API standards:** success `{ data, meta? }`, errors RFC 9457 Problem Details.
- **Validation:** use Zod for any input parsing/validation.
- **Dates:** ISO 8601 UTC strings only in API payloads.
- **ESM only** and follow file-location rules from architecture.
- **DB access:** only in repo modules (`apps/api/src/features/users/repo.js`).

### Technical Requirements
- **Data source:** `User.ldapAttributes` (JSON), `User.ldapSyncedAt`, `User.username`, `User.status`, `User.role`.
- **Configured LDAP fields:** derive list from `config.ldapSync.attributes` (from `LDAP_SYNC_ATTRIBUTES` env). Include `usernameAttribute` when useful for display.
- **List endpoint (`GET /users`):** return array of users with LDAP field values; include ordered `fields` list so UI can render consistent columns.
- **Detail endpoint (`GET /users/:id`):** return user + `fields`; include a derived `ldapFields` array if UI needs stable ordering.
- **Missing values:** render as `null` (API) and `—` (UI).
- **Not synced state:** if `ldapSyncedAt` is null, UI should show a prompt to run LDAP sync.

### Architecture Compliance
- API routes under `apps/api/src/features/users/`.
- Shared auth helpers under `apps/api/src/shared/auth/` (extract from ldap routes if helpful).
- Web UI under `apps/web/src/features/users/` and uses shared `apiFetch`.
- Tests under `tests/api` using `node:test` + `app.inject` pattern.

### Testing Requirements
- Use Node built-in test runner (`node:test`) with Fastify `inject`.
- Cover auth missing/invalid, RBAC forbidden, list response shape, and detail not-found.
- No new web test framework; document manual UI verification steps.

### Previous Story Intelligence
- LDAP sync persists attributes in `User.ldapAttributes` based on `LDAP_SYNC_ATTRIBUTES`.
- Sync upserts users by `LDAP_SYNC_USERNAME_ATTRIBUTE`; do not mutate `role` or `status` in directory read flows.
- LDAP client uses `ldapts`; no LDAP calls needed for this story.

### Latest Tech Information (for implementation)
- React Router data routers use `createBrowserRouter` with nested `children` routes, rendered through `<Outlet />` in the parent component. [Source: https://reactrouter.com/start/data/routing]
- TanStack Query v5 `useQuery` returns `status` with `isPending`/`isLoading` booleans for first-load states; prefer the object-form API (`useQuery({ queryKey, queryFn })`). [Source: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery]

### Open Questions (confirm if unclear)
- Should the list show all LDAP fields as columns, or only a subset (e.g., name/email/department/title) with a "View details" action for the rest?
- Do we want to display `ldapSyncedAt` timestamps in the list and detail views?

### Project Structure Notes
- API: add `apps/api/src/features/users/routes.js` and register in `apps/api/src/server.js`.
- Web: new components and API helper under `apps/web/src/features/users/`.
- Styling: extend `apps/web/src/styles/index.css` with list/detail styles consistent with existing cards.

### References
- Epic story definition and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
- Functional requirements: [Source: _bmad-output/planning-artifacts/prd.md#FR7,FR9]
- Architecture rules + stack: [Source: _bmad-output/planning-artifacts/architecture.md]
- Project rules and versions: [Source: _bmad-output/project-context.md]
- Previous story patterns: [Source: _bmad-output/implementation-artifacts/1-3-manual-ldap-sync.md]
- LDAP field hints: [Source: _bmad-output/analysis/brainstorming-session-2026-01-14.md]

## Dev Agent Record

### Agent Model Used

Codex CLI (GPT-5)

### Debug Log References

 - `node --test tests/api/users-directory.test.mjs` (failed: `node` not found in PATH)
 - `/home/haziq_afendi/.local/node/bin/node --test tests/api/users-directory.test.mjs` (passed)
 - `/home/haziq_afendi/.local/node/bin/node --test tests/api/*.test.mjs` (passed)

### Implementation Plan

- Add shared IT-only auth helper and users API routes with list/detail handlers.
- Extend users repo for directory reads and return ordered LDAP fields + values.
- Build Users list/detail UI with read-only LDAP indicators and sync-empty states.
- Add API integration tests and verify full API test suite with local Node.

### Completion Notes List

- Added IT-only auth helper and Users API routes (`GET /users`, `GET /users/:id`) returning ordered LDAP fields and ISO sync timestamps.
- Extended users repo for list/detail reads and normalized LDAP field values to explicit nulls when missing.
- Built Users list + detail pages with navigation, read-only LDAP indicators, and sync-not-run alerts.
- Added responsive table/detail styling and a home navigation link to the directory.
- Added API integration tests for auth/RBAC/list/detail and ran full API test suite.
- Manual UI verification: sign in as IT, open Users directory, confirm LDAP columns and missing values show `—`, open a user detail, verify read-only fields and “Source: LDAP” indicator, and confirm not-synced alert when `ldapSyncedAt` is null.

### File List

- apps/api/src/shared/auth/requireItUser.js
- apps/api/src/features/users/routes.js
- apps/api/src/features/users/repo.js
- apps/api/src/server.js
- tests/api/users-directory.test.mjs
- apps/web/src/features/users/users-api.js
- apps/web/src/features/users/users-list-page.jsx
- apps/web/src/features/users/user-detail-page.jsx
- apps/web/src/routes/router.jsx
- apps/web/src/features/users/home-page.jsx
- apps/web/src/styles/index.css
- _bmad-output/implementation-artifacts/1-4-user-directory-read-only-ldap-fields.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-01-29: Added Users directory API + UI, shared IT auth helper, tests, and styling; ran API test suite.
