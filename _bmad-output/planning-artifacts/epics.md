---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# IT-Hub - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for IT-Hub, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Admin/Head of IT can manage user roles (IT, Admin, Head of IT, Requester).
FR2: Internal roles can disable/enable users within the app.
FR3: The system does not allow user deletion; users can only be disabled.
FR4: All internal roles can view audit logs.
FR5: IT staff can trigger manual LDAP sync.
FR6: The system can perform scheduled daily LDAP sync.
FR7: The system can display current LDAP-derived profile fields for users.
FR8: The system can maintain a change history of LDAP field updates per user.
FR9: The system can integrate with LDAP in read-only mode (no push-back updates).
FR10: IT staff can configure a global credential template.
FR11: The system can generate deterministic credentials based on LDAP fields and the configured template.
FR12: IT staff can preview/review generated credentials before confirmation.
FR13: IT staff can regenerate credentials when LDAP data or templates change, with explicit confirmation.
FR14: The system can preserve historical credential versions across regenerations.
FR15: IT staff can override specific credentials for a user.
FR16: IT staff can configure which LDAP field maps to the username per system.
FR17: The system can apply configurable normalization rules to credential generation.
FR18: IT staff can lock/unlock individual system credentials.
FR19: The system can block credential generation and regeneration for disabled users.
FR20: The system can store IMAP passwords as IT-only credentials and never export them.
FR21: IT staff can export credentials for a single user on demand.
FR22: IT staff can export credentials in batch for multiple users.
FR23: The system can format exports with a title line and per-system username/password entries.
FR24: The system can exclude IMAP credentials from exports.
FR25: The system can generate exports without archiving them.
FR26: The system can schedule preventive maintenance cycles (minor quarterly, major biannually).
FR27: IT staff can configure and use global maintenance checklists.
FR28: The system can auto-assign maintenance tasks by department with optional rotation.
FR29: Users performing maintenance can record completion and sign off (no admin approval required).
FR30: The system can support maintenance records for laptops/PCs and servers.
FR31: Any internal user can submit item requests.
FR32: Requesters can attach e-invoice documents to requests.
FR33: IT staff can review requests and override if an item is already purchased.
FR34: Admin/Head of IT can approve requests after IT review.
FR35: The system can require manual review for all requests (no auto-approval).
FR36: Requesters can view request status and outcomes.
FR37: The system can send email notifications for approval steps.
FR38: The system can send in-app notifications for approval steps.
FR39: The system can send notifications for upcoming/overdue maintenance schedules.
FR40: Users can see live status updates for requests and maintenance without manual refresh.
FR41: Users can search and filter users, requests, and maintenance records.
FR42: The system can provide a dark mode UI theme.
FR43: The system can support mobile-friendly views for approvals/sign-off.

### NonFunctional Requirements

NFR1: 95% of user actions complete within 2 seconds under normal business-hours load as measured by APM.
NFR2: Live status updates appear within 5 seconds under normal load as measured by monitoring.
NFR3: Search results return within 2 seconds as measured by APM.
NFR4: Single-user export completes within 5 seconds; batch export (100 users) within 30 seconds as measured by export job logs.
NFR5: All data encrypted in transit (HTTPS/TLS) as verified by security configuration review.
NFR6: All sensitive data encrypted at rest as verified by storage settings review.
NFR7: Role-based access control for IT/Admin/Head of IT/Requester as verified by role-permission tests.
NFR8: Audit logs for sensitive actions (status changes, credential generation, overrides) verified by audit log review.
NFR9: IMAP credentials restricted to IT-only access verified by access-control tests.
NFR10: 99.5% uptime during business hours as measured by uptime monitoring.
NFR11: Daily backups with basic restore capability verified by periodic restore tests.
NFR12: LDAP sync success rate >= 99% as measured by sync job logs.
NFR13: Sync failures trigger retry and IT alert as verified by alerting logs.

### Additional Requirements

- Use Vite React SPA for web and Fastify API as the starter template; initialize apps via Vite and fastify-cli.
- Node runtime must meet Vite requirements (Node 20.19+ or 22.12+).
- Database: MySQL 8.4 LTS (target 8.4.8 LTS).
- ORM: Prisma 7.3.0 with Prisma Migrate for schema-driven migrations.
- API input validation with Zod 4.3.0.
- No caching initially; if needed later, use Redis with node-redis 5.9.0.
- Authentication uses LDAP/AD bind only; no local password storage.
- JWT access tokens issued by API and delivered via HttpOnly, Secure, SameSite cookies using jose 6.1.3.
- RBAC enforced at API layer with audit logs for sensitive actions.
- LDAP client must be maintained; avoid ldapjs (archived) or use a small LDAP gateway.
- API is REST + JSON with OpenAPI 3.0.3 via @fastify/swagger 9.6.1.
- Error format must follow RFC 9457 (Problem Details); success responses `{ data, meta? }`.
- Rate limiting via @fastify/rate-limit 10.3.0.
- Live updates implemented via SSE with fastify-sse-v2 4.2.1; event names `feature.event`, payloads `{ id, type, timestamp, data }`.
- Frontend routing via React Router DOM 7.12.0; server state via TanStack Query 5.90.20.
- Feature-based vertical slice structure for frontend and backend; shared utilities in `shared/`.
- Dates are ISO 8601 UTC strings; API IDs are string UUIDs; JSON fields camelCase.
- Dockerized web/API/MySQL services; .env separation for dev/stage/prod; JSON logs to stdout; monitoring for uptime/latency and LDAP/export alerts; daily backups with restore checks.

### FR Coverage Map


FR1: Epic 1 - Role management
FR2: Epic 1 - User enable/disable
FR3: Epic 1 - No deletion policy
FR4: Epic 1 - Audit log access
FR5: Epic 1 - Manual LDAP sync
FR6: Epic 1 - Scheduled LDAP sync
FR7: Epic 1 - View LDAP profile fields
FR8: Epic 1 - LDAP change history
FR9: Epic 1 - Read-only LDAP integration
FR10: Epic 2 - Credential template config
FR11: Epic 2 - Deterministic credential generation
FR12: Epic 2 - Preview/review credentials
FR13: Epic 2 - Regeneration with confirmation
FR14: Epic 2 - Historical credential versions
FR15: Epic 2 - Per-user overrides
FR16: Epic 2 - Username field mapping
FR17: Epic 2 - Normalization rules
FR18: Epic 2 - Lock/unlock credentials
FR19: Epic 2 - Block generation for disabled users
FR20: Epic 2 - IMAP IT-only credentials
FR21: Epic 3 - Single-user export
FR22: Epic 3 - Batch export
FR23: Epic 3 - Export formatting rules
FR24: Epic 3 - Exclude IMAP from exports
FR25: Epic 3 - No export archiving
FR26: Epic 4 - Maintenance cycles
FR27: Epic 4 - Global checklists
FR28: Epic 4 - Auto-assign by department
FR29: Epic 4 - Maintenance sign-off
FR30: Epic 4 - Asset coverage (laptops/servers)
FR31: Epic 5 - Submit item requests
FR32: Epic 5 - Upload e-invoice
FR33: Epic 5 - IT review/override
FR34: Epic 5 - Admin/Head approval
FR35: Epic 5 - Manual review required
FR36: Epic 5 - Request status tracking
FR37: Epic 6 - Email notifications
FR38: Epic 6 - In-app notifications
FR39: Epic 6 - Maintenance alerts
FR40: Epic 6 - Live status updates
FR41: Epic 7 - Search/filter records
FR42: Epic 7 - Dark mode UI
FR43: Epic 7 - Mobile-friendly approvals/sign-off

## Epic List


### Epic 1: User Directory & Governance (LDAP + Roles + Audit)

IT/Admins can sync and manage the authoritative user directory, control roles/status, and view audit logs.

### Story 1.1: Initialize Project from Starter Template

**FRs:** N/A (Architecture requirement: starter template)

As the delivery team,
I want to initialize the project from the approved starter templates,
So that the web and API foundations are ready for feature work.

**Acceptance Criteria:**

**Given** a new repository for IT-Hub
**When** the project is initialized using Vite (web) and fastify-cli (API)
**Then** `apps/web` and `apps/api` scaffolds exist with runnable dev scripts

**And** the baseline project structure matches the approved architecture

### Story 1.2: LDAP Sign-In & Session

**FRs:** N/A (Architecture requirement: LDAP auth)

As an internal user,
I want to sign in with my LDAP credentials,
So that I can securely access IT-Hub.

**Acceptance Criteria:**

**Given** an active internal user with valid LDAP credentials
**When** they sign in
**Then** the API authenticates via LDAP bind and issues a session (JWT in HttpOnly/Secure/SameSite cookie)
**And** the user is redirected into the app

**Given** invalid LDAP credentials
**When** the user attempts to sign in
**Then** access is denied with a clear error message

**Given** a disabled user
**When** they attempt to sign in
**Then** access is denied and the account remains disabled

### Story 1.3: Manual LDAP Sync

**FRs:** FR5, FR9

As IT staff,
I want to trigger a manual LDAP sync,
So that user data is up-to-date on demand.

**Acceptance Criteria:**

**Given** LDAP is configured
**When** IT triggers manual sync
**Then** a sync job runs and displays status (started, completed, failed)
**And** user records are updated from LDAP in read-only mode

**Given** a sync failure
**When** the job completes
**Then** the failure is recorded with a clear error message

### Story 1.4: User Directory (Read-Only LDAP Fields)

**FRs:** FR7

As IT staff,
I want to view a directory of users with LDAP-derived fields,
So that I can understand the current user profile data.

**Acceptance Criteria:**

**Given** LDAP data has been synced
**When** IT opens the Users list
**Then** they see a list of users and configured LDAP fields

**Given** a user record
**When** IT opens the user detail
**Then** LDAP fields are displayed as read-only with a "source: LDAP" indicator

### Story 1.5: Scheduled Daily LDAP Sync + Retry/Alert

**FRs:** FR6, FR9

As IT staff,
I want LDAP sync to run daily with retry and alerts,
So that data stays fresh and issues are visible.

**Acceptance Criteria:**

**Given** the daily schedule is enabled
**When** the scheduled time arrives
**Then** the sync job runs automatically and logs its outcome

**Given** a scheduled sync fails
**When** the failure occurs
**Then** the system retries and generates an alert after retry exhaustion

### Story 1.6: LDAP Change History per User

**FRs:** FR8

As IT staff,
I want to view LDAP change history per user,
So that I can trace profile updates over time.

**Acceptance Criteria:**

**Given** LDAP fields have changed during sync
**When** IT views a user's history
**Then** changes are listed with field name, old/new values, and timestamp

### Story 1.7: Role Management

**FRs:** FR1

As Admin/Head of IT,
I want to assign roles to users,
So that access is governed correctly.

**Acceptance Criteria:**

**Given** a user exists
**When** Admin/Head assigns a role (IT, Admin, Head of IT, Requester)
**Then** the role is saved and reflected in the user profile

**Given** a role change
**When** it is saved
**Then** the change is recorded in audit logs

### Story 1.8: Enable/Disable Users (No Deletion)

**FRs:** FR2, FR3

As Admin/Head of IT,
I want to disable or enable users,
So that access can be controlled without deleting accounts.

**Acceptance Criteria:**

**Given** a user exists
**When** Admin/Head disables the user
**Then** the user cannot sign in and is marked as disabled

**Given** a disabled user
**When** Admin/Head re-enables them
**Then** the user can sign in again

**And** user records are never deleted

### Story 1.9: Audit Log Viewing

**FRs:** FR4

As any internal role,
I want to view audit logs,
So that sensitive actions are transparent.

**Acceptance Criteria:**

**Given** audit events exist
**When** a user opens the Audit Log
**Then** they can view entries with actor, action, target, and timestamp

**Given** the audit log list
**When** the user filters by actor/action/date
**Then** results update accordingly

### Story 1.10: Audit Logging for Sensitive Actions

**FRs:** N/A (NFR8 audit logging)

As IT/Admin leadership,
I want sensitive actions to be recorded in audit logs,
So that accountability and traceability are ensured.

**Acceptance Criteria:**

**Given** a sensitive action occurs (role changes, enable/disable, credential generation/override, export requests, approvals, maintenance sign-off)
**When** the action is completed
**Then** an audit log entry is created with actor, action, target, timestamp, and outcome

**And** audit entries are immutable once recorded

## Epic 2: Credential Lifecycle Management

IT can configure templates and generate deterministic credentials with governance controls and history.

### Story 2.1: Global Credential Template

**FRs:** FR10

As IT staff,
I want to configure a global credential template,
So that credential formats are consistent across systems.

**Acceptance Criteria:**

**Given** IT is authorized
**When** they create or update the global template
**Then** the template is saved and versioned for future generation

**Given** an invalid template format
**When** IT attempts to save
**Then** validation errors are shown and the template is not saved

### Story 2.2: Deterministic Credential Generation

**FRs:** FR11

As IT staff,
I want the system to generate deterministic credentials from LDAP fields,
So that credentials are consistent and reproducible.

**Acceptance Criteria:**

**Given** a configured template and mapped LDAP fields
**When** IT generates credentials for a user
**Then** the system produces deterministic outputs based on the template and LDAP fields

**Given** missing required LDAP data
**When** generation is attempted
**Then** the system blocks generation and indicates which fields are missing

### Story 2.3: Credential Preview & Confirmation

**FRs:** FR12

As IT staff,
I want to preview generated credentials before confirming,
So that I can verify correctness before saving.

**Acceptance Criteria:**

**Given** credentials are generated
**When** IT previews them
**Then** a read-only preview is shown and requires explicit confirmation to save

### Story 2.4: Regeneration with Confirmation

**FRs:** FR13

As IT staff,
I want to regenerate credentials when LDAP data or templates change,
So that credentials stay accurate.

**Acceptance Criteria:**

**Given** LDAP data or template changes
**When** IT requests regeneration
**Then** the system requires explicit confirmation before overwriting active credentials

### Story 2.5: Credential History

**FRs:** FR14

As IT staff,
I want to view historical credential versions,
So that I can audit changes over time.

**Acceptance Criteria:**

**Given** credentials were generated or regenerated
**When** IT views credential history
**Then** prior versions are listed with timestamps and reason (e.g., template change, LDAP update)

### Story 2.6: Per-User Credential Override

**FRs:** FR15

As IT staff,
I want to override specific credentials for a user,
So that exceptions can be handled.

**Acceptance Criteria:**

**Given** a user's generated credentials
**When** IT overrides a specific field
**Then** the override is saved and logged

### Story 2.7: Username Field Mapping per System

**FRs:** FR16

As IT staff,
I want to configure which LDAP field maps to the username per system,
So that each system uses the correct identifier.

**Acceptance Criteria:**

**Given** multiple LDAP fields are available
**When** IT configures per-system mapping
**Then** the mapping is applied for future generations

### Story 2.8: Normalization Rules

**FRs:** FR17

As IT staff,
I want to apply normalization rules to generated credentials,
So that output formats are consistent (e.g., lowercase, remove spaces).

**Acceptance Criteria:**

**Given** normalization rules are configured
**When** credentials are generated
**Then** the rules are applied and visible in the preview

### Story 2.9: Credential Lock/Unlock

**FRs:** FR18

As IT staff,
I want to lock/unlock individual system credentials,
So that protected credentials don't change inadvertently.

**Acceptance Criteria:**

**Given** a credential is locked
**When** regeneration occurs
**Then** the locked credential remains unchanged

### Story 2.10: Disabled User Guardrails

**FRs:** FR19

As IT staff,
I want generation/regeneration blocked for disabled users,
So that access cannot be issued to disabled accounts.

**Acceptance Criteria:**

**Given** a user is disabled
**When** generation or regeneration is attempted
**Then** the system blocks the action with a clear message

### Story 2.11: IMAP Credentials (IT-only)

**FRs:** FR20

As IT staff,
I want IMAP credentials stored as IT-only and excluded from exports,
So that sensitive access remains restricted.

**Acceptance Criteria:**

**Given** IMAP credentials exist
**When** non-IT users attempt to view them
**Then** access is denied

**And** IMAP credentials are excluded from any export output


## Epic 3: Secure Export Delivery

IT can produce compliant credential exports (single and batch) with required formatting and IMAP exclusion.

### Story 3.1: Single-User Credential Export

**FRs:** FR21, FR23, FR24

As IT staff,
I want to export credentials for a single user on demand,
So that I can deliver access details quickly.

**Acceptance Criteria:**

**Given** a user has generated credentials
**When** IT requests a single-user export
**Then** the system produces an export within 5 seconds under normal load

**And** the export includes a title line and per-system username/password entries

**And** IMAP credentials are excluded from the export

### Story 3.2: Batch Credential Export

**FRs:** FR22, FR23, FR24

As IT staff,
I want to export credentials for multiple users in a batch,
So that I can deliver access details at scale.

**Acceptance Criteria:**

**Given** a list of users with generated credentials
**When** IT requests a batch export
**Then** the system produces the batch within 30 seconds for up to 100 users

**And** each user's export follows the required formatting (title line + per-system entries)

**And** IMAP credentials are excluded from all outputs

### Story 3.3: Export Formatting Rules

**FRs:** FR23

As IT staff,
I want exports formatted consistently,
So that recipients can read and apply them easily.

**Acceptance Criteria:**

**Given** an export is generated
**When** the output is produced
**Then** it contains a title line and per-system username/password entries in the agreed format

### Story 3.4: No Export Archiving

**FRs:** FR25

As IT staff,
I want exports generated without being archived by the system,
So that sensitive data is not stored unnecessarily.

**Acceptance Criteria:**

**Given** an export is generated
**When** it completes
**Then** the system does not store/archive the export file


## Epic 4: Preventive Maintenance Management

IT can schedule, assign, and record maintenance across devices with checklist-driven sign-off.

### Story 4.1: Maintenance Cycles Scheduling

**FRs:** FR26

As IT staff,
I want to schedule preventive maintenance cycles (minor quarterly, major biannually),
So that maintenance happens on a predictable cadence.

**Acceptance Criteria:**

**Given** maintenance cycle settings
**When** IT configures minor/major schedules
**Then** the system creates upcoming maintenance windows per cycle

### Story 4.2: Global Maintenance Checklists

**FRs:** FR27

As IT staff,
I want to define global maintenance checklists,
So that technicians follow consistent procedures.

**Acceptance Criteria:**

**Given** checklist items are defined
**When** a maintenance task is created
**Then** the checklist is attached to the task

### Story 4.3: Auto-Assign Maintenance by Department (Optional Rotation)

**FRs:** FR28

As IT staff,
I want maintenance tasks auto-assigned by department with optional rotation,
So that workload is distributed efficiently.

**Acceptance Criteria:**

**Given** department assignment rules
**When** maintenance tasks are generated
**Then** tasks are assigned based on department rules
**And** if rotation is enabled, assignments rotate across eligible technicians

### Story 4.4: Record Maintenance Completion & Sign-Off

**FRs:** FR29

As a technician,
I want to record maintenance completion and sign off,
So that work is tracked without requiring admin approval.

**Acceptance Criteria:**

**Given** an assigned maintenance task
**When** the technician completes the checklist and signs off
**Then** the task is marked complete with timestamp and signer

### Story 4.5: Device Coverage (Laptops/PCs/Servers)

**FRs:** FR30

As IT staff,
I want maintenance records to support laptops/PCs and servers,
So that all device types are covered.

**Acceptance Criteria:**

**Given** device inventory includes laptops/PCs and servers
**When** maintenance is scheduled or recorded
**Then** the device type is captured and filterable in maintenance records


## Epic 5: Item Requests & Approvals

Requesters submit items with invoices; IT reviews; Admin/Head approves; requesters track status.

### Story 5.1: Submit Item Request

**FRs:** FR31

As an internal requester,
I want to submit an item request with justification,
So that IT can review my request.

**Acceptance Criteria:**

**Given** a requester is signed in
**When** they submit a request with required fields
**Then** the request is created with status "Submitted" and visible to IT

### Story 5.2: Upload E-Invoice

**FRs:** FR32

As a requester,
I want to attach an e-invoice to my request,
So that approvals have the required documentation.

**Acceptance Criteria:**

**Given** a request draft or submitted request
**When** the requester uploads an e-invoice file
**Then** the file is stored and linked to the request

### Story 5.3: IT Review & Override

**FRs:** FR33

As IT staff,
I want to review requests and mark items as already purchased,
So that duplicate purchases are avoided.

**Acceptance Criteria:**

**Given** a submitted request
**When** IT reviews and marks "already purchased"
**Then** the request status updates and the reason is recorded

### Story 5.4: Admin/Head Approval

**FRs:** FR34

As Admin/Head of IT,
I want to approve requests after IT review,
So that purchases proceed with proper oversight.

**Acceptance Criteria:**

**Given** a request is IT-reviewed
**When** Admin/Head approves
**Then** the request status updates to "Approved" and is logged in audit logs

### Story 5.5: Manual Review Enforcement

**FRs:** FR35

As an Admin/Head,
I want all requests to require manual review,
So that nothing is auto-approved.

**Acceptance Criteria:**

**Given** any request
**When** it enters the workflow
**Then** it cannot be auto-approved and must be reviewed by IT then Admin/Head

### Story 5.6: Request Status Tracking

**FRs:** FR36

As a requester,
I want to view request status and outcomes,
So that I know where my request stands.

**Acceptance Criteria:**

**Given** a request exists
**When** the requester views their requests
**Then** they can see current status and outcome details


## Epic 6: Notifications & Live Status

Users receive email/in-app notifications and see live updates for requests and maintenance.

### Story 6.1: Email Notifications for Approval Steps

**FRs:** FR37

As a requester or approver,
I want to receive email notifications for approval steps,
So that I'm alerted when action is needed.

**Acceptance Criteria:**

**Given** a request moves to a new approval step
**When** the transition occurs
**Then** an email notification is sent to the relevant party

### Story 6.2: In-App Notifications for Approval Steps

**FRs:** FR38

As a requester or approver,
I want to receive in-app notifications for approval steps,
So that I can act within the system.

**Acceptance Criteria:**

**Given** a request moves to a new approval step
**When** the transition occurs
**Then** an in-app notification is created and visible in the UI

### Story 6.3: Maintenance Schedule Alerts

**FRs:** FR39

As IT staff,
I want notifications for upcoming/overdue maintenance schedules,
So that maintenance is not missed.

**Acceptance Criteria:**

**Given** maintenance is upcoming or overdue
**When** the alert threshold is reached
**Then** notifications are sent to the assigned technicians

### Story 6.4: Live Status Updates (Requests + Maintenance)

**FRs:** FR40

As an internal user,
I want live status updates without manual refresh,
So that I always see current request and maintenance states.

**Acceptance Criteria:**

**Given** a request or maintenance status changes
**When** the change is saved
**Then** connected clients receive updates within 5 seconds via SSE


## Epic 7: Search & Experience Preferences

Users can search/filter key records and use dark mode with mobile-friendly approval/sign-off views.

### Story 7.1: Search & Filter Core Records

**FRs:** FR41

As an internal user,
I want to search and filter users, requests, and maintenance records,
So that I can quickly find what I need.

**Acceptance Criteria:**

**Given** lists of users, requests, or maintenance records
**When** the user searches or applies filters
**Then** results update within 2 seconds under normal load

### Story 7.2: Dark Mode Theme

**FRs:** FR42

As an internal user,
I want a dark mode UI,
So that the app is comfortable to use in low-light environments.

**Acceptance Criteria:**

**Given** the user opens the app
**When** dark mode is enabled
**Then** the UI renders with dark theme styles across core screens

### Story 7.3: Mobile-Friendly Approvals & Sign-Off

**FRs:** FR43

As an approver or technician,
I want approval/sign-off flows to be mobile-friendly,
So that I can complete actions on the go.

**Acceptance Criteria:**

**Given** the user opens approvals or sign-off flows on mobile
**When** they navigate and act
**Then** layouts are responsive and actions are fully usable without horizontal scrolling
