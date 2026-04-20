# Workspace UI Review

**Audited:** 2026-04-16
**Baseline:** Abstract 6-pillar standards
**Scope:** `apps/web` workspace shell, main user surfaces, main admin surfaces
**Screenshots:** Captured at `.planning/ui-reviews/workspace-20260416-121451/`
**Phase Context:** No GSD phase artifacts found; this is a workspace-level audit

---

## Overall Verdict

The app is only partially following a coherent UI standard. The workspace shell, dashboard, users list, request review, and approvals pages share a clear tokenized desktop pattern, but the user detail and audit-log surfaces still rely on an older visual system with different headers, buttons, spacing, and state treatments. That split is visible enough that the product does not yet feel like one complete admin workspace.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| Copywriting | 2/4 | Core page copy is serviceable, but raw backend labels and generic actions still leak into primary surfaces. |
| Visuals | 2/4 | The shell and queue pages are coherent; detail/admin legacy pages break the visual language. |
| Color | 2/4 | Good token foundation, but major surfaces still bypass it with hardcoded legacy button and field styles. |
| Typography | 2/4 | One font family is used, but the scale and weights are too fragmented to read as deliberate. |
| Spacing | 3/4 | Workspace pages mostly hold a usable rhythm, though legacy pages widen the spacing/radius scale. |
| Experience Design | 2/4 | Queue pages handle states well; detail and audit pages fall back to plain text states and uneven mobile treatment. |

**Overall: 13/24**

---

## Top 5 Findings

1. **Two competing UI systems are live on the main surfaces** — users move from a tokenized workspace shell into legacy page chrome and buttons — unify `user-detail` and `audit-log-page` onto `WorkspacePageHeader`, `DataStateBlock`, and `workspace-inline-*` primitives.  
   Refs: `apps/web/src/features/users/home-page.jsx:121`, `apps/web/src/features/users/users-list-page.jsx:271`, `apps/web/src/features/requests/pages/ReviewRequestsPage.jsx:132`, `apps/web/src/features/requests/pages/AdminApprovalPage.jsx:83`, `apps/web/src/features/users/user-detail-page.jsx:151`, `apps/web/src/features/audit/audit-log-page.jsx:133`, `apps/web/src/shared/workspace/workspace.css:354`, `apps/web/src/styles/index.css:460`, `apps/web/src/styles/index.css:772`

2. **State handling is inconsistent on detail/admin legacy pages** — some pages offer actionable, styled empty/error/loading states while others drop to plain text with no recovery affordance — replace legacy `status-text`/`status-block` returns with `DataStateBlock` and add retry actions where refetch exists.  
   Refs: `apps/web/src/shared/workspace/DataStateBlock.jsx:3`, `apps/web/src/shared/workspace/workspace.css:866`, `apps/web/src/features/users/user-detail-page.jsx:110`, `apps/web/src/features/users/user-detail-page.jsx:127`, `apps/web/src/features/users/user-detail-page.jsx:281`, `apps/web/src/features/audit/audit-log-page.jsx:98`, `apps/web/src/features/audit/audit-log-page.jsx:115`, `apps/web/src/features/audit/audit-log-page.jsx:273`

3. **Copy leaks raw system vocabulary into user-facing views** — roles, statuses, LDAP field keys, and audit metadata are rendered as backend-shaped strings instead of curated labels — normalize these values before rendering and group low-value technical fields behind expandable detail sections.  
   Refs: `apps/web/src/features/users/user-detail-page.jsx:198`, `apps/web/src/features/users/user-detail-page.jsx:202`, `apps/web/src/features/users/user-detail-page.jsx:219`, `apps/web/src/features/audit/audit-log-page.jsx:20`, `apps/web/src/features/audit/audit-log-page.jsx:153`, `apps/web/src/features/audit/audit-log-page.jsx:237`

4. **Responsive treatment is uneven across the audited admin surfaces** — request review and approval tables get mobile card conversions, but the audit log remains a wide desktop table and the detail page still depends on dense field rows — apply the same mobile row-to-card pattern to audit logs and simplify the detail layout below tablet widths.  
   Refs: `apps/web/src/features/requests/pages/ReviewRequestsPage.css:41`, `apps/web/src/features/requests/pages/AdminApprovalPage.css:29`, `apps/web/src/styles/index.css:812`, `apps/web/src/styles/index.css:952`, `apps/web/src/styles/index.css:639`, `apps/web/src/styles/index.css:671`

5. **Color and component token discipline is only partially enforced** — the shell uses semantic tokens well, but legacy buttons, inputs, and audit text still hardcode values and reintroduce alternate component patterns — consolidate on semantic tokens and remove duplicate `.btn-*` styling for core workspace surfaces.  
   Refs: `apps/web/src/styles/index.css:3`, `apps/web/src/styles/index.css:60`, `apps/web/src/styles/index.css:64`, `apps/web/src/styles/index.css:772`, `apps/web/src/styles/index.css:846`, `apps/web/src/styles/index.css:894`, `apps/web/src/shared/workspace/workspace.css:901`

---

## Residual Uncertainty

Screenshots were captured successfully, but I did not walk a seeded authenticated user/admin session during capture. The rendered scoring for role-specific shells is therefore based primarily on source inspection plus shared CSS, not live interaction testing of logged-in flows.

---

## Files Audited

- `apps/web/src/shared/workspace/WorkspaceLayout.jsx`
- `apps/web/src/shared/workspace/workspace.css`
- `apps/web/src/shared/workspace/WorkspacePageHeader.jsx`
- `apps/web/src/shared/workspace/DataStateBlock.jsx`
- `apps/web/src/shared/ui/ThemeToggle/ThemeToggle.jsx`
- `apps/web/src/features/notifications/components/NotificationBell.jsx`
- `apps/web/src/features/users/home-page.jsx`
- `apps/web/src/features/users/users-list-page.jsx`
- `apps/web/src/features/users/user-detail-page.jsx`
- `apps/web/src/features/requests/pages/ReviewRequestsPage.jsx`
- `apps/web/src/features/requests/pages/ReviewRequestsPage.css`
- `apps/web/src/features/requests/pages/AdminApprovalPage.jsx`
- `apps/web/src/features/requests/pages/AdminApprovalPage.css`
- `apps/web/src/features/audit/audit-log-page.jsx`
- `apps/web/src/styles/index.css`
