# LDAP Sync Lightweight UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heavy LDAP sync card with a lightweight directory toolbar sync action, add auditable new-user tracking, refresh user data after sync, and tighten the IMAP generator workbench.

**Architecture:** Keep existing Fastify routes and React Query patterns. Backend sync remains owned by `apps/api/src/features/ldap/syncService.js`; it gains per-created-user audit rows and compact created-user summary data. Frontend moves LDAP sync UX into a reusable toolbar control inside the Users Directory and uses existing SSE/query invalidation patterns.

**Tech Stack:** Fastify, Prisma, React 19, React Query, Vitest, Node test runner, existing CSS variables, Stitch `IT Operations & Asset Portal` design direction.

---

## File Structure

Backend:

- Modify: `apps/api/src/features/ldap/syncService.js`
  - Track created users during a sync run.
  - Write `user.ldap_create` audit rows.
  - Serialize compact created-user summary.
- Modify: `apps/api/src/features/users/routes.js`
  - Include `user.ldap_create` in per-user audit history.
- Test: `tests/api/ldap-sync.test.mjs`
  - New-user audit and summary coverage.
- Test: `tests/api/users_history.test.mjs` or `tests/api/users-directory.test.mjs`
  - Per-user history includes LDAP create entries.

Frontend:

- Modify: `apps/web/src/features/users/ldap-sync-api.js`
  - Preserve current API calls; add helper for stale detection only if useful.
- Modify: `apps/web/src/features/users/ldap-sync-panel.jsx`
  - Replace panel UI with toolbar-friendly control or extract into a new component.
- Modify: `apps/web/src/features/users/users-list-page.jsx`
  - Remove `dashboard-sync-panel`.
  - Place sync control in table toolbar beside filters.
  - Invalidate users query after sync completes.
- Modify: `apps/web/src/features/credentials/imap/ImapPreviewInspector.jsx`
  - Wire `setActive` checkbox state via props.
- Modify: `apps/web/src/features/credentials/imap/ImapGeneratorPage.jsx`
  - Hold `setActive` state and pass it to save payload.
  - Optionally expose manual username/role/status if in scope.
- Modify: `apps/web/src/features/credentials/imap/ImapGeneratorPage.css`
  - Convert panel/card styling into connected workbench surfaces.
- Modify: `apps/web/src/styles/index.css`
  - Add lightweight sync toolbar/control styles.
- Modify: `apps/web/src/shared/workspace/workspace.css`
  - Remove or bypass heavy sync-panel card styles for Users Directory.
- Test: `apps/web/tests/UsersListPageStates.test.jsx`
  - Sync toolbar placement and state behavior.
- Test: `apps/web/tests/ImapGeneratorPage.test.jsx`
  - `setActive` checkbox payload.

Docs:

- Reference: `docs/superpowers/specs/2026-05-11-ldap-sync-lightweight-ui-design.md`
- Optional update: `docs/live-updates.md` if LDAP SSE payload shape changes in a public way.

---

## Chunk 1: Backend LDAP Created-User Audit And Summary

### Task 1: Add failing sync tests for created-user audit

**Files:**
- Modify: `tests/api/ldap-sync.test.mjs`
- Modify later: `apps/api/src/features/ldap/syncService.js`

- [ ] **Step 1: Write failing test**

Add a test near existing runner tests:

```js
test("manual sync writes audit rows for newly created LDAP users", async () => {
  const auditEntries = [];
  const upserted = [];
  const syncRepo = createInMemorySyncRepo();
  const runner = createLdapSyncRunner({
    config: baseConfig,
    ldapService: {
      searchEntries: async () => [
        { dn: "uid=newuser,dc=example,dc=com", uid: "newuser", cn: "New User", mail: "new@example.com" }
      ]
    },
    syncRepo,
    userRepo: {
      findUsersByUsernames: async () => [],
      upsertUserFromLdap: async (data) => {
        upserted.push(data);
        return { id: "created-user-1", username: data.username, ldapDn: data.ldapDn };
      }
    },
    auditRepo: {
      createAuditLog: async (entry) => {
        auditEntries.push(entry);
        return entry;
      }
    }
  });

  const run = await runner.startScheduledSync();

  assert.equal(run.createdCount, 1);
  assert.equal(auditEntries.some((entry) => entry.action === "user.ldap_create"), true);
  const createdAudit = auditEntries.find((entry) => entry.action === "user.ldap_create");
  assert.equal(createdAudit.entityId, "created-user-1");
  assert.equal(createdAudit.metadata.username, "newuser");
  assert.equal(createdAudit.metadata.ldapDn, "uid=newuser,dc=example,dc=com");
  assert.equal(createdAudit.metadata.syncRunId, run.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs
```

Expected: FAIL because `user.ldap_create` is not written.

- [ ] **Step 3: Implement created-user audit**

In `apps/api/src/features/ldap/syncService.js`, change the new-user branch so `upsertUserFromLdap` result is captured:

```js
const syncedUser = await userRepo.upsertUserFromLdap({
  username,
  ldapDn: entry.dn,
  ldapAttributes: newLdapAttributes,
  syncedAt: new Date()
});

if (!existingUser && auditRepo?.createAuditLog && syncedUser?.id) {
  await auditRepo.createAuditLog({
    action: "user.ldap_create",
    actorUserId: null,
    entityType: "user",
    entityId: syncedUser.id,
    metadata: {
      username,
      ldapDn: entry.dn,
      syncRunId: run.id
    }
  });
}
```

Keep existing `user.ldap_update` behavior.

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/ldap/syncService.js tests/api/ldap-sync.test.mjs
git commit -m "feat: audit ldap-created users"
```

### Task 2: Add created-user summary to sync run serialization

**Files:**
- Modify: `apps/api/src/features/ldap/syncService.js`
- Modify: `tests/api/ldap-sync.test.mjs`

- [ ] **Step 1: Write failing test**

Add a test that expects `serializeSyncRun` output to include compact `createdUsers` if the run has those transient fields:

```js
test("serializeSyncRun includes compact created user summary", () => {
  const run = {
    id: "run-1",
    status: "completed",
    startedAt: new Date("2026-05-11T00:00:00.000Z"),
    completedAt: new Date("2026-05-11T00:00:01.000Z"),
    processedCount: 3,
    createdCount: 2,
    updatedCount: 0,
    skippedCount: 1,
    createdUsers: [
      { id: "u1", username: "ali" },
      { id: "u2", username: "sara" }
    ],
    createdUsersHasMore: false
  };

  const payload = serializeSyncRun(run);

  assert.deepEqual(payload.createdUsers, [
    { id: "u1", username: "ali" },
    { id: "u2", username: "sara" }
  ]);
  assert.equal(payload.createdUsersHasMore, false);
});
```

- [ ] **Step 2: Run test to verify fail**

Run:

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs
```

Expected: FAIL because serialization omits created-user summary.

- [ ] **Step 3: Implement summary fields**

In `serializeSyncRun`, add:

```js
createdUsers: Array.isArray(run.createdUsers) ? run.createdUsers : [],
createdUsersHasMore: Boolean(run.createdUsersHasMore)
```

Inside `runSync`, collect up to 5 created users:

```js
const createdUsers = [];
let createdUsersHasMore = false;
```

After a new user upsert:

```js
if (syncedUser?.id) {
  if (createdUsers.length < 5) {
    createdUsers.push({ id: syncedUser.id, username: syncedUser.username ?? username });
  } else {
    createdUsersHasMore = true;
  }
}
```

When updating sync run, include transient fields if repository accepts them. If Prisma repo rejects unknown columns, keep summary attached only to the returned object:

```js
const completedRun = await syncRepo.updateSyncRun(run.id, { ... });
return {
  ...completedRun,
  createdUsers,
  createdUsersHasMore
};
```

- [ ] **Step 4: Run tests**

Run:

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/ldap/syncService.js tests/api/ldap-sync.test.mjs
git commit -m "feat: summarize ldap-created users"
```

### Task 3: Include LDAP create in per-user history

**Files:**
- Modify: `apps/api/src/features/users/routes.js`
- Modify: `tests/api/users_history.test.mjs` or `tests/api/users-directory.test.mjs`

- [ ] **Step 1: Write failing route test**

Add or update a test so `GET /users/:id/audit-logs` includes `user.ldap_create`.

Expected history item:

```js
assert.equal(history.some((item) => item.action === "user.ldap_create"), true);
```

- [ ] **Step 2: Run test to verify fail**

Run the selected test:

```bash
node --env-file=.env --test tests/api/users_history.test.mjs
```

Expected: FAIL because route action filter omits `user.ldap_create`.

- [ ] **Step 3: Implement route support**

In `apps/api/src/features/users/routes.js`, add `"user.ldap_create"` to the actions array for `findAuditLogsByEntity`.

When processing logs, add a history item for `user.ldap_create`:

```js
history.push({
  id: log.id,
  timestamp: log.createdAt,
  field: "account",
  oldValue: null,
  newValue: "Created from LDAP sync",
  actor: actorName,
  action: log.action,
  type: "lifecycle_event",
  metadata: log.metadata
});
```

- [ ] **Step 4: Run test**

```bash
node --env-file=.env --test tests/api/users_history.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/users/routes.js tests/api/users_history.test.mjs
git commit -m "feat: show ldap create history"
```

---

## Chunk 2: Users Directory Lightweight Sync Toolbar

### Task 4: Add frontend test for toolbar sync control

**Files:**
- Modify: `apps/web/tests/UsersListPageStates.test.jsx`
- Modify later: `apps/web/src/features/users/users-list-page.jsx`
- Modify later: `apps/web/src/features/users/ldap-sync-panel.jsx`

- [ ] **Step 1: Write failing UI test**

Update the mock for `ldap-sync-panel.jsx` or render real component if practical. Test expectations:

```jsx
expect(screen.queryByText("LDAP Synchronization")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: /sync ldap/i })).toBeInTheDocument();
```

If using real component, mock `EventSource` and API fetches.

- [ ] **Step 2: Run test to verify fail**

Run:

```bash
pnpm --dir apps/web test -- --run tests/UsersListPageStates.test.jsx
```

Expected: FAIL because current page still renders the sync panel/card.

- [ ] **Step 3: Refactor sync component shape**

In `apps/web/src/features/users/ldap-sync-panel.jsx`:

- Rename export internally to toolbar semantics if keeping same file.
- Render a compact control:

```jsx
<div className={`ldap-sync-toolbar ldap-sync-toolbar-${status}`}>
  <button
    type="button"
    className="ldap-sync-icon-button"
    aria-label={isRunning ? "LDAP sync running" : "Sync LDAP"}
    title={isRunning ? "LDAP sync running" : "Sync LDAP"}
    onClick={() => mutation.mutate()}
    disabled={mutation.isPending}
  >
    <span aria-hidden="true">{isRunning ? "..." : "↻"}</span>
  </button>
  <span className="ldap-sync-status-dot" aria-hidden="true" />
  <span className="ldap-sync-timestamp">{formatTimestamp(lastUpdated)}</span>
  {data?.createdCount > 0 ? (
    <a className="ldap-sync-created-chip" href="/audit-logs?action=user.ldap_create">
      +{data.createdCount} new
    </a>
  ) : null}
</div>
```

Use a lucide icon if the project already has lucide installed. If not, use a CSS/Unicode fallback only temporarily and prefer existing icon patterns.

- [ ] **Step 4: Move sync into Users table toolbar**

In `apps/web/src/features/users/users-list-page.jsx`:

- Remove the `dashboard-sync-panel users-sync-panel` section.
- Add `<LdapSyncPanel />` inside `.users-table-toolbar` near filters/export.
- Keep empty-state guidance, but update copy to mention toolbar sync icon.

- [ ] **Step 5: Add lightweight CSS**

In `apps/web/src/styles/index.css` or `apps/web/src/shared/workspace/workspace.css`, add:

```css
.ldap-sync-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--touch-target-min, 44px);
  color: var(--text-muted);
}

.ldap-sync-icon-button {
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

.ldap-sync-icon-button:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.ldap-sync-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--text-muted);
}

.ldap-sync-toolbar-started .ldap-sync-status-dot {
  background: var(--info);
}

.ldap-sync-toolbar-completed .ldap-sync-status-dot {
  background: var(--success);
}

.ldap-sync-toolbar-failed .ldap-sync-status-dot {
  background: var(--error);
}

.ldap-sync-created-chip {
  border: 1px solid var(--success-border);
  border-radius: 999px;
  padding: 0.2rem 0.45rem;
  color: var(--success);
  text-decoration: none;
}
```

Use existing theme tokens where names differ.

- [ ] **Step 6: Run test**

```bash
pnpm --dir apps/web test -- --run tests/UsersListPageStates.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/users/ldap-sync-panel.jsx apps/web/src/features/users/users-list-page.jsx apps/web/src/styles/index.css apps/web/src/shared/workspace/workspace.css apps/web/tests/UsersListPageStates.test.jsx
git commit -m "feat: move ldap sync into toolbar"
```

### Task 5: Add auto-sync and query invalidation behavior

**Files:**
- Modify: `apps/web/src/features/users/ldap-sync-panel.jsx`
- Modify: `apps/web/tests/UsersListPageStates.test.jsx`

- [ ] **Step 1: Write failing tests**

Cover:

- Missing latest sync triggers one `POST /ldap/sync`.
- `409` does not show error.
- Completed event invalidates users list.

Mock `apiFetch`, `EventSource`, and query client invalidation if test already wraps QueryClient.

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm --dir apps/web test -- --run tests/UsersListPageStates.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement stale/missing auto-sync**

In `ldap-sync-panel.jsx`:

- Add `useRef(false)` guard so React Strict Mode does not double-trigger.
- After latest query settles:

```js
const shouldAutoSync = !data || isSyncStale(data.completedAt ?? data.startedAt);
if (shouldAutoSync && !autoSyncStartedRef.current && !isRunning) {
  autoSyncStartedRef.current = true;
  mutation.mutate(undefined, {
    onError: (error) => {
      if (error?.status === 409 || /currently in progress/i.test(error.message)) {
        queryClient.invalidateQueries({ queryKey: ["ldap-sync-latest"] });
      }
    }
  });
}
```

Keep stale threshold conservative, for example 15 minutes, or add config constant near top:

```js
const LDAP_SYNC_STALE_MS = 15 * 60 * 1000;
```

- [ ] **Step 4: Invalidate users on completed SSE**

In SSE handler:

```js
if (run?.status === "completed") {
  queryClient.invalidateQueries({ queryKey: ["users"] });
}
```

Use actual users query key from `users-api` tests. If current code uses multiple keys, invalidate broad prefix.

- [ ] **Step 5: Add toast**

Import existing `useToast`. On completed run with `createdCount > 0`, show:

```js
toast.success(
  `${run.createdCount} new LDAP users synced`,
  formatCreatedUsers(run.createdUsers, run.createdUsersHasMore)
);
```

Guard duplicate toasts by tracking last completed run id.

- [ ] **Step 6: Run tests**

```bash
pnpm --dir apps/web test -- --run tests/UsersListPageStates.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/users/ldap-sync-panel.jsx apps/web/tests/UsersListPageStates.test.jsx
git commit -m "feat: auto refresh ldap directory sync"
```

---

## Chunk 3: IMAP Generator Workbench Tightening

### Task 6: Wire `Set as active` checkbox

**Files:**
- Modify: `apps/web/src/features/credentials/imap/ImapPreviewInspector.jsx`
- Modify: `apps/web/src/features/credentials/imap/ImapGeneratorPage.jsx`
- Modify: `apps/web/tests/ImapGeneratorPage.test.jsx`

- [ ] **Step 1: Write failing test**

In `ImapGeneratorPage.test.jsx`, find save tests and add:

```jsx
await user.click(screen.getByRole("checkbox", { name: /set as active/i }));
await user.click(screen.getByRole("button", { name: /save imap password/i }));

expect(saveImapPassword).toHaveBeenCalledWith(
  expect.objectContaining({ setActive: true })
);
```

- [ ] **Step 2: Run fail**

```bash
pnpm --dir apps/web test -- --run tests/ImapGeneratorPage.test.jsx
```

Expected: FAIL because checkbox is uncontrolled and payload omits `setActive`.

- [ ] **Step 3: Implement controlled checkbox**

In `ImapPreviewInspector.jsx`, accept props:

```js
setActive = false,
onSetActiveChange
```

Render:

```jsx
<input
  type="checkbox"
  checked={setActive}
  onChange={(event) => onSetActiveChange?.(event.target.checked)}
/>
```

In `ImapGeneratorPage.jsx`:

```js
const [setActive, setSetActive] = useState(false);
```

Add to save payload:

```js
payload.setActive = setActive;
```

Pass props to inspector.

- [ ] **Step 4: Run pass**

```bash
pnpm --dir apps/web test -- --run tests/ImapGeneratorPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/credentials/imap/ImapPreviewInspector.jsx apps/web/src/features/credentials/imap/ImapGeneratorPage.jsx apps/web/tests/ImapGeneratorPage.test.jsx
git commit -m "fix: wire imap active save option"
```

### Task 7: Lighten IMAP card styling into connected workbench

**Files:**
- Modify: `apps/web/src/features/credentials/imap/ImapGeneratorPage.css`
- Modify if needed: `apps/web/src/features/credentials/imap/ImapGeneratorPage.jsx`

- [ ] **Step 1: Add visual regression-oriented test if existing style tests support it**

If CSS-focused tests exist, add expectations for workbench class names. Otherwise skip automated CSS test and rely on screenshot/browser verification in Chunk 4.

- [ ] **Step 2: Replace heavy panel CSS**

Change `.imap-generator-panel`:

- Remove `box-shadow`.
- Reduce `border-radius` to `0.5rem` or less.
- For columns inside `.imap-generator-shell`, use connected backgrounds/dividers.

Example direction:

```css
.imap-generator-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.75fr);
  border: 1px solid var(--ui-border-subtle, #d9e1ec);
  border-radius: 0.5rem;
  background: var(--ui-surface-elevated, #fff);
  overflow: clip;
}

.imap-generator-panel {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 1rem;
}

.imap-generator-workbench {
  border-right: 1px solid var(--ui-border-subtle, #d9e1ec);
}

.imap-generator-inspector {
  background: var(--ui-surface-canvas, #f8fafc);
}
```

Avoid cards inside cards.

- [ ] **Step 3: Run targeted web tests**

```bash
pnpm --dir apps/web test -- --run tests/ImapGeneratorPage.test.jsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/credentials/imap/ImapGeneratorPage.css apps/web/src/features/credentials/imap/ImapGeneratorPage.jsx
git commit -m "style: lighten imap generator workbench"
```

---

## Chunk 4: Verification And Polish

### Task 8: Run focused API and web verification

**Files:**
- No code changes expected unless failures require fixes.

- [ ] **Step 1: Run focused API tests**

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs tests/api/users_history.test.mjs tests/api/imap_generator_service.test.mjs tests/api/imap-access.test.mjs
```

Expected: all pass.

- [ ] **Step 2: Run focused web tests**

```bash
pnpm --dir apps/web test -- --run tests/UsersListPageStates.test.jsx tests/ImapGeneratorPage.test.jsx
```

Expected: all pass.

- [ ] **Step 3: Run build if practical**

```bash
pnpm --filter web build
```

Expected: build succeeds.

- [ ] **Step 4: Manual UI check**

Start dev server:

```bash
pnpm --dir apps/web dev
```

Open Users Directory and IMAP Generator. Verify:

- No large LDAP sync card.
- Sync icon appears in toolbar.
- Sync status is understandable without reading docs.
- New-user chip does not crowd filters.
- IMAP workbench has connected layout, no heavy nested card feel.
- Mobile width keeps controls reachable.

- [ ] **Step 5: Final commit if verification-only adjustments were needed**

```bash
git add <changed-files>
git commit -m "test: verify ldap sync lightweight ui"
```

Only commit if files changed during polish.

---

## Execution Notes

- Use existing CSS variables; do not introduce hard-coded palette unless matching existing local patterns.
- Keep Sync API route unchanged: `POST /ldap/sync`, `GET /ldap/sync/latest`, `GET /ldap/sync/stream`.
- Do not store local login passwords; LDAP auth remains source of truth.
- Prefer audit logs for full new-user traceability; keep SSE summary compact.
- Treat unrelated existing full-suite failures separately from this feature.

