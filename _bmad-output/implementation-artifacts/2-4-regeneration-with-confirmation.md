# Story 2.4: Regeneration with Confirmation

Status: ready-for-dev

## Story

As IT staff,
I want to regenerate credentials when LDAP data or templates change,
so that credentials stay accurate and up-to-date.

## Acceptance Criteria

### AC1: Trigger Regeneration

**Given** LDAP data or the global credential template has changed
**When** IT staff requests regeneration for a user
**Then** the system identifies the change type (LDAP update or template change)
**And** generates new credentials using the current template and latest LDAP data
**And** displays a comparison of old vs new credentials

### AC2: Explicit Confirmation Required Before Overwrite

**Given** IT staff is viewing regenerated credentials
**When** they attempt to save the new credentials
**Then** the system requires explicit confirmation with clear warnings
**And** shows the specific changes being made (which fields will be overwritten)
**And** without explicit confirmation, active credentials remain unchanged

### AC3: Preserve Historical Credentials

**Given** credentials are being regenerated
**When** new credentials are confirmed and saved
**Then** the previous active credentials are moved to history (credential_versions table)
**And** the historical record includes:
- Previous username and password
- Reason for change ("ldap_update" or "template_change")
- Timestamp of change
- IT staff who performed the regeneration
**And** the new credentials become the active set

### AC4: Handle Locked Credentials During Regeneration

**Given** some credentials are locked (Story 2.9 - to be implemented)
**When** regeneration is requested
**Then** the system skips locked credentials
**And** regenerates only unlocked credentials
**And** provides a summary of which credentials were skipped and why

### AC5: Block Regeneration for Disabled Users

**Given** a user is disabled (per FR19)
**When** IT staff attempts to regenerate credentials
**Then** the system blocks the action
**And** returns a clear error message explaining that disabled users cannot have credentials regenerated
**And** suggests re-enabling the user first if credentials are needed

## Tasks / Subtasks

- [ ] **Task 1: Database Schema Updates** (AC: 3)
  - [ ] Ensure credential_versions table supports "regeneration" reason type
  - [ ] Add index on user_id + is_active for efficient active credential queries
  - [ ] Verify soft-delete pattern for deactivating old credentials

- [ ] **Task 2: Regeneration Service Layer** (AC: 1, 3, 4, 5)
  - [ ] Create regenerateUserCredentials() function
  - [ ] Implement change detection (compare current LDAP/template vs last generation)
  - [ ] Build credential comparison logic (old vs new)
  - [ ] Handle locked credential filtering (prepare for Story 2.9)
  - [ ] Add disabled user validation guardrail
  - [ ] Implement transaction-based atomic updates (deactivate old, create new, create history)

- [ ] **Task 3: API Endpoints** (AC: 1, 2, 5)
  - [ ] Create POST /api/v1/users/:userId/credentials/regenerate endpoint
  - [ ] Create POST /api/v1/users/:userId/credentials/regenerate/preview endpoint (comparison view)
  - [ ] Create POST /api/v1/users/:userId/credentials/regenerate/confirm endpoint
  - [ ] Implement Zod validation for regeneration requests
  - [ ] Add RBAC checks (IT role only)
  - [ ] Implement audit logging for regeneration attempts (success and blocked)
  - [ ] Add RFC 9457 error handling for disabled users

- [ ] **Task 4: Frontend Components** (AC: 1, 2, 4)
  - [ ] Create CredentialRegeneration page/component
  - [ ] Build comparison view showing old vs new credentials side-by-side
  - [ ] Implement change highlighting (what's different: username, password, or both)
  - [ ] Create explicit confirmation UI with warnings about overwriting
  - [ ] Add locked credential indicators and skip notifications
  - [ ] Implement disabled user error display with re-enable guidance

- [ ] **Task 5: Integration with Preview/Confirm Pattern** (AC: 2)
  - [ ] Reuse preview session storage from Story 2.3
  - [ ] Adapt preview structure to include comparison data
  - [ ] Integrate with existing confirmation workflow
  - [ ] Handle cancellation (discard regeneration preview)

- [ ] **Task 6: Testing** (AC: 1, 2, 3, 4, 5)
  - [ ] Write unit tests for regeneration service
  - [ ] Test change detection logic with various scenarios
  - [ ] Create integration tests for full regenerate → preview → confirm flow
  - [ ] Test disabled user blocking
  - [ ] Test locked credential handling
  - [ ] Verify history preservation and audit logging
  - [ ] Test transaction rollback on errors

- [ ] **Task 7: Documentation** (AC: 1, 2, 3)
  - [ ] Update API documentation with regeneration endpoints
  - [ ] Document regeneration workflow and confirmation requirements
  - [ ] Add troubleshooting guide for common scenarios (disabled users, locked credentials)
  - [ ] Document history preservation behavior

## Dev Notes

### Architecture Requirements

**Database Schema:**

The regeneration feature uses existing tables from Stories 2.1-2.3:
- `user_credentials`: Stores active credentials
- `credential_versions`: Stores historical credentials with reason tracking

*Key Fields for Regeneration:*
- `user_credentials.is_active`: Boolean flag - set to false when superseded
- `credential_versions.reason`: String - "regeneration" for this story
- `credential_versions.created_at`: Timestamp of regeneration
- `user_credentials.template_version`: Tracks which template version was used

**API Patterns:**
- Endpoints:
  - `POST /api/v1/users/:userId/credentials/regenerate` - Initiate regeneration
  - `POST /api/v1/users/:userId/credentials/regenerate/preview` - Preview comparison
  - `POST /api/v1/users/:userId/credentials/regenerate/confirm` - Confirm and save
- Response format: `{ data, meta }` per architecture requirements
- Error format: RFC 9457 Problem Details
- Input validation: Zod 4.3.0

**Security Requirements:**
- RBAC: IT role only for regeneration operations
- All regeneration events must be audit logged (sensitive action per NFR8)
- JWT authentication via HttpOnly cookies
- Disabled user guardrail (FR19 compliance)

**Feature Structure:**
```
apps/api/src/features/credentials/
├── routes.js              # Add regeneration endpoints
├── service.js             # Add regeneration logic
├── repo.js                # Credential versioning operations
├── schema.js              # Zod schemas for regeneration requests
├── generator.js           # Reuse from Story 2.2
└── normalizer.js          # Reuse from Story 2.2

apps/web/src/features/credentials/
├── regeneration/
│   ├── CredentialRegeneration.jsx      # Main regeneration page
│   ├── CredentialComparison.jsx        # Old vs new comparison view
│   ├── RegenerationPreview.jsx         # Preview modal
│   └── RegenerationConfirm.jsx         # Confirmation UI
├── api/
│   └── credentials.js                  # Add regeneration API calls
└── hooks/
    └── useCredentials.js               # Add regeneration hooks
```

### Technical Specifications

**Regeneration Flow:**

1. **Initiate Regeneration**: IT staff clicks "Regenerate Credentials" for a user
2. **Change Detection**: System compares current state with last generation:
   - Fetch current LDAP attributes for user
   - Fetch active credential template version
   - Compare with stored template_version in user_credentials
   - Detect which LDAP fields changed (if any)
3. **Generate New Credentials**: Use Story 2.2 deterministic generation with current data
4. **Build Comparison**: Create side-by-side view of old vs new credentials
5. **Preview Session**: Store comparison in preview session (5-min expiration from Story 2.3)
6. **Explicit Confirmation**: IT staff reviews changes and confirms
7. **Atomic Update**: Transaction ensures:
   - Deactivate old credentials (set is_active = false)
   - Create new active credentials
   - Create history entry in credential_versions with reason "regeneration"
   - Audit log entry for the action

**Comparison Data Structure:**
```javascript
{
  userId: "uuid-of-user",
  changeType: "ldap_update" | "template_change" | "both",
  changedLdapFields: ["mail", "cn"],  // if LDAP changed
  oldTemplateVersion: 2,
  newTemplateVersion: 3,  // if template changed
  comparisons: [
    {
      system: "email",
      old: {
        username: "john.old@company.com",
        password: "OldPass123",
        isLocked: false
      },
      new: {
        username: "john.new@company.com",
        password: "NewPass456",
        isLocked: false  // Future: from Story 2.9
      },
      changes: ["username", "password"]
    },
    {
      system: "vpn",
      old: {
        username: "jold",
        password: "VpnOld789",
        isLocked: true   // Future: from Story 2.9
      },
      new: null,  // Skipped due to lock
      skipped: true,
      skipReason: "credential_locked"
    }
  ],
  timestamp: "2026-02-02T10:30:00Z",
  expiresAt: "2026-02-02T10:35:00Z"
}
```

**RFC 9457 Error Examples:**

```json
// Disabled user blocked
{
  "type": "/problems/regeneration-blocked",
  "title": "Regeneration Blocked",
  "status": 403,
  "detail": "Cannot regenerate credentials for disabled users",
  "userId": "uuid-here",
  "userStatus": "disabled",
  "resolution": "Re-enable the user before regenerating credentials"
}

// No changes detected
{
  "type": "/problems/no-changes-detected",
  "title": "No Changes Detected",
  "status": 400,
  "detail": "LDAP data and template are unchanged since last generation",
  "lastGeneratedAt": "2026-02-01T08:00:00Z",
  "suggestion": "Credentials are already up-to-date"
}

// Preview session expired
{
  "type": "/problems/preview-expired",
  "title": "Preview Session Expired",
  "status": 410,
  "detail": "The regeneration preview session has expired. Please start again.",
  "expiredAt": "2026-02-02T10:35:00Z"
}
```

**UI/UX Specifications:**

- **Regeneration Trigger**: Button on user detail page next to existing credentials
- **Comparison View**: Side-by-side table showing:
  - System name (left column)
  - Old credentials (center): username and masked password
  - New credentials (right): username and masked password
  - Change indicators: Highlight cells with changes (green for new values)
  - Lock icons: For credentials that will be skipped (future Story 2.9)
- **Change Summary**: Banner showing:
  - Change type (LDAP update, template change, or both)
  - Which LDAP fields changed (if applicable)
  - Template version change (if applicable)
- **Confirmation Section**:
  - Warning text: "This will overwrite existing active credentials. Previous credentials will be preserved in history."
  - Checkbox: "I understand and want to regenerate credentials"
  - Primary Button: "Confirm Regeneration" (disabled until checkbox checked)
  - Secondary Button: "Cancel" (discards preview)

### Dependencies on Previous Stories

**This story depends on:**
- **Story 2.1 (Global Credential Template)**: Template versioning and structure
- **Story 2.2 (Deterministic Credential Generation)**: Generation algorithm, credential tables, versioning
- **Story 2.3 (Credential Preview & Confirmation)**: Preview/confirm pattern, session storage
- **Epic 1 Stories**: LDAP sync, user management, RBAC, audit logging

**This story enables:**
- **Story 2.5 (Credential History)**: History viewing UI for regeneration records
- **Story 2.9 (Credential Lock/Unlock)**: Locked credential handling during regeneration

### Critical Rules from Project Context

- **Never auto-regenerate**: Always require explicit confirmation before overwriting
- **Preserve history**: All previous credentials must be preserved with reason tracking
- **Disabled user guardrail**: Block regeneration for disabled users (FR19)
- **Audit everything**: All regeneration attempts (success/blocked) must be logged
- **Atomic updates**: Use transactions to ensure data consistency
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: All code stays in `features/credentials/`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Implementation Plan

1. **Backend First**:
   - Add regeneration service with change detection
   - Create comparison building logic
   - Implement transaction-based atomic updates
   - Add regeneration endpoints (regenerate, preview, confirm)
   - Integrate audit logging

2. **Frontend**:
   - Build CredentialRegeneration component
   - Create comparison view with change highlighting
   - Integrate with existing preview/confirm workflow
   - Handle disabled user errors and locked credential indicators

3. **Integration**:
   - Connect to Story 2.3 preview session storage
   - Reuse Story 2.2 generation logic
   - Integrate with LDAP data from Epic 1

4. **Testing**:
   - Unit tests for change detection
   - Integration tests for full flow
   - Test guardrails (disabled users, locked credentials)

5. **Documentation**:
   - Update API docs
   - Add user guide for IT staff

### Technical Decisions Made

(To be filled during implementation)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### File List

**Expected Modified Files:**
- `apps/api/src/features/credentials/routes.js` - Add regeneration endpoints
- `apps/api/src/features/credentials/service.js` - Add regeneration logic
- `apps/api/src/features/credentials/repo.js` - Add credential versioning operations
- `apps/api/src/features/credentials/schema.js` - Add regeneration schemas
- `apps/web/src/features/credentials/api/credentials.js` - Add regeneration API calls
- `apps/web/src/features/credentials/hooks/useCredentials.js` - Add regeneration hooks

**Expected New Files:**
- `apps/web/src/features/credentials/regeneration/CredentialRegeneration.jsx`
- `apps/web/src/features/credentials/regeneration/CredentialComparison.jsx`
- `apps/web/src/features/credentials/regeneration/RegenerationPreview.jsx`
- `apps/web/src/features/credentials/regeneration/RegenerationConfirm.jsx`
- `apps/web/src/features/credentials/regeneration/index.js`

## Previous Story Intelligence

### Story 2.1: Global Credential Template (Status: review)

**Patterns Established:**
- Template structure stored as JSON with versioning
- Only one active template at a time
- Template version tracked as integer (1, 2, 3...)

### Story 2.2: Deterministic Credential Generation (Status: review)

**Technical Implementation:**
- Database tables: `user_credentials` and `credential_versions`
- Deterministic generation algorithm in `generator.js`
- Pattern parser: `{field:N}`, `{random:N}`, `{fixed:text}`
- Version tracking: `user_credentials.template_version` field

**Key Files to Reuse:**
- `apps/api/src/features/credentials/generator.js` - Generation logic
- `apps/api/src/features/credentials/normalizer.js` - Normalization
- Database schema from Story 2.2

### Story 2.3: Credential Preview & Confirmation (Status: done)

**Technical Implementation:**
- Preview session storage with 5-minute expiration
- In-memory Map with automatic cleanup
- Token format: `preview_${timestamp}_${random}`
- Explicit confirmation pattern: Checkbox + disabled button

**Key Components to Reuse:**
- Preview session management from `repo.js`
- Confirmation UI patterns from `ConfirmationForm.jsx`
- Error handling patterns

**Lessons Learned from Story 2.3:**
- In-memory storage is sufficient for single-instance; Redis for multi-instance
- Always include ldapSources in preview (was a critical fix during code review)
- Automatic cleanup of expired sessions prevents memory leaks
- RFC 9457 error format works well for all error scenarios

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.4: Regeneration with Confirmation
   - FR13: IT staff can regenerate credentials with explicit confirmation
   - FR14: System preserves historical credential versions
   - FR19: Block credential generation/regeneration for disabled users

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Vite React SPA + Fastify API, MySQL 8.4 LTS, Prisma 7.3.0
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging, encryption at rest

3. **PRD Document**: `_bmad-output/planning-artifacts/prd.md`
   - FR13: Regeneration with confirmation requirement
   - FR14: Historical credential versions requirement
   - Journey 2: Edge case handling mentions regeneration and disabled users
   - Section: "Functional Requirements → Credential Generation & Governance"

4. **Previous Stories**:
   - Story 2.1: Global Credential Template
   - Story 2.2: Deterministic Credential Generation
   - Story 2.3: Credential Preview & Confirmation

### Git Intelligence

Recent commit: `44b8ab0 Initialize project from starter templates (fixed scope violations)`
- Project initialized from Vite + Fastify starter templates
- Feature-based structure established
- Stories 2.1, 2.2, 2.3 implementations completed

---

**Story ID**: 2.4
**Story Key**: 2-4-regeneration-with-confirmation
**Epic**: 2 - Credential Lifecycle Management
**Priority**: High (depends on Story 2.3, enables Story 2.5)
**Created**: 2026-02-02
**Status**: ready-for-dev

**Next Story in Epic**: Story 2.5 - Credential History
