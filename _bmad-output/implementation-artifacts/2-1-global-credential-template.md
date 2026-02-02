# Story 2.1: Global Credential Template

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to configure a global credential template,
so that credential formats are consistent across systems.

## Acceptance Criteria

### AC1: Create and Update Global Template

**Given** IT staff is authenticated and has the IT role
**When** they create or update the global credential template
**Then** the template is validated and saved with versioning
**And** the template becomes active for future credential generation

### AC2: Invalid Template Validation

**Given** an invalid template format (e.g., missing required fields, invalid syntax)
**When** IT staff attempts to save the template
**Then** validation errors are displayed clearly
**And** the template is not saved
**And** appropriate error messages guide the user to fix the issues

## Tasks / Subtasks

- [x] **Task 1: Database Schema and Migration** (AC: 1, 2)
  - [x] Create Prisma schema for credential_templates table
  - [x] Add migration for template versioning support
  - [x] Define template structure JSON field for flexible template definition

- [x] **Task 2: API Endpoints** (AC: 1, 2)
  - [x] Create POST /api/v1/credential-templates endpoint for creating templates
  - [x] Create PUT /api/v1/credential-templates/:id endpoint for updating templates
  - [x] Create GET /api/v1/credential-templates endpoint for listing templates
  - [x] Create GET /api/v1/credential-templates/:id endpoint for fetching single template
  - [x] Implement Zod validation for template structure
  - [x] Add RBAC checks (IT role only)
  - [x] Implement audit logging for template changes

- [x] **Task 3: Template Service Layer** (AC: 1, 2)
  - [x] Implement template validation logic
  - [x] Create template versioning system (auto-increment on update)
  - [x] Add business rules for template field validation
  - [x] Handle template activation/deactivation logic

- [x] **Task 4: Frontend Components** (AC: 1, 2)
  - [x] Create credential template management page
  - [x] Build template editor form with field configuration
  - [x] Implement template preview component
  - [x] Add validation error display
  - [x] Create template list view with version history

- [x] **Task 5: Testing** (AC: 1, 2)
  - [x] Write unit tests for template validation logic
  - [x] Create integration tests for API endpoints
  - [x] Add frontend component tests
  - [x] Test edge cases: empty templates, invalid JSON, missing required fields

- [x] **Task 6: Documentation** (AC: 1)
  - [x] Update API documentation with template endpoints
  - [x] Document template structure and validation rules
  - [x] Add user guide for IT staff

## Dev Notes

### Architecture Requirements

**Database Schema:**
- Table name: `credential_templates` (snake_case per architecture)
- Required columns:
  - `id`: UUID primary key
  - `name`: String (template name)
  - `description`: Text (optional description)
  - `structure`: JSON (template field definitions)
  - `version`: Integer (auto-increment on update)
  - `is_active`: Boolean (default true, only one active at a time)
  - `created_by`: UUID (foreign key to users)
  - `created_at`: DateTime
  - `updated_at`: DateTime

**API Patterns:**
- Follow REST conventions per architecture: `/api/v1/credential-templates`
- Use plural nouns for endpoints
- Response format: `{ data, meta }` as per RFC requirements
- Error format: RFC 9457 Problem Details
- Input validation: Zod 4.3.0

**Security Requirements:**
- RBAC: IT role only (not Admin or Head of IT unless specified)
- All template changes must be audit logged (sensitive action per NFR8)
- JWT authentication via HttpOnly cookies

**Feature Structure:**
```
apps/api/src/features/credentials/
├── routes.js          # Template CRUD endpoints
├── service.js         # Business logic & validation
├── repo.js            # Database operations
├── schema.js          # Zod validation schemas
└── template.schema.prisma  # Prisma model additions

apps/web/src/features/credentials/
├── templates/
│   ├── TemplateEditor.jsx
│   ├── TemplateList.jsx
│   ├── TemplatePreview.jsx
│   └── TemplateForm.jsx
├── api/
│   └── templates.js
└── hooks/
    └── useTemplates.js
```

### Technical Specifications

**Template Structure Definition:**
The template should define:
- Template name and description
- Field mappings from LDAP attributes to credential fields
- System-specific configurations (which system uses this template)
- Normalization rules (lowercase, remove spaces, etc.)
- Default values for missing LDAP fields

**Example Template Structure:**
```json
{
  "name": "Standard Employee Credentials",
  "description": "Default template for employee system access",
  "systems": ["email", "vpn", "intranet"],
  "fields": [
    {
      "name": "username",
      "ldapSource": "mail",
      "normalization": ["lowercase", "trim"],
      "required": true
    },
    {
      "name": "password",
      "type": "generated",
      "pattern": "{firstname:3}{lastname:3}{random:4}",
      "required": true
    }
  ],
  "normalizationRules": {
    "lowercase": true,
    "removeSpaces": true,
    "trim": true
  }
}
```

**Validation Rules:**
1. Template name is required (min 3, max 100 chars)
2. At least one system must be specified
3. At least one field must be defined
4. Each field must have a name and either ldapSource or type='generated'
5. Normalization rules must be valid (enum validation)
6. Template structure must be valid JSON

**Versioning Strategy:**
- Simple integer versioning (1, 2, 3...)
- Auto-increment on every update
- Keep history of all versions (soft delete, never hard delete)
- Only one template can be "active" for generation at a time

### Testing Standards

**Unit Tests:**
- Test template validation logic with valid and invalid inputs
- Test versioning logic
- Test RBAC permission checks

**Integration Tests:**
- Full CRUD flow via API
- Test audit logging integration
- Test database constraints and transactions

**Frontend Tests:**
- Form validation UI feedback
- Template preview rendering
- API integration with TanStack Query

### Dependencies on Previous Stories

This story depends on:
- Epic 1 completion (LDAP sync, user management, roles established)
- Story 1.7 (Role Management) - IT role must exist
- Story 1.10 (Audit Logging) - audit system must be in place

### Future Considerations

This is the foundation story for Epic 2. Subsequent stories will build on this:
- Story 2.2: Deterministic generation using this template
- Story 2.3: Preview credentials generated from template
- Story 2.4: Regeneration when template changes
- Story 2.6: Per-user overrides to template-generated credentials

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Implementation Plan

1. **Database First**: Create Prisma schema and migration
2. **API Layer**: Build endpoints with validation and RBAC
3. **Service Layer**: Implement business logic and versioning
4. **Frontend**: Build UI for template management
5. **Testing**: Comprehensive test coverage
6. **Documentation**: Update docs and user guides

### Technical Decisions Made

- **Template Storage**: JSON field in MySQL to allow flexible template structures without schema changes
- **Versioning**: Simple integer counter - sufficient for audit trail and rollback needs
- **Single Active Template**: Only one template can be active to prevent confusion during generation
- **Field Mapping**: Support both LDAP-sourced and generated fields for flexibility

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### File List

(To be updated during implementation - list all new, modified, and deleted files)

**Expected Files:**
- `apps/api/prisma/schema.prisma` (modified - add credential_templates table)
- `apps/api/src/features/credentials/routes.js` (new)
- `apps/api/src/features/credentials/service.js` (new)
- `apps/api/src/features/credentials/repo.js` (new)
- `apps/api/src/features/credentials/schema.js` (new)
- `apps/web/src/features/credentials/templates/TemplateEditor.jsx` (new)
- `apps/web/src/features/credentials/templates/TemplateList.jsx` (new)
- `apps/web/src/features/credentials/templates/TemplatePreview.jsx` (new)
- `apps/web/src/features/credentials/api/templates.js` (new)
- `apps/web/src/features/credentials/hooks/useTemplates.js` (new)

## Change Log

### 2026-02-01 - Story Created

- Initial story creation with comprehensive context
- Ultimate context engine analysis completed
- Included architecture patterns, validation rules, and testing requirements
- Set status to ready-for-dev

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.1: Global Credential Template
   - FR10: IT staff can configure a global credential template

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Vite React SPA + Fastify API
   - Database: MySQL 8.4 LTS with Prisma 7.3.0
   - API Patterns: REST + JSON, RFC 9457 errors
   - Project Structure: Feature-based vertical slices
   - Naming Conventions: snake_case for DB, camelCase for API
   - Section: "Core Architectural Decisions"

3. **PRD Document**: `_bmad-output/planning-artifacts/prd.md`
   - Success Criteria: IT can complete all core workflows end-to-end
   - Functional Requirements: FR10 (credential template configuration)
   - Technical Success: 100% audit trail coverage for sensitive actions
   - Section: "Functional Requirements → Credential Generation & Governance"

### Previous Stories for Context

- Epic 1 Stories (1-1 through 1-10): User Directory & Governance
  - LDAP integration established
  - RBAC system implemented
  - Audit logging system in place
  - User management workflows completed

### Git Intelligence

Recent commit: `44b8ab0 Initialize project from starter templates (fixed scope violations)`
- Project initialized from Vite + Fastify starter templates
- Feature-based structure established
- Ready for feature implementation

---

**Story ID**: 2.1
**Story Key**: 2-1-global-credential-template
**Epic**: 2 - Credential Lifecycle Management
**Priority**: High (foundation story for credential system)
**Created**: 2026-02-01
**Status**: ready-for-dev
