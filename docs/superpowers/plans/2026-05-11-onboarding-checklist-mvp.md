# Onboarding Checklist MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build checklist-first onboarding with real manual users, saved checklists, per-item statuses, manual credential entry, and completed-credential text export.

**Architecture:** Keep existing onboarding module boundaries (`schema.js`, `repo.js`, `service.js`, `routes.js`) and add additive DB models for saved checklists and onboarding runs. Preserve legacy department bundle code during this MVP to reduce migration risk, but stop using it from the main UI. Frontend keeps React Query/API module pattern and updates onboarding pages to use Stitch-referenced compact checklist layouts.

**Tech Stack:** Fastify, Prisma/MySQL, Zod, React 19, TanStack Query, Vite/Vitest, Node test runner, Stitch MCP design reference.

---

## UI Design Reference

Use Stitch MCP project:

- Project: `projects/10479808496060796622`
- Title: `IT Operations & Asset Portal`
- Screen: `projects/10479808496060796622/screens/d5183b43c7d14b16bcb78565f7deea8e`
- Screen title: `IT Onboarding Checklist`
- Design system asset shown in project: `assets/cbf5765b62fc400e8d991b5b4954c3ff`

Implementation UI rules from Stitch:

- Dense operational tool, no marketing layout.
- Inter typography, 14px body, compact spacing.
- Slate/cool grey surfaces, white modules, subtle borders, low shadow.
- 4px default radius, 8px max for larger panels.
- Checklist modules use left-aligned controls, primary label, 12px secondary details.
- Status badges use subtle filled background, solid text/border.
- Tables/lists should be scan-first, with stable row height and no layout shift.

During UI implementation, use Stitch as visual reference. If more precision is needed, open the Stitch screen or screenshot before coding.

---

## File Map

Backend:

- Modify: `apps/api/prisma/schema.prisma`
- Add: `apps/api/prisma/migrations/<timestamp>_onboarding_checklist_mvp/migration.sql`
- Modify: `apps/api/src/features/onboarding/schema.js`
- Modify: `apps/api/src/features/onboarding/repo.js`
- Modify: `apps/api/src/features/onboarding/service.js`
- Modify: `apps/api/src/features/onboarding/routes.js`
- Modify: `apps/api/src/features/users/repo.js` only if manual-user helper is cleaner there
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`
- Test: update `tests/api/onboarding_routes.test.mjs` only for route compatibility if needed

Frontend:

- Modify: `apps/web/src/features/onboarding/onboarding-api.js`
- Modify: `apps/web/src/features/onboarding/OnboardingLayout.jsx`
- Modify: `apps/web/src/features/onboarding/pages/CatalogPage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsPage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsEditor.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingHomePage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/NewJoinerPage.jsx`
- Modify: `apps/web/src/features/onboarding/onboarding.css`
- Test: `tests/web/onboardingChecklistMvp.test.jsx`

Docs:

- Modify: `docs/superpowers/specs/2026-05-11-onboarding-checklist-design.md` only if implementation discovers a spec mismatch.

---

## Chunk 1: Backend Data Model

### Task 1: Add Checklist/Run Prisma Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Add: `apps/api/prisma/migrations/<timestamp>_onboarding_checklist_mvp/migration.sql`
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`

- [ ] **Step 1: Write failing schema test**

Create `tests/api/onboarding_checklist_mvp.test.mjs` with a first test that asserts Prisma exposes the new models and item fields.

```js
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

test("onboarding checklist data model supports items, saved checklists, runs, and run items", async () => {
  assert.equal(typeof prisma.onboardingCatalogItem.findMany, "function");
  assert.equal(typeof prisma.onboardingChecklist.findMany, "function");
  assert.equal(typeof prisma.onboardingRun.findMany, "function");
  assert.equal(typeof prisma.onboardingRunItem.findMany, "function");
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: FAIL because new Prisma delegates do not exist.

- [ ] **Step 3: Update Prisma schema**

Add enums:

```prisma
enum OnboardingRunMode {
  existing_user
  manual

  @@map("onboarding_run_mode")
}

enum OnboardingRunStatus {
  in_progress
  completed

  @@map("onboarding_run_status")
}

enum OnboardingItemStatus {
  pending
  completed
  not_required

  @@map("onboarding_item_status")
}
```

Extend `OnboardingCatalogItem`:

```prisma
  hasCredentials Boolean @default(true) @map("has_credentials")
  isActive       Boolean @default(true) @map("is_active")

  checklistItems OnboardingChecklistItem[]
  runItems       OnboardingRunItem[]
```

Add:

```prisma
model OnboardingChecklist {
  id          String   @id @default(uuid()) @db.Char(36) @map("id")
  name        String   @db.VarChar(191) @map("name")
  description String?  @db.Text @map("description")
  isActive    Boolean  @default(true) @map("is_active")
  createdById String?  @db.Char(36) @map("created_by_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  items OnboardingChecklistItem[]

  @@index([isActive], map: "idx_onboarding_checklists_is_active")
  @@index([name], map: "idx_onboarding_checklists_name")
  @@map("onboarding_checklists")
}

model OnboardingChecklistItem {
  id            String   @id @default(uuid()) @db.Char(36) @map("id")
  checklistId   String   @db.Char(36) @map("checklist_id")
  catalogItemId String   @db.Char(36) @map("catalog_item_id")
  position      Int      @default(0) @map("position")
  createdAt     DateTime @default(now()) @map("created_at")

  checklist   OnboardingChecklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  catalogItem OnboardingCatalogItem @relation(fields: [catalogItemId], references: [id], onDelete: Cascade)

  @@unique([checklistId, catalogItemId], map: "uniq_onboarding_checklist_catalog_item")
  @@index([checklistId], map: "idx_onboarding_checklist_items_checklist_id")
  @@index([catalogItemId], map: "idx_onboarding_checklist_items_catalog_item_id")
  @@map("onboarding_checklist_items")
}

model OnboardingRun {
  id          String              @id @default(uuid()) @db.Char(36) @map("id")
  userId      String              @db.Char(36) @map("user_id")
  mode        OnboardingRunMode   @map("mode")
  email       String              @db.VarChar(191) @map("email")
  status      OnboardingRunStatus @default(in_progress) @map("status")
  createdById String?             @db.Char(36) @map("created_by_id")
  createdAt   DateTime            @default(now()) @map("created_at")
  updatedAt   DateTime            @updatedAt @map("updated_at")

  user  User @relation(fields: [userId], references: [id])
  items OnboardingRunItem[]

  @@index([userId], map: "idx_onboarding_runs_user_id")
  @@index([status], map: "idx_onboarding_runs_status")
  @@index([createdAt], map: "idx_onboarding_runs_created_at")
  @@map("onboarding_runs")
}

model OnboardingRunItem {
  id                     String               @id @default(uuid()) @db.Char(36) @map("id")
  runId                  String               @db.Char(36) @map("run_id")
  catalogItemId           String               @db.Char(36) @map("catalog_item_id")
  status                 OnboardingItemStatus @default(pending) @map("status")
  login                  String?              @db.VarChar(191) @map("login")
  password               String?              @db.Text @map("password")
  labelSnapshot           String               @db.VarChar(191) @map("label_snapshot")
  urlSnapshot             String?              @db.Text @map("url_snapshot")
  notesSnapshot           String?              @db.Text @map("notes_snapshot")
  hasCredentialsSnapshot  Boolean              @default(true) @map("has_credentials_snapshot")
  position               Int                  @default(0) @map("position")
  createdAt              DateTime             @default(now()) @map("created_at")
  updatedAt              DateTime             @updatedAt @map("updated_at")

  run         OnboardingRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  catalogItem OnboardingCatalogItem @relation(fields: [catalogItemId], references: [id])

  @@unique([runId, catalogItemId], map: "uniq_onboarding_run_catalog_item")
  @@index([runId], map: "idx_onboarding_run_items_run_id")
  @@index([catalogItemId], map: "idx_onboarding_run_items_catalog_item_id")
  @@index([status], map: "idx_onboarding_run_items_status")
  @@map("onboarding_run_items")
}
```

Also add `onboardingRuns OnboardingRun[]` to `User`.

- [ ] **Step 4: Generate migration**

Run:

```bash
pnpm --filter api exec prisma migrate dev --name onboarding_checklist_mvp
```

If local DB is not available, manually create SQL migration and run:

```bash
pnpm --filter api exec prisma generate
```

- [ ] **Step 5: Run test to verify GREEN**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations tests/api/onboarding_checklist_mvp.test.mjs
git commit -m "feat: add onboarding checklist data model"
```

---

## Chunk 2: Backend Services And Routes

### Task 2: Add Onboarding Item CRUD With Plain Naming

**Files:**
- Modify: `apps/api/src/features/onboarding/schema.js`
- Modify: `apps/api/src/features/onboarding/repo.js`
- Modify: `apps/api/src/features/onboarding/service.js`
- Modify: `apps/api/src/features/onboarding/routes.js`
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`

- [ ] **Step 1: Write failing route test**

Append test:

```js
test("POST /api/v1/onboarding/items creates item with hasCredentials", async () => {
  const app = await createAuthenticatedOnboardingApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/onboarding/items",
    headers: itAuthHeaders(),
    payload: {
      itemKey: "sigma",
      label: "Sigma Access",
      url: "https://sigma.example.com",
      notes: "Use company email",
      hasCredentials: true,
      isActive: true
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.label, "Sigma Access");
  assert.equal(response.json().data.hasCredentials, true);
});
```

Use existing onboarding route test helper patterns from `tests/api/onboarding_routes.test.mjs`.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: FAIL with 404 or validation error.

- [ ] **Step 3: Implement schemas**

Add item schemas:

```js
export const createOnboardingItemSchema = z.object({
  itemKey: itemKeySchema,
  label: z.string().trim().min(1).max(191),
  url: z.string().trim().url().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  hasCredentials: z.boolean().default(true),
  isActive: z.boolean().default(true)
});

export const updateOnboardingItemSchema = createOnboardingItemSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");
```

Keep legacy `createCatalogItemSchema` but map it to include `hasCredentials` default if needed.

- [ ] **Step 4: Implement repo/service methods**

Add or update:

- `listOnboardingItems`
- `createOnboardingItem`
- `updateOnboardingItem`
- `deactivateOnboardingItem`

Map `url` API field to existing DB `loginUrl` for now.

- [ ] **Step 5: Implement routes**

Add endpoints:

- `GET /items`
- `POST /items`
- `PUT /items/:id`
- `DELETE /items/:id`

Prefer soft delete via `isActive = false`.

- [ ] **Step 6: Run test to verify GREEN**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs tests/api/onboarding_routes.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/onboarding tests/api/onboarding_checklist_mvp.test.mjs
git commit -m "feat: add onboarding item endpoints"
```

### Task 3: Add Saved Checklist CRUD

**Files:**
- Modify: `apps/api/src/features/onboarding/schema.js`
- Modify: `apps/api/src/features/onboarding/repo.js`
- Modify: `apps/api/src/features/onboarding/service.js`
- Modify: `apps/api/src/features/onboarding/routes.js`
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`

- [ ] **Step 1: Write failing checklist test**

```js
test("POST /api/v1/onboarding/checklists creates saved checklist with item order", async () => {
  const app = await createAuthenticatedOnboardingApp();
  const itemA = await seedOnboardingItem({ itemKey: "microsoft", label: "Microsoft Account" });
  const itemB = await seedOnboardingItem({ itemKey: "sigma", label: "Sigma Access" });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/onboarding/checklists",
    headers: itAuthHeaders(),
    payload: {
      name: "Standard New Staff",
      description: "Common onboarding access",
      itemIds: [itemA.id, itemB.id],
      isActive: true
    }
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json().data.items.map((item) => item.id), [itemA.id, itemB.id]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: FAIL with 404.

- [ ] **Step 3: Implement checklist schemas**

```js
export const createChecklistSchema = z.object({
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  itemIds: z.array(idSchema).default([]),
  isActive: z.boolean().default(true)
});
```

- [ ] **Step 4: Implement repo/service/routes**

Use transaction to create checklist then `createMany` join rows with `position`.

Endpoints:

- `GET /checklists`
- `POST /checklists`
- `PUT /checklists/:id`
- `DELETE /checklists/:id` soft deactivate

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/onboarding tests/api/onboarding_checklist_mvp.test.mjs
git commit -m "feat: add saved onboarding checklists"
```

### Task 4: Add Onboarding Runs, Manual Real User, And Checklist Application

**Files:**
- Modify: `apps/api/src/features/onboarding/schema.js`
- Modify: `apps/api/src/features/onboarding/repo.js`
- Modify: `apps/api/src/features/onboarding/service.js`
- Modify: `apps/api/src/features/onboarding/routes.js`
- Modify: `apps/api/src/features/users/repo.js`
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`

- [ ] **Step 1: Write failing manual run test**

```js
test("manual onboarding run creates real user with email-derived username", async () => {
  const app = await createAuthenticatedOnboardingApp();
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/onboarding/runs",
    headers: itAuthHeaders(),
    payload: {
      mode: "manual",
      manualIdentity: {
        fullName: "Haziq Afendi",
        email: "haziq.afendi@jkseng.com"
      }
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.email, "haziq.afendi@jkseng.com");
  assert.equal(response.json().data.user.username, "haziq.afendi");
  assert.equal(response.json().data.user.ldapSyncedAt, null);
});
```

- [ ] **Step 2: Write failing checklist merge test**

```js
test("applying multiple checklists merges duplicate items into one run item", async () => {
  const { app, run, checklistA, checklistB, duplicateItem } = await seedRunWithTwoChecklistsSharingItem();
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/onboarding/runs/${run.id}/apply-checklists`,
    headers: itAuthHeaders(),
    payload: { checklistIds: [checklistA.id, checklistB.id] }
  });

  assert.equal(response.statusCode, 200);
  const matching = response.json().data.items.filter((item) => item.onboardingItemId === duplicateItem.id);
  assert.equal(matching.length, 1);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: FAIL with missing routes.

- [ ] **Step 4: Implement manual user helper**

In service or user repo:

- Lowercase and trim email.
- Username = substring before `@`.
- If username exists, reuse user.
- If not, create `User` with:
  - `username`
  - `role = requester`
  - `status = active`
  - `ldapAttributes = { cn, displayName, mail, givenName, sn }`
  - `ldapSyncedAt = null`

- [ ] **Step 5: Implement run creation**

Endpoint:

```http
POST /api/v1/onboarding/runs
```

Payload supports:

```js
{
  mode: "manual",
  manualIdentity: { fullName, email }
}
```

and:

```js
{
  mode: "existing_user",
  userId
}
```

- [ ] **Step 6: Implement apply-checklists**

Endpoint:

```http
POST /api/v1/onboarding/runs/:id/apply-checklists
```

Behavior:

- Load active checklist items.
- Preserve existing run items.
- Insert missing items only.
- Merge duplicates by `catalogItemId`.
- New credential item login defaults to run email.
- New item status defaults to `pending`.
- Snapshot label/url/notes/hasCredentials.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/features/onboarding apps/api/src/features/users tests/api/onboarding_checklist_mvp.test.mjs
git commit -m "feat: create onboarding runs from saved checklists"
```

### Task 5: Add Run Item Updates And Export

**Files:**
- Modify: `apps/api/src/features/onboarding/schema.js`
- Modify: `apps/api/src/features/onboarding/repo.js`
- Modify: `apps/api/src/features/onboarding/service.js`
- Modify: `apps/api/src/features/onboarding/routes.js`
- Test: `tests/api/onboarding_checklist_mvp.test.mjs`

- [ ] **Step 1: Write failing item update/export test**

```js
test("onboarding export includes only completed credential items", async () => {
  const { app, run, credentialItem, hardwareItem } = await seedRunWithCredentialAndHardwareItems();

  await updateRunItems(app, run.id, [
    {
      id: credentialItem.id,
      status: "completed",
      login: "haziq.afendi@jkseng.com",
      password: "SharedPass123"
    },
    {
      id: hardwareItem.id,
      status: "completed"
    }
  ]);

  const response = await app.inject({
    method: "GET",
    url: `/api/v1/onboarding/runs/${run.id}/export`,
    headers: itAuthHeaders()
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Sigma Access/);
  assert.match(response.body, /haziq\.afendi@jkseng\.com/);
  assert.doesNotMatch(response.body, /Monitor/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs
```

Expected: FAIL with missing update/export behavior.

- [ ] **Step 3: Implement update schema**

```js
export const updateRunItemsSchema = z.object({
  items: z.array(z.object({
    id: idSchema.optional(),
    onboardingItemId: idSchema.optional(),
    status: z.enum(["pending", "completed", "not_required"]),
    login: z.string().trim().max(191).optional().or(z.literal("")),
    password: z.string().max(5000).optional().or(z.literal("")),
    position: z.number().int().min(0).optional()
  })).min(1)
});
```

- [ ] **Step 4: Implement update service**

Support:

- Status update.
- Login/password update.
- Add item manually by `onboardingItemId`.
- Remove item by omitting? Prefer explicit delete route if simpler:
  - `DELETE /api/v1/onboarding/runs/:runId/items/:itemId`

For this MVP, implement `PUT /runs/:id/items` as upsert/update and add delete route only if UI needs it.

- [ ] **Step 5: Implement export service**

Formatter:

```js
export const formatOnboardingCredentialsExport = ({ run, user, items, generatedAt }) => {
  // return text, no filesystem writes
};
```

Rules:

- Include only completed credential snapshot items.
- Require non-empty login and password.
- Use LF line endings.
- Do not log credential content.
- Set no-cache headers.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs tests/api/export_no_archive.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/onboarding tests/api/onboarding_checklist_mvp.test.mjs
git commit -m "feat: export completed onboarding credentials"
```

---

## Chunk 3: Frontend API And UI

### Task 6: Add Frontend API Client Methods

**Files:**
- Modify: `apps/web/src/features/onboarding/onboarding-api.js`
- Test: `tests/web/onboardingChecklistMvp.test.jsx`

- [ ] **Step 1: Write failing API mock test**

Test expected URL calls for:

- `fetchOnboardingItems`
- `createOnboardingItem`
- `fetchSavedChecklists`
- `createOnboardingRun`
- `applyOnboardingChecklists`
- `updateOnboardingRunItems`
- `exportOnboardingRunCredentials`

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: FAIL because functions missing.

- [ ] **Step 3: Implement API functions**

Add functions:

```js
export const fetchOnboardingItems = async () => parsePayload(await apiFetch("/api/v1/onboarding/items"));
export const fetchSavedChecklists = async () => parsePayload(await apiFetch("/api/v1/onboarding/checklists"));
export const createOnboardingRun = async (data) => parsePayload(await apiFetch("/api/v1/onboarding/runs", { method: "POST", body: JSON.stringify(data) }));
export const applyOnboardingChecklists = async (runId, checklistIds) => parsePayload(await apiFetch(`/api/v1/onboarding/runs/${runId}/apply-checklists`, { method: "POST", body: JSON.stringify({ checklistIds }) }));
export const updateOnboardingRunItems = async (runId, items) => parsePayload(await apiFetch(`/api/v1/onboarding/runs/${runId}/items`, { method: "PUT", body: JSON.stringify({ items }) }));
```

Export uses blob download like existing `apps/web/src/features/exports/api/exports.js`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/onboarding-api.js tests/web/onboardingChecklistMvp.test.jsx
git commit -m "feat: add onboarding checklist web api"
```

### Task 7: Rename Catalog UI To Onboarding Items

**Files:**
- Modify: `apps/web/src/features/onboarding/OnboardingLayout.jsx`
- Modify: `apps/web/src/features/onboarding/pages/CatalogPage.jsx`
- Modify: `apps/web/src/features/onboarding/onboarding.css`
- Test: `tests/web/onboardingChecklistMvp.test.jsx`

- [ ] **Step 1: Write failing text/render test**

Assert:

- Navigation shows `Items`, not `Catalog`.
- Page heading shows `Onboarding Items`.
- Form has `Has login/password`.
- No user-facing "Catalog Items".

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: FAIL due current labels.

- [ ] **Step 3: Update UI wording and fields**

Change visible labels:

- `Catalog` -> `Items`
- `Catalog Items` -> `Onboarding Items`
- `Login URL` -> `URL`
- `IT-only credential` -> `Has login/password` inverted only if needed; do not confuse with export exclusion.

Use Stitch style:

- Dense two-column form on desktop.
- Compact list rows.
- Subtle status badges.
- No nested cards.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding tests/web/onboardingChecklistMvp.test.jsx
git commit -m "feat: rename onboarding catalog to items"
```

### Task 8: Replace Department Defaults With Saved Checklists UI

**Files:**
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsPage.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingDefaultsEditor.jsx`
- Modify: `apps/web/src/features/onboarding/pages/OnboardingHomePage.jsx`
- Modify: `apps/web/src/features/onboarding/onboarding.css`
- Test: `tests/web/onboardingChecklistMvp.test.jsx`

- [ ] **Step 1: Write failing saved checklist UI test**

Assert:

- Defaults page heading shows `Saved Checklists`.
- No department field rendered.
- Checklist editor can select multiple onboarding items.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: FAIL due department bundle UI.

- [ ] **Step 3: Implement saved checklist UI**

Use `fetchSavedChecklists`, `fetchOnboardingItems`, create/update checklist API.

Layout:

- Left: checklist form/editor.
- Right: saved checklist list with item counts.
- Item picker uses compact checkbox rows from Stitch checklist module guidance.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding tests/web/onboardingChecklistMvp.test.jsx
git commit -m "feat: manage saved onboarding checklists"
```

### Task 9: Rebuild New Joiner Flow

**Files:**
- Modify: `apps/web/src/features/onboarding/pages/NewJoinerPage.jsx`
- Modify: `apps/web/src/features/onboarding/onboarding.css`
- Test: `tests/web/onboardingChecklistMvp.test.jsx`

- [ ] **Step 1: Write failing flow test**

Assert:

- Manual identity has full name/email, no department.
- Selecting saved checklists applies/merges items.
- Credential item login defaults to email.
- Common password apply fills credential item password inputs.
- Status options are `pending`, `completed`, `not_required`.
- Export button disabled until completed credential item exists.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: FAIL because old department preview flow remains.

- [ ] **Step 3: Implement local flow state**

State:

- `mode`
- `selectedUserId`
- `manualIdentity`
- `run`
- `selectedChecklistIds`
- `runItems`
- `commonPassword`

Flow:

1. Create run.
2. Apply selected checklist IDs.
3. Render editable items.
4. Save item updates.
5. Export.

- [ ] **Step 4: Implement checklist item UI**

Use dense table/list:

Columns:

- Item
- Status segmented/select
- Login
- Password
- Notes/URL summary
- Remove action

For non-credential items, show status and notes only.

- [ ] **Step 5: Implement common password**

Button behavior:

- Fill only `hasCredentialsSnapshot === true` items.
- Do not touch non-credential items.
- Keep per-item override possible after applying.

- [ ] **Step 6: Implement export control**

Export count:

```js
runItems.filter(item => item.hasCredentialsSnapshot && item.status === "completed" && item.login && item.password).length
```

Disable export when count is zero.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/onboarding tests/web/onboardingChecklistMvp.test.jsx
git commit -m "feat: rebuild new joiner checklist flow"
```

---

## Chunk 4: Integration Verification

### Task 10: Regression And Build Verification

**Files:**
- No planned code edits unless verification fails.

- [ ] **Step 1: Run backend onboarding tests**

Run:

```bash
node --env-file=.env --test tests/api/onboarding_checklist_mvp.test.mjs tests/api/onboarding_routes.test.mjs tests/api/onboarding_service.test.mjs
```

Expected: all pass.

- [ ] **Step 2: Run LDAP/export regressions**

Run:

```bash
node --env-file=.env --test tests/api/ldap-sync.test.mjs tests/api/ldapSyncJob.test.mjs tests/api/credentials_export.test.mjs tests/api/credentials_export_service.test.mjs
```

Expected: all pass.

- [ ] **Step 3: Run frontend onboarding/export tests**

Run:

```bash
pnpm --filter web test -- --run tests/web/onboardingChecklistMvp.test.jsx tests/web/credentialExportButton.test.jsx tests/web/export_format_selector.test.jsx
```

Expected: all pass.

- [ ] **Step 4: Build web**

Run:

```bash
pnpm --filter web build
```

Expected: build passes. Existing chunk-size warning is acceptable unless new warning appears.

- [ ] **Step 5: Optional browser/Stitch visual check**

Start dev server:

```bash
pnpm --filter web dev
```

Open onboarding routes in browser:

- `/onboarding`
- `/onboarding/new-joiner`
- `/onboarding/defaults`
- `/onboarding/catalog` or renamed `/onboarding/items` if route is changed

Compare against Stitch `IT Onboarding Checklist` screen:

- compact operational surface
- slate/cool grey system
- clear checklist rows
- no card nesting
- no layout overlap at desktop width

- [ ] **Step 6: Commit final fixes**

If any verification fixes were needed:

```bash
git add <changed-files>
git commit -m "fix: stabilize onboarding checklist mvp"
```

---

## Execution Notes

- Current repo has unrelated uncommitted frontend changes. Do not revert them. Before implementation, inspect touched files carefully and preserve existing user edits.
- Prefer additive migrations and compatibility aliases.
- Do not delete legacy department bundle tables in this MVP.
- Do not alter credential template/export modules except for imports/tests broken by shared changes.
- Do not store onboarding export files on server.
- Do not log passwords or export content.
- Use `apply_patch` for manual edits.
- Follow TDD: failing test first, verify failure, implement, verify pass.
