# Card Revamp Design

Date: 2026-04-16
Project: JKS-IT-Hub
Scope: Shared workspace card system across dashboard, users, detail, audit, and admin surfaces

## Summary

This design replaces the current mixed card treatments with a single workspace panel system.
The selected direction is `crisp enterprise` using `header-band panels` as the base card language.

The current UI mixes:

- newer workspace cards from `apps/web/src/shared/workspace/workspace.css`
- older, softer cards and controls from `apps/web/src/styles/index.css`

That split makes the product feel inconsistent across dashboard, list, detail, and admin pages.
The revamp standardizes all major cards into a shared structure that feels operational, compact, and serious enough for internal admin workflows.

## Problem

The existing card style feels weak for three reasons:

1. Too many cards use the same soft, generic container treatment.
2. Different surfaces use different visual systems.
3. Nested mini-cards and oversized detail shells make dense data feel less structured.

This creates a UI that looks assembled from multiple phases rather than designed as one workspace.

## Goals

- Establish one card language for all primary workspace surfaces.
- Make cards feel like workspace modules instead of floating dashboard tiles.
- Improve hierarchy through structure, not decorative styling.
- Keep summary cards compact and easy to scan.
- Reduce nested full-card patterns in favor of inset rows and grouped sections.
- Ensure mobile layouts still feel like the same system, only condensed.

## Non-Goals

- Full product redesign outside card and panel structure.
- New color theme or brand redesign.
- Heavy motion, glassmorphism, gradients, or decorative chrome.
- Reworking business flows or feature scope.

## Design Direction

The approved direction is:

- Style family: `crisp enterprise`
- Base pattern: `header-band panel`
- Metric treatment: `compact`

This should feel closer to internal admin software than a generic dashboard kit.

## Visual Principles

### 1. Flat But Not Dead

Cards should not rely on plush shadows or oversized radii.
They should feel stable and structured.

- visible border
- low shadow only for separation
- restrained radius

### 2. Hierarchy Through Structure

Hierarchy should come from bands, dividers, grouped sections, and typography.
It should not come from random background changes or oversized spacing.

### 3. Data-First Composition

Cards exist to organize information and actions.
Layouts should privilege readability, scan speed, and density over decoration.

### 4. Shared System, Specialized Types

Every card should belong to one common system.
Different screens may use different card types, but not different visual languages.

## Panel System

All major cards should map to one of these panel types:

1. `metric panel`
2. `content panel`
3. `table panel`
4. `detail panel`
5. `status panel`

If a container does not clearly fit one of these types, it should not remain a full card.

## Base Anatomy

### Shell

- radius: `12px`
- border: `1px solid` visible workspace border token
- shadow: minimal, only enough to separate from page background
- background: primary surface token

The shell should look intentional and controlled, not soft or inflated.

### Header Band

- height target: `40px` to `48px` depending on content density
- slightly tinted or muted background
- bottom divider
- left side: title, eyebrow, or short metadata
- right side: actions or secondary controls

The header band is the core signature of the system.
It turns cards into workspace modules instead of generic rounded boxes.

### Body

- tighter vertical rhythm than current soft cards
- consistent inner padding
- strong alignment to grid
- minimal dead space

### Footer

Use only when functionally needed:

- pagination
- summary rows
- secondary actions

The footer should be separated with a divider, not implied by spacing alone.

### Inset Rows

For activity items, metadata groups, LDAP fields, previews, or compact summaries:

- use inset rows
- use dividers
- use muted sub-surfaces when needed

Do not render every child element as another full card.

## Interaction Rules

### Hover

- slightly stronger border
- slight surface contrast increase
- no dramatic lift

### Focus

- visible focus ring
- clear border state
- avoid glow-heavy shadow behavior

### Selected

- accent border
- subtle surface tint
- preserve readability

### Disabled

- flatter contrast
- reduced emphasis
- no lifted or interactive appearance

## Panel Type Specifications

### Metric Panel

Use for compact summaries such as:

- unread notifications
- users in directory
- review queue
- maintenance status

Structure:

- small label or eyebrow
- one dominant number
- one short support line

Rules:

- compact height
- no oversized empty space
- no decorative icon unless it adds operational meaning
- no executive-style hero treatment

### Content Panel

Use for:

- quick actions
- recent activity
- small dashboards
- short grouped content

Structure:

- header band
- stacked body content
- optional footer

### Table Panel

Use for:

- users list
- audit records
- request queues
- approval tables

Structure:

- header band
- toolbar/filter zone
- table or mobile list body
- footer for pagination or summary

### Detail Panel

Use for:

- profile summary
- LDAP fields
- credentials
- history blocks

Structure:

- header band
- grouped sections inside body
- dividers between internal sections

The current oversized soft detail shell should be replaced by multiple detail panels.

### Status Panel

Use for:

- sync status
- warnings
- errors
- operational alerts

Structure:

- same shell and anatomy as other panels
- status differentiation via header tint, edge accent, or tokenized emphasis

Do not invent a separate alert-card language.

## Application To Current Surfaces

### Dashboard

#### Stat Cards

Convert current dashboard stat cards into compact metric panels.

Requirements:

- shorter height
- label first
- number second
- one quiet support line
- no oversized tile feel

#### Content Panels

Panels like quick actions, recent audit activity, and recent notifications should use:

- shared header band
- inset rows for items
- stronger section structure

Remove the feeling of generic panels containing mini-cards.

### Users List

Treat this as the canonical table panel.

Requirements:

- shared panel shell
- header band
- integrated toolbar zone
- body for table or mobile list
- footer for pagination

### User Detail

Break the current large soft card into multiple detail panels:

- profile summary
- LDAP fields
- credentials
- history

The detail page should read as a composed workspace, not one oversized blob.

### Mobile Cards

Keep the same geometry and tone as desktop panels, condensed for mobile.
They should feel like the same system in a smaller format, not a separate card style.

### Alerts And Sync Panels

Use the same panel shell with status tinting or accent logic.
Do not preserve a separate visual language for warnings and sync areas.

### Audit And Admin Pages

These pages must be migrated to the same panel shell and header-band structure.
They are currently one of the main sources of visual inconsistency.

## Migration Rules

- Start with shared primitives, not page-specific exceptions.
- Migrate by surface group:
  - dashboard
  - users list
  - user detail
  - audit and admin pages
- Once a page is migrated, remove legacy soft card treatments from that page completely.
- Any remaining card must map to one of the five approved panel types.
- Legacy `.btn-*` and legacy surface variables must not define the visual identity of migrated panels.

## Risks To Avoid

- keeping mixed shell styles on the same page
- only changing tokens while preserving old spacing and old composition
- overusing shadows, gradients, or decorative effects
- retaining card-inside-card patterns where inset rows are enough
- making metric panels too large or too promotional

## Acceptance Criteria

- Dashboard, list, detail, and admin screens all feel like one workspace system.
- Metric panels are compact summaries, not hero blocks.
- Content, table, detail, and status panels are distinguishable by structure, not by unrelated styling.
- Nested mini-cards are reduced to inset rows, grouped sections, or dividers.
- Mobile surfaces preserve the same panel language in condensed form.
- Loading, empty, and error states use the same panel system instead of raw text blocks.
- No migrated page retains legacy soft-card styling alongside new panels.

## File Targets

Primary sources likely affected during implementation:

- `apps/web/src/shared/workspace/workspace.css`
- `apps/web/src/shared/workspace/WorkspacePageHeader.jsx`
- `apps/web/src/features/users/home-page.jsx`
- `apps/web/src/features/users/users-list-page.jsx`
- `apps/web/src/features/users/user-detail-page.jsx`
- `apps/web/src/features/audit/audit-log-page.jsx`
- selected admin/request pages still using older card shells
- `apps/web/src/styles/index.css` for removal or reduction of legacy card patterns

## Verification Plan

Implementation should be reviewed against:

- desktop dashboard
- desktop users list
- desktop user detail
- desktop audit/admin surface
- mobile users list
- mobile detail surface

Verification checks:

- shell consistency
- header-band consistency
- density and spacing discipline
- inset row behavior
- metric panel compactness
- no mixed legacy card styles on migrated pages

## Decision Log

- User rejected the current soft/generic card feel.
- User chose `crisp enterprise` as the target tone.
- User selected `all primary workspace cards` as scope.
- User selected `header-band panel` as the preferred card direction.
- User confirmed metric panels should remain `compact`.

## Next Step

Create an implementation plan that introduces shared panel primitives first, then migrates workspace surfaces in ordered groups without mixing legacy and new card shells on the same page.
