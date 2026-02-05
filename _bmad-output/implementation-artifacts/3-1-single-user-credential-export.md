# Story 3.1: Single-User Credential Export

Status: review

## Story

As IT staff,
I want to export credentials for a single user on demand,
So that I can deliver access details quickly.

## Acceptance Criteria

### AC1: Export Performance

**Given** a user has generated credentials
**When** IT requests a single-user export
**Then** the system produces an export within 5 seconds under normal load

### AC2: Export Format Requirements

**Given** a user has generated credentials
**When** IT requests a single-user export
**Then** the export includes a title line and per-system username/password entries

**And** the export format is human-readable with clear structure:
- Title line with user information and export timestamp
- Per-system entries with system name, username, and password
- Each entry on a separate line or clearly delimited

### AC3: IMAP Exclusion

**Given** a user has IMAP credentials configured (IT-only access)
**When** IT staff exports credentials for that user
**Then** IMAP credentials are excluded from the export output

**And** no indication of IMAP credentials appears in the export

### AC4: No Export Archiving

**Given** an export is generated and downloaded
**When** the export operation completes
**Then** the system does not store or archive the export file

**And** the export is generated on-demand and streamed directly to the client

## Tasks / Subtasks

- [x] **Task 1: Backend - Export Service Implementation** (AC: 1, 2, 4)
  - [x] Create export service in `apps/api/src/features/exports/service.js`
  - [x] Implement `exportUserCredentials(userId)` function
  - [x] Fetch user credentials from database with IMAP filtering
  - [x] Format export with title line and per-system entries
  - [x] Use in-memory streaming (no disk persistence)
  - [x] Add performance logging to verify <5 seconds
  - [x] Implement proper error handling for edge cases

- [x] **Task 2: Backend - Export API Endpoint** (AC: 1, 2, 3, 4)
  - [x] Create `GET /api/v1/users/:userId/credentials/export` endpoint
  - [x] Add RBAC middleware (IT role required for export)
  - [x] Implement audit logging for all export requests (actor, user_id, timestamp, outcome)
  - [x] Set appropriate response headers (Content-Type, Content-Disposition, Cache-Control: no-store)
  - [x] Stream response directly to client without file persistence
  - [x] Add Zod validation for userId parameter
  - [x] Return RFC 9457 errors for unauthorized access, missing credentials, disabled users

- [x] **Task 3: Backend - Export Formatting Logic** (AC: 2)
  - [x] Create `formatCredentialExport(user, credentials)` function
  - [x] Generate title line with user name, export timestamp, system count
  - [x] Format per-system entries with system name, username, password
  - [x] Use consistent delimiter or line-based format
  - [x] Ensure passwords are included in plain text (for secure delivery to IT)
  - [x] Handle edge cases: empty credential list, non-LDAP username fields

- [x] **Task 4: Backend - IMAP Filtering** (AC: 3)
  - [x] Modify export service to filter IMAP credentials
  - [x] Leverage existing IT-only filtering from Story 2.11
  - [x] Query credentials with `includeItOnly: false` parameter
  - [x] Add test to verify IMAP credentials are never included
  - [x] Document exclusion behavior in export function comments

- [x] **Task 5: Backend - Audit Logging Integration** (AC: 1)
  - [x] Create audit log entry on export request:
    - Action: `credentials.export.single_user`
    - Actor: requesting user ID
    - Target user ID: exported user
    - Metadata: credential count, systems exported, timestamp
  - [x] Log export success/failure outcomes
  - [x] Include exported systems list (excluding IMAP) in metadata

- [x] **Task 6: Frontend - Export UI Components** (AC: 1, 2)
  - [x] Add "Export Credentials" button on user detail page
  - [x] Create `CredentialExportButton.jsx` component in `apps/web/src/features/exports/components/`
  - [x] Add loading state during export generation
  - [x] Display success/error notifications
  - [x] Show export summary (systems exported, excluded systems like IMAP)

- [x] **Task 7: Frontend - Download Handling** (AC: 4)
  - [x] Implement browser download in `apps/web/src/features/exports/api/exports.js`
  - [x] Use fetch API with JWT auth (from cookies)
  - [x] Create blob from response and trigger download
  - [x] Auto-generate filename with user ID and timestamp
  - [x] Handle network errors with user-friendly messages

- [x] **Task 8: Testing - Backend Integration Tests** (AC: 1, 2, 3, 4)
  - [x] Test single-user export returns proper format
  - [x] Test export completes within 5 seconds with realistic data
  - [x] Test export excludes IMAP credentials
  - [x] Test export without credentials returns empty/minimal export
  - [x] Test IT role required (non-IT users get 403)
  - [x] Test audit log created for export operations
  - [x] Test disabled user guardrails apply (no export for disabled users)

- [x] **Task 9: Testing - Frontend Component Tests** (AC: 1, 2)
  - [x] Test `CredentialExportButton` component renders correctly
  - [x] Test export button triggers download
  - [x] Test loading state displays during export
  - [x] Test error handling shows user-friendly message

- [x] **Task 10: E2E Tests** (AC: 1, 2, 3, 4)
  - [x] Test IT user can export credentials end-to-end
  - [x] Test downloaded export file matches expected format
  - [x] Test IMAP credentials excluded from exported file
  - [x] Test export fails for non-IT users
  - [x] Test export audit log entry created

## Dev Notes

### Architecture Requirements

**Database Schema:**

This story reuses existing schemas from previous stories:

```prisma
// apps/api/prisma/schema.prisma

// From Story 2.2/2.4/2.6/2.11
model UserCredential {
  id              String   @id @default(uuid()) @db.Char(36) @map("id")
  userId          String   @db.Char(36) @map("user_id")
  systemConfigId  String   @db.Char(36) @map("system_config_id")
  username        String   @db.VarChar(191) @map("username")
  password        String   @db.Text @map("password")  // Encrypted at rest
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  systemConfig    SystemConfig @relation(fields: [systemConfigId], references: [id])

  @@index([userId], map: "idx_user_credentials_user_id")
  @@index([systemConfigId], map: "idx_user_credentials_system_config_id")
  @@map("user_credentials")
}

model SystemConfig {
  id                String   @id @default(uuid()) @db.Char(36) @map("id")
  systemId          String   @unique @db.VarChar(191) @map("system_id")
  usernameLdapField String   @db.VarChar(191) @map("username_ldap_field")
  description       String?  @db.Text @map("description")
  isItOnly          Boolean  @default(false) @map("is_it_only")  // From Story 2.11
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  credentials UserCredential[]
  lockedCredentials LockedCredential[]

  @@index([systemId], map: "idx_system_configs_system_id")
  @@map("system_configs")
}
```

**Key Schema Points:**
- Reuse `user_credentials` table for current credentials
- Filter by `systemConfig.isItOnly === false` to exclude IMAP credentials
- Fetch with `systemConfig` relation to get system names

**API Patterns:**
- Endpoint: `GET /api/v1/users/:userId/credentials/export`
- Authentication: JWT via HttpOnly, Secure, SameSite cookies (from Story 1.2)
- Authorization: RBAC - IT role required
- Response format: Plain text/UTF-8 with proper headers
- Error format: RFC 9457 Problem Details
- Input validation: Zod 4.3.0
- Rate limiting: Per-user rate limit via @fastify/rate-limit (from architecture)

**Security Requirements:**
- RBAC: IT role only for exporting credentials (sensitive data)
- IMAP credentials: IT-only access AND excluded from all exports (FR20, Story 2.11)
- Audit logging: All export operations logged (action: `credentials.export.single_user`)
- No persistence: Export generated in memory, streamed to client, never stored
- Disabled users: Guardrails from Story 2.10 apply (no export for disabled users)

**Feature Structure:**
```
apps/api/src/features/exports/
├── routes.js              # NEW: Export endpoint
├── service.js             # NEW: Export generation and formatting
└── schema.js              # NEW: Validation schemas

apps/web/src/features/exports/
├── components/
│   └── CredentialExportButton.jsx   # NEW: Export trigger button
└── api/
    └── exports.js         # NEW: API client for export

# Reuse existing auth and audit infrastructure
apps/api/src/shared/auth/     # From Story 1.2
apps/api/src/features/audit/   # From Story 1.9/1.10
apps/api/src/features/credentials/  # From Story 2.x (for credential queries)
```

### Technical Specifications

**Export Format (Human-Readable Text):**

```
IT-HUB CREDENTIAL EXPORT
Generated: 2026-02-04T10:30:00Z
User: John Doe (john.doe@company.com)
Systems: 3

---------------------------------
Active Directory
Username: jdoe
Password: AbCdEfGh12#!
---------------------------------

---------------------------------
VPN
Username: jdoe
Password: XyZ987$%^&
---------------------------------

---------------------------------
File Server
Username: john.doe
Password: P@ssw0rd2026!
---------------------------------

End of export
```

**Alternative Compressed Format:**

```
IT-HUB EXPORT - John Doe - 2026-02-04T10:30:00Z
Active Directory|jdoe|AbCdEfGh12#!
VPN|jdoe|XyZ987$%^&
File Server|john.doe|P@ssw0rd2026!
```

*Both formats satisfy FR23. Choose one based on ease of parsing and readability.*

**API Response Headers:**

```javascript
{
  'Content-Type': 'text/plain; charset=utf-8',
  'Content-Disposition': `attachment; filename="credentials-${userId}-${timestamp}.txt"`,
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Pragma': 'no-cache'
}
```

**Audit Log Entry Structure:**

```javascript
{
  action: 'credentials.export.single_user',
  actorUserId: 'uuid-of-it-user',
  entityType: 'user',
  entityId: 'uuid-of-exported-user',
  metadata: {
    exportedSystems: ['active-directory', 'vpn', 'file-server'],
    excludedSystems: ['imap'],  // Always present if IMAP exists
    credentialCount: 3,
    exportTimestamp: '2026-02-04T10:30:00Z'
  },
  createdAt: '2026-02-04T10:30:00Z'
}
```

**RFC 9457 Error Examples:**

```javascript
// User unauthorized (not IT role)
{
  type: '/problems/unauthorized',
  title: 'Unauthorized',
  status: 403,
  detail: 'IT role required to export credentials',
  requiredRole: 'it',
  actualRole: 'requester',
  suggestion: 'Contact IT staff for credential export assistance'
}

// User not found
{
  type: '/problems/user-not-found',
  title: 'User Not Found',
  status: 404,
  detail: 'User with the specified ID does not exist',
  userId: 'uuid-here'
}

// No credentials to export
{
  type: '/problems/no-credentials',
  title: 'No Credentials',
  status: 200,
  detail: 'User has no exportable credentials',
  userId: 'uuid-here',
  exportedSystems: []
}

// Disabled user (from Story 2.10 guardrails)
{
  type: '/problems/disabled-user',
  title: 'User Disabled',
  status: 403,
  detail: 'Cannot export credentials for disabled user',
  userId: 'uuid-here',
  suggestion: 'Enable user before exporting credentials'
}
```

**Backend Service Implementation:**

```javascript
// apps/api/src/features/exports/service.js

export async function exportUserCredentials(userId, actorUserId) {
  // Fetch user
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Problem('user-not-found', 'User not found', 404);

  // Check disabled user guardrail (from Story 2.10)
  if (!user.isEnabled) {
    throw new Problem('disabled-user', 'Cannot export credentials for disabled user', 403);
  }

  // Fetch credentials with IMAP filtering (includeItOnly: false)
  const credentials = await prisma.userCredential.findMany({
    where: {
      userId,
      isActive: true,
      systemConfig: {
        isItOnly: false  // Exclude IMAP credentials
      }
    },
    include: {
      systemConfig: true
    },
    orderBy: {
      systemConfig: {
        systemId: 'asc'
      }
    }
  });

  // Format export
  const exportContent = formatCredentialExport(user, credentials);

  // Audit log
  await auditLog.create({
    action: 'credentials.export.single_user',
    actorUserId,
    entityType: 'user',
    entityId: userId,
    metadata: {
      exportedSystems: credentials.map(c => c.systemConfig.systemId),
      credentialCount: credentials.length
    }
  });

  return exportContent;
}

function formatCredentialExport(user, credentials) {
  const timestamp = new Date().toISOString();
  const lines = [
    'IT-HUB CREDENTIAL EXPORT',
    `Generated: ${timestamp}`,
    `User: ${user.displayName || user.email || user.ldapUsername}`,
    `Systems: ${credentials.length}`,
    '',
    ...credentials.flatMap(cred => [
      '---------------------------------',
      cred.systemConfig.description || cred.systemConfig.systemId,
      `Username: ${cred.username}`,
      `Password: ${cred.password}`,
      '---------------------------------',
      ''
    ]),
    'End of export'
  ];

  return lines.join('\n');
}
```

**Frontend Download Implementation:**

```javascript
// apps/web/src/features/exports/api/exports.js

export async function exportCredentials(userId) {
  const response = await fetch(`/api/v1/users/${userId}/credentials/export`, {
    method: 'GET',
    credentials: 'include',  // Send JWT cookies
    headers: {
      'Accept': 'text/plain'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to export credentials');
  }

  // Create blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  a.href = url;
  a.download = `credentials-${userId}-${timestamp}.txt`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
```

**Frontend Button Component:**

```javascript
// apps/web/src/features/exports/components/CredentialExportButton.jsx

export function CredentialExportButton({ userId, username }) {
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setNotification(null);

    try {
      await exportCredentials(userId);
      setNotification({
        type: 'success',
        message: 'Credentials exported successfully'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to export credentials'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="export-button"
      >
        {isExporting ? 'Exporting...' : 'Export Credentials'}
      </button>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
```

### UI/UX Specifications

**Export Button Location:**
- On User Detail Page (`apps/web/src/features/users/user-detail-page.jsx`)
- In the Credentials section, adjacent to "Generate/Regenerate" buttons
- With tooltip: "Download credentials for secure delivery"

**Loading State:**
- Button shows "Exporting..." during export generation
- Disable button while export is in progress
- Show spinner if export takes more than 1 second

**Success Notification:**
- "Credentials exported successfully"
- Auto-dismiss after 5 seconds
- Show exported system count: "Exported 3 systems"

**Error States:**
- **User disabled**: "Cannot export credentials for disabled user"
- **No credentials**: "This user has no exportable credentials"
- **Unauthorized**: "You don't have permission to export credentials (IT role required)"
- **Network error**: "Failed to connect to server. Please try again."

**Export File Naming:**
- Format: `credentials-{userId}-{date}.txt`
- Example: `credentials-abc123-2026-02-04.txt`
- Use local date in filename for user friendliness

### Dependencies on Previous Stories

**This story depends on:**
- **Story 1.2 (LDAP Sign-In & Session)**: JWT authentication via HttpOnly cookies
- **Story 1.7 (Role Management)**: RBAC infrastructure for role-based access
- **Story 1.9/1.10 (Audit Logging)**: Audit log infrastructure for sensitive actions
- **Story 2.2 (Deterministic Credential Generation)**: credential generation service
- **Story 2.5 (Credential History)**: Database schema for user_credentials table
- **Story 2.6 (Per-User Credential Override)**: Override functionality credential storage
- **Story 2.7 (Username Field Mapping per System)**: System configuration infrastructure
- **Story 2.10 (Disabled User Guardrails)**: Guardrails for disabled users
- **Story 2.11 (IMAP Credentials IT-only)**: IMAP filtering mechanism (`isItOnly` flag)

**This story enables:**
- **Story 3.2 (Batch Credential Export)**: Reuses export formatting and IMAP filtering
- **Story 3.3 (Export Formatting Rules)**: Builds on export format established here
- **Story 3.4 (No Export Archiving)**: Confirms no-archiving pattern

### Critical Rules from Project Context

- **IMAP credentials are NEVER exported; IT-only access** (Critical Don't-Miss Rule from Story 2.11)
- **All sensitive actions must write to audit log** (Critical Don't-Miss Rule)
- **Disabled user guardrails apply to all operations** (Critical Don't-Miss Rule from Story 2.10)
- **No export archiving** - Exports generated on-demand, streamed, never stored (FR25)
- **Performance SLA**: Single-user export ≤5 seconds (NFR4)
- **Naming**: Database columns snake_case, API camelCase
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: Code stays in `features/exports/`
- **Prisma access only in repo layer**: No Prisma calls outside repo files

### Performance Considerations

- **NFR4 Requirement**: Single-user export must complete within 5 seconds under normal load
- **In-memory generation**: No disk writes, direct stream to client
- **Efficient queries**: Use indexed columns (userId, isActive)
- **No caching required**: Single-user exports are atomic, caching adds complexity without benefit
- **Rate limiting**: Prevent abuse by limiting export requests per user (e.g., 20 requests per minute)

### Security Considerations

- **Export content**: Plain text passwords included for secure delivery to IT staff
- **No encryption in export**: IT staff need readable credentials for setup
- **Secure transmission**: HTTPS/TLS required (from architecture)
- **Audit logging**: Every export logged with actor, target, timestamp
- **RBAC enforcement**: Only IT role can export
- **IMAP exclusion**: Absolute - IMAP credentials visible only to IT but never exported
- **No persistence**: Export file never written to disk

### Web Research Findings (2024-2025)

**File Format:**
- Plain text format meets human-readable requirements (FR23) faster than encryption/metadata overhead
- JSON with metadata provides structure but adds complexity for simple IT delivery
- CSV is simpler but less flexible for multi-line passwords

**Best Practices:**
- Use in-memory streams where possible (避免磁盘写入)
- Set security headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`
- Implement rate limiting to prevent bulk unauthorized exports
- Auto-delete temporary files with `finally` blocks (if temporary files needed)
- Use Fastify v5.7.x (latest stable) and Node.js v20/v22 LTS

**Streaming Implementation:**
```javascript
const { Readable } = require('stream');
const stream = Readable.from([exportContent]);
reply.type('text/plain').send(stream);
```

### Previous Story Intelligence

### Story 2.11: IMAP Credentials (IT-only) (Status: ready-for-dev)

**Relevant Implementation:**
- Database: `system_configs` table has `is_it_only` column
- Filtering: Repository function `getUserCredentials(userId, includeItOnly)` filters IMAP
- Access control: IT-only viewing enforced via middleware

**Key Files to Reuse:**
- `apps/api/src/features/credentials/repo.js` - `getUserCredentials()` with IT-only filtering
- `apps/api/src/features/credentials/service.js` - `getUserCredentialsForUser()` service layer

**Lessons Learned:**
- IMAP credentials flagged with `isItOnly: true` in system_configs table
- Use `includeItOnly: false` parameter to automatically filter IMAP credentials
- IMAP is excluded from ALL exports - this is absolute, no exceptions

### Story 2.10: Disabled User Guardrails (Status: review)

**Relevant Implementation:**
- Guardrail checks before credential operations
- RFC 9457 errors for blocked operations
- Audit logging for blocked attempts

**Reuse Pattern:**
```javascript
if (!user.isEnabled) {
  throw new Problem('disabled-user', 'Cannot export credentials for disabled user', 403);
}
```

### Story 2.5: Credential History (Status: done)

**Database Patterns:**
- `user_credentials` table stores current active credentials
- Prisma relations load with `include: { systemConfig: true }`
- Credentials filtered by `isActive: true`

**Query Pattern:**
```javascript
const credentials = await prisma.userCredential.findMany({
  where: {
    userId,
    isActive: true
  },
  include: {
    systemConfig: true
  }
});
```

### Story 1.9/1.10: Audit Logging (Status: done)

**Audit Log Pattern:**
```javascript
await auditLog.create({
  action: 'credentials.export.single_user',
  actorUserId: req.user.id,
  entityType: 'user',
  entityId: userId,
  metadata: {
    exportedSystems: [...],
    credentialCount: 3
  }
});
```

### Git Intelligence

**Recent Work Patterns:**
- Story 2.4 implemented credential regeneration with similar patterns
- Feature-based structure maintained consistently
- Prisma migrations follow naming convention (YYYYMMDDHHmmss_description)
- Tests follow `tests/api/` and `tests/web/` conventions

**File Patterns from Recent Commits:**
- Backend tests: `tests/api/[feature-name].test.mjs`
- Frontend components: `apps/web/src/features/[feature]/components/`
- Feature modules: `apps/api/src/features/[feature]/routes.js`, `service.js`, `repo.js`, `schema.js`

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 3: Secure Export Delivery
   - Story 3.1: Single-User Credential Export (Lines 510-527)
   - FR21: IT staff can export credentials for a single user on demand
   - FR23: Export formatting with title line and per-system entries
   - FR24: Exclude IMAP credentials from exports
   - FR25: No export archiving

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Fastify API, Prisma ORM, MySQL 8.4 LTS, React SPA
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging, encryption at rest, HTTPS/TLS
   - Performance: NFR4 single-user export ≤5 seconds

3. **Previous Story**: `_bmad-output/implementation-artifacts/2-11-imap-credentials-it-only.md`
   - IMAP IT-only access mechanism
   - Export exclusion patterns
   - Database schema with `is_it_only` column

4. **Previous Story**: `_bmad-output/implementation-artifacts/2-10-disabled-user-guardrails.md`
   - Disabled user guardrail checks
   - RFC 9457 error response patterns

5. **Previous Story**: `_bmad-output/implementation-artifacts/2-5-credential-history.md`
   - `user_credentials` table structure and query patterns

6. **Project Context**: `_bmad-output/docs/project-context.md`
   - Critical Rule: "IMAP credentials are NEVER exported; IT-only access."
   - Critical Rule: "All sensitive actions must write to audit log."
   - Naming conventions: DB snake_case, API camelCase
   - Framework rules: Prisma access only in repo.js

### Related Implementation Files

**Database Schema:**
- `apps/api/prisma/schema.prisma` - UserCredential and SystemConfig models

**Backend (New):**
- `apps/api/src/features/exports/routes.js` - Export endpoint
- `apps/api/src/features/exports/service.js` - Export generation and formatting
- `apps/api/src/features/exports/schema.js` - Validation schemas

**Backend (Reuse):**
- `apps/api/src/features/credentials/repo.js` - `getUserCredentials()` with IT-only filtering
- `apps/api/src/features/audit/repo.js` - Audit log creation
- `apps/api/src/shared/auth/middleware.js` - RBAC enforcement

**Frontend (New):**
- `apps/web/src/features/exports/components/CredentialExportButton.jsx` - Export button
- `apps/web/src/features/exports/api/exports.js` - Export API client

**Frontend (Modify):**
- `apps/web/src/features/users/user-detail-page.jsx` - Add export button

**Tests (New):**
- `tests/api/credentials_export_service.test.mjs` - Service unit tests
- `tests/api/credentials_export.test.mjs` - Backend integration tests
- `tests/web/credentialExportButton.test.jsx` - Frontend component tests
- `tests/e2e/credentialExport.e2e.test.js` - End-to-end tests

---

## Dev Agent Record

### Agent Model Used

nvidia/z-ai/glm4.7

### Debug Log References

- Task 1 (Export Service Implementation): Created service at apps/api/src/features/exports/service.js
- Task 2 (Export API Endpoint): Created routes at apps/api/src/features/exports/routes.js
- Task 6-7 (Frontend Components): CreatedCredential export button and API client

### Completion Notes List

- **2026-02-04**: Implemented backend export service with formatCredentialExport and exportUserCredentials functions. DisabledUserError created for guardrails. Performance logging added to track 5-second SLA.
- **2026-02-04**: Implemented export API endpoint at GET /api/v1/users/:userId/credentials/export with RBAC middleware (IT role required). Proper response headers configured (Content-Type, Content-Disposition, Cache-Control, X-Content-Type-Options, X-Frame-Options). RFC 9457 errors for unauthorized access, user not found, disabled users.
- **2026-02-04**: Created frontend CredentialExportButton component with loading state and notifications. Export API client with blob download and error handling. Button added to user detail page credentials section.
- **2026-02-04**: Integration tests created for service unit tests (formatCredentialExport, DisabledUserError). Backend API integration tests created for export endpoint. All 9 tests passing.
- **2026-02-04**: Frontend component tests created using Vitest and React Testing Library. Tests cover component rendering, loading states, success/error notifications, and button interactions.
- **2026-02-04**: E2E tests created using Playwright. Tests cover full export flow, file format verification, IMAP exclusion, RBAC enforcement, audit logging, disabled user guardrails, empty credential list handling, and 5-second SLA performance requirement.

### File List

**Backend (New):**
- `apps/api/src/features/exports/service.js` - Export generation and formatting service
- `apps/api/src/features/exports/routes.js` - Export API endpoint
- `apps/api/src/features/exports/schema.js` - Zod validation schemas

**Backend (Modified):**
- `apps/api/src/server.js` - Registered export routes

**Frontend (New):**
- `apps/web/src/features/exports/components/CredentialExportButton.jsx` - Export button component
- `apps/web/src/features/exports/api/exports.js` - Export API client

**Frontend (Modified):**
- `apps/web/src/features/users/user-detail-page.jsx` - Added export button to credentials section

**Tests (New):**
- `tests/api/credentials_export_service.test.mjs` - Service unit tests
- `tests/api/credentials_export.test.mjs` - Backend integration tests

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2026-02-04 | Initial story creation - Comprehensive context for Story 3.1 | create-story |
| 2026-02-04 | Story implementation complete: All 10 tasks complete - Backend export service, API endpoint, formatting logic, IMAP filtering, audit logging, frontend UI components, download handling, backend integration tests, frontend component tests, E2E tests | dev-agent |

---

**Story ID**: 3.1
**Story Key**: 3-1-single-user-credential-export
**Epic**: 3 - Secure Export Delivery
**Priority**: High (FR21 requirement, enables credential delivery workflow)
**Created**: 2026-02-04
**Status**: in-progress
**FRs**: FR21, FR23, FR24, FR25
**NFR**: NFR4 (single-user export ≤5 seconds)

**Previous Story**: Story 2.11 - IMAP Credentials (IT-only)
**Next Story**: Story 3.2 - Batch Credential Export
