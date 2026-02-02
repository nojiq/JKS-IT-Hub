# Story 1.8: Enable/Disable Users (No Deletion)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Admin/Head of IT,
I want to disable or enable users,
So that access can be controlled without deleting accounts.

## Acceptance Criteria

1. **Given** a user exists
   **When** Admin/Head disables the user (sets status to disabled)
   **Then** the user IS BLOCKED from signing in
   **And** their current session (if any) is invalidated (nice to have, but critical is login block)
   **And** the status is reflected in the user profile

2. **Given** a disabled user
   **When** Admin/Head re-enables them
   **Then** the user can sign in again

3. **Given** any attempt to delete a user
   **When** an API call is made
   **Then** the system denies the action (Method Not Allowed or 403)
   **And** user records persist in the database

4. **Given** a status change
   **When** it is saved
   **Then** an audit log is created with action `user.status_change`

## Tasks / Subtasks

- [x] Backend: Schema & Repository
  - [x] Check/Update `apps/api/prisma/schema.prisma`
    - [x] Encure `User` model has a field for status (e.g., `isActive` Boolean @default(true) OR `status` String/Enum @default("active"))
    - [x] Run `npx prisma migrate dev --name add_user_status` if field missing
  - [x] Update `apps/api/src/features/users/repo.js`
    - [x] Add `updateUserStatus(id, status)` function
    - [x] Ensure `findUser*` methods return this status field

- [x] Backend: Auth Integration (CRITICAL)
  - [x] Update Login Logic (`apps/api/src/features/auth/` or `shared/auth/`)
    - [x] In the LDAP login/callback flow, AFTER validating LDAP credentials, CHECK the user's local DB status
    - [x] If status is 'disabled' (or isActive=false), THROW specific error/return 403 "Account is disabled"
    - [x] Ensure JWT generation DOES NOT happen for disabled users

- [x] Backend: Status Management Endpoint
  - [x] Create `PATCH /users/:id/status` in `apps/api/src/features/users/routes.js`
  - [x] Implement Validation
    - [x] Use Zod to validate body `{ status: 'active' | 'disabled' }` (or boolean)
  - [x] Implement RBAC
    - [x] Use `requireAdminOrHead` middleware (reused from Story 1.7)
  - [x] Audit Logging
    - [x] Call `auditRepo.createAuditLog`
    - [x] Action: `user.status_change`
    - [x] Metadata: `{ oldStatus, newStatus }` (use `changes` array pattern if standardized)

- [x] Frontend: User Detail UI
  - [x] Update `apps/web/src/features/users/users-api.js`
    - [x] Add `updateUserStatus(id, status)` call
  - [x] Update `apps/web/src/features/users/user-detail-page.jsx`
    - [x] Add "Account Status" card (or combine with Role card)
    - [x] Display current status (Active/Disabled) with Badge (Green/Red)
    - [x] Add Toggle/Switch or Button to change status
    - [x] RBAC: Disable/Hide controls if user is not Admin/Head
    - [x] **Confirmation**: Add Alert/Dialog before "Disable" action to prevent accidents

- [x] Tests
  - [x] Unit: Auth Logic blocks disabled users
  - [x] Unit: Repo updates status correctly
  - [x] Integration: Admin can disable user -> User cannot login
  - [x] Integration: Unauthorized user cannot change status

## Dev Notes

### Architecture & Patterns
- **Auth Flow**: Requires binding into the existing LDAP-based auth strategy. Ensure we check the *local* DB status *after* LDAP bind but *before* token issuance.
- **Audit Logging**: Follow the pattern established in Story 1.7. Metadata should be rich enough to see *who* disabled *whom*.
- **No Deletion**: The requirements explicitly state "No Deletion". Ensure no `DELETE /users/:id` endpoint exists, or if it does (scaffolded), remove it or protect it heavily (e.g., only for hard system maintenance, but for this story, standard users/admins should not have it).

### Code Review Learnings (from Story 1.7)
- **Audit Metadata**: Use a structured `changes` array in audit metadata if possible for consistency, e.g., `changes: [{ field: 'status', old: 'active', new: 'disabled' }]`.

### References
- [Source: apps/api/src/features/users/routes.js] - Existing user routes
- [Source: apps/api/src/shared/auth/requireAdminOrHead.js] - RBAC middleware

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References
- `tests/api/users_repo_status.test.mjs`: Verified `updateUserStatus` repository function.
- `tests/api/auth-login.test.mjs`: Verified login blocking for disabled users and session invalidation in `/auth/me`.
- `tests/api/users-status.test.mjs`: Verified `PATCH /users/:id/status` endpoint with RBAC and audit logging.

### Completion Notes List
- Implemented `updateUserStatus` in repository.
- Updated `authRoutes` (login & me) to check `isUserDisabled` and block access/clear session.
- Implemented `PATCH /users/:id/status` with `requireAdminOrHead` RBAC.
- Added audit logging for status changes (`user.status_change`).
- Added `StatusManagementCard` to User Detail UI with Confirmation Dialog.
- Verified that disabled users cannot login and existing sessions are invalidated on next check.

### Senior Developer Review (AI)
- **Status**: Approved after fixes
- **Fixes Applied**:
  - Created missing migration file `20260130120000_add_user_status`.
  - Replaced `window.confirm` with `ConfirmationDialog` in UI (Premium design).
  - Ensured untracked files are ready for commit.
- **Notes**: Manual SQL generation was used due to environment constraints; please verify against specific DB version if needed.

### File List
- apps/api/src/features/users/repo.js
- apps/api/src/features/users/routes.js
- apps/api/src/features/auth/routes.js
- apps/api/src/server.js
- apps/web/src/features/users/users-api.js
- apps/web/src/features/users/user-detail-page.jsx
- apps/web/src/shared/ui/confirmation-dialog.jsx
- apps/web/src/shared/ui/confirmation-dialog.css
- apps/api/prisma/migrations/20260130120000_add_user_status/migration.sql
- tests/api/users_repo_status.test.mjs
- tests/api/auth-login.test.mjs
- tests/api/users-status.test.mjs
