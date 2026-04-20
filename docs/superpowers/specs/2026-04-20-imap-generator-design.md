# IMAP Generator Design

Date: 2026-04-20
Project: JKS-IT-Hub
Scope: Add a first-class IMAP Generator page under `Users & Credentials` with deterministic password generation, manual and user-attached workflows, system-over-LDAP field resolution, history recording, and active-password control

## Summary

This design promotes IMAP password generation from a narrow override modal into a dedicated operational page inside `Users & Credentials`.

The new page supports both:

- attached-user workflow with LDAP-prefilled context
- manual workflow with fuzzy full-name matching and inline user creation

The generator remains deterministic.
The same resolved field values, selected toggles, and user context must produce the same IMAP password.
If a user changes values and later restores the previous values, the password must return to the earlier result.

Approved product behavior:

- route lives inside `Users & Credentials`, not as a new top-level product
- page layout uses a `workbench + inspector` structure
- field sources resolve as `system` first, then `ldap`
- once IT edits a field, its effective source becomes `system`, not `ldap`
- manual sync never silently overwrites system values
- sync conflict UI stays hidden unless a manual sync actually finds LDAP differences against stored system values
- previous IMAP passwords are visible from a modal, not cluttering the main page
- save flow supports both `history only` and `set as active`

## Problem

Current IMAP functionality exists, but it is shaped like a credential override side-path rather than a primary admin workflow.

Current issues:

- IMAP generation is embedded inside a modal flow instead of a dedicated tool
- layout is too cramped for six fields, per-field toggles, source tracking, user matching, and history work
- current source handling is biased toward LDAP-only display and does not represent mixed `system` / `ldap` ownership clearly
- manual data entry, fuzzy user matching, and user creation are not first-class parts of the workflow
- previous IMAP passwords are not presented as a clean reusable archive flow
- LDAP sync behavior needs explicit conflict handling so manual/system values are not overwritten accidentally

The result is a feature that has the core generator logic but does not yet feel like a proper admin tool.

## Goals

- Create a first-class `IMAP Generator` page inside `Users & Credentials`.
- Support attached-user and manual-entry workflows on the same page.
- Preserve deterministic password generation behavior.
- Show field-level source ownership clearly.
- Let `system` values override `ldap` values without losing LDAP snapshot visibility.
- Allow manual creation or attachment of users from the generator flow.
- Record current and past IMAP passwords cleanly.
- Let IT save a password as history only or explicitly set it active.
- Keep sync conflict UI hidden unless there is a real conflict after manual sync.
- Make the page feel like a serious internal admin workstation, not a decorative card page.

## Non-Goals

- Replacing the primary left workspace sidebar
- Replacing the existing LDAP sync architecture broadly across the app
- Converting all user identity editing in the app into manual-edit mode
- Turning the IMAP generator into a standalone top-level module
- Auto-merging LDAP values into manually maintained IMAP identity fields
- Replacing existing credential history behavior outside IMAP-specific enhancements

## Approved Direction

Approved direction:

- add routed page: `/users/imap-generator`
- add module tab: `IMAP Generator`
- use `Workbench + Inspector` page structure
- keep previous-password archive behind a modal
- keep sync conflict review hidden until needed
- support manual workflow, fuzzy full-name search, inline user creation, and direct user preload from user detail

Reason:

- the workflow is too complex for a modal
- the user wants both manual and attached-user flows in one place
- the page needs room for source-aware field editing and deterministic preview
- the UI should behave like an operator workstation, not a one-off dialog

## Existing Context

The repo already contains most of the deterministic IMAP generation primitives:

- IMAP field set exists in `apps/web/src/features/credentials/override/CredentialOverrideModal.jsx`
- live preview pattern already exists with debounced preview requests
- deterministic generation exists in `apps/api/src/features/credentials/generator.js`
- override preview and confirm flows already persist current and historical credentials
- IMAP is already seeded as a built-in IT-only system

The design should reuse these strengths while replacing the current IMAP entry point and extending the data model for system-owned field overrides and reusable archive workflows.

## Information Architecture

### Route Placement

Add the page under the existing `users` route tree:

- `/users/imap-generator`

Keep it inside `Users & Credentials` so it remains aligned with current operator mental model and role gating.

### Module Tabs

Update the `Users & Credentials` tab set to include:

- `Overview`
- `Directory`
- `IMAP Generator`
- `Locked Credentials`
- `History`

### Entry Paths

Users can enter the page from:

- `Users & Credentials > IMAP Generator`
- a user detail page with a deep link or action such as `Open in IMAP Generator`

If launched from a user detail page, the generator opens with that user already attached and field values resolved immediately.

## Page Layout

Approved layout: `Workbench + Inspector`

### Left: Workbench

The workbench is the primary editing area and contains:

1. user resolver
2. mode state
3. field workbench
4. conditional sync conflict review

#### User Resolver

Top section behavior:

- search by full name
- fuzzy suggestions appear as the user types
- exact match is preferred when found
- if no suitable match exists, show inline `Create User`
- if multiple close matches exist, force explicit selection before save

#### Mode State

The page must support both:

- `Attached User`
- `Manual Entry`

Manual entry is not a temporary preview-only mode.
It is a valid working mode that can later attach to an existing user or create a new one.

#### Field Workbench

Show one row per IMAP field:

- `email`
- `firstName`
- `lastName`
- `fullName`
- `dob`
- `phone`

Each row contains:

- `Use` toggle
- field label
- editable value input
- source badge
- optional helper state such as `overridden` or `changed`

The workbench should use rows and panels, not card-heavy grouping.

### Right: Sticky Inspector

The inspector is pinned on the right and contains:

- resolved IMAP username
- live deterministic password preview
- selected-field chips
- deterministic state explanation
- save controls
- `Set as active` toggle
- action to open `Previous IMAP Passwords`

The inspector should preserve layout stability while async preview is loading.
It must never cause the page to jump as preview state updates.

### Hidden-Until-Needed Sync Conflict Panel

The sync conflict panel is not part of the default page layout.
It appears only when:

- the user triggers manual sync
- LDAP returns values that differ from stored `system` values for overlapping IMAP fields

When no conflict exists, this section is absent.

### Previous Passwords Modal

Previous IMAP passwords should not occupy persistent page space.
Expose them behind a secondary action button that opens a modal.

The modal shows:

- previous password records
- when each was saved
- whether it had been active or archival
- generation snapshot details
- action to save the selected record again as history only or active

## Visual Direction

The page should follow a `data-dense admin workstation` direction.

Approved visual principles:

- dense but controlled spacing
- operational clarity over decorative cards
- panels, rows, and inspectors instead of marketing-style tiles
- strong contrast and visible borders
- stable hover and focus states
- light workspace canvas with crisp elevated surfaces
- restrained motion only for state clarity

Typography and color should stay compatible with the broader workspace revamp direction, but this page should lean more technical and utilitarian than promotional.

## Source Resolution Model

This feature needs explicit source ownership per field.

### Sources

Each IMAP field can resolve from:

- `system`
- `ldap`

`manual` entry is treated as authoring behavior that produces a stored `system` value.

### Resolution Rule

For every IMAP field, the effective value is:

1. stored `system` value if present
2. otherwise latest `ldap` value
3. otherwise empty

This means `system` always wins over `ldap` in the generator.

### Source Badge Rule

If IT edits a field that previously came from LDAP:

- the edited value is stored as `system`
- the badge changes from `LDAP` to `SYSTEM`
- it does not continue displaying as `LDAP`

This is critical.
The UI must represent effective ownership truthfully, not historical origin.

### LDAP Snapshot Rule

LDAP remains a read-only snapshot of what sync most recently saw.
The generator may display LDAP values for reference, but it must not treat them as the active source if a `system` value exists.

## Data Model Direction

Add a separate IMAP-related system profile for user-level identity inputs used by the generator.

Recommended fields:

- `email`
- `firstName`
- `lastName`
- `fullName`
- `dob`
- `phone`

Recommended storage shape:

- one user-linked record or JSON object for IMAP system-owned fields
- per-field metadata sufficient to resolve source and detect overrides

Minimum stored semantics:

- current system values by field
- updated timestamp
- updated-by actor
- optional last LDAP comparison snapshot or fingerprints for conflict detection

Do not overwrite the existing LDAP snapshot with manual/system values.
These must remain separate layers.

## User Matching And Creation

### Fuzzy Full-Name Search

Manual mode resolves users through fuzzy full-name search.

Approved behavior:

- fuzzy suggestions as user types
- exact match preferred
- if no exact match, show close candidates
- explicit selection required for ambiguous cases

### Inline Create User

If no good match exists, the page expands an inline `Create User` panel.

Reason:

- keeps the operator on the page
- preserves current IMAP inputs and preview context
- avoids context break caused by a modal

Create-user flow should collect only the minimum required identity and account fields to attach the IMAP workflow cleanly.

### Manual Entry Persistence

When manual values are used and then saved:

- if the user is matched, save those values into the user’s IMAP system profile
- if no user exists, offer inline create-user
- after creation, save the same values into the new user’s IMAP system profile

## Deterministic Generation

The generator remains deterministic.

### Deterministic Inputs

Password derivation must depend on:

- user identity context required by the algorithm
- resolved IMAP field values
- the set of selected `Use` toggles
- normalization rules already defined for IMAP fields

### Required Behavior

- same resolved inputs => same password
- changing a selected field => password changes
- changing a non-selected field => password does not change
- reverting a selected field to its previous value => password returns to previous deterministic result

### Preview Behavior

Preview updates in real time while typing and toggling.

The inspector should show:

- generated password
- which fields are currently driving it
- whether anything changed versus the current active IMAP credential

## Save Behavior

The save flow supports two outcomes:

- `History only`
- `Set as active`

### History Only

When `Set as active` is off:

- save the password and generation snapshot as an archived IMAP record
- do not replace the current active IMAP credential

### Set As Active

When `Set as active` is on:

- save the new password as the active IMAP credential
- rotate the previous active IMAP password into history
- record the generation snapshot for the new active save

### Re-Saving Previous Passwords

From the previous-passwords modal, IT can re-save an older password:

- as history only
- as active

This must create a new saved event.
It must not mutate old historical records silently.

## Generation Snapshot Requirements

Every IMAP save, whether active or historical, must preserve the exact snapshot used for generation.

Minimum snapshot contents:

- field values used
- selected `Use` fields
- effective source per field
- save mode: `history_only` or `active`
- actor
- saved timestamp

This makes previous records auditable and reusable.

## Manual Sync Conflict Workflow

Manual sync must not silently override stored system values.

### Trigger

Conflict review appears only when:

- user manually runs sync
- synced LDAP data differs from stored system-owned IMAP fields

### Conflict Review Content

For each conflicting field, show:

- current effective system value
- latest LDAP value
- before/after comparison
- choice to keep `system` or replace with `ldap`

### Default Behavior

Until the operator chooses to replace a field:

- keep the `system` value
- keep source badge as `SYSTEM`
- preserve LDAP only as the newest snapshot/reference value

This gives the operator full control over overlap resolution.

## Error Handling

### Resolver Errors

- no match: show suggestions or inline create-user path
- ambiguous match: require explicit selection
- create-user validation failure: keep page state intact and show inline form errors

### Preview Errors

- preserve typed values
- show inline inspector error
- keep layout stable
- do not clear the current workbench state

### Save Errors

- if active IMAP changed since preview, show conflict and require fresh preview
- if required user attachment is missing for save, block save with clear guidance
- if save fails, preserve the generated state and user edits

### Sync Conflict Errors

- do not attempt auto-merge fallback
- surface conflict review only after real diff detection

## Component Architecture

Recommended frontend structure:

- route container for `/users/imap-generator`
- resolver section component
- inline create-user panel component
- IMAP field workbench component
- sticky inspector component
- previous-passwords modal component
- sync conflict review component

Recommended backend structure:

- user matching service
- create/attach user service support for generator flow
- system profile storage and resolution service
- deterministic IMAP generator reuse
- save orchestration for history-only vs active behavior
- sync conflict detection and review support

Keep container and presentation responsibilities separate.
The page container should own data fetching and mutations.
Presentational components should render controlled state passed into them.

## Testing

Required verification coverage:

- same inputs regenerate same password
- reverting inputs restores previous password
- unselected fields do not affect password
- system values override LDAP values in resolution
- editing an LDAP-derived field changes its badge to `SYSTEM`
- fuzzy full-name suggestions behave correctly
- ambiguous user matches block save until selection
- inline create-user preserves current IMAP working state
- history-only save does not replace active credential
- active save rotates current credential into history
- re-saving an old password creates a new recorded event
- sync conflict panel stays hidden when no conflict exists
- sync conflict panel appears only after manual sync finds overlap differences
- field-by-field LDAP replacement works as selected

## Migration / Delivery Notes

Implementation should reuse the current IMAP deterministic logic and credential history primitives where possible.

Expected changes include:

- route and module tab update
- new page and components
- new user IMAP system-profile storage
- extended save flows for archive reuse and active/history branching
- sync conflict review support

This feature should land as a coherent workflow, not as another layered modal on top of existing IMAP override UI.
