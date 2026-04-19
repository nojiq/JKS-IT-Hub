# IT-Hub UI Revamp Design

Date: 2026-04-19
Project: JKS-IT-Hub
Scope: Full app shell, visual system, information architecture, and cross-module UI consistency revamp for the web workspace

## Summary

This design replaces the current generic enterprise styling with a more deliberate `premium technical workspace` direction for IT and IT admin users.

The revamp is not a page-level reskin.
It restructures the product around:

- a clearer global shell
- module-first navigation
- a module-launcher home
- a stronger typography and color system
- clearer business-task copy inside technical modules
- shared interaction patterns across tables, forms, filters, and detail views

The approved product priorities are:

1. purchase request and approval workflow
2. new joiner onboarding
3. user management with password generation
4. preventive maintenance

The new UI should optimize for IT operators, IT admins, and IT managers only.

## Problem

Current UI issues fall into three categories:

1. weak visual identity
2. confusing operational language
3. inconsistent navigation and component behavior

Specific pain points surfaced during brainstorming:

- font does not fit dense IT workflow usage
- current search placement suggests global search, but behaves like a single-purpose user search
- navigation feels unclear and inconsistent
- color usage lacks a clear product character
- sidebar header meaning is vague
- business flow is not obvious from page titles and copy
- screens do not feel like one coherent application

This makes the product feel assembled incrementally instead of intentionally designed for IT operations.

## Goals

- Establish one premium-but-practical workspace shell for the entire app.
- Improve orientation through clearer sidebar structure and page hierarchy.
- Make module entry and task prioritization obvious for IT operators.
- Replace misleading shell patterns with explicit module-level patterns.
- Increase consistency across typography, color, spacing, panels, tables, forms, and detail layouts.
- Keep the interface readable and efficient for dense operational workflows.
- Preserve technical clarity while improving business-task guidance.

## Non-Goals

- Changing product feature scope.
- Rewriting core backend workflows as part of design.
- Building a flashy marketing-style interface.
- Using heavy glassmorphism, decorative gradients, or novelty motion as the main identity.
- Replacing technical naming everywhere with business-only labels.

## Approved Direction

The approved direction is:

- redesign scope: `full app shell + design system overhaul`
- overall style: `modern premium operations desk`
- home pattern: `module launcher`
- search strategy: `module-specific search`, not shell-level pseudo-global search
- page header pattern: `technical title + task subtitle + next-step guidance`
- navigation pattern: `minimal icon sidebar with expandable groups`
- information architecture: `full restructure` allowed

## User And Workflow Focus

Primary audience:

- IT operators
- IT admins
- IT managers

Primary workflow order:

1. `Requests` for item purchase request and approval handling
2. `Onboarding` for new joiner setup
3. `Users & Credentials` for user status and password generation work
4. `Maintenance` for preventive maintenance operations

Administrative modules remain available, but should not compete visually with daily core operations.

## Design Direction

Style family:

- `premium technical workspace`

This should feel more like an operations console than a generic blue enterprise dashboard.
The interface should be restrained, deliberate, and clearly optimized for internal work.

Design principles:

### 1. Premium Through Restraint

Premium feel should come from typography, spacing, contrast, and clarity.
It should not come from visual noise.

### 2. Technical First, Business Clear

Navigation and titles may stay technical where that improves orientation.
Business flow clarity should be added through subtitles, section naming, and task framing.

### 3. Modules Over Miscellaneous Pages

Users should enter a domain, then work within a focused module environment.
The app should not feel like a flat list of unrelated routes.

### 4. One Shell, One Vocabulary

The product should use one shell, one toolbar logic, one panel system, one button hierarchy, and one state pattern.

## Visual System

### Typography

Recommended pairing:

- headings, navigation, launcher cards, section labels: `Lexend`
- body text, tables, forms, helper text: `Source Sans 3`
- mono usage only for passwords, credential values, IDs, or system references

Rationale:

- `Space Grotesk` adds personality, but is too stylized for dense internal workflows
- `Lexend` feels more modern and premium while staying legible
- `Source Sans 3` handles long tables, forms, and metadata more cleanly than a display-forward family

Typography rules:

- stronger title hierarchy
- calmer body text
- lower reliance on all-caps labels
- tighter but consistent line-length control for descriptions and helper copy

### Color Strategy

Recommended palette behavior:

- deep ink/navy foundation for structure
- slate neutrals for supporting surfaces and dividers
- off-white or cloud canvas for main work areas
- cobalt blue for interactive emphasis
- semantic green, amber, red, and sky for system states
- optional restrained champagne/brass only for subtle branded accents, never as the dominant action color

Practical interpretation:

- darker sidebar and shell framing
- lighter work surface
- crisp white or near-white panels
- strong text contrast
- visible borders and hover states without visual clutter

### Surface Language

The interface should avoid both extremes:

- not overly flat and dead
- not glassy, blurry, or decorative

Recommended surface behavior:

- dark sidebar with contained depth
- light workspace background
- white elevated panels with subtle border and soft shadow
- restrained radii
- clear section separation through layout instead of colored blocks everywhere

### Motion

Motion should support clarity only:

- sidebar expand/collapse
- hover and focus transitions
- drawer behavior on smaller screens
- module launcher feedback

Animation should remain subtle and respect `prefers-reduced-motion`.

## Shell And Navigation

The shell is the persistent app frame:

- sidebar
- topbar
- page header structure
- user menu
- notification controls
- shared layout spacing

### Sidebar

Sidebar pattern:

- minimal icon rail when collapsed
- expandable grouped navigation
- darker than workspace canvas
- clearer header meaning

The sidebar header should explicitly describe the product, for example:

- `IT Hub`
- `IT Operations Console`

That is clearer than vague wording such as `Hub Workspace`.

### Navigation Groups

Recommended groups:

1. `Core Operations`
2. `Administration`

Recommended primary modules inside `Core Operations`:

- `Requests`
- `Onboarding`
- `Users & Credentials`
- `Maintenance`

Recommended `Administration` modules:

- `Systems`
- `Approvals`
- `Audit`

### Topbar

The topbar should become lighter and more utility-focused.
It should not carry a fake global search pattern.

Keep in topbar:

- sidebar toggle
- notifications
- theme control if still needed
- user/account menu

Remove from topbar:

- misleading shell-level `Search users` field

### Search Strategy

Approved strategy:

- module-specific search only

Reason:

- each module has different entities and filter needs
- a shell-level search implies cross-entity intelligence the app does not currently provide
- module-local search is clearer and more honest

Future extension allowed:

- dedicated command palette for navigation and quick actions

But that should be a separate power-user feature, not a disguised topbar field.

## Home Experience

Home should shift from a generic dashboard summary to a `module launcher`.

### Home Behavior

After login, users should see:

- prioritized module entry cards
- a short status summary on each card
- current workload signals without forcing a KPI-first dashboard

Recommended order:

1. `Requests`
2. `Onboarding`
3. `Users & Credentials`
4. `Maintenance`

Each launcher card should communicate:

- what this module is for
- current pending or overdue count
- why the user should enter now

This creates a more intentional entry experience for IT work than a mixed dashboard panel grid.

## Information Architecture

The app should be reorganized around operational domains instead of a flat route inventory.

### Global Structure

Use sidebar to enter a domain.
Use module pages to hold deeper task navigation.

This means:

- fewer global nav items competing at once
- more local clarity once a module is open
- better separation between operational work and administrative configuration

### Naming Strategy

Keep labels mostly technical where helpful.

Recommended module naming:

- `Requests`
- `Onboarding`
- `Users & Credentials`
- `Maintenance`
- `Systems`
- `Approvals`
- `Audit`

`Requests` stays better than `Procurement` because it is shorter, more flexible, and closer to the current product vocabulary.

## Page Header Pattern

Approved pattern:

- technical title
- task subtitle
- supporting context or next-step guidance

Examples:

- `Requests`
  `Review purchase requests, move approvals forward, and resolve blocked items.`
- `Onboarding`
  `Prepare access, assign defaults, and generate credentials for new joiners.`
- `Users & Credentials`
  `Manage user status, passwords, and generated access details.`
- `Maintenance`
  `Schedule preventive work, assign tasks, and close overdue actions.`

This provides consistent orientation while making business flow more obvious.

## Module Patterns

Each module should follow the same base structure:

1. module landing page
2. local toolbar with module search, filters, and primary action
3. main work surface
4. internal tabs or secondary navigation inside the module

The global sidebar should not carry every deep sub-route.

### Requests

Purpose:

- item purchase request intake, review, approval progression, and blocked item handling

Landing page sections:

- `Needs Review`
- `Waiting for Approval`
- `Blocked`
- `Recently Completed`

Primary views:

- request queue
- approval queue
- request detail

Toolbar behavior:

- search by request ID, item, or requester
- filters for status, priority, date, approver, or stage

### Onboarding

Purpose:

- new joiner setup and default access configuration

Landing page sections:

- `Start New Joiner`
- `In Progress`
- `Ready for Credential Generation`
- `Completed Recently`

Primary views:

- new joiner flow
- defaults
- catalog

The new joiner experience should feel step-based and operational.
Defaults and catalog should feel like supporting tools, not the main landing focus.

### Users & Credentials

Purpose:

- user status management, password operations, credential generation, and credential history

Landing page sections:

- `User Directory`
- `Recent Access Actions`
- `Password Generation`
- `Locked Credentials`

Primary views:

- users list
- user detail
- password and credential tools
- credential history

User detail should be reorganized into clearer operational zones:

- identity
- account status
- credentials
- recent actions

### Maintenance

Purpose:

- preventive maintenance scheduling, assignment, task execution, and closure

Landing page sections:

- `Upcoming Windows`
- `My Tasks`
- `Overdue`
- `History`

Primary views:

- schedule
- task execution
- assignment/configuration
- history

This module should feel more like a calendar/task workspace than a generic admin form cluster.

### Administration

Administrative surfaces should be visually aligned with core modules, but clearly secondary in emphasis.

Modules:

- `Systems`
- `Approvals`
- `Audit`

They should use the same shell, toolbar, panel, and detail patterns as the rest of the app.

## Shared Component Rules

### Search And Filters

Each module gets one consistent toolbar pattern:

- module search
- module filters
- one clear primary action

Avoid ad hoc placement of buttons and filters per screen.

### Panels

Continue using shared workspace panel primitives, but evolve them into the new design system.

Requirements:

- one consistent card/panel family
- improved typography hierarchy
- clearer header bands or section headers
- better spacing rhythm

### Tables

Tables should remain a first-class pattern for dense operational work.

Requirements:

- consistent toolbar above tables
- consistent row density
- consistent status treatment
- clear action placement
- responsive behavior that preserves usability at medium widths

### Forms

Forms should feel more deliberate and less scattered.

Requirements:

- strong labels
- clearer helper text
- grouped sections
- consistent action placement
- reduced noise around secondary actions

### States

Loading, empty, success, warning, and error states should use a shared visual vocabulary.

That includes:

- icon treatment
- copy structure
- action hierarchy
- panel layout

## Copy Strategy

One root problem is that business flow is unclear.
The fix is not replacing all technical naming.
The fix is more disciplined copy.

Copy rules:

- navigation labels stay short and technical
- page titles stay stable and reusable
- subtitles explain task intent
- section labels reflect queue or workflow state
- buttons use explicit verbs
- avoid vague shell labels and filler descriptions

## Responsive And Accessibility Requirements

The redesign must verify:

- `375px`
- `768px`
- `1024px`
- `1440px`

Accessibility baseline:

- visible focus states
- keyboard-operable navigation and drawers
- sufficient contrast in light and dark themes
- no reliance on color alone for meaning
- reduced-motion support for shell animations

## Rollout Strategy

Recommended implementation order:

1. design tokens, fonts, color system, shell, and shared primitives
2. home module launcher and `Requests`
3. `Onboarding`
4. `Users & Credentials`
5. `Maintenance` and `Administration`
6. cross-app consistency sweep

This sequencing aligns the redesign with the product's real workflow priority.

## Likely Files

- `apps/web/src/styles/index.css`
- `apps/web/src/shared/workspace/workspace.css`
- `apps/web/src/shared/workspace/WorkspaceLayout.jsx`
- `apps/web/src/shared/workspace/WorkspacePageHeader.jsx`
- `apps/web/src/shared/workspace/WorkspacePanel.jsx`
- `apps/web/src/features/users/home-page.jsx`
- `apps/web/src/routes/router.jsx`

Additional module pages and tests will be updated during implementation planning.

## Risks

- over-styling the app and hurting readability for dense workflows
- renaming or regrouping modules in ways that break user familiarity
- introducing a premium visual layer without fixing copy and task flow
- partial rollout leaving the app in a mixed visual state
- building module-specific patterns inconsistently if shared primitives are not locked first

## Next Step

Create the implementation plan for:

1. shell and design token overhaul
2. module launcher home
3. `Requests` module restructure
4. phased rollout across remaining modules
5. shared verification for accessibility, responsiveness, and UI consistency
