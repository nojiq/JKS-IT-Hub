# Story 2.11: IMAP Credentials (IT-only)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want IMAP credentials stored as IT-only and excluded from exports,
So that sensitive access remains restricted.

## Acceptance Criteria

### AC1: IMAP Credentials Restricted to IT-Only Access

**Given** IMAP credentials exist for a user
**When** a non-IT user (Requester, Admin, or Head of IT without IT role) attempts to view them
**Then** access is denied with a clear error message
**And** the IMAP credentials are not visible in the UI
**And** the IMAP credentials are not returned in API responses

### AC2: IMAP Credentials Excluded from All Exports

**Given** a user has IMAP credentials
**When** IT staff exports credentials (single-user or batch)
**Then** IMAP credentials are excluded from the export output
**And** other system credentials are included normally
**And** no indication of IMAP credentials appears in the export

### AC3: IT Users Can View IMAP Credentials

**Given** a user with IT role is authenticated
**When** they view a user's credentials
**Then** IMAP credentials are visible in the credentials list
**And** IMAP credentials can be viewed in detail
**And** IMAP credentials follow the same display patterns as other credentials

### AC4: IMAP Credentials Follow Standard Lifecycle

**Given** IMAP credentials are being managed
**When** IT staff performs credential operations (generate, regenerate, override, lock/unlock)
**Then** IMAP credentials follow the same lifecycle as other credentials
**And** IMAP credentials respect disabled user guardrails
**And** IMAP credentials can be locked/unlocked
**And** IMAP credential history is preserved

### AC5: IMAP System Configuration

**Given** the system is configured for credential generation
**When** IT staff configures system mappings
**Then** IMAP can be configured as a system with username field mapping
**And** IMAP system configuration includes an `isItOnly` flag set to `true`
**And** the IMAP system appears in the system configuration list

### AC6: Audit Logging for IMAP Access Attempts

**Given** a non-IT user attempts to access IMAP credentials
**When** the access is denied
**Then** the blocked attempt is logged with:
  - Actor (user who attempted access)
  - Action: `credential.imap.access.denied`
  - Target user (whose IMAP credentials were requested)
  - Timestamp
  - Reason: `insufficient_permissions`

## Tasks / Subtasks

### Database Schema Tasks

- [x] **Task 1: Add IT-Only Flag to SystemConfig** (AC: 5)
  - [x] Add migration to add `is_it_only` boolean column to `system_configs` table
  - [x] Default value: `false`
  - [x] Update Prisma schema with `isItOnly Boolean @default(false) @map("is_it_only")`
  - [x] Run migration: `npx prisma migrate dev --name add-is-it-only-to-system-configs`

- [x] **Task 2: Seed IMAP System Configuration** (AC: 5)
  - [x] Create seed data for IMAP system in `apps/api/prisma/seed.js`
  - [x] Set `systemId: "imap"`, `isItOnly: true`, `usernameLdapField: "mail"` (or appropriate field)
  - [x] Ensure seed runs on fresh database setup

### Backend API Tasks

- [x] **Task 3: Add IT-Only Access Check Middleware** (AC: 1, 6)
  - [x] Create `requireItRole()` middleware in `apps/api/src/shared/auth/middleware.js`
  - [x] Check if authenticated user has `role === 'it'` or `role === 'head_it'` (Head IT typically has IT access)
  - [x] Return RFC 9457 error if access denied: `type: '/problems/insufficient-permissions'`
  - [x] Add audit logging for denied access attempts

- [x] **Task 4: Filter IMAP Credentials in API Responses** (AC: 1, 3)
  - [x] Modify `apps/api/src/features/credentials/repo.js` `getUserCredentials()` function
  - [x] Add parameter `includeItOnly: boolean` (default: `false`)
  - [x] Filter out credentials where `systemConfig.isItOnly === true` unless `includeItOnly === true`
  - [x] Update service layer to pass `includeItOnly` based on user role

- [x] **Task 5: Update Credential Routes with IT-Only Filtering** (AC: 1, 3)
  - [x] Modify `GET /users/:id/credentials` route in `apps/api/src/features/credentials/routes.js`
  - [x] Check if requesting user has IT role
  - [x] Pass `includeItOnly: true` to service if user is IT, otherwise `false`
  - [x] Ensure proper error handling for access denied scenarios

- [x] **Task 6: Exclude IMAP from Export Functions** (AC: 2)
  - [x] Modify export service in `apps/api/src/features/exports/service.js` (or credentials export logic)
  - [x] Filter out credentials where `systemConfig.isItOnly === true` before formatting export
  - [x] Add test to verify IMAP credentials are never included in exports
  - [x] Document exclusion behavior in export function comments

- [x] **Task 7: Verify IMAP Credentials Follow Standard Lifecycle** (AC: 4)
  - [x] Review `generateUserCredentials()` - ensure IMAP credentials are generated normally
  - [x] Review `previewCredentialRegeneration()` - ensure IMAP credentials are included in preview for IT users
  - [x] Review `confirmRegeneration()` - ensure IMAP credentials can be regenerated
  - [x] Review override functions - ensure IMAP credentials can be overridden
  - [x] Review lock/unlock functions - ensure IMAP credentials can be locked/unlocked
  - [x] Verify disabled user guardrails apply to IMAP credentials

### Frontend UI Tasks

- [x] **Task 8: Add IT-Only Badge to IMAP Credentials in UI** (AC: 1, 3)
  - [x] Create `ItOnlyBadge.jsx` component in `apps/web/src/features/credentials/components/`
  - [x] Display "IT-Only" badge next to IMAP credentials in credentials list
  - [x] Add tooltip: "This credential is restricted to IT staff only"
  - [x] Style badge with distinct color (e.g., orange/amber for restricted access)

- [x] **Task 9: Filter IMAP Credentials for Non-IT Users in UI** (AC: 1)
  - [x] Update credentials list component to check user role from auth context
  - [x] Filter out credentials with `system.isItOnly === true` if user is not IT
  - [x] Ensure no visual indication of IMAP credentials for non-IT users
  - [x] Add role check in credential detail views

- [x] **Task 10: Update Export Preview to Exclude IMAP** (AC: 2)
  - [x] Modify export preview component in `apps/web/src/features/exports/`
  - [x] Show message: "IMAP credentials are excluded from exports for security"
  - [x] Display count of excluded credentials if any
  - [x] Ensure export preview matches actual export output

- [x] **Task 11: Add IMAP System Configuration UI** (AC: 5)
  - [x] Update system configuration form to include `isItOnly` checkbox
  - [x] Show "IT-Only Access" toggle when creating/editing system configurations
  - [x] Display warning: "Credentials for this system will only be visible to IT staff"
  - [x] Disable toggle for existing IMAP system (prevent accidental changes)

### Testing Tasks

- [x] **Task 12: Backend Integration Tests for IT-Only Access** (AC: 1, 3, 6)
  - [x] Test IT user can view IMAP credentials via `GET /users/:id/credentials`
  - [x] Test non-IT user (Requester) cannot view IMAP credentials (returns filtered list)
  - [x] Test Admin user cannot view IMAP credentials (unless also IT role)
  - [x] Test Head of IT can view IMAP credentials (if they have IT access)
  - [x] Test audit log created for denied access attempts
  - [x] Verify RFC 9457 error format for access denied

- [x] **Task 13: Backend Tests for Export Exclusion** (AC: 2)
  - [x] Test single-user export excludes IMAP credentials
  - [x] Test batch export excludes IMAP credentials for all users
  - [x] Test export with only IMAP credentials returns empty/minimal export
  - [x] Test export with mixed credentials (IMAP + others) excludes only IMAP

- [x] **Task 14: Backend Tests for IMAP Lifecycle** (AC: 4)
  - [x] Test IMAP credentials can be generated
  - [x] Test IMAP credentials can be regenerated
  - [x] Test IMAP credentials can be overridden
  - [x] Test IMAP credentials can be locked/unlocked
  - [x] Test IMAP credentials respect disabled user guardrails
  - [x] Test IMAP credential history is preserved

- [x] **Task 15: Frontend Component Tests** (AC: 1, 3)
  - [x] Test `ItOnlyBadge` component renders correctly
  - [x] Test credentials list filters IMAP for non-IT users
  - [x] Test credentials list shows IMAP for IT users with badge
  - [x] Test export preview shows exclusion message

- [x] **Task 16: E2E Tests for IT-Only Access** (AC: 1, 2, 3)
  - [x] Test IT user can view and manage IMAP credentials end-to-end
  - [x] Test non-IT user cannot see IMAP credentials in UI
  - [x] Test export downloaded by IT user excludes IMAP credentials
  - [x] Test system configuration with IT-Only flag works correctly

## Dev Notes

### IMAP Credential Security Model

**Critical Security Requirement**: IMAP credentials provide email access and are considered highly sensitive. They must NEVER be exposed to non-IT users or included in any export operations.

**Access Control Hierarchy**:
- **IT Role**: Full access to IMAP credentials (view, generate, regenerate, override, lock/unlock)
- **Head of IT Role**: Full access (typically has IT permissions)
- **Admin Role**: NO access to IMAP credentials (admin is for approvals, not IT operations)
- **Requester Role**: NO access to IMAP credentials

### Database Schema Changes

**New Column in `system_configs` table**:

```sql
-- Migration: add_is_it_only_to_system_configs
ALTER TABLE system_configs 
ADD COLUMN is_it_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed IMAP system configuration
INSERT INTO system_configs (id, system_id, username_ldap_field, is_it_only, description, created_at, updated_at)
VALUES (
  UUID(),
  'imap',
  'mail',
  TRUE,
  'IMAP email access credentials - IT-only access',
  NOW(),
  NOW()
);
```

**Updated Prisma Schema**:

```prisma
model SystemConfig {
  id                String   @id @default(uuid()) @db.Char(36) @map("id")
  systemId          String   @unique @db.VarChar(191) @map("system_id")
  usernameLdapField String   @db.VarChar(191) @map("username_ldap_field")
  isItOnly          Boolean  @default(false) @map("is_it_only")  // NEW FIELD
  description       String?  @db.Text @map("description")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  credentials UserCredential[]
  normalizationRules NormalizationRule[]
  lockedCredentials LockedCredential[]

  @@index([systemId], map: "idx_system_configs_system_id")
  @@map("system_configs")
}
```

### Backend Implementation Patterns

**IT-Only Access Middleware** (NEW):

```javascript
// apps/api/src/shared/auth/middleware.js

export function requireItRole(request, reply) {
  const user = request.user; // From JWT auth
  
  if (!user || (user.role !== 'it' && user.role !== 'head_it')) {
    // Log denied access attempt
    await auditLog.create({
      action: 'credential.imap.access.denied',
      actorUserId: user?.id,
      metadata: {
        reason: 'insufficient_permissions',
        requiredRole: 'it',
        actualRole: user?.role
      }
    });
    
    return reply.status(403).send({
      type: '/problems/insufficient-permissions',
      title: 'Insufficient Permissions',
      status: 403,
      detail: 'IT role required to access IMAP credentials',
      requiredRole: 'it',
      actualRole: user?.role
    });
  }
}
```

**Filtering IMAP Credentials in Repository**:

```javascript
// apps/api/src/features/credentials/repo.js

export async function getUserCredentials(userId, includeItOnly = false) {
  const credentials = await prisma.userCredential.findMany({
    where: {
      userId,
      isActive: true
    },
    include: {
      systemConfig: true
    }
  });
  
  // Filter out IT-only credentials unless explicitly requested
  if (!includeItOnly) {
    return credentials.filter(cred => !cred.systemConfig?.isItOnly);
  }
  
  return credentials;
}
```

**Export Filtering**:

```javascript
// apps/api/src/features/exports/service.js (or credentials export logic)

export async function exportUserCredentials(userId) {
  const credentials = await getUserCredentials(userId, false); // Never include IT-only
  
  // Filter again to be extra safe
  const exportableCredentials = credentials.filter(
    cred => !cred.systemConfig?.isItOnly
  );
  
  return formatExport(exportableCredentials);
}
```

### Frontend Implementation Patterns

**IT-Only Badge Component**:

```jsx
// apps/web/src/features/credentials/components/ItOnlyBadge.jsx

export function ItOnlyBadge() {
  return (
    <span 
      className="it-only-badge"
      title="This credential is restricted to IT staff only"
    >
      🔒 IT-Only
    </span>
  );
}
```

**Filtering in Credentials List**:

```jsx
// apps/web/src/features/credentials/components/CredentialsList.jsx

export function CredentialsList({ credentials, user }) {
  const isItUser = user.role === 'it' || user.role === 'head_it';
  
  const visibleCredentials = credentials.filter(cred => {
    // Filter out IT-only credentials for non-IT users
    if (cred.system?.isItOnly && !isItUser) {
      return false;
    }
    return true;
  });
  
  return (
    <div className="credentials-list">
      {visibleCredentials.map(cred => (
        <CredentialCard 
          key={cred.id} 
          credential={cred}
          showItOnlyBadge={cred.system?.isItOnly}
        />
      ))}
    </div>
  );
}
```

### Feature Structure (MUST FOLLOW)

```
apps/api/src/features/credentials/
├── routes.js              # MODIFY: Add IT-only filtering to GET /users/:id/credentials
├── service.js             # MODIFY: Update to pass includeItOnly parameter
├── repo.js                # MODIFY: Add includeItOnly parameter and filtering logic
└── schema.js              # MODIFY: Update response schemas to document IT-only behavior

apps/api/src/features/exports/
├── routes.js              # MODIFY: Ensure exports exclude IT-only credentials
├── service.js             # MODIFY: Add IT-only filtering to export functions
└── ...

apps/api/src/shared/auth/
├── middleware.js          # NEW: Add requireItRole() middleware
└── ...

apps/api/prisma/
├── schema.prisma          # MODIFY: Add isItOnly field to SystemConfig
├── migrations/            # NEW: Migration for is_it_only column
└── seed.js                # MODIFY: Add IMAP system configuration seed

apps/web/src/features/credentials/
├── components/
│   ├── ItOnlyBadge.jsx           # NEW: IT-Only badge component
│   ├── CredentialsList.jsx       # MODIFY: Add IT-only filtering
│   └── CredentialCard.jsx        # MODIFY: Show IT-only badge
└── ...

apps/web/src/features/exports/
├── components/
│   └── ExportPreview.jsx         # MODIFY: Show IMAP exclusion message
└── ...
```

### Dependencies on Previous Stories

**This story depends on:**
- **Story 2.1 (Global Credential Template)**: Template infrastructure for credential generation
- **Story 2.2 (Deterministic Credential Generation)**: Credential generation service
- **Story 2.4 (Regeneration with Confirmation)**: Regeneration lifecycle
- **Story 2.5 (Credential History)**: History preservation
- **Story 2.6 (Per-User Credential Override)**: Override functionality
- **Story 2.7 (Username Field Mapping per System)**: System configuration infrastructure
- **Story 2.9 (Credential Lock/Unlock)**: Lock/unlock functionality
- **Story 2.10 (Disabled User Guardrails)**: Guardrail patterns and disabled user checks
- **Story 1.7 (Role Management)**: RBAC infrastructure for role-based access

**This story enables:**
- **Story 3.1 (Single-User Credential Export)**: Export must exclude IMAP credentials
- **Story 3.2 (Batch Credential Export)**: Batch export must exclude IMAP credentials
- **Story 3.3 (Export Formatting Rules)**: Export formatting respects IT-only exclusion
- **Story 3.4 (No Export Archiving)**: Export archiving (if implemented) must not include IMAP

### Critical Rules from Project Context

- **IMAP credentials are NEVER exported; IT-only access** (Critical Don't-Miss Rule)
- **All sensitive actions must write to audit log** (Critical Don't-Miss Rule)
- **Naming**: Database columns in snake_case (`is_it_only`), API payloads in camelCase (`isItOnly`)
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: Code stays in `features/credentials/` and `features/exports/`
- **Audit everything**: Log all access denied attempts for IMAP credentials

### REUSE PATTERNS FROM PREVIOUS STORIES

**From Story 2.7 (Username Field Mapping per System)**:
- System configuration model and patterns
- `SystemConfig` table structure
- System-specific field mapping

**From Story 2.10 (Disabled User Guardrails)**:
- Access control patterns (blocking operations based on user state)
- Audit logging for blocked attempts
- RFC 9457 error responses for access denied
- UI indicator patterns (similar to DisabledUserBanner, create ItOnlyBadge)

**From Story 1.7 (Role Management)**:
- Role-based access control (RBAC) patterns
- User role checking (`user.role === 'it'`)
- Permission-based UI rendering

**From Story 2.9 (Credential Lock/Unlock)**:
- Credential-level access control patterns
- System-specific credential operations

### Role-Based Access Control (RBAC) Matrix

| Role | View IMAP | Generate IMAP | Regenerate IMAP | Override IMAP | Lock/Unlock IMAP | Export IMAP |
|------|-----------|---------------|-----------------|---------------|------------------|-------------|
| IT | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (excluded from all exports) |
| Head of IT | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (excluded from all exports) |
| Admin | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| Requester | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

**Note**: Even IT users cannot export IMAP credentials. The export exclusion is absolute.

### Testing Strategy

**Backend Tests**:
1. **Access Control Tests**: Verify IT-only access restrictions work correctly
2. **Export Exclusion Tests**: Verify IMAP credentials are never included in exports
3. **Lifecycle Tests**: Verify IMAP credentials follow standard lifecycle (generate, regenerate, override, lock/unlock)
4. **Audit Tests**: Verify access denied attempts are logged
5. **Integration Tests**: Verify end-to-end flows with IMAP credentials

**Frontend Tests**:
1. **Component Tests**: Test ItOnlyBadge, filtered credentials list
2. **Role-Based Rendering Tests**: Test UI shows/hides IMAP based on user role
3. **Export Preview Tests**: Test export preview shows exclusion message

**E2E Tests**:
1. **IT User Flow**: IT user can view, manage, and see IMAP credentials with badge
2. **Non-IT User Flow**: Non-IT user cannot see IMAP credentials anywhere in UI
3. **Export Flow**: Export downloaded by IT user does not contain IMAP credentials

### UI/UX Specifications

**IT-Only Badge**:

```
┌─────────────────────────────────────────────────────────────┐
│ Credentials for John Doe                                    │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔒 IMAP                                   🔒 IT-Only     │ │
│ │ Username: john.doe@company.com                          │ │
│ │ Password: ••••••••••••                                  │ │
│ │ [View] [Regenerate] [Override] [Lock]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🖥️ Active Directory                                     │ │
│ │ Username: jdoe                                          │ │
│ │ Password: ••••••••••••                                  │ │
│ │ [View] [Regenerate] [Override] [Lock]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Export Preview with IMAP Exclusion**:

```
┌─────────────────────────────────────────────────────────────┐
│ Export Preview - John Doe                                   │
│                                                              │
│ ℹ️ IMAP credentials are excluded from exports for security │
│                                                              │
│ Systems to be exported:                                     │
│ ✓ Active Directory                                          │
│ ✓ VPN                                                       │
│ ✓ File Server                                               │
│ ✗ IMAP (excluded - IT-only)                                 │
│                                                              │
│ [Download Export] [Cancel]                                  │
└─────────────────────────────────────────────────────────────┘
```

### Error Response Examples

**Non-IT User Attempts to Access IMAP Credentials**:

```json
{
  "type": "/problems/insufficient-permissions",
  "title": "Insufficient Permissions",
  "status": 403,
  "detail": "IT role required to access IMAP credentials",
  "requiredRole": "it",
  "actualRole": "requester",
  "suggestion": "Contact IT staff for IMAP credential access"
}
```

**Audit Log Entry for Denied Access**:

```json
{
  "action": "credential.imap.access.denied",
  "actorUserId": "user-uuid-123",
  "entityType": "user_credential",
  "entityId": "credential-uuid-456",
  "metadata": {
    "reason": "insufficient_permissions",
    "requiredRole": "it",
    "actualRole": "requester",
    "systemId": "imap",
    "targetUserId": "user-uuid-789"
  },
  "createdAt": "2026-02-04T13:52:10Z"
}
```

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.11: IMAP Credentials (IT-only) (Lines 489-503)
   - FR20: Store IMAP passwords as IT-only credentials and never export them

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Fastify API, Prisma ORM, React SPA
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging
   - Database: MySQL 8.4 LTS, Prisma 7.3.0

3. **Project Context**: `_bmad-output/project-context.md`
   - Critical Rule: "IMAP credentials are NEVER exported; IT-only access."
   - Critical Rule: "All sensitive actions must write to audit log."
   - Naming conventions: DB snake_case, API camelCase
   - Framework rules: Prisma access only in repo.js

4. **Previous Story**: `_bmad-output/implementation-artifacts/2-10-disabled-user-guardrails.md`
   - Access control patterns
   - Audit logging for blocked attempts
   - RFC 9457 error response patterns
   - UI indicator components (DisabledUserBanner pattern)

### Related Implementation Files

**Database Schema**:
- `apps/api/prisma/schema.prisma` - SystemConfig model (add isItOnly field)
- `apps/api/prisma/migrations/` - New migration for is_it_only column
- `apps/api/prisma/seed.js` - IMAP system configuration seed

**Backend (To Modify)**:
- `apps/api/src/features/credentials/repo.js` - Add includeItOnly parameter and filtering
- `apps/api/src/features/credentials/service.js` - Pass includeItOnly based on user role
- `apps/api/src/features/credentials/routes.js` - Add IT-only filtering to GET endpoints
- `apps/api/src/features/exports/service.js` - Exclude IT-only credentials from exports

**Backend (New)**:
- `apps/api/src/shared/auth/middleware.js` - Add requireItRole() middleware

**Frontend (To Modify)**:
- `apps/web/src/features/credentials/components/CredentialsList.jsx` - Filter IT-only credentials
- `apps/web/src/features/credentials/components/CredentialCard.jsx` - Show IT-only badge
- `apps/web/src/features/exports/components/ExportPreview.jsx` - Show exclusion message

**Frontend (New)**:
- `apps/web/src/features/credentials/components/ItOnlyBadge.jsx` - IT-Only badge component

**Tests (New)**:
- `tests/api/imap-credentials-it-only.test.mjs` - Backend integration tests
- `tests/web/ItOnlyBadge.test.jsx` - Component tests

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_To be filled by dev agent_

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2026-02-04 | Initial story creation - Comprehensive context for Story 2.11 | create-story |

---

**Story ID**: 2.11
**Story Key**: 2-11-imap-credentials-it-only
**Epic**: 2 - Credential Lifecycle Management
**Priority**: High (FR20 requirement, security-critical)
**Created**: 2026-02-04
**Status**: ready-for-dev
**FRs**: FR20

**Previous Story**: Story 2.10 - Disabled User Guardrails
**Next Story**: Story 3.1 - Single-User Credential Export
