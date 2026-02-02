# Story 1.7: Role Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Admin/Head of IT,
I want to assign roles to users,
So that access is governed correctly.

## Acceptance Criteria

1. **Given** a user exists
   **When** Admin/Head assigns a role (IT, Admin, Head of IT, Requester)
   **Then** the role is saved and reflected in the user profile

2. **Given** a role change
   **When** it is saved
   **Then** the change is recorded in audit logs with actor, action, and target

3. **Given** an unauthorized user (e.g. IT staff or Requester)
   **When** they attempt to change a role
   **Then** the action is denied (403 Forbidden)

## Tasks / Subtasks

- [x] Backend Implementation
  - [x] Create Authorization Middleware
    - [x] Create `apps/api/src/shared/auth/requireAdminOrHead.js` logic (check `req.user.role` is 'admin' or 'head_it')
  - [x] Update User Repository
    - [x] Add `updateUserRole(id, role)` to `apps/api/src/features/users/repo.js`
  - [x] Implement Update Endpoint
    - [x] Add `PATCH /users/:id/role` to `apps/api/src/features/users/routes.js`
    - [x] Validate input role against `UserRole` enum values
    - [x] Call `repo.updateUserRole`
    - [x] Call `auditRepo.createAuditLog` with `action: 'user.role_update'`, `actor`, and `metadata: { oldRole, newRole }`
  
- [x] Frontend Implementation
  - [x] Update API Client
    - [x] Add `updateUserRole(id, role)` to `apps/web/src/features/users/users-api.js`
  - [x] Update User Detail UI
    - [x] Add "Role Management" card to `apps/web/src/features/users/user-detail-page.jsx`
    - [x] Display current role
    - [x] Add `<Select>` or `<Combobox>` for changing role (options: Requester, IT, Admin, Head of IT)
    - [x] Show "Save" button only when changed
    - [x] Disable controls if current user is not Admin/Head (check `useAuth` user role)
    - [x] Handle success/error toasts

- [x] Tests
  - [x] Unit Test: Middleware restricts access correctly
  - [x] Unit Test: Endpoints validates roles
  - [x] Integration Test: Admin can change role -> DB updated -> Audit Log created
  - [x] Integration Test: IT User cannot change role (403)

## Dev Notes

### Technical Implementation Guide

- **Prisma Enum**: `UserRole` is already defined in `schema.prisma` (`it`, `admin`, `head_it`, `requester`). Ensure validation uses these exact values.
- **Middleware**: Look at `requireItUser` for inspiration. You'll need to fetch the request user (likely already populated by `jwt` plugin or pre-handler) and check the role.
- **Audit Logs**: 
  - Action: `user.role_update`
  - EntityType: `user`
  - EntityId: `userId`
  - Metadata: `{ oldRole: 'requester', newRole: 'it' }`
- **UI RBAC**: The UI should gracefully handle permission checks. If the logged-in user isn't Admin/Head, either hide the Role edit controls or make them read-only text.

### Project Structure Notes

- Keep auth logic in `shared/auth`.
- Keep user logic in `features/users`.
- Follow the "Clean Code" principle: separate route handling from repo logic.

### References

- [Source: apps/api/prisma/schema.prisma#UserRole] - Enum definitions
- [Source: apps/api/src/shared/auth/requireItUser.js] - Auth pattern example
- [Source: apps/api/src/features/users/routes.js] - Existing user routes

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash Thinking Experminetal 01-21

### Debug Log References

- Created requireAdminOrHead middleware and tests.
- Updated user repo and routes.
- Added role management UI.
- Verified with integration tests.

### Completion Notes List

- Implemented `requireAdminOrHead` middleware for RBAC.
- Added `updateUserRole` to user repo and API endpoint `PATCH /users/:id/role`.
- Implemented Audit Logging for role changes (`user.role_update`).
- Added "Role Management" card to User Detail page in frontend.
- Added integration tests for role management and audit logging.

### File List

- apps/api/src/shared/auth/requireAdminOrHead.js
- tests/api/auth-middleware.test.mjs
- apps/api/src/server.js
- apps/api/src/features/users/repo.js
- apps/api/src/features/users/routes.js
- apps/web/src/features/users/users-api.js
- apps/web/src/features/users/user-detail-page.jsx
- tests/api/users-role-management.test.mjs

### Code Review Actions

- **Reviewer**: Senior Developer (AI)
- **Date**: 2026-01-30
- **Outcome**: Fixes Applied
- **Findings**:
  - **MEDIUM**: Audit log metadata for role updates was inconsistent (flat `oldRole`/`newRole` vs standard `changes` array). FIXED: Updated backend to use standard `changes` array.
  - **MEDIUM**: Test Coverage gaps for audit log format. FIXED: Updated `users-role-management.test.mjs` to verify `changes` array structure.
  - **LOW**: Frontend used heavy inline styles. FIXED: Extracted styles to `index.css` and applied classes.

