# LDAP Sync Lightweight UI And MVP Gap Design

Date: 2026-05-11

## Context

The MVP verification found that LDAP sync, user credential generation, IMAP password storage, and audit infrastructure mostly exist, but the user experience and audit trail have gaps:

- LDAP sync is triggered by a large panel button, not a lightweight directory action.
- Page refresh loads latest sync status but does not auto-sync stale or missing data.
- New LDAP users are counted, but individual new users are not audited.
- Sync completion does not show a targeted toast or activity entry identifying new users.
- The user list can remain stale after sync completion unless manually refreshed.
- The IMAP generator has a "Set as active" checkbox that is visually present but must be wired into save behavior.

The UI should follow the Stitch project `IT Operations & Asset Portal`: dense IT operations UI, Inter typography, slate neutrals, 4px base rhythm, subtle borders, minimal depth, and table-first workflows.

## Design Goals

- Reduce heavy card feel without banning grouped surfaces entirely.
- Move LDAP sync into the directory toolbar as a compact icon action.
- Make new-user sync events visible through audit logs, toast, and lightweight activity chips.
- Keep user directory focused on search, filters, table scanning, and fast operations.
- Make IMAP generator feel like one connected workbench instead of separate heavy cards.
- Preserve current route and API patterns where possible.

## Visual Direction

Use flat operational bands and connected workspaces instead of elevated cards.

- No shadows on main directory and sync surfaces.
- Prefer 1px borders, horizontal dividers, and subtle surface tinting.
- Use 4px radius for controls and 8px maximum for larger grouped surfaces.
- Keep metrics compact and inline.
- Avoid nested cards.
- Keep tables as the primary visual anchor.

## Users Directory UI

The current LDAP sync panel should be removed from the page body.

LDAP sync moves into the table toolbar:

```text
Search | Role | Status | Sync icon + status dot + Last synced | Export
```

The sync control consists of:

- Refresh icon button.
- Status dot: idle, running, failed.
- Short timestamp: `Last synced 13:42`.
- Optional activity chip after completion: `+3 new users`.

The sync button states:

- Idle: refresh icon, tooltip `Sync LDAP`.
- Running: spinner or rotating refresh icon, tooltip `LDAP sync running`.
- Failed: warning status dot and tooltip with last error.
- Disabled only while request is actively starting; a running sync should show state rather than look broken.

When new users are created, show:

- Toast: `3 new LDAP users synced`.
- Toast/body preview: first few usernames.
- Action link: `View audit`.
- Inline chip near sync status: `+3 new users`.

The chip links to filtered audit logs for `user.ldap_create`.

## LDAP Sync Data Flow

On Users Directory mount:

1. Fetch latest sync status.
2. If no sync exists or latest completed sync is stale, trigger `POST /ldap/sync`.
3. If the server returns `409`, treat it as "sync already running" and continue listening.
4. Subscribe to LDAP sync SSE.
5. On `started`, update status dot and icon state.
6. On `completed`, update sync status, show toast when `createdCount > 0`, and invalidate user list queries.
7. On `failed`, show failed state and expose error text through tooltip/inline message.

Manual sync via icon uses the same flow.

## Backend Audit Additions

When LDAP sync creates a user, write one audit row per new user:

- `action`: `user.ldap_create`
- `actorUserId`: `null`
- `entityType`: `user`
- `entityId`: created user id
- `metadata`: username, LDAP DN, sync run id, and selected LDAP attributes safe for display

The existing `user.ldap_update` audit should remain unchanged.

User detail history should include `user.ldap_create` so each user has an origin event before later LDAP updates and credential events.

## Sync Summary Payload

The sync run should expose a compact new-user summary for UI feedback.

Recommended payload shape:

```json
{
  "createdCount": 3,
  "createdUsers": [
    { "id": "user-1", "username": "ali" },
    { "id": "user-2", "username": "sara" },
    { "id": "user-3", "username": "kumar" }
  ],
  "createdUsersHasMore": false
}
```

Cap `createdUsers` to a small number, such as 5. Full tracking belongs in audit logs, not SSE payloads.

## IMAP Generator UI

Replace separate panel cards with one connected workbench:

- Left column: user resolver.
- Center column: LDAP/manual field grid.
- Right column: sticky live preview rail.

Use column dividers, not boxed cards. The preview rail may use a subtle tinted background, but no shadow.

Manual user creation should become an inline form area:

- Username, defaulted from manual email.
- Role, default `requester`.
- Status, default `active`.

The `Set as active` checkbox must be stateful and pass `setActive` to the save API.

## Error Handling

- `409 Sync already running`: show running state, no error toast.
- Sync start failure: toast error and keep prior status.
- Sync execution failure: failed status dot, tooltip with error, and optional inline text under toolbar on directory page.
- SSE disconnect: keep UI usable, fall back to polling while sync is running.
- Audit write failure for new users should fail the sync only if current audit policy requires strict audit integrity. Otherwise, log server error and include warning metadata. Prefer strict audit for MVP traceability.

## Testing Plan

Backend tests:

- LDAP sync creates `user.ldap_create` audit rows for new users.
- LDAP sync still creates `user.ldap_update` rows for changed existing users.
- Sync summary includes capped created-user preview.
- `GET /users/:id/audit-logs` includes `user.ldap_create`.
- `409` sync-in-progress response remains unchanged.

Frontend tests:

- Users Directory auto-starts sync when latest sync is missing or stale.
- Sync icon triggers manual sync.
- `409` shows running state, not error.
- Completed sync invalidates user list queries.
- Created users show toast and audit chip.
- Failed sync shows warning state.
- IMAP `Set as active` checkbox sends `setActive`.

Visual checks:

- Directory page has no large LDAP sync card.
- Toolbar sync icon is visible and has accessible label/tooltip.
- IMAP generator reads as one connected workbench.
- Light and dark themes retain AA contrast.
- Mobile layout keeps sync action reachable without crowding filters.

## Out Of Scope

- Rebuilding the entire workspace layout.
- Replacing all cards across the product.
- Changing authentication away from LDAP.
- Storing local login passwords for LDAP users.
- Full audit dashboard redesign beyond adding filters/links for `user.ldap_create`.

