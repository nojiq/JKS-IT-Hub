---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - _bmad-output/analysis/brainstorming-session-2026-01-14.md
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 1
  projectDocsCount: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
date: '2026-01-27'
---

# Product Requirements Document - IT-Hub

**Author:** Haziq afendi
**Date:** 2026-01-27

## Executive Summary
- **Vision:** Centralize IT operations (LDAP sync, credential generation, maintenance, requests, exports) into a single internal SPA.
- **Differentiator:** Deterministic credentials with audit history and unified workflows that replace spreadsheets.
- **Target Users:** IT staff, Head of IT/Admin, and internal requesters.

## Success Criteria

### User Success
- IT can complete all core workflows end-to-end in one system: LDAP sync, credential generation, preventive maintenance, item requests, and exports.
- Every workflow has clear status and ownership.
- Credentials are deterministic and trusted; regeneration is controlled and auditable.
- Preventive maintenance and item requests no longer depend on spreadsheets.
- Mobile-friendly approval/sign-off supports admins on the go.

### Business Success
- Majority of IT workflows are migrated into the system within 3-12 months.
- Manual tracking artifacts are eliminated for core workflows.
- Reduced errors/rework in credential generation and maintenance records.
- Clear visibility for Head of IT/Admin on requests, PM coverage, and user status.

### Technical Success
- LDAP sync is reliable and error-free (manual + scheduled).
- 100% audit trail coverage for sensitive actions (status changes, credential generation, overrides).
- Role-based access control enforced for IT/Admin actions.
- Export accuracy guaranteed, with IMAP credentials never included.

### Measurable Outcomes
- % of IT workflows handled entirely in the system (target: 60% at 3 months, 90% at 12 months)
- % of users with credentials managed by the system
- % of PM tasks recorded on schedule
- % of item requests with e-invoice attached and approved
- Reduction in manual tracking artifacts (target: 100% removal for core workflows)

## Product Scope

### MVP - Minimum Viable Product
- LDAP sync (manual + scheduled)
- Deterministic credential generation with audit history
- Preventive maintenance scheduling + reporting
- Item request workflow with e-invoice upload
- Exports (single + batch, excluding IMAP credentials)
- User status management (enable/disable)
- RBAC + audit logging

### Growth Features (Post-MVP)
- Role-based dashboards (IT vs Admin vs Head of IT)
- Configurable approval flows and notifications
- Advanced audit views + filters
- Bulk operations and reporting
- Integrations with other internal systems

### Vision (Future)
- Modular expansion for additional IT workflows
- Possible next modules: asset inventory/lifecycle, onboarding-offboarding, ticketing, access reviews/audit
- AI features (request triage, anomaly detection, policy suggestions)

## User Journeys

### Journey 1: IT Technician (Primary Success Path) - Credential Generation + Export
Aina is the IT technician onboarding new staff. Today she needs to sync LDAP, generate deterministic credentials, and export access details for a department lead.
- Opening Scene: Aina starts her day by searching for new hires and a pending access request.
- Rising Action: She runs LDAP sync, reviews updated user attributes, and selects the correct username field per system.
- Climax: The system generates deterministic credentials, shows them for confirmation, and produces a clean export (excluding IMAP).
- Resolution: Aina delivers access details confidently, with a full audit trail and no manual spreadsheets.

**Revealed Requirements:** LDAP sync view, credential generation rules, per-system username selection, export formatting, audit history.

### Journey 2: IT Technician (Edge Case) - Regeneration + Disabled User Handling
Aina discovers a user's legal name changed in LDAP. The user is also temporarily disabled due to a security issue.
- Opening Scene: Aina sees the LDAP change history and a disabled status flag.
- Rising Action: She attempts regeneration and sees warnings about disabled users and export restrictions.
- Climax: The system blocks export and requires explicit admin action to re-enable before regeneration.
- Resolution: Aina documents the change, leaves the user disabled, and the audit trail captures the attempted action.

**Revealed Requirements:** change history, disable/enable controls, export blocking rules, regeneration confirmations, audit logging.

### Journey 3: Head of IT/Admin (Oversight + Mobile Sign-Off)
Haziq is the Head of IT reviewing item requests and maintenance coverage while away from his desk.
- Opening Scene: He receives a notification about pending approvals and overdue maintenance and reviews them in dark mode on mobile.
- Rising Action: On mobile, he reviews request details, attached e-invoice, and priority context.
- Climax: He approves the request and assigns maintenance follow-up in one place.
- Resolution: The system updates status, logs the approval, and gives clear visibility across departments.

**Revealed Requirements:** mobile-friendly approval flow, status dashboards, approval audit trail, maintenance overview.

### Journey 4: Requester (Internal Staff) - Item Request + Invoice Upload
Lina from Admin needs to request a new laptop and attach the purchase invoice.
- Opening Scene: Lina submits a request with justification and uploads the e-invoice.
- Rising Action: She tracks progress as IT reviews and Admin approves.
- Climax: She receives confirmation and knows when the item will be ready.
- Resolution: The request is archived with documentation for future audit.

**Revealed Requirements:** request submission flow, file uploads, status tracking, notifications.

### Journey Requirements Summary
- LDAP sync + change history
- Deterministic credential generation with regeneration rules
- Disable/enable controls with export restrictions
- Export formatting rules (exclude IMAP)
- Approval workflows with audit logs
- Mobile-friendly sign-off and dashboards
- Request submission + invoice upload + status tracking

## Web App Specific Requirements

### Project-Type Overview
This is an internal, browser-based SPA optimized for IT workflows, with mobile-friendly approval/sign-off. SEO is not required. The UI should support live status updates and a dark mode theme.

### Technical Architecture Considerations
- SPA architecture with client-side routing and API-driven data flows.
- Real-time updates for status changes.
- Internal access only.

### Browser Matrix
- Support latest stable versions of Chrome, Edge, Firefox, and Safari.
- No legacy browser requirements specified.

### Responsive Design
- Desktop-first for IT operations.
- Mobile-friendly layouts for approvals/sign-offs and quick status checks.

### Performance Targets
- See Non-Functional Requirements.

### SEO Strategy
- Not required (internal application).

### Accessibility Level
- Dark mode theme required.
- No formal accessibility standard specified.

### Implementation Considerations
- Consistent theming and contrast in dark mode.
- Live update UX should prevent stale status views.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP (eliminate spreadsheets, unify core IT workflows)  
**Resource Requirements:** Small team (1 full-stack + 1 IT stakeholder + part-time QA/PM)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- IT Technician: LDAP sync -> credential generation -> export
- IT Technician (edge case): regeneration + disabled user handling
- Head of IT/Admin: approvals + mobile sign-off
- Requester: item request + invoice upload

MVP capabilities align with Product Scope (including RBAC + audit logging).

### Post-MVP Features

**Phase 2 (Growth):** See Product Scope - Growth Features.  
**Phase 3 (Expansion):** See Product Scope - Vision.

### Risk Mitigation Strategy

**Technical Risks:** LDAP integration and IMAP password generation  
- Early technical spike against real LDAP environment  
- Strict validation rules + deterministic generation tests  
- IMAP credentials never exported; encrypted at rest; restricted access  

**Market Risks:** Adoption inertia / reverting to old spreadsheets  
- MVP focuses on end-to-end workflows + visible status tracking  
- Pilot with one department before full rollout  

**Resource Risks:** Limited team capacity  
- Keep MVP lean; defer dashboards/automation to Phase 2

## Functional Requirements

### Roles & Access Control
- FR1: Admin/Head of IT can manage user roles (IT, Admin, Head of IT, Requester).
- FR2: Internal roles can disable/enable users within the app.
- FR3: The system does not allow user deletion; users can only be disabled.
- FR4: All internal roles can view audit logs.

### LDAP Sync & Profile Data
- FR5: IT staff can trigger manual LDAP sync.
- FR6: The system can perform scheduled daily LDAP sync.
- FR7: The system can display current LDAP-derived profile fields for users.
- FR8: The system can maintain a change history of LDAP field updates per user.
- FR9: The system can integrate with LDAP in read-only mode (no push-back updates).

### Credential Generation & Governance
- FR10: IT staff can configure a global credential template.
- FR11: The system can generate deterministic credentials based on LDAP fields and the configured template.
- FR12: IT staff can preview/review generated credentials before confirmation.
- FR13: IT staff can regenerate credentials when LDAP data or templates change, with explicit confirmation.
- FR14: The system can preserve historical credential versions across regenerations.
- FR15: IT staff can override specific credentials for a user.
- FR16: IT staff can configure which LDAP field maps to the username per system.
- FR17: The system can apply configurable normalization rules to credential generation.
- FR18: IT staff can lock/unlock individual system credentials.
- FR19: The system can block credential generation and regeneration for disabled users.
- FR20: The system can store IMAP passwords as IT-only credentials and never export them.

### Export Management
- FR21: IT staff can export credentials for a single user on demand.
- FR22: IT staff can export credentials in batch for multiple users.
- FR23: The system can format exports with a title line and per-system username/password entries.
- FR24: The system can exclude IMAP credentials from exports.
- FR25: The system can generate exports without archiving them.

### Preventive Maintenance
- FR26: The system can schedule preventive maintenance cycles (minor quarterly, major biannually).
- FR27: IT staff can configure and use global maintenance checklists.
- FR28: The system can auto-assign maintenance tasks by department with optional rotation.
- FR29: Users performing maintenance can record completion and sign off (no admin approval required).
- FR30: The system can support maintenance records for laptops/PCs and servers.

### Item Requests & Approvals
- FR31: Any internal user can submit item requests.
- FR32: Requesters can attach e-invoice documents to requests.
- FR33: IT staff can review requests and override if an item is already purchased.
- FR34: Admin/Head of IT can approve requests after IT review.
- FR35: The system can require manual review for all requests (no auto-approval).
- FR36: Requesters can view request status and outcomes.

### Notifications & Live Updates
- FR37: The system can send email notifications for approval steps.
- FR38: The system can send in-app notifications for approval steps.
- FR39: The system can send notifications for upcoming/overdue maintenance schedules.
- FR40: Users can see live status updates for requests and maintenance without manual refresh.

### Search & Discovery
- FR41: Users can search and filter users, requests, and maintenance records.

### UI Preferences
- FR42: The system can provide a dark mode UI theme.
- FR43: The system can support mobile-friendly views for approvals/sign-off.

## Non-Functional Requirements

### Performance
- 95% of user actions complete within 2 seconds under normal business-hours load as measured by APM.
- Live status updates appear within 5 seconds under normal load as measured by monitoring.
- Search results return within 2 seconds as measured by APM.
- Single-user export completes within 5 seconds; batch export (100 users) within 30 seconds as measured by export job logs.

### Security
- All data encrypted in transit (HTTPS/TLS) as verified by security configuration review.
- All sensitive data encrypted at rest as verified by storage settings review.
- Role-based access control for IT/Admin/Head of IT/Requester as verified by role-permission tests.
- Audit logs for sensitive actions (status changes, credential generation, overrides) verified by audit log review.
- IMAP credentials restricted to IT-only access verified by access-control tests.

### Reliability
- 99.5% uptime during business hours as measured by uptime monitoring.
- Daily backups with basic restore capability verified by periodic restore tests.

### Integration
- LDAP sync success rate >= 99% as measured by sync job logs.
- Sync failures trigger retry and IT alert as verified by alerting logs.
