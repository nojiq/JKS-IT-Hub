# Responsive Table And Sidebar Toggle Design

Date: 2026-04-16
Project: JKS-IT-Hub
Scope: Users directory table responsiveness and shared workspace sidebar toggle behavior

## Summary

This design adds two interaction improvements to the workspace shell:

- responsive + scroll-aware users table behavior
- toggleable sidebar with desktop collapse and mobile drawer behavior

Goal: make workspace adapt better to browser width without forcing full mobile layout too early.

## Problem

Current behavior too rigid:

- users table stays wide until hard mobile switch
- medium browser widths lose usability fast
- sidebar always open, consumes width even when user wants focus on data
- no shared shell control for collapsed navigation

## Goals

- preserve table usability across desktop and tablet widths
- reduce visible columns progressively before switching to cards
- keep horizontal scroll as fallback, not primary mode
- let user collapse sidebar on desktop
- convert sidebar to drawer on smaller screens
- keep behavior accessible and predictable

## Non-Goals

- full redesign of all tables in app
- new navigation information architecture
- new icon library dependency
- replacing current mobile card layout for users page

## Design Direction

Approved direction:

- table: `responsive + scroll`
- sidebar: `desktop collapse + mobile drawer`

This keeps workspace feeling like desktop admin software while improving narrower widths.

## Table Behavior

### Breakpoints

#### `>= 1280px`

- full desktop table
- all core columns visible
- no forced collapse

#### `1024px - 1279px`

- keep main table layout
- start hiding lowest-priority columns
- allow horizontal scroll if content still exceeds container

#### `768px - 1023px`

- stronger column reduction
- keep only highest-value columns visible
- preserve horizontal scroll as fallback
- do not switch to mobile cards yet

#### `< 768px`

- use existing mobile card/list layout

### Column Priority

Hide columns in this order:

1. lowest priority extra LDAP columns
2. `department`
3. `username`
4. `role`

Keep visible as long as possible:

1. `user`
2. `status`
3. `actions`

### Mid-Width Behavior

At medium widths:

- `user` column stays dominant
- secondary metadata can move into subtext inside `user` cell if needed
- `status` remains visible
- `actions` remains visible
- `role` stays only while space allows

### Scroll Behavior

- table wrapper keeps `overflow-x: auto`
- horizontal scroll remains available after responsive collapse
- scroll is fallback, not sole adaptation strategy
- if implementation remains clean, first identity column may become sticky on non-mobile widths

### Why Hybrid

Pure scroll still feels cramped on medium widths.
Pure collapse loses access to secondary fields too quickly.
Hybrid gives:

- better scan speed
- more resilient layout
- less abrupt jump into mobile mode

## Sidebar Behavior

### Desktop `>= 1024px`

Sidebar becomes collapsible rail.

Expanded state:

- current label + nav structure
- onboarding children visible when active

Collapsed state:

- icon-first rail
- labels hidden
- active item still obvious
- width reduced to compact icon rail

Desktop collapsed state should persist in `localStorage`.

### Mobile / Tablet `< 1024px`

Sidebar becomes off-canvas drawer.

- closed by default
- toggle button opens drawer
- backdrop click closes drawer
- route change closes drawer
- `Escape` closes drawer

Mobile drawer open state should not persist.

## Toggle Control

### Placement

- topbar left side
- before search

### Visual Treatment

- compact icon button
- neutral shell, same workspace control styling
- no oversized pill button
- icon should be simple line-style menu/panel-collapse symbol

### Interaction

- one control for both desktop collapse and mobile drawer open
- clear `aria-label`
- reflects current state via `aria-expanded` when applicable

## Icons

Do not add new icon package unless necessary.

Preferred order:

1. inline SVG
2. tiny local icon component
3. external icon package only if already present

## Shared Shell Rules

- sidebar logic lives in `WorkspaceLayout`
- shell state handled centrally, not page-by-page
- layout CSS belongs in shared workspace stylesheet
- drawer overlay and collapse transitions should stay subtle

## Users Page Rules

- responsive column logic belongs in users table markup + shared workspace CSS
- keep current mobile list mode below mobile breakpoint
- do not make all workspace tables collapse identically unless pattern proves reusable after users page

## Accessibility

- toggle button needs explicit label
- mobile drawer must close with `Escape`
- backdrop close must be supported
- hidden desktop labels must not break active-state discoverability
- responsive table must preserve keyboard access to row actions

## Acceptance Criteria

- resizing browser changes visible table columns before mobile switch
- medium widths stay usable without immediate card conversion
- table can still scroll horizontally when needed
- desktop sidebar can collapse and expand
- collapsed desktop sidebar remains usable with icons
- smaller screens use drawer behavior
- mobile drawer closes on backdrop click, route change, and `Escape`
- desktop collapse state persists across reloads

## Likely Files

- `apps/web/src/shared/workspace/WorkspaceLayout.jsx`
- `apps/web/src/shared/workspace/workspace.css`
- `apps/web/src/features/users/users-list-page.jsx`
- `apps/web/tests/WorkspaceLayout.test.jsx`
- `apps/web/tests/UsersListPageStates.test.jsx`

## Risks

- overcomplicated breakpoint rules creating brittle column logic
- hiding too many columns too early
- desktop collapsed rail becoming unclear without active cues
- mixing desktop collapse rules with mobile drawer state

## Next Step

Create implementation plan covering:

1. shared shell toggle behavior
2. sidebar icon + persistence
3. responsive users table column collapse
4. test coverage for resize and drawer behavior
