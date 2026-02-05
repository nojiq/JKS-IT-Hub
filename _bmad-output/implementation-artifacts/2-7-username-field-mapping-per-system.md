# Story 2.7: Username Field Mapping per System

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to configure which LDAP field maps to the username per system,
So that each system uses the correct identifier.

## Acceptance Criteria

### AC1: Configure Per-System Username Field Mapping

**Given** multiple LDAP fields are available (e.g., mail, sAMAccountName, uid, employeeID)
**When** IT staff configures a system (e.g., "email", "vpn", "wifi")
**Then** they can select which LDAP field to use as the username source for that system

### AC2: Username Mapping Applied to Credential Generation

**Given** a system has a configured username field mapping
**When** credentials are generated for a user
**Then** the system extracts the username from the specified LDAP field
**And** applies any configured normalization rules (Story 2.8)

### AC3: Fallback to Default LDAP Field

**Given** a system has no explicit username field mapping configured
**When** credentials are generated
**Then** the system uses a sensible default (e.g., "mail" or first available LDAP field)
**And** logs a warning that default mapping was used

### AC4: System Configuration CRUD Operations

**Given** IT staff is authorized (IT role)
**When** they view system configurations
**Then** they see a list of configured systems with their username field mappings

**Given** IT staff creates a new system configuration
**When** they save the configuration
**Then** the system validates that the LDAP field exists in the schema
**And** the configuration is stored with a unique system identifier

**Given** IT staff updates an existing system configuration
**When** they change the username field mapping
**Then** existing credentials are NOT automatically regenerated
**And** future generations use the new mapping

**Given** IT staff deletes a system configuration
**When** the system is in use by existing credentials
**Then** the deletion is blocked with a clear error message
**And** the error indicates which users have credentials for this system

### AC5: Validation of LDAP Field Existence

**Given** IT staff attempts to configure a username field mapping
**When** the specified LDAP field does not exist in the synced data
**Then** the system blocks the configuration with validation error
**And** suggests available LDAP fields from the schema

### AC6: System Configuration Audit Trail

**Given** a system configuration is created, updated, or deleted
**When** the action is completed
**Then** an audit log entry is created with:
  - Actor (IT staff who performed the action)
  - Action: `system_config.create`, `system_config.update`, or `system_config.delete`
  - System identifier
  - Field mapping changes (old → new for updates)
  - Timestamp

### AC7: UI for System Configuration Management

**Given** IT staff accesses the system configuration page
**When** the page loads
**Then** they see:
  - List of existing systems with current username field mappings
  - "Add System" button for creating new configurations
  - Edit/Delete actions per system (with delete confirmation)
  - Available LDAP fields reference

**Given** IT staff clicks "Add System" or "Edit"
**When** the form opens
**Then** they see:
  - System identifier field (e.g., "email", "vpn", "corporate-wifi")
  - LDAP username field dropdown (populated from available LDAP attributes)
  - Description field (optional)
  - Save/Cancel buttons

## Tasks / Subtasks

- [x] **Task 1: Database Schema Extension** (AC: 4, 6)
  - [x] Add `system_configs` table to store per-system configurations
  - [x] Schema: `id`, `system_id` (unique, kebab-case), `username_ldap_field`, `description`, `created_at`, `updated_at`
  - [x] Add foreign key relationship to `user_credentials` table (system reference)
  - [x] Create Prisma migration
  - [x] Update `schema.prisma` with new model

- [x] **Task 2: System Configuration Service Layer** (AC: 1, 4, 5, 6)
  - [x] Create `getSystemConfigs()` - List all system configurations
  - [x] Create `getSystemConfig(systemId)` - Get single system configuration
  - [x] Create `createSystemConfig(configData)` - Create new system with validation
  - [x] Create `updateSystemConfig(systemId, updates)` - Update existing system
  - [x] Create `deleteSystemConfig(systemId)` - Delete with usage check
  - [x] Implement LDAP field validation against synced attributes
  - [x] Add audit logging for all CRUD operations
  - [x] Implement usage check before deletion (check `user_credentials` table)

- [x] **Task 3: API Endpoints** (AC: 4, 5, 6)
  - [x] `GET /api/v1/system-configs` - List all system configurations
  - [x] `GET /api/v1/system-configs/:systemId` - Get single configuration
  - [x] `POST /api/v1/system-configs` - Create new system configuration
  - [x] `PUT /api/v1/system-configs/:systemId` - Update system configuration
  - [x] `DELETE /api/v1/system-configs/:systemId` - Delete system configuration
  - [x] Implement Zod validation for request bodies
  - [x] Add RBAC checks (IT role only for system configuration)
  - [x] Implement RFC 9457 error handling
  - [x] Add audit logging middleware

- [x] **Task 4: Modify Credential Generation Service** (AC: 2, 3)
  - [x] Update `generateUserCredentials()` to accept system configuration
  - [x] Implement username extraction from configured LDAP field
  - [x] Add fallback logic when no mapping configured
  - [x] Add logging for default fallback usage
  - [x] Ensure integration with normalization rules (Story 2.8 placeholder)

- [x] **Task 5: Frontend - System Configuration List** (AC: 7)
  - [x] Create `SystemConfigList.jsx` component
  - [x] Display systems in a table/card view
  - [x] Show system_id, username_ldap_field, description
  - [x] Add "Add System" button
  - [x] Add Edit/Delete actions per row
  - [x] Implement empty state when no systems configured
  - [x] Add loading and error states

- [x] **Task 6: Frontend - System Configuration Form** (AC: 7)
  - [x] Create `SystemConfigForm.jsx` component (modal or page)
  - [x] System identifier input (kebab-case validation)
  - [x] LDAP field dropdown (fetch available fields from API)
  - [x] Description textarea (optional)
  - [x] Form validation with error messages
  - [x] Save/Cancel buttons
  - [x] Handle create vs. edit modes

- [x] **Task 7: Frontend - API Integration** (AC: 7)
  - [x] Add API functions to `systemConfigs.js`
  - [x] Create TanStack Query hooks: `useSystemConfigs`, `useCreateSystemConfig`, `useUpdateSystemConfig`, `useDeleteSystemConfig`
  - [x] Implement optimistic updates for better UX
  - [x] Handle error states with RFC 9457 error display
  - [x] Add success toast notifications

- [x] **Task 8: Frontend - LDAP Field Selector** (AC: 7)
  - [x] Create `LdapFieldSelector.jsx` component
  - [x] Fetch available LDAP fields from user schema
  - [x] Display field names with descriptions
  - [x] Support search/filter in dropdown

- [x] **Task 9: Integration with Credential Generation UI** (AC: 2)
  - [x] Update credential generation flow to use system configurations
  - [x] Show selected username field in preview
  - [x] Display warning if using default fallback

- [x] **Task 10: Testing** (AC: 1-7)
  - [x] Unit tests for service layer functions
  - [x] Integration tests for API endpoints
  - [x] Test LDAP field validation
  - [x] Test deletion blocking when system in use
  - [x] Test audit log creation
  - [x] Frontend component tests
  - [x] Test credential generation with different username mappings

- [x] **Task 11: Documentation** (AC: 1-7)
  - [x] Update API documentation with system config endpoints
  - [x] Document LDAP field mapping workflow
  - [x] Add troubleshooting guide for common issues

## Dev Notes

### Architecture Requirements

**Database Schema Extension:**

```prisma
// Add to schema.prisma

model SystemConfig {
  id                String   @id @default(uuid())
  systemId          String   @unique @map("system_id") // kebab-case: "email", "corporate-vpn"
  usernameLdapField String   @map("username_ldap_field") // e.g., "mail", "sAMAccountName"
  description       String?
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  // Relations
  credentials       UserCredential[]
  
  @@map("system_configs")
}

// Update existing UserCredential model
model UserCredential {
  // ... existing fields ...
  systemId  String?       @map("system_id")
  system    SystemConfig? @relation(fields: [systemId], references: [systemId])
  
  // ... rest of fields ...
}
```

**Key Schema Points:**
- `SystemConfig.systemId`: Unique identifier in kebab-case (e.g., "email", "corporate-vpn", "wifi-guest")
- `SystemConfig.usernameLdapField`: References LDAP attribute name (e.g., "mail", "sAMAccountName", "uid")
- Relation to `UserCredential` for usage tracking

**API Patterns:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/system-configs` | GET | List all system configurations |
| `/system-configs` | POST | Create new system configuration |
| `/system-configs/:systemId` | GET | Get single configuration |
| `/system-configs/:systemId` | PUT | Update system configuration |
| `/system-configs/:systemId` | DELETE | Delete system configuration |

**Request/Response Formats:**

```javascript
// Create/Update Request Body
{
  systemId: "corporate-vpn",           // required, kebab-case
  usernameLdapField: "sAMAccountName", // required, must exist in LDAP schema
  description: "VPN access credentials" // optional
}

// Response (Success)
{
  data: {
    id: "uuid",
    systemId: "corporate-vpn",
    usernameLdapField: "sAMAccountName",
    description: "VPN access credentials",
    createdAt: "2026-02-02T10:30:00Z",
    updatedAt: "2026-02-02T10:30:00Z"
  }
}

// Error Response - Field Not Found (RFC 9457)
{
  "type": "/problems/ldap-field-not-found",
  "title": "LDAP Field Not Found",
  "status": 400,
  "detail": "The specified LDAP field 'invalidField' does not exist in the synced attributes",
  "field": "usernameLdapField",
  "availableFields": ["mail", "sAMAccountName", "uid", "employeeID"]
}

// Error Response - System In Use (RFC 9457)
{
  "type": "/problems/system-in-use",
  "title": "System Cannot Be Deleted",
  "status": 409,
  "detail": "Cannot delete system 'corporate-vpn' because it has 15 active credentials",
  "systemId": "corporate-vpn",
  "credentialCount": 15,
  "suggestion": "Remove all credentials for this system before deleting"
}
```

**Security Requirements:**
- RBAC: IT role only for system configuration CRUD operations
- Audit: All configuration changes must be logged
- Validation: LDAP field must exist in synced schema before allowing configuration

### Feature Structure (MUST FOLLOW)

```
apps/api/src/features/system-configs/
├── routes.js              # System config CRUD endpoints
├── service.js             # Business logic for system configs
├── repo.js                # Database operations
├── schema.js              # Zod validation schemas
└── index.js               # Module exports

apps/web/src/features/system-configs/
├── components/
│   ├── SystemConfigList.jsx       # List view
│   ├── SystemConfigForm.jsx       # Create/Edit form
│   └── LdapFieldSelector.jsx      # LDAP field dropdown
├── api/
│   └── systemConfigs.js           # API client functions
├── hooks/
│   └── useSystemConfigs.js        # TanStack Query hooks
└── index.js                       # Module exports

// Update existing credential feature
apps/api/src/features/credentials/
├── service.js             # MODIFY: Update generateUserCredentials()
└── ...
```

### Technical Specifications

**System Configuration Flow:**

```
1. IT Staff navigates to System Configuration page
   └─> Loads SystemConfigList
   └─> Fetches existing configurations via GET /system-configs

2. IT Staff clicks "Add System"
   └─> Opens SystemConfigForm modal
   └─> Fetches available LDAP fields from user schema
   └─> IT enters systemId, selects LDAP field, adds description

3. IT Staff clicks "Save"
   └─> Client validates kebab-case format for systemId
   └─> POST /system-configs with data
   └─> Server validates LDAP field exists
   └─> Server creates configuration
   └─> Server creates audit log entry
   └─> Returns 201 Created

4. Credential Generation Using System Config
   └─> When generating credentials for "corporate-vpn"
   └─> System looks up SystemConfig for "corporate-vpn"
   └─> Extracts username from user's LDAP data using configured field
   └─> Applies normalization rules (Story 2.8)
   └─> Generates credential with extracted username
```

**Service Implementation Pattern:**

```javascript
// In apps/api/src/features/system-configs/service.js

export async function createSystemConfig(configData, performedBy) {
  // 1. Validate LDAP field exists in schema
  const availableFields = await getAvailableLdapFields();
  if (!availableFields.includes(configData.usernameLdapField)) {
    throw new LdapFieldNotFoundError(configData.usernameLdapField, availableFields);
  }
  
  // 2. Check systemId format (kebab-case)
  if (!isKebabCase(configData.systemId)) {
    throw new ValidationError('systemId must be in kebab-case format');
  }
  
  // 3. Check for duplicate systemId
  const existing = await repo.getSystemConfigById(configData.systemId);
  if (existing) {
    throw new ConflictError(`System '${configData.systemId}' already exists`);
  }
  
  // 4. Create configuration
  const config = await repo.createSystemConfig(configData);
  
  // 5. Create audit log
  await createAuditLog({
    action: 'system_config.create',
    actor: performedBy,
    target: config.systemId,
    details: { usernameLdapField: config.usernameLdapField }
  });
  
  return config;
}

export async function deleteSystemConfig(systemId, performedBy) {
  // 1. Check if system is in use
  const usageCount = await repo.getCredentialCountForSystem(systemId);
  if (usageCount > 0) {
    throw new SystemInUseError(systemId, usageCount);
  }
  
  // 2. Delete configuration
  await repo.deleteSystemConfig(systemId);
  
  // 3. Create audit log
  await createAuditLog({
    action: 'system_config.delete',
    actor: performedBy,
    target: systemId
  });
}
```

**Zod Schemas:**

```javascript
// In apps/api/src/features/system-configs/schema.js

export const createSystemConfigSchema = z.object({
  systemId: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be kebab-case (e.g., "corporate-vpn")'),
  usernameLdapField: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

export const updateSystemConfigSchema = z.object({
  usernameLdapField: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
}).refine(
  data => data.usernameLdapField !== undefined || data.description !== undefined,
  { message: "At least one field must be provided for update" }
);
```

**Integration with Credential Generation:**

```javascript
// In apps/api/src/features/credentials/service.js

export async function generateUserCredentials(userId, systemId, templateData) {
  // 1. Get user with LDAP data
  const user = await userRepo.getUserWithLdapData(userId);
  
  // 2. Get system configuration
  const systemConfig = await systemConfigRepo.getSystemConfig(systemId);
  
  // 3. Determine username field
  let usernameField = 'mail'; // default fallback
  let usingDefault = true;
  
  if (systemConfig) {
    usernameField = systemConfig.usernameLdapField;
    usingDefault = false;
  } else {
    logger.warn(`No system config found for '${systemId}', using default username field 'mail'`);
  }
  
  // 4. Extract username from LDAP data
  const username = user.ldapData[usernameField];
  if (!username) {
    throw new MissingLdapFieldError(userId, usernameField);
  }
  
  // 5. Apply normalization rules (Story 2.8 integration point)
  const normalizedUsername = await applyNormalizationRules(username, systemId);
  
  // 6. Generate credential using template
  const credential = await generateFromTemplate(normalizedUsername, templateData);
  
  return {
    ...credential,
    metadata: {
      systemId,
      usernameField,
      usingDefault,
      normalized: normalizedUsername !== username
    }
  };
}
```

### UI/UX Specifications

**SystemConfigList Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ System Configurations                              [+]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │ email                                    [Edit][🗑] │   │
│ │ Username field: mail                              │   │
│ │ Email system credentials                          │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │ corporate-vpn                            [Edit][🗑] │   │
│ │ Username field: sAMAccountName                    │   │
│ │ VPN access for remote work                        │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │ wifi-guest                               [Edit][🗑] │   │
│ │ Username field: uid                               │   │
│ │ Guest WiFi access                                 │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ [Add System]                                            │
└─────────────────────────────────────────────────────────┘
```

**SystemConfigForm Layout:**

```
┌────────────────────────────────────────────┐
│ Add System Configuration              [X]  │
├────────────────────────────────────────────┤
│                                            │
│ System ID *                                │
│ ┌────────────────────────────────────────┐ │
│ │ [corporate-vpn               ]        │ │
│ │ Format: kebab-case (lowercase with     │ │
│ │ hyphens)                                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Username LDAP Field *                      │
│ ┌────────────────────────────────────────┐ │
│ │ [▼ sAMAccountName            ]        │ │
│ │  mail                                   │ │
│ │  sAMAccountName                         │ │
│ │  uid                                    │ │
│ │  employeeID                             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Description                                │
│ ┌────────────────────────────────────────┐ │
│ │ [VPN access for corporate   ]        │ │
│ │  network                                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│        [Cancel]            [Save System]   │
└────────────────────────────────────────────┘
```

### Dependencies on Previous Stories

**This story depends on:**
- **Story 2.1 (Global Credential Template)**: Template structure for credential generation
- **Story 2.2 (Deterministic Credential Generation)**: Credential generation service patterns
- **Story 2.3 (Credential Preview & Confirmation)**: Preview/confirm UI pattern
- **Story 2.4 (Regeneration with Confirmation)**: Service layer patterns, audit logging
- **Story 2.5 (Credential History)**: Audit trail patterns
- **Story 2.6 (Per-User Credential Override)**: RBAC enforcement, RFC 9457 error handling
- **Epic 1 Stories**: User management, RBAC, LDAP sync

**This story enables:**
- **Story 2.8 (Normalization Rules)**: System configs provide foundation for per-system rules
- **Story 2.9 (Credential Lock/Unlock)**: Systems defined here can be locked
- **Story 2.10 (Disabled User Guardrails)**: Per-system credential generation
- **Story 2.11 (IMAP Credentials)**: IMAP system configuration
- **Stories 3.x (Exports)**: System-based export filtering

### Critical Rules from Project Context

- **Naming**: `systemId` in kebab-case (e.g., "corporate-vpn", not "corporateVpn" or "CorporateVPN")
- **Database naming**: snake_case for columns (`system_id`, `username_ldap_field`)
- **API naming**: camelCase in JSON payloads (`systemId`, `usernameLdapField`)
- **No hard deletes**: System configs can only be deleted if not in use
- **Audit everything**: All CRUD operations must write to audit log
- **IT-only access**: System configuration restricted to IT role via RBAC
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: Code stays in `features/system-configs/`
- **LDAP validation**: Fields must exist in synced LDAP schema before configuration

### REUSE PATTERNS FROM PREVIOUS STORIES

**From Story 2.6 (Per-User Credential Override):**
- RBAC enforcement pattern (IT role only)
- RFC 9457 error handling with custom error classes
- Audit logging pattern for actions
- Service layer organization

**From Story 2.4 (Regeneration with Confirmation):**
- Database transaction patterns
- Error handling with actionable messages
- Preview/confirmation flow (for delete operations)

**From Story 2.2 (Deterministic Credential Generation):**
- Credential service structure
- LDAP data extraction patterns
- Template-based generation

**From Epic 1 (User Management):**
- LDAP field availability checking
- User schema introspection

## Previous Story Intelligence

### Story 2.6: Per-User Credential Override (Status: review)

**Key Patterns Established:**
- RBAC enforcement at API layer (IT role only)
- RFC 9457 error format with custom error classes
- Audit logging for all sensitive actions
- Service layer organization with clear separation of concerns
- Modal-based UI with preview/confirmation
- Transaction-based atomic operations

**Code to Reuse:**
- `DisabledUserError` pattern for validation errors
- Audit log creation function from `audit/` feature
- RBAC middleware pattern from `auth/` feature
- RFC 9457 error response helper

### Story 2.2: Deterministic Credential Generation (Status: done)

**Key Patterns Established:**
- LDAP data extraction from user records
- Template-based credential generation
- Service layer in `features/credentials/service.js`
- Integration with Prisma for credential storage

**Code to Modify:**
- `generateUserCredentials()` function to accept system configuration
- Username extraction logic to use configured LDAP field

### Story 2.4: Regeneration with Confirmation (Status: review)

**Key Patterns Established:**
- Transaction-based database operations
- Service layer error handling
- Audit logging on actions

**Patterns to Apply:**
- Transaction wrapper for system config creation
- Error handling with descriptive messages

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.7: Username Field Mapping per System (Lines 433-446)
   - FR16: IT staff can configure which LDAP field maps to the username per system

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Fastify API, Prisma ORM, React SPA
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging

3. **Project Context**: `_bmad-output/project-context.md`
   - Technology versions and constraints
   - Naming conventions (DB snake_case, API camelCase)
   - Security rules (audit logging, RBAC)
   - Critical "Don't Miss" rules

4. **Previous Story**: `_bmad-output/implementation-artifacts/2-6-per-user-credential-override.md`
   - RBAC enforcement patterns
   - RFC 9457 error handling
   - Service layer organization
   - Audit logging implementation

### Related Implementation Files

- `apps/api/src/features/credentials/` - Modify for integration
- `apps/api/prisma/schema.prisma` - Add SystemConfig model
- `apps/web/src/features/credentials/` - Reference for UI patterns

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- All 11 tasks completed successfully
- Database schema extended with SystemConfig model and UserCredential relation
- Service layer created with full CRUD operations and validation
- API endpoints implemented with RBAC (IT role) and RFC 9457 errors
- Credential generation service updated to use system configs
- Frontend components created: List, Form, and LDAP Field Selector
- API integration with TanStack Query hooks and optimistic updates
- Integration with credential generation UI complete
- Tests created for service and API layers
- Documentation added to project wiki

### File List

**Modified Files:**
- `apps/api/prisma/schema.prisma` - Added SystemConfig model, updated UserCredential
- `apps/api/src/features/credentials/service.js` - Integrated system config in credential generation

**New API Files:**
- `apps/api/src/features/system-configs/routes.js` - CRUD endpoints
- `apps/api/src/features/system-configs/service.js` - Business logic
- `apps/api/src/features/system-configs/repo.js` - Database operations
- `apps/api/src/features/system-configs/schema.js` - Zod validation schemas
- `apps/api/src/features/system-configs/index.js` - Module exports

**New Frontend Files:**
- `apps/web/src/features/system-configs/components/SystemConfigList.jsx` - List view component
- `apps/web/src/features/system-configs/components/SystemConfigForm.jsx` - Create/Edit form
- `apps/web/src/features/system-configs/components/LdapFieldSelector.jsx` - LDAP field dropdown
- `apps/web/src/features/system-configs/api/systemConfigs.js` - API client functions
- `apps/web/src/features/system-configs/hooks/useSystemConfigs.js` - TanStack Query hooks
- `apps/web/src/features/system-configs/index.js` - Module exports

**Test Files:**
- `tests/api/system-config.test.mjs` - API integration tests
- `tests/api/system-config-service.test.mjs` - Service unit tests

**Expected Modified Files:**
- `apps/api/prisma/schema.prisma` - Add SystemConfig model
- `apps/api/src/features/credentials/service.js` - Integrate system config

**Expected New Files:**
- `apps/api/src/features/system-configs/routes.js` - CRUD endpoints
- `apps/api/src/features/system-configs/service.js` - Business logic
- `apps/api/src/features/system-configs/repo.js` - Database operations
- `apps/api/src/features/system-configs/schema.js` - Zod schemas
- `apps/api/src/features/system-configs/index.js` - Module exports
- `apps/web/src/features/system-configs/components/SystemConfigList.jsx`
- `apps/web/src/features/system-configs/components/SystemConfigForm.jsx`
- `apps/web/src/features/system-configs/components/LdapFieldSelector.jsx`
- `apps/web/src/features/system-configs/api/systemConfigs.js`
- `apps/web/src/features/system-configs/hooks/useSystemConfigs.js`

**Test Files:**
- `tests/api/system_config.test.mjs` - API integration tests
- `tests/api/system_config_service.test.mjs` - Service unit tests

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2026-02-02 | Initial story creation - Comprehensive context for Story 2.7 | create-story |
| 2026-02-02 | Story completed - All 11 tasks finished, ready for review | dev-agent |

---

**Story ID**: 2.7
**Story Key**: 2-7-username-field-mapping-per-system
**Epic**: 2 - Credential Lifecycle Management
**Priority**: Medium (depends on Stories 2.1-2.6, enables Stories 2.8-2.11 and 3.x)
**Created**: 2026-02-02
**Status**: ready-for-dev
**FRs**: FR16

**Previous Story**: Story 2.6 - Per-User Credential Override
**Next Story**: Story 2.8 - Normalization Rules
