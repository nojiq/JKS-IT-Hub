# Stitch UI Revamp Design

Date: 2026-05-11
Project: JKS-IT-Hub
Source blueprint: Stitch project `IT Operations & Asset Portal`

## Summary

This design makes the current Stitch project the primary visual and interaction blueprint for the IT Hub web app.

The revamp is full scope, but delivery starts with a design-system foundation before moving through feature pages in priority order. This avoids a partial-looking app while reducing the risk of a single large rewrite.

Approved delivery order:

1. Foundation design system
2. Requests and procurement
3. Onboarding
4. Users and credentials
5. Preventive maintenance
6. Approvals, system overview, login, audit, and admin polish

## Goals

- Align the app with the Stitch `IT Operations & Asset Portal` screens.
- Establish one shared visual system before rebuilding individual pages.
- Preserve existing routes, APIs, and business behavior unless a UI workflow exposes a real gap.
- Improve density, hierarchy, consistency, and operational clarity across all modules.
- Make page implementation visually verifiable against the relevant Stitch screens.

## Non-Goals

- Replacing backend workflows.
- Changing product feature scope.
- Rewriting routing without a UI-driven reason.
- Creating marketing-style landing pages.
- Adding decorative visual effects that do not improve operational clarity.

## Foundation Phase

The foundation phase applies the Stitch design system before page-level revamps.

Scope:

- CSS tokens in `apps/web/src/styles/index.css`
- typography, spacing, color, border, shadow, and radius rules
- global shell and workspace layout behavior
- navigation and page header patterns
- shared panels, tables, lists, buttons, forms, badges, and state blocks
- responsive behavior for desktop, tablet, and mobile
- loading, empty, error, pending, and permission-limited state patterns

Feature pages should consume shared primitives instead of each feature inventing local visual rules.

## Page Phases

### Phase 1: Requests And Procurement

Blueprint screens:

- `Procurement & Purchase Requests`
- approval patterns from `Approval Oversight Dashboard`

Scope:

- request intake and request list surfaces
- review and approval states
- filters and module-specific search
- lifecycle status display
- dense table/list behavior
- contextual empty and error states

### Phase 2: Onboarding

Blueprint screen:

- `IT Onboarding Checklist`

Scope:

- onboarding home and layout
- employee setup stages
- checklist modules
- blockers and next actions
- progress and completion states

### Phase 3: Users And Credentials

Blueprint screens:

- `User Directory`
- `User Profile & Security`

Scope:

- directory scanning
- user detail layout
- account status and security metadata
- credential/password actions
- LDAP sync surface
- credential-related pending and result states

### Phase 4: Preventive Maintenance

Blueprint screen:

- `Preventive Maintenance Dashboard`

Scope:

- maintenance dashboard
- scheduling and window cards
- checklist completion
- device and service states
- overdue and attention states

### Phase 5: Admin, Overview, Login

Blueprint screens:

- `System Overview Dashboard`
- `Approval Oversight Dashboard`
- `Login Page`

Scope:

- global overview and admin/system surfaces
- audit and approval polish
- authentication entry
- final cross-module consistency pass

## Architecture

The app remains a React/Vite frontend using the existing route and feature structure.

Shared UI architecture should live primarily in:

- `apps/web/src/styles/index.css`
- `apps/web/src/shared/workspace/*`
- existing shared UI components under `apps/web/src/shared/ui/*`

Feature-specific CSS should stay limited to workflow-specific layout needs, such as request lifecycle views, onboarding checklist grouping, user profile/security sections, and maintenance scheduling surfaces.

Backend APIs and business logic should remain unchanged unless implementation proves that an existing UI flow cannot be represented with current data.

## Data Flow And State

The revamp keeps current feature APIs and data-loading patterns intact.

Page work should reorganize presentation around:

- clearer page headers
- module-specific search and filters
- status summaries
- lifecycle panels
- tables and lists
- detail sections
- contextual action areas

New UI-only counts, grouping, and progress summaries should be derived client-side from existing API responses unless current data is insufficient.

## Error Handling

Errors should appear inside the relevant workspace surface, not as detached generic messages.

Each module should offer contextual recovery actions where appropriate:

- retry
- clear filters
- return to module home
- open the affected detail

Form and approval errors should stay close to the field or action that caused them. Long-running actions such as credential regeneration, request submission, LDAP sync, and maintenance completion need disabled/pending states plus visible success or failure feedback.

## Testing And Verification

Testing should follow the phase structure.

Foundation tests:

- token and style contract checks
- workspace layout behavior
- panel and state block styling
- navigation and responsive shell behavior

Feature phase tests:

- focused React tests for key visible states and workflows
- style/layout tests where the visual contract is important
- existing API tests should remain unchanged unless a real contract mismatch is found

Visual verification:

- run the local app
- compare implemented pages against the matching Stitch screens
- verify desktop and mobile/responsive behavior where the affected surface supports it

## Acceptance Criteria

- The shared foundation reflects the Stitch design tokens and interaction patterns.
- Each priority phase maps to the named Stitch blueprint screens.
- Routes and existing business behavior remain stable.
- Shared components reduce visual duplication across modules.
- Loading, empty, error, and pending states are consistent across the app.
- The completed revamp reads as one operational IT workspace, not separate page-level redesigns.
