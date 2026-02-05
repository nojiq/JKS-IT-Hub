# Story 2.6: Per-User Credential Override

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to override specific credentials for a user,
So that exceptions can be handled when automated generation doesn't meet specific user requirements.

## Acceptance Criteria

### AC1: Override Individual System Credential

**Given** a user has generated credentials for a system (e.g., email, vpn)
**When** IT staff initiates an override for that specific system
**Then** a form is presented to edit the username and/or password
**And** the override is previewed before confirmation
**And** upon confirmation, the override replaces the active credential for that system

### AC2: Override Must Be Logged

**Given** IT staff overrides a credential
**When** the override is confirmed
**Then** an audit log entry is created with:
  - Actor (IT staff who performed override)
  - Action: `credentials.override`
  - Target user ID
  - System being overridden
  - Timestamp
  - Reason for override (required input)

### AC3: Override Creates History Entry

**Given** a credential is overridden
**When** the override is saved
**Then** a new `CredentialVersion` record is created with:
  - `reason`: "override"
  - `createdBy`: IT staff who performed the override
  - The previous credential is preserved in history (not deleted)

### AC4: Override Respects Disabled User Guardrails

**Given** a user is disabled (status = 'disabled')
**When** IT staff attempts to override credentials
**Then** the system blocks the action with a clear error message
**And** the error uses RFC 9457 Problem Details format

### AC5: Override Respects Credential Lock Status

**Given** a credential is locked (if lock functionality exists)
**When** IT staff attempts to override it
**Then** the system blocks the override with a clear error message
**And** the error indicates the credential must be unlocked first

### AC6: Override UI Integration

**Given** IT staff is viewing a user's credentials
**When** they click "Override" on a specific credential
**Then** an override modal/drawer opens with:
  - Current username (pre-filled, editable)
  - Current password (masked, editable with reveal option)
  - Reason for override (required text field)
  - Preview of changes
  - Confirm/Cancel buttons

### AC7: Partial Override Support

**Given** IT staff is performing an override
**When** they only change the username OR only change the password
**Then** the unchanged field retains its current value
**And** the history entry correctly reflects what was changed

## Tasks / Subtasks

- [x] **Task 1: Database Schema Verification** (AC: 1, 3)
  - [x] Verify `user_credentials` table supports override semantics (existing structure is sufficient)
  - [x] Verify `credential_versions` table has `reason` field supporting 'override' value
  - [x] Verify `CredentialVersion` has `createdBy` relationship for actor tracking
  - [x] Confirm no schema changes needed (leverage existing Story 2.2/2.4/2.5 structures)

- [x] **Task 2: Override Service Layer** (AC: 1, 3, 4, 5, 7)
  - [x] Create `previewCredentialOverride(userId, system, overrideData)` function
  - [x] Create `confirmCredentialOverride(performedBy, previewSession)` function
  - [x] Implement disabled user check (throw `DisabledUserError` if user is disabled)
  - [x] Implement partial override logic (only update changed fields)
  - [x] Create history entry with `reason: 'override'`
  - [x] Deactivate old credential, create new active credential

- [x] **Task 3: API Endpoints** (AC: 1, 2, 3, 4, 7)
  - [x] Create `POST /api/v1/users/:userId/credentials/:system/override/preview` endpoint
  - [x] Create `POST /api/v1/users/:userId/credentials/:system/override/confirm` endpoint
  - [x] Implement Zod validation for override request body
  - [x] Add RBAC check (IT role only for overrides)
  - [x] Implement RFC 9457 error handling for blocked actions
  - [x] Add audit logging on confirmed override

- [x] **Task 4: Frontend Components** (AC: 1, 6, 7)
  - [x] Create `CredentialOverrideModal.jsx` component
  - [x] Add "Override" button to `CredentialList.jsx` per credential item
  - [x] Build override form with:
    - Username field (pre-filled)
    - Password field with reveal toggle (CredentialRevealer pattern)
    - Reason field (required, textarea)
    - Preview panel showing diff
  - [x] Add confirmation step with explicit action
  - [x] Implement loading and error states
  - [x] Add success toast notification

- [x] **Task 5: Frontend API Integration** (AC: 1)
  - [x] Add `previewOverride(userId, system, overrideData)` to `credentials.js` API
  - [x] Add `confirmOverride(userId, system, previewToken, confirmed)` to API
  - [x] Create `useCredentialOverride` hook with TanStack Query mutation
  - [x] Handle error states and display RFC 9457 error messages

- [x] **Task 6: Testing** (AC: 1, 2, 3, 4, 5, 7)
  - [x] Write unit tests for override service functions
  - [x] Create integration tests for API endpoints
  - [x] Test disabled user blocking
  - [x] Test partial override scenarios (username only, password only, both)
  - [x] Verify audit log creation
  - [x] Verify history entry creation with 'override' reason
  - [x] Test RBAC access control
  - [x] Add frontend component tests

- [x] **Task 7: Documentation** (AC: 1)
  - [x] Update API documentation with override endpoints
  - [x] Document override workflow for IT staff
  - [x] Add troubleshooting guide for common issues

## Dev Notes

### Architecture Requirements

**Database Schema:**

This story leverages existing schema from Stories 2.2, 2.4, and 2.5. **NO NEW MIGRATIONS REQUIRED.**

```sql
-- Existing tables used (from schema.prisma):
-- user_credentials: Stores active credentials
-- credential_versions: Stores history with 'reason' field
--   - reason values: 'initial', 'regeneration', 'ldap_update', 'template_change', 'override'
```

**Key Schema Points:**
- `UserCredential.isActive`: Override deactivates old, creates new active
- `CredentialVersion.reason`: Supports 'override' value
- `CredentialVersion.createdBy`: Links to IT staff performing override
- No `isLocked` field exists yet (Story 2.9 - defer lock check handling)

**API Patterns:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/users/:userId/credentials/:system/override/preview` | POST | Preview override changes |
| `/users/:userId/credentials/:system/override/confirm` | POST | Confirm and apply override |

**Request/Response Formats:**

```javascript
// Preview Request Body
{
  username: "new.username@company.com",  // optional
  password: "NewPassword123!",            // optional
  reason: "User requested specific username format"  // required
}

// Preview Response
{
  data: {
    previewToken: "uuid-preview-token",
    expiresAt: "2026-02-02T12:30:00Z",
    currentCredential: {
      system: "email",
      username: "old.username@company.com",
      password: { masked: "••••••••" }
    },
    proposedCredential: {
      system: "email",
      username: "new.username@company.com",
      password: { masked: "••••••••" }
    },
    changes: {
      usernameChanged: true,
      passwordChanged: false
    },
    reason: "User requested specific username format"
  }
}

// Confirm Request Body
{
  previewToken: "uuid-preview-token",
  confirmed: true
}

// Confirm Response
{
  data: {
    credentialId: "uuid-credential-id",
    system: "email",
    overriddenAt: "2026-02-02T12:15:00Z",
    overriddenBy: {
      id: "uuid-user-id",
      username: "aina.it"
    },
    historyVersionId: "uuid-version-id"
  }
}
```

**Error Responses (RFC 9457):**

```json
// Disabled User Error
{
  "type": "/problems/disabled-user",
  "title": "Disabled User",
  "status": 403,
  "detail": "Cannot override credentials for disabled users",
  "userId": "uuid-here",
  "suggestion": "Re-enable the user first"
}

// No Active Credential Error
{
  "type": "/problems/no-active-credential",
  "title": "No Active Credential",
  "status": 404,
  "detail": "No active credential found for this system",
  "userId": "uuid-here",
  "system": "email"
}

// Invalid Preview Token Error
{
  "type": "/problems/invalid-preview-token",
  "title": "Invalid Preview Token",
  "status": 400,
  "detail": "Preview session expired or invalid",
  "suggestion": "Generate a new preview before confirming"
}
```

**Security Requirements:**
- RBAC: IT role only for override operations
- Audit: All overrides must be logged (action: `credentials.override`)
- Reason: Override reason is REQUIRED (for audit trail)
- JWT: Authentication via HttpOnly cookies

### Feature Structure (MUST FOLLOW)

```
apps/api/src/features/credentials/
├── routes.js              # ADD: Override endpoints (extend existing)
├── service.js             # ADD: Override functions (extend existing)
├── repo.js                # REUSE: Existing credential repo functions
├── schema.js              # ADD: Override request schemas
└── overrideService.js     # NEW: Override-specific service (optional, or in service.js)

apps/web/src/features/credentials/
├── override/
│   ├── CredentialOverrideModal.jsx    # NEW: Override modal component
│   ├── CredentialOverrideModal.css    # NEW: Override modal styles
│   ├── OverridePreview.jsx            # NEW: Preview diff component
│   └── index.js                       # NEW: Module exports
├── generation/
│   └── CredentialList.jsx             # MODIFY: Add "Override" button per item
├── api/
│   └── credentials.js                 # MODIFY: Add override API calls
└── hooks/
    └── useCredentials.js              # MODIFY: Add useCredentialOverride hook
```

### Technical Specifications

**Override Flow:**

```
1. IT Staff clicks "Override" on credential
   └─> Opens CredentialOverrideModal

2. Modal displays:
   - Current username (editable input)
   - Current password (masked, reveal option, editable)
   - Reason field (required textarea)
   - Preview panel (initially empty)

3. IT Staff modifies fields → Click "Preview"
   └─> POST /override/preview
   └─> Shows diff: old vs new values

4. IT Staff reviews preview → Click "Confirm Override"
   └─> POST /override/confirm with previewToken
   └─> Success: Toast "Credential updated", refresh list
   └─> Error: Display RFC 9457 error with actionable message
```

**Service Implementation Pattern:**

```javascript
// In service.js - follow existing patterns from generateUserCredentials

export async function previewCredentialOverride(userId, system, overrideData) {
  // 1. Check user exists and is enabled (reuse existing pattern)
  const user = await repo.getUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.status === 'disabled') throw new DisabledUserError(userId);
  
  // 2. Get active credential for this system
  const credential = await repo.getUserCredentialBySystem(userId, system);
  if (!credential) throw new NotFoundError('No active credential for system');
  
  // 3. Build preview
  const preview = {
    currentCredential: { /* ... */ },
    proposedCredential: {
      username: overrideData.username || credential.username,
      password: overrideData.password || credential.password
    },
    changes: {
      usernameChanged: overrideData.username && overrideData.username !== credential.username,
      passwordChanged: !!overrideData.password
    },
    reason: overrideData.reason
  };
  
  // 4. Store preview session (reuse storePreviewSession pattern)
  const token = await storeOverridePreview(userId, system, preview);
  
  return { previewToken: token, ...preview };
}

export async function confirmCredentialOverride(performedByUserId, previewSession) {
  // Use transaction for atomicity
  return prisma.$transaction(async (tx) => {
    // 1. Re-validate user is still enabled
    // 2. Deactivate current credential
    // 3. Create new credential with override values
    // 4. Create version history entry with reason: 'override'
    // 5. Create audit log entry
    // 6. Delete preview session
  });
}
```

**Zod Schema Additions:**

```javascript
// In schema.js - add to existing file

export const overridePreviewSchema = z.object({
  username: z.string().min(1).max(191).optional(),
  password: z.string().min(1).optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500)
}).refine(
  (data) => data.username || data.password,
  { message: "At least one of username or password must be provided" }
);

export const confirmOverrideSchema = z.object({
  previewToken: z.string().min(1, "Preview token is required"),
  confirmed: z.boolean().refine((val) => val === true, {
    message: "Explicit confirmation required"
  })
});
```

### Dependencies on Previous Stories

**This story depends on:**
- **Story 2.1 (Global Credential Template)**: Template structure
- **Story 2.2 (Deterministic Credential Generation)**: credential creation patterns
- **Story 2.3 (Credential Preview & Confirmation)**: Preview/confirm UI pattern
- **Story 2.4 (Regeneration with Confirmation)**: Preview session storage pattern
- **Story 2.5 (Credential History)**: History viewing and version tracking
- **Epic 1 Stories**: User management, RBAC, audit logging

**This story enables:**
- **Story 2.9 (Credential Lock/Unlock)**: Locked credentials block override
- Audit trail for all credential modifications

### Critical Rules from Project Context

- **Password security**: Always mask passwords, require explicit reveal
- **Audit everything**: Override action MUST write to audit log
- **IT-only access**: Override restricted to IT role via RBAC
- **No hard deletes**: Old credentials deactivated, never deleted
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: Code stays in `features/credentials/`
- **Date format**: ISO 8601 UTC strings only
- **Disabled user guardrails**: Block credential changes for disabled users (FR19)

### REUSE PATTERNS FROM PREVIOUS STORIES

**From Story 2.3 (Preview & Confirmation):**
- `CredentialPreview.jsx` component pattern
- Preview token generation and storage
- Confirmation flow UI

**From Story 2.4 (Regeneration):**
- `previewSessions` Map storage in repo.js
- `DisabledUserError` error class
- Transaction pattern for atomic updates
- Preview expiry handling (5 min default)

**From Story 2.5 (History):**
- `CredentialRevealer.jsx` component (password reveal toggle)
- History entry creation pattern
- Audit logging for credential actions

### UI/UX Specifications

**CredentialOverrideModal Layout:**

```
┌────────────────────────────────────────────┐
│ Override Credential: [System Name]    [X]  │
├────────────────────────────────────────────┤
│                                            │
│ Current Credential                         │
│ ┌────────────────────────────────────────┐ │
│ │ Username: old.user@company.com        │ │
│ │ Password: ••••••••  [👁]              │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ New Values                                 │
│ ┌────────────────────────────────────────┐ │
│ │ Username: [                          ]│ │
│ │           (pre-filled, editable)      │ │
│ │ Password: [                          ]│ │
│ │           (optional, leave blank=keep)│ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Reason for Override *                      │
│ ┌────────────────────────────────────────┐ │
│ │ [Textarea - min 10 chars required]    │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│        [Cancel]        [Preview Changes]   │
│                                            │
├────────────────────────────────────────────┤
│ PREVIEW PANEL (after preview clicked)      │
│ ┌────────────────────────────────────────┐ │
│ │ Changes:                               │ │
│ │ - Username: old → new (CHANGED)        │ │
│ │ - Password: unchanged                   │ │
│ │                                        │ │
│ │ ⚠️ This action cannot be undone        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│       [Cancel]        [Confirm Override]   │
└────────────────────────────────────────────┘
```

**Button Styling:**
- "Preview Changes": Secondary button (Ghost/Outline)
- "Confirm Override": Destructive button (Rose-500) - requires confirmation
- "Cancel": Ghost button

**Toast Messages:**
- Success: "Credential overridden successfully"
- Error: Display problem detail title and suggestion

### Performance Considerations

- Preview sessions expire after 5 minutes (configurable via env)
- Reuse existing preview session cleanup interval
- Single database transaction for confirm operation
- No additional indexes needed (existing indexes sufficient)

## Previous Story Intelligence

### Story 2.5: Credential History (Status: done)

**Key Patterns Established:**
- History retrieval with filtering and pagination
- `CredentialVersion` model usage with `reason` field
- `CredentialRevealer` component for password display
- Audit logging for credential views

**Code to Reuse:**
- `apps/web/src/features/credentials/history/CredentialRevealer.jsx`
- History entry creation in `repo.createCredentialVersion()`
- Audit log creation pattern

### Story 2.4: Regeneration with Confirmation (Status: review)

**Key Patterns Established:**
- Preview session storage using in-memory Map
- `DisabledUserError` for blocking disabled user operations
- Preview token generation with UUID
- Two-step preview/confirm flow
- Transaction-based atomic updates

**Code to Reuse:**
- `storePreviewSession()` and `getPreviewSession()` from repo.js
- `DisabledUserError` class from service.js
- Preview expire handling (5 minute default)
- Confirmation flow API pattern

### Story 2.3: Credential Preview & Confirmation (Status: done)

**Key Patterns Established:**
- Modal-based preview UI
- Explicit confirmation requirement
- `SystemCredentials.jsx` component for display

**Code to Reuse:**
- Preview modal pattern
- Confirm button with explicit `confirmed: true` requirement

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.6: Per-User Credential Override (Lines 419-431)
   - FR15: IT staff can override specific credentials for a user

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: see project-context.md
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging

3. **Project Context**: `_bmad-output/project-context.md`
   - Technology versions and constraints
   - Naming conventions (DB snake_case, API camelCase)
   - Security rules (audit logging, disabled user guardrails)
   - Critical "Don't Miss" rules

4. **UX Design Document**: `_bmad-output/planning-artifacts/ux-design-specification.md`
   - Design System: Shadcn/UI with Tailwind (or Vanilla CSS per project setup)
   - Button hierarchy: Primary (Submit), Destructive (Override action)
   - CredentialRevealer component pattern
   - Modal/Sheet patterns for forms

### Related Implementation Files

- `apps/api/src/features/credentials/routes.js` - Add override endpoints
- `apps/api/src/features/credentials/service.js` - Add override functions
- `apps/api/src/features/credentials/repo.js` - Reuse existing functions
- `apps/api/src/features/credentials/schema.js` - Add override schemas
- `apps/api/prisma/schema.prisma` - No changes needed
- `apps/web/src/features/credentials/generation/CredentialList.jsx` - Add Override button
- `apps/web/src/features/credentials/history/CredentialRevealer.jsx` - Reuse component

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- ✅ **Task 1**: Database schema verified - existing structure from Stories 2.2/2.4/2.5 is sufficient
- ✅ **Task 2**: Service layer implemented with `previewCredentialOverride()` and `confirmCredentialOverride()` functions
  - Partial override logic implemented (only changed fields updated)
  - Disabled user guardrails enforced using existing `DisabledUserError`
  - Transaction-based atomic updates for consistency
  - History entry creation with `reason: 'override'`
  - Audit logging on confirm with `credentials.override` action
- ✅ **Task 3**: API endpoints added
  - `POST /api/v1/users/:userId/:system/override/preview` - Preview endpoint with Zod validation
  - `POST /api/v1/users/:userId/:system/override/confirm` - Confirm endpoint
  - RFC 9457 error handling for all error cases (disabled user, no credential, invalid token)
  - RBAC checks for IT/admin/head_it roles only
- ✅ **Task 4**: Frontend components created
  - `CredentialOverrideModal.jsx` with full UI per Dev Notes specifications
  - Override button added to `CredentialList.jsx`
  - Form with pre-filled username, password with reveal toggle, required reason field
  - Preview panel showing diff between old and new values
  - Loading and error states implemented
- ✅ **Task 5**: Frontend API integration
  - `previewOverride()` and `confirmOverride()` API functions added
  - `usePreviewOverride` and `useConfirmOverride` TanStack Query hooks created
  - Error handling with RFC 9457 problem details
- ✅ **Task 6**: Testing
  - Unit tests for service functions
  - Integration tests for API endpoints covering all ACs
  - Tests for disabled user blocking, partial overrides, audit logs, history entries, RBAC

### Implementation Decisions
- Leveraged existing `DisabledUserError` from Story 2.4 instead of creating new error class
- Reused preview session storage pattern from Story 2.4 (`storePreviewSession`, `getPreviewSession`)
- Followed existing credential versioning pattern with `reason` field supporting 'override'
- Used existing RBAC pattern (IT, admin, head_it roles only)
- Implemented transaction-based atomic updates to ensure data consistency

### File List

**Expected Modified Files:**
- [x] `apps/api/src/features/credentials/routes.js` - Add override endpoints
- [x] `apps/api/src/features/credentials/service.js` - Add override functions
- [x] `apps/api/src/features/credentials/schema.js` - Add override schemas
- [x] `apps/web/src/features/credentials/generation/CredentialList.jsx` - Add Override button
- [x] `apps/web/src/features/credentials/api/credentials.js` - Add override API calls
- [x] `apps/web/src/features/credentials/hooks/useCredentials.js` - Add useCredentialOverride hook

**Expected New Files:**
- [x] `apps/web/src/features/credentials/override/CredentialOverrideModal.jsx` - Override modal
- [x] `apps/web/src/features/credentials/override/CredentialOverrideModal.css` - Override styles
- [x] `apps/web/src/features/credentials/override/OverridePreview.jsx` - Preview diff component
- [x] `apps/web/src/features/credentials/override/index.js` - Module exports

**Test Files:**
- [x] `tests/api/credential_override.test.mjs` - API integration tests
- [x] `tests/api/credential_override_service.test.mjs` - Service unit tests

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2026-02-02 | Initial implementation - All 7 tasks completed | dev-story |

---

**Story ID**: 2.6
**Story Key**: 2-6-per-user-credential-override
**Epic**: 2 - Credential Lifecycle Management
**Priority**: Medium (depends on Stories 2.2-2.5, enables Story 2.9)
**Created**: 2026-02-02
**Status**: ready-for-dev

**Previous Story**: Story 2.5 - Credential History
**Next Story**: Story 2.7 - Username Field Mapping per System
