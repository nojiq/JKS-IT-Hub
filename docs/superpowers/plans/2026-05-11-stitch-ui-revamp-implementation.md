# Stitch UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Stitch `IT Operations & Asset Portal` blueprint across the IT Hub web app, starting with a shared design-system foundation and then revamping all priority modules in order.

**Architecture:** Keep the existing React/Vite app, routes, API calls, and feature boundaries. Build the Stitch visual system into shared tokens and workspace primitives first, then update feature pages to consume those primitives with only workflow-specific CSS left in feature folders. Avoid backend changes unless a UI flow exposes a real data contract gap.

**Tech Stack:** React 19, Vite 7, React Router 7, TanStack React Query 5, Vitest, Testing Library, CSS modules/files already in `apps/web/src`.

---

## Source References

- Spec: `docs/superpowers/specs/2026-05-11-stitch-ui-revamp-design.md`
- Stitch project: `IT Operations & Asset Portal`
  - Project ID: `10479808496060796622`
  - Project resource: `projects/10479808496060796622`
- Existing older plan index: `docs/superpowers/plans/2026-04-19-ui-revamp-phases-index.md`

## Stitch Blueprint Packet

Workers must use these exact Stitch references. If a screenshot URL expires, use the Stitch MCP `get_screen` call with the listed screen resource.

| App route | Stitch screen | Screen resource | Screenshot URL |
| --- | --- | --- | --- |
| `/requests` | `Procurement & Purchase Requests` | `projects/10479808496060796622/screens/0ce9d8bf94f74079ab56644176eba208` | `https://lh3.googleusercontent.com/aida/ADBb0uixLi1-hbcYI504QdUXHT_BFfeMj-aV6AFho2WgweyQeyVXj3eACljeIAhvrJ58Szlbrnt_JFN5JZAxcswos9LQvi-ZQ3lg4S43oOHAzMbJ-f129W9MMcuEN0pASpMegS93VaaqNcQq0okGIGzK2CuHIUB4vDdPwv0OMMYYBjBKr0k-aLKOCZjUVmqWkNypiZqEtMJcVbpmNpnvRJi5jVHesEQnZ6yIBJ26L3FeeCpc0s6uhhe_4llKg2_b` |
| `/` | `IT Operations Dashboard` | `projects/10479808496060796622/screens/2a59792f73464bf29fd3f2c50ec8bb3b` | `https://lh3.googleusercontent.com/aida/ADBb0ugn7yBtI5ghYD-4EPIDXI0y5GSEmbUXAMeVBCk881PNwblKc5_PaG3mc9qOuFNGO6KwtCbPBVM4IzpkTyXNlj82JYjqp11Tf_XviLKL8Svo1wB7ZAekrnRfYVDJQ0ahBxXY8RfVY3niDhJ5md3NgqVClIV-vEG083eNYSwgJK667TO66KLGQVK2cq91kD29ls0mIJ7CzcEBTcGU5F8z3hTL9YmTVF7_NyuHnIS_NguLrWU7z4ymoym-yGw` |
| `/maintenance` | `Preventive Maintenance Dashboard` | `projects/10479808496060796622/screens/30907ad78a5241c3b55327dad418eede` | `https://lh3.googleusercontent.com/aida/ADBb0ug0Ys9uUQXhlrQ29j_5izMiLBuQbUEKvnoTZG99D19rzewBD-PNxVSLbqyz2CIR0NTGvNxxKhyrg6OjiqdaXp6hGmCaLGVYGePLxCZkE5nSa6-IFLkqVtMhGL87yXDzjP-OgA0BvXWbOYfP7UxUtKl0LCR21C8J_XP1Cxi5xmwd9L0fW-UgP9SQGAEV-ZXakbsEPG8g7oCav1YUrtqAupGLrd3groIyEoUbh73SeyccrUtt61AfsDihGJA` |
| `/users/:id` | `User Profile & Security` | `projects/10479808496060796622/screens/b4e15df545274276bf53011b36812bda` | `https://lh3.googleusercontent.com/aida/ADBb0ujiiJNm_TEnykOpwQpzepMZZUg9A4CtEwnFDlbXc1LLIFaUEhJFUb3Y1mzgOM0UOZEDK_K34YYIFkZ3moi9K_98buJ_wzwIypFgPv0mbPkehOJyMhdJROB74tdHgf9DinRV8L13JeSHdM_czMa1nfVC3ZZTifwPYwm7RClxG6aGbdN5CkI9RV_aywchASYbk9kKGkyFT0Ooc8ap8DDXZOcpW_fb26EKQur7OZ_7JDphStgWYG4l0E9QbMM3` |
| `/requests/approvals` | `Approval Oversight Dashboard` | `projects/10479808496060796622/screens/afe1031bb2c24c42acbef40ee546d827` | `https://lh3.googleusercontent.com/aida/ADBb0uj4dBWLPUn2hDXVbryUAKW1iRfe41UqDLGz96bubkdCJzKJnynVrrIkHdeyO6IJuC8r5Vws9GOREvgG4AsguQ-6AkGserEYy5FiA8czYJmdsabinvJIxLFzxspRkVIuc6PiiqYGay1EeYugftBqQLUVP7CarUNAiYjOPgsx-Gfll-d_TFmVALtGTcB_QatLwp_q4SCGdWSw04Txadth7z7VXE13iRd7Vah282c8CJUlt7d-PXCK9ie1L5XZ` |
| `/systems` | `System Overview Dashboard` | `projects/10479808496060796622/screens/eedd2f9439ad4a0bae2fc218b4cef6de` | `https://lh3.googleusercontent.com/aida/ADBb0uhxiQxXxFBkvG2cvjp7QNOQcXMWQ7IrjMYnt0OWQ4CCRC9WsWr_kcMDcNBqKLdITi27NXH5EanEEew07E4_ddPCvLJ24ONCND_LiBWYNes2_MvEEaOcpSiovG6kjg0Z26xRs0na1h2z0rDeSLNtt4sKRhyVz8fiVcLA8J3ScQjZ6NgtX11MDTrTPXqW2brJmdJrnhvfbOhGHaoPIJceya3xNPW8HtsHT-zdqNqQginyr3mtqoIwVFR-gJ6e` |
| `/onboarding` | `IT Onboarding Checklist` | `projects/10479808496060796622/screens/d5183b43c7d14b16bcb78565f7deea8e` | `https://lh3.googleusercontent.com/aida/ADBb0ugTOpMWrPEUWqN_P_V84gFudtPF04Z873XaJJcJnD6ZLwI4OEWue-E_lGwsaFjztdehrcQ7cFrwm4hQN9hZA1N9nD2GwhK1BaDSr4ukU-rDjyhIsMkwKRYUgX6MNze27RoMpDh4q5R2cqyWVl7PpHHV5z--VDotBFKU1UcSwagJux8r9ve_HSHjN2v0bjJaB6O0M1EojkLV9q4Mx6z4WElPH_gUg-5FrQBfr2tYeGfu07Tu0JHbmDTwpHYS` |
| `/login` | `Login Page` | `projects/10479808496060796622/screens/bded71f6161e4fe2b7985301605c6567` | `https://lh3.googleusercontent.com/aida/ADBb0ujCQ8h_6Sw5d9Y7fOdSe8VDQ6bNToV-Lfrgrd57ZTSWVaTFUHkntiN8ubkQEUVnKbNS-kRSip2Gt0hBl1-KlNdHQiN_i9_sUEvPgglQAqRwJqe--TosN5m0dh8N2A3AcS5DV8x3GQr8QvF_s2HmGVSdEiFZvRXjqaOczJGEj3moESb6xAzckc5vx2x7q3uSLgtthDJTbWUSvTs_GXHzm4BjpujYEY3dJIzkr04btg_vSDWu42GEsD0PUsc` |
| `/users/directory` | `User Directory` | `projects/10479808496060796622/screens/3497d9fe170e4574b657fea1df8a1a74` | `https://lh3.googleusercontent.com/aida/ADBb0ui-QCSXcnHKNfDxlewlX-fR0i-lV1rATh9penJh2wOr1WFYidp-Db0JM3qFnETfFvycEqY2NA-SCOPBoAAOQQmpJ4twdTNiGsbTEGjHRVkO9bJ6U6eN-Amh0X9f38SW1Kebftf973aPB6JpnVhfEJxRVGx9orAho0aeuOUfP2zmGK7Nhe-BRgUva6TnCjolZZsgxLB21ZpP3QACXEd5tGLVWx8BUNB0QkwKSp48F0O25CjlQLPJ2f17-yAL` |
| `/requests/review` | `Manager Approval Portal` | `projects/10479808496060796622/screens/d2fa917383ba4a888b9083a6b8132f9e` | `https://lh3.googleusercontent.com/aida/ADBb0uggMiSCq7SvKClAebQGjYtyUnMArOUuSL68wgI9Vyq2nHKg4T7eOZXBDYMlhvPKCVEuaImJWVyw4f0W70mIHkT8bqc9xY-JWs37H30UWpZflW8r4SF1CUaf2BHd7lR_UvxZ2FNU8rRS9guHsZ1VhqOhkhT3G4mNjxCTA77Qt_P-rkrmzelPCmR97h1minme2Iufv3mZm4xm-FPVTaHggleqK3bvt2V7whLyRHG4NoxJofwGmHjWdmuqTToL` |

Per chunk, workers must save implementation screenshots under `/tmp/jks-it-hub-visual-checks/<chunk-name>/` or another verified ignored local folder and summarize differences from the matching Stitch screen before committing.

## Current Worktree Warning

Before executing any task, run:

```bash
git status --short
```

There are existing modified and untracked files in this workspace. Treat them as user work unless proven otherwise. Do not revert them. If a task must edit a dirty file, read the current file and `git diff -- <path>` first, then preserve existing changes while applying the new work.

## Safe Commit Rule

The commit commands below describe intended commit boundaries. Do not run broad `git add` pathspecs in a dirty worktree. Before every commit:

1. Run `git status --short`.
2. Run `git diff --name-only` and list only files changed by the current task.
3. For files that were already dirty before the task, use `git add -p <path>` and stage only hunks created by this task.
4. For clean files created or modified by this task, use `git add -- <exact-path>`.
5. Run `git diff --cached --name-only` and confirm it contains only current-task files before `git commit`.

If safe staging is ambiguous, stop and ask the user instead of staging broad paths.

## Per-Chunk Visual Verification Rule

At the end of each chunk:

1. Start the web app with `pnpm --filter web dev`.
2. Open the affected route(s) in a browser at desktop width around `1280x1024`.
3. Check a narrow/mobile viewport for text overlap and navigation behavior where the route supports it.
4. Compare against the matching Stitch blueprint from the table above.
5. Save screenshots to `/tmp/jks-it-hub-visual-checks/<chunk-name>/` or another verified ignored local folder and summarize any differences.

Passing tests without this route-level visual check is not enough for this UI revamp.

## File Ownership By Chunk

Use these ownership boundaries when assigning subagents:

- Chunk 1 owns shared foundation files:
  - `apps/web/src/styles/index.css`
  - `apps/web/src/shared/workspace/*`
  - `apps/web/src/shared/ui/*` where needed
  - `apps/web/tests/StitchThemeStyles.test.jsx`
  - `apps/web/tests/WorkspaceLayout.test.jsx`
  - `apps/web/tests/WorkspaceModuleTabs.test.jsx`
  - `apps/web/tests/WorkspacePanel.test.jsx`
  - `apps/web/tests/DataStateBlock.test.jsx`
  - `apps/web/tests/OverviewStripStyles.test.jsx`
  - `apps/web/tests/WorkspacePanelStyles.test.jsx`
- Chunk 2 owns request/procurement files:
  - `apps/web/src/features/requests/**/*`
  - request tests under `apps/web/tests/*Request*` and `tests/web/InvoiceDisplay.test.jsx`
- Chunk 3 owns onboarding files:
  - `apps/web/src/features/onboarding/**/*`
  - onboarding tests under `apps/web/tests/*Onboarding*`, `apps/web/tests/CatalogPage*`, `apps/web/tests/NewJoinerPage*`
- Chunk 4 owns users and credentials files:
  - `apps/web/src/features/users/UsersLayout.jsx`
  - `apps/web/src/features/users/UsersHomePage.jsx`
  - `apps/web/src/features/users/users-list-page.jsx`
  - `apps/web/src/features/users/user-detail-page.jsx`
  - `apps/web/src/features/users/ldap-sync-panel.jsx`
  - `apps/web/src/features/credentials/**/*`
  - users/credentials tests under `apps/web/tests/*User*`, `apps/web/tests/ImapGeneratorPage.test.jsx`, and `tests/web/*credential*`
- Chunk 5 owns maintenance files:
  - `apps/web/src/features/maintenance/**/*`
  - maintenance tests under `apps/web/tests/*Maintenance*`, `apps/web/tests/maintenance*`, `tests/web/maintenance*`
- Chunk 6 owns admin, overview, login, and final sweep files:
  - `apps/web/src/features/audit/**/*`
  - `apps/web/src/features/system-configs/**/*`
  - `apps/web/src/features/notifications/**/*`
  - `apps/web/src/features/users/home-page.jsx`
  - `apps/web/src/features/users/login-page.jsx`
  - admin/overview/login tests under `apps/web/tests/*System*`, `apps/web/tests/*Audit*`, `apps/web/tests/HomePage.test.jsx`

Do not let multiple subagents edit the same file at the same time. Chunk 1 should finish before page chunks begin. `apps/web/src/styles/index.css` belongs to Chunk 1; later chunks may only consume its tokens unless the user explicitly approves a serialized follow-up foundation patch.

---

## Chunk 1: Stitch Foundation

### Task 1.1: Capture Current Foundation Contracts

**Files:**
- Read: `apps/web/src/styles/index.css`
- Read: `apps/web/src/shared/workspace/workspace.css`
- Read: `apps/web/src/shared/workspace/WorkspaceLayout.jsx`
- Read: `apps/web/src/shared/workspace/WorkspacePageHeader.jsx`
- Read: `apps/web/src/shared/workspace/WorkspacePanel.jsx`
- Read: `apps/web/src/shared/workspace/DataStateBlock.jsx`
- Test: `apps/web/tests/StitchThemeStyles.test.jsx`
- Test: `apps/web/tests/WorkspaceLayout.test.jsx`
- Test: `apps/web/tests/WorkspacePanel.test.jsx`
- Test: `apps/web/tests/DataStateBlock.test.jsx`

- [ ] **Step 1: Inspect dirty shared files**

Run:

```bash
git status --short apps/web/src/shared/workspace apps/web/src/styles apps/web/tests
git diff -- apps/web/src/shared/workspace/workspace.css apps/web/src/styles/index.css
```

Expected: understand existing local edits before modifying shared files.

- [ ] **Step 2: Run current foundation tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/StitchThemeStyles.test.jsx apps/web/tests/WorkspaceLayout.test.jsx apps/web/tests/WorkspacePanel.test.jsx apps/web/tests/DataStateBlock.test.jsx
```

Expected: baseline pass or documented pre-existing failure.

### Task 1.2: Define Stitch Tokens And Global Density

**Files:**
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/tests/StitchThemeStyles.test.jsx`
- Create or modify: `apps/web/tests/OverviewStripStyles.test.jsx`
- Create or modify: `apps/web/tests/WorkspacePanelStyles.test.jsx`

- [ ] **Step 1: Write or update token tests first**

Assert that CSS contains the Stitch contract:

```js
expect(css).toContain("--ui-surface-canvas: #fbf9fa");
expect(css).toContain("--ui-accent-primary: #334155");
expect(css).toContain("--font-body: \"Inter\"");
expect(css).toContain("--font-code: \"JetBrains Mono\"");
expect(css).toContain("--radius-control: 4px");
expect(css).toContain("--radius-panel: 8px");
```

- [ ] **Step 2: Run token tests and confirm failure where coverage is new**

Run:

```bash
pnpm --filter web test -- apps/web/tests/StitchThemeStyles.test.jsx apps/web/tests/OverviewStripStyles.test.jsx apps/web/tests/WorkspacePanelStyles.test.jsx
```

Expected: new assertions fail before implementation, existing assertions continue to describe current behavior.

- [ ] **Step 3: Implement the Stitch token layer**

Update `apps/web/src/styles/index.css` so canonical tokens match Stitch:

- light canvas `#fbf9fa`
- elevated surface `#ffffff`
- muted surface `#f5f3f5`
- active/hover tonal layers
- slate primary `#334155` with darker hover `#1d2b3e`
- semantic success, warning, error, and info tokens
- Inter body/headline fonts
- JetBrains Mono code font
- 4px control radius, 8px panel radius
- compact 4px-based spacing aliases

Keep legacy aliases mapped to canonical tokens so existing page CSS does not break.

- [ ] **Step 4: Run token tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/StitchThemeStyles.test.jsx apps/web/tests/OverviewStripStyles.test.jsx apps/web/tests/WorkspacePanelStyles.test.jsx
```

Expected: PASS.

### Task 1.3: Rebuild Shared Workspace Primitives

**Files:**
- Modify: `apps/web/src/shared/workspace/WorkspaceLayout.jsx`
- Modify: `apps/web/src/shared/workspace/workspace.css`
- Modify: `apps/web/src/shared/workspace/WorkspacePageHeader.jsx`
- Modify: `apps/web/src/shared/workspace/WorkspacePanel.jsx`
- Modify: `apps/web/src/shared/workspace/DataStateBlock.jsx`
- Modify: `apps/web/src/shared/workspace/DesktopFilterBar.jsx`
- Modify: `apps/web/src/shared/workspace/BulkActionsBar.jsx`
- Modify: `apps/web/src/shared/workspace/ModuleLauncherCard.jsx`
- Modify: `apps/web/src/shared/workspace/WorkspaceModuleTabs.jsx`
- Test: `apps/web/tests/WorkspaceLayout.test.jsx`
- Test: `apps/web/tests/WorkspaceModuleTabs.test.jsx`
- Test: `apps/web/tests/WorkspacePanel.test.jsx`
- Test: `apps/web/tests/DataStateBlock.test.jsx`

- [ ] **Step 1: Add tests for shared workspace behavior**

Cover:

- sidebar labels remain `Core Operations` and `Administration`
- collapsed sidebar keeps accessible labels
- page header supports eyebrow, title, description, meta, and actions
- panel variants render stable `data-variant`
- data state block exposes contextual action buttons
- module tabs use button/link affordances without layout shift

- [ ] **Step 2: Run shared workspace tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/WorkspaceLayout.test.jsx apps/web/tests/WorkspaceModuleTabs.test.jsx apps/web/tests/WorkspacePanel.test.jsx apps/web/tests/DataStateBlock.test.jsx
```

Expected: failures only for newly required Stitch behavior.

- [ ] **Step 3: Implement shared workspace CSS and markup**

Update shared primitives to match Stitch:

- dark precise sidebar with compact grouped nav
- utility topbar without fake global search
- full-width light workspace canvas
- no nested card appearance
- crisp bordered panels
- compact headers and toolbar action areas
- table/list surfaces with sticky-capable header classes
- standard state blocks for loading, empty, error, pending, permission-limited
- focus states with visible ring and no layout shift
- mobile drawer behavior preserved

- [ ] **Step 4: Run shared workspace tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/WorkspaceLayout.test.jsx apps/web/tests/WorkspaceModuleTabs.test.jsx apps/web/tests/WorkspacePanel.test.jsx apps/web/tests/DataStateBlock.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Visually verify foundation routes**

Run the app and check `/`, `/requests`, `/onboarding`, `/users/directory`, and `/maintenance` for shell/sidebar/topbar consistency at desktop and mobile widths. Save screenshots under `/tmp/jks-it-hub-visual-checks/chunk-1-foundation/`.

- [ ] **Step 6: Commit foundation**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): apply stitch workspace foundation"
```

Expected: commit includes only foundation files.

---

## Chunk 2: Requests And Procurement

### Task 2.1: Revamp Requests Home And List Surfaces

**Files:**
- Modify: `apps/web/src/features/requests/pages/RequestsHomePage.jsx`
- Modify: `apps/web/src/features/requests/pages/RequestsHomePage.css`
- Modify: `apps/web/src/features/requests/pages/MyRequestsPage.jsx`
- Modify: `apps/web/src/features/requests/components/RequestListItem.jsx`
- Modify: `apps/web/src/features/requests/components/RequestStatusBadge.jsx`
- Modify: `apps/web/src/features/requests/components/RequestStatusTimeline.jsx`
- Test: `apps/web/tests/RequestsHomePage.test.jsx`

- [ ] **Step 1: Inspect dirty request files**

Run:

```bash
git status --short apps/web/src/features/requests apps/web/tests/RequestsHomePage.test.jsx
git diff -- apps/web/src/features/requests/pages/RequestsHomePage.css
```

Expected: preserve pre-existing edits.

- [ ] **Step 2: Add request home tests**

Cover:

- page header names procurement/request workflow
- summary metrics use shared panel/list styling
- module-specific search/filter controls are present
- request lifecycle statuses render with consistent badges
- empty state gives clear next action

- [ ] **Step 3: Run request home tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/RequestsHomePage.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 4: Implement Stitch procurement layout**

Use the Stitch `Procurement & Purchase Requests` screen as blueprint:

- compact operational header
- request status summary strip
- filter/search toolbar inside the module
- dense bordered request rows
- clear lifecycle/status badge treatment
- primary action for new request
- no shell-level search pattern

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/RequestsHomePage.test.jsx
```

Expected: PASS.

### Task 2.2: Revamp Submission, Review, And Approval Surfaces

**Files:**
- Modify: `apps/web/src/features/requests/pages/SubmitRequestPage.jsx`
- Modify: `apps/web/src/features/requests/pages/ReviewRequestsPage.jsx`
- Modify: `apps/web/src/features/requests/pages/ReviewRequestsPage.css`
- Modify: `apps/web/src/features/requests/pages/AdminApprovalPage.jsx`
- Modify: `apps/web/src/features/requests/pages/AdminApprovalPage.css`
- Modify: `apps/web/src/features/requests/components/RequestForm.jsx`
- Modify: `apps/web/src/features/requests/components/RequestDetailModal.jsx`
- Modify: `apps/web/src/features/requests/components/RequestReviewModal.jsx`
- Modify: `apps/web/src/features/requests/components/AdminApprovalModal.jsx`
- Test: `apps/web/tests/ReviewRequestsPage.test.jsx`
- Test: `apps/web/tests/AdminApprovalPage.test.jsx`
- Test: `tests/web/InvoiceDisplay.test.jsx`

- [ ] **Step 1: Add review/approval tests**

Cover:

- review queues use Stitch table/list density
- approval actions expose pending/disabled states
- invoice/attachment sections stay visible and readable
- errors appear inside the active review surface

- [ ] **Step 2: Run request review tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/ReviewRequestsPage.test.jsx apps/web/tests/AdminApprovalPage.test.jsx
pnpm test -- tests/web/InvoiceDisplay.test.jsx
```

Expected: new UI-contract assertions fail before implementation.

- [ ] **Step 3: Implement review and approval surfaces**

Apply Stitch approval patterns:

- queue header with operational context
- dense rows/cards for requests awaiting action
- sticky or persistent action area where current layout supports it
- contextual errors and retry actions
- modal spacing and typography aligned with shared panel rules

- [ ] **Step 4: Run request tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/RequestsHomePage.test.jsx apps/web/tests/ReviewRequestsPage.test.jsx apps/web/tests/AdminApprovalPage.test.jsx
pnpm test -- tests/web/InvoiceDisplay.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Visually verify requests routes**

Run the app and compare `/requests`, `/requests/review`, and `/requests/approvals` against the request and approval Stitch blueprints. Save screenshots under `/tmp/jks-it-hub-visual-checks/chunk-2-requests/`.

- [ ] **Step 6: Commit requests phase**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): revamp requests workflow with stitch layout"
```

Expected: commit includes only request/procurement files and tests.

---

## Chunk 3: Onboarding

### Task 3.1: Revamp Onboarding Home And Layout

**Files:**
- Modify: `apps/web/src/features/onboarding/OnboardingLayout.jsx`
- Modify: `apps/web/src/features/onboarding/onboarding.css`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingHomePage.jsx`
- Test: `apps/web/tests/OnboardingLayout.test.jsx`
- Test: `apps/web/tests/OnboardingHomePage.test.jsx`

- [ ] **Step 1: Inspect dirty onboarding files**

Run:

```bash
git status --short apps/web/src/features/onboarding apps/web/tests/OnboardingLayout.test.jsx apps/web/tests/OnboardingHomePage.test.jsx
git diff -- apps/web/src/features/onboarding apps/web/tests/OnboardingLayout.test.jsx apps/web/tests/OnboardingHomePage.test.jsx
```

Expected: preserve pre-existing edits.

- [ ] **Step 2: Add onboarding layout tests**

Cover:

- header and tabs match shared workspace patterns
- onboarding home shows setup progress, blockers, and next action groups
- empty/loading/error states use shared state blocks

- [ ] **Step 3: Run onboarding tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/OnboardingLayout.test.jsx apps/web/tests/OnboardingHomePage.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 4: Implement Stitch onboarding checklist structure**

Use the Stitch `IT Onboarding Checklist` screen:

- task progress summary
- checklist module rows with compact checkbox/status affordances
- blockers/attention section
- next-action panel
- consistent shared panel and badge styling

- [ ] **Step 5: Run onboarding tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/OnboardingLayout.test.jsx apps/web/tests/OnboardingHomePage.test.jsx
```

Expected: PASS.

### Task 3.2: Revamp Catalog, Defaults, And New Joiner Pages

**Files:**
- Modify: `apps/web/src/features/onboarding/pages/CatalogPage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsPage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsEditor.jsx`
- Modify: `apps/web/src/features/onboarding/pages/NewJoinerPage.jsx`
- Test: `apps/web/tests/CatalogPage.test.jsx`
- Test: `apps/web/tests/CatalogPageStyles.test.jsx`
- Test: `apps/web/tests/NewJoinerPage.test.jsx`

- [ ] **Step 1: Add page-specific tests**

Cover:

- catalog uses dense list/table surfaces
- defaults pages use form field and panel patterns
- new joiner flow shows progress, pending, and error states near affected controls

- [ ] **Step 2: Run page tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/CatalogPage.test.jsx apps/web/tests/CatalogPageStyles.test.jsx apps/web/tests/NewJoinerPage.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 3: Implement page surfaces**

Keep existing behavior and route structure. Replace local visual patterns with shared panels, headers, badges, and state blocks.

- [ ] **Step 4: Run onboarding suite**

Run:

```bash
pnpm --filter web test -- apps/web/tests/OnboardingLayout.test.jsx apps/web/tests/OnboardingHomePage.test.jsx apps/web/tests/CatalogPage.test.jsx apps/web/tests/CatalogPageStyles.test.jsx apps/web/tests/NewJoinerPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Visually verify onboarding routes**

Run the app and compare `/onboarding`, `/onboarding/catalog`, `/onboarding/defaults`, and `/onboarding/new-joiner` against the onboarding Stitch blueprint. Save screenshots under `/tmp/jks-it-hub-visual-checks/chunk-3-onboarding/`.

- [ ] **Step 6: Commit onboarding phase**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): revamp onboarding with stitch checklist layout"
```

Expected: commit includes only onboarding files and tests.

---

## Chunk 4: Users And Credentials

### Task 4.1: Revamp Users Home, Directory, And Profile

**Files:**
- Modify: `apps/web/src/features/users/UsersLayout.jsx`
- Modify: `apps/web/src/features/users/UsersHomePage.jsx`
- Modify: `apps/web/src/features/users/users-list-page.jsx`
- Modify: `apps/web/src/features/users/user-detail-page.jsx`
- Modify: `apps/web/src/features/users/ldap-sync-panel.jsx`
- Test: `apps/web/tests/UsersHomePage.test.jsx`
- Test: `apps/web/tests/UsersListPageStates.test.jsx`
- Test: `apps/web/tests/UserDetailPage.test.jsx`

- [ ] **Step 1: Inspect dirty users and credentials files**

Run:

```bash
git status --short apps/web/src/features/users apps/web/src/features/credentials apps/web/tests/UsersHomePage.test.jsx apps/web/tests/UsersListPageStates.test.jsx apps/web/tests/UserDetailPage.test.jsx
git diff -- apps/web/src/features/users apps/web/src/features/credentials apps/web/tests/UsersHomePage.test.jsx apps/web/tests/UsersListPageStates.test.jsx apps/web/tests/UserDetailPage.test.jsx
```

Expected: preserve pre-existing edits.

- [ ] **Step 2: Add user module tests**

Cover:

- directory search/filter is module-local
- user rows show account status and credential/security cues
- detail page follows `User Profile & Security` layout
- LDAP sync panel has pending, success, and failure state styling

- [ ] **Step 3: Run user tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/UsersHomePage.test.jsx apps/web/tests/UsersListPageStates.test.jsx apps/web/tests/UserDetailPage.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 4: Implement users Stitch screens**

Use `User Directory` and `User Profile & Security`:

- compact directory table/list
- profile/security panels
- visible account state and action hierarchy
- credential actions with pending/disabled feedback
- LDAP sync surface aligned with admin data panels

- [ ] **Step 5: Run user tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/UsersHomePage.test.jsx apps/web/tests/UsersListPageStates.test.jsx apps/web/tests/UserDetailPage.test.jsx
```

Expected: PASS.

### Task 4.2: Align Credential Workflows

**Files:**
- Modify: `apps/web/src/features/credentials/components/*`
- Modify: `apps/web/src/features/credentials/generation/*`
- Modify: `apps/web/src/features/credentials/history/*`
- Modify: `apps/web/src/features/credentials/imap/*`
- Modify: `apps/web/src/features/credentials/preview/*`
- Modify: `apps/web/src/features/credentials/regeneration/*`
- Modify: `apps/web/src/features/credentials/templates/*`
- Test: `apps/web/tests/ImapGeneratorPage.test.jsx`
- Test: `apps/web/tests/TemplateListStyles.test.jsx`
- Test: `tests/web/credentialTemplates.test.jsx`
- Test: `tests/web/credentialExportButton.test.jsx`
- Test: `tests/web/imapCredentialsUi.test.jsx`

- [ ] **Step 1: Add credential UI tests**

Cover:

- generated credential values use mono styling
- destructive/locked credential states are visually distinct
- regeneration/preview errors appear in context
- template list/editor surfaces use shared panels and form controls

- [ ] **Step 2: Run credential tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/ImapGeneratorPage.test.jsx apps/web/tests/TemplateListStyles.test.jsx
pnpm test -- tests/web/credentialTemplates.test.jsx tests/web/credentialExportButton.test.jsx tests/web/imapCredentialsUi.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 3: Implement credential visual alignment**

Replace one-off card/form/table styles with foundation classes where possible. Preserve credential generation logic and API calls.

- [ ] **Step 4: Run users and credentials tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/UsersHomePage.test.jsx apps/web/tests/UsersListPageStates.test.jsx apps/web/tests/UserDetailPage.test.jsx apps/web/tests/ImapGeneratorPage.test.jsx apps/web/tests/TemplateListStyles.test.jsx
pnpm test -- tests/web/credentialTemplates.test.jsx tests/web/credentialExportButton.test.jsx tests/web/imapCredentialsUi.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Visually verify users and credentials routes**

Run the app and compare `/users`, `/users/directory`, a user detail route, `/users/imap-generator`, `/users/locked`, and credential history/templates routes against the user directory/profile Stitch blueprints. Save screenshots under `/tmp/jks-it-hub-visual-checks/chunk-4-users-credentials/`.

- [ ] **Step 6: Commit users and credentials phase**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): revamp users and credentials with stitch patterns"
```

Expected: commit includes only users, credentials, and related tests.

---

## Chunk 5: Preventive Maintenance

### Task 5.1: Revamp Maintenance Dashboard And Schedule

**Files:**
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceLayout.jsx`
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceHomePage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceHomePage.css`
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceSchedulePage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceSchedulePage.css`
- Modify: `apps/web/src/features/maintenance/components/MaintenanceWindowCard.jsx`
- Modify: `apps/web/src/features/maintenance/components/MaintenanceWindowCard.css`
- Modify: `apps/web/src/features/maintenance/components/MaintenanceWindowList.jsx`
- Modify: `apps/web/src/features/maintenance/components/MaintenanceWindowList.css`
- Test: `apps/web/tests/MaintenanceHomePage.test.jsx`
- Test: `tests/web/maintenanceWindowList.test.jsx`

- [ ] **Step 1: Inspect dirty maintenance files**

Run:

```bash
git status --short apps/web/src/features/maintenance tests/web/maintenanceWindowList.test.jsx
git diff -- apps/web/src/features/maintenance/components/MaintenanceWindowCard.jsx apps/web/src/features/maintenance/components/MaintenanceWindowCard.css apps/web/src/features/maintenance/pages/MaintenanceHomePage.css tests/web/maintenanceWindowList.test.jsx
```

Expected: preserve pre-existing edits.

- [ ] **Step 2: Add dashboard/schedule tests**

Cover:

- dashboard follows `Preventive Maintenance Dashboard`
- overdue/attention states use semantic badges
- schedule rows/cards expose assignment, due date, checklist progress, and action state
- empty and error states are contextual

- [ ] **Step 3: Run maintenance dashboard tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/MaintenanceHomePage.test.jsx
pnpm test -- tests/web/maintenanceWindowList.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 4: Implement maintenance dashboard and schedule**

Apply Stitch maintenance layout:

- status summary band
- schedule/overdue panels
- dense maintenance window cards
- clear assignment and progress indicators
- consistent modal/action pending states

- [ ] **Step 5: Run maintenance dashboard tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/MaintenanceHomePage.test.jsx
pnpm test -- tests/web/maintenanceWindowList.test.jsx
```

Expected: PASS.

### Task 5.2: Revamp Maintenance Admin Pages And Modals

**Files:**
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceConfigPage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/MaintenanceConfigPage.css`
- Modify: `apps/web/src/features/maintenance/pages/ChecklistManagementPage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/AssignmentRulesPage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/AssignmentRulesPage.css`
- Modify: `apps/web/src/features/maintenance/pages/MyMaintenanceTasksPage.jsx`
- Modify: `apps/web/src/features/maintenance/pages/MyMaintenanceTasksPage.css`
- Modify: `apps/web/src/features/maintenance/components/*.jsx`
- Modify: `apps/web/src/features/maintenance/components/*.css`
- Test: `apps/web/tests/maintenanceConfigPage.test.jsx`
- Test: `apps/web/tests/useMaintenanceConfig.test.jsx`
- Test: `tests/web/maintenanceCompletionModal.test.jsx`
- Test: `tests/web/maintenanceScheduleGeneration.test.js`

- [ ] **Step 1: Add admin/modal tests**

Cover:

- config forms use shared form controls
- checklist management uses compact list/table surfaces
- assignment rules expose validation errors near fields
- completion and generation modals use consistent pending/error/success states

- [ ] **Step 2: Run maintenance admin tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/maintenanceConfigPage.test.jsx apps/web/tests/useMaintenanceConfig.test.jsx
pnpm test -- tests/web/maintenanceCompletionModal.test.jsx tests/web/maintenanceScheduleGeneration.test.js
```

Expected: new tests fail before implementation.

- [ ] **Step 3: Implement maintenance admin alignment**

Keep maintenance behavior intact. Replace visual drift with shared panels, forms, tables, badges, and state blocks.

- [ ] **Step 4: Run full maintenance tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/MaintenanceHomePage.test.jsx apps/web/tests/maintenanceConfigPage.test.jsx apps/web/tests/useMaintenanceConfig.test.jsx
pnpm test -- tests/web/maintenanceWindowList.test.jsx tests/web/maintenanceCompletionModal.test.jsx tests/web/maintenanceScheduleGeneration.test.js
```

Expected: PASS.

- [ ] **Step 5: Visually verify maintenance routes**

Run the app and compare `/maintenance`, `/maintenance/schedule`, `/maintenance/config`, `/maintenance/checklists`, and `/maintenance/my-tasks` against the maintenance Stitch blueprint. Save screenshots under `/tmp/jks-it-hub-visual-checks/chunk-5-maintenance/`.

- [ ] **Step 6: Commit maintenance phase**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): revamp preventive maintenance dashboard"
```

Expected: commit includes only maintenance files and tests.

---

## Chunk 6: Admin, Overview, Login, And Final Sweep

### Task 6.1: Revamp Dashboard, System Overview, Audit, And Notifications

**Files:**
- Modify: `apps/web/src/features/users/home-page.jsx`
- Modify: `apps/web/src/features/system-configs/SystemManagementPage.jsx`
- Modify: `apps/web/src/features/system-configs/components/*`
- Modify: `apps/web/src/features/audit/audit-log-page.jsx`
- Modify: `apps/web/src/features/notifications/**/*`
- Test: `apps/web/tests/HomePage.test.jsx`
- Test: `apps/web/tests/SystemManagementPage.test.jsx`
- Test: `apps/web/tests/SystemManagementLayoutStyles.test.jsx`
- Test: `apps/web/tests/SystemManagementThemeStyles.test.jsx`
- Test: `apps/web/tests/AuditLogPage.test.jsx`
- Test: `apps/web/tests/NotificationStyles.test.jsx`

- [ ] **Step 1: Inspect dirty admin, overview, and login files**

Run:

```bash
git status --short apps/web/src/features/users/home-page.jsx apps/web/src/features/users/login-page.jsx apps/web/src/features/system-configs apps/web/src/features/audit apps/web/src/features/notifications apps/web/src/app.jsx
git diff -- apps/web/src/features/users/home-page.jsx apps/web/src/features/users/login-page.jsx apps/web/src/features/system-configs apps/web/src/features/audit apps/web/src/features/notifications apps/web/src/app.jsx
```

Expected: preserve pre-existing edits.

- [ ] **Step 2: Add overview/admin tests**

Cover:

- dashboard uses module launcher and overview patterns from Stitch
- systems/admin pages use dense form/list surfaces
- audit rows are scan-friendly with consistent metadata styling
- notifications use shared status and list patterns

- [ ] **Step 3: Run admin/overview tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/HomePage.test.jsx apps/web/tests/SystemManagementPage.test.jsx apps/web/tests/SystemManagementLayoutStyles.test.jsx apps/web/tests/SystemManagementThemeStyles.test.jsx apps/web/tests/AuditLogPage.test.jsx apps/web/tests/NotificationStyles.test.jsx
```

Expected: new tests fail before implementation.

- [ ] **Step 4: Implement Stitch overview/admin surfaces**

Use `IT Operations Dashboard` for `/`, `System Overview Dashboard` for `/systems`, and `Approval Oversight Dashboard` for approval/admin patterns:

- module launcher stays operational, not marketing-like
- system/admin controls follow shared form/list patterns
- audit and notifications use compact rows and contextual states
- copy remains task-oriented for IT operators/admins

- [ ] **Step 5: Run admin/overview tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/HomePage.test.jsx apps/web/tests/SystemManagementPage.test.jsx apps/web/tests/SystemManagementLayoutStyles.test.jsx apps/web/tests/SystemManagementThemeStyles.test.jsx apps/web/tests/AuditLogPage.test.jsx apps/web/tests/NotificationStyles.test.jsx
```

Expected: PASS.

### Task 6.2: Revamp Login And Cross-Module Consistency

**Files:**
- Modify: `apps/web/src/app.jsx`
- Modify: `apps/web/src/features/users/login-page.jsx`
- Read only: `apps/web/src/styles/index.css`
- Read only: feature CSS from previous chunks for consistency audit
- Test: `apps/web/tests/HomePage.test.jsx`
- Test: `apps/web/tests/WorkspaceLayout.test.jsx`

- [ ] **Step 1: Add login and final consistency tests**

Cover:

- login page uses Stitch `Login Page` blueprint
- unauthenticated route still redirects correctly
- app shell does not show old header patterns on login
- no obvious old token names are used as primary styling hooks where canonical tokens exist

- [ ] **Step 2: Run login/final tests**

Run:

```bash
pnpm --filter web test -- apps/web/tests/HomePage.test.jsx apps/web/tests/WorkspaceLayout.test.jsx
```

Expected: new assertions fail before implementation if old login/header patterns remain.

- [ ] **Step 3: Implement login and consistency sweep**

Apply Stitch login design:

- precise branded login surface
- operational copy, not marketing hero copy
- clear form errors and pending sign-in state
- no decorative gradients or oversized landing composition

Then scan feature CSS for outdated colors/radii/shadows and record any remaining token drift as follow-up work.

Do not edit previous chunks' feature files in this task. If the scan finds cross-module drift outside `apps/web/src/app.jsx` or `apps/web/src/features/users/login-page.jsx`, record a follow-up item instead of changing ownership boundaries.

- [ ] **Step 4: Run full web test suite**

Run:

```bash
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 5: Build web app**

Run:

```bash
pnpm --filter web build
```

Expected: build succeeds.

- [ ] **Step 6: Visual verification**

Run local dev server:

```bash
pnpm --filter web dev
```

Open the local URL and compare:

- `/login` against Stitch `Login Page`
- `/` against Stitch `IT Operations Dashboard`
- `/systems` against Stitch `System Overview Dashboard`
- `/requests` against Stitch `Procurement & Purchase Requests`
- `/onboarding` against Stitch `IT Onboarding Checklist`
- `/users/directory` and a user detail page against Stitch `User Directory` and `User Profile & Security`
- `/maintenance` against Stitch `Preventive Maintenance Dashboard`
- `/requests/approvals` against Stitch `Approval Oversight Dashboard`

Expected: screens are visually consistent with Stitch, responsive layouts do not overlap, text fits, and core interactions still work.

- [ ] **Step 7: Commit final sweep**

Run:

```bash
git status --short
git diff --name-only
# Stage only current-task hunks/files according to the Safe Commit Rule above.
git diff --cached --name-only
git commit -m "feat(web): finish stitch admin overview and login revamp"
```

Expected: final UI revamp commit includes only admin, overview, login, final consistency, and related tests.

---

## Final Verification

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS or documented unrelated pre-existing failure.

- [ ] **Step 2: Run web build**

Run:

```bash
pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional changes remain.

- [ ] **Step 4: Prepare final summary**

Include:

- chunks completed
- commits created
- tests run and results
- any deviations from the Stitch blueprint
- any user-owned dirty files that were preserved
