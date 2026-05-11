# Onboarding Checklist MVP Design

## Goal

Rework onboarding from a department-driven credential generator into a checklist-first workflow for IT onboarding. IT can sync users from LDAP, create a manual real user when LDAP is not ready, apply one or more saved checklists, track completion per item, and export completed credentials as a text handoff file for the new user's computer.

## Current State

The app already has:

- LDAP sync that creates and updates users from directory data.
- Manual onboarding drafts that can generate credentials before LDAP exists.
- Onboarding catalog items and department bundles.
- User credential generation and credential exports.

The current gaps are:

- Manual onboarding creates a draft, not a real user.
- Department is required in onboarding and used for default bundles.
- Onboarding has selected items but no per-item status tracking.
- Current "Catalog" wording is unclear for the intended workflow.
- Hardware/checklist-only items are not modeled separately from credential items.
- The export flow for onboarding should be a user handoff text file containing only completed credential items.

## Vocabulary

Use plain UI wording:

- "Catalog Items" becomes "Onboarding Items".
- "Department Bundles" becomes "Saved Checklists".
- "App Access Selection" becomes "Onboarding Checklist".
- "Default Bundle" becomes "Saved Checklist".

Database table names can remain close to current names if that reduces migration churn. UI and API response names should use onboarding/checklist wording.

## User Workflow

1. IT opens New Joiner onboarding.
2. IT chooses identity source:
   - existing LDAP/directory user, or
   - manual user.
3. Manual user creates a real `User` record immediately.
4. IT enters or confirms email.
5. IT selects one or more saved checklists.
6. App merges duplicate onboarding items.
7. IT can add or remove items manually.
8. Each selected item starts with status `pending`.
9. Credential-capable items default login value to the joiner email.
10. IT can enter one common password and apply it to all credential-capable items.
11. IT can override login/password per item.
12. IT marks each item `pending`, `completed`, or `not_required`.
13. IT exports a text handoff file.
14. Export includes only completed credential-capable items with login/password present.

## Data Model

### Onboarding Item

Represents a reusable item IT may need to prepare.

Fields:

- `id`
- `itemKey`
- `label`
- `url` optional
- `notes` optional
- `hasCredentials` boolean
- `isActive` boolean
- `createdById`
- timestamps

Examples:

- Microsoft Account: `hasCredentials = true`
- Sigma Access: `hasCredentials = true`
- Monitor: `hasCredentials = false`
- External Hard Disk: `hasCredentials = false`

### Saved Checklist

Reusable group of onboarding items. Not department-based.

Fields:

- `id`
- `name`
- `description` optional
- `isActive` boolean
- `createdById`
- timestamps

Checklist item join:

- `checklistId`
- `onboardingItemId`
- `position`

Examples:

- Standard New Staff
- Automation Onboarding
- Site Staff Setup

### Onboarding Run

One onboarding instance for a user.

Fields:

- `id`
- `userId`
- `mode`: `existing_user` or `manual`
- `email`
- `status`: `in_progress`, `completed`
- `createdById`
- timestamps

Manual users should be normal `User` rows with `ldapSyncedAt = null`.

### Onboarding Run Item

Selected item inside a specific onboarding run.

Fields:

- `id`
- `runId`
- `onboardingItemId`
- `status`: `pending`, `completed`, `not_required`
- `login`
- `password`
- `urlSnapshot`
- `notesSnapshot`
- `hasCredentialsSnapshot`
- `position`
- timestamps

Use snapshots so later changes to reusable items do not rewrite old onboarding records.

## API Design

Use IT-role protection for all onboarding management endpoints.

Items:

- `GET /api/v1/onboarding/items`
- `POST /api/v1/onboarding/items`
- `PUT /api/v1/onboarding/items/:id`
- `DELETE /api/v1/onboarding/items/:id` or deactivate

Saved checklists:

- `GET /api/v1/onboarding/checklists`
- `POST /api/v1/onboarding/checklists`
- `PUT /api/v1/onboarding/checklists/:id`
- `DELETE /api/v1/onboarding/checklists/:id` or deactivate

Runs:

- `POST /api/v1/onboarding/runs`
- `GET /api/v1/onboarding/runs`
- `GET /api/v1/onboarding/runs/:id`
- `PUT /api/v1/onboarding/runs/:id/items`
- `POST /api/v1/onboarding/runs/:id/apply-checklists`
- `GET /api/v1/onboarding/runs/:id/export`

Export response:

- Content type: `text/plain; charset=utf-8`
- Download filename: `onboarding-credentials-{username-or-email}-{date}.txt`
- No server-side file storage.
- No credential content in logs.

## UI Design

### Onboarding Items Page

Replace "Catalog" page wording with "Onboarding Items".

Form fields:

- Item name
- Key
- URL optional
- Notes optional
- "Has login/password" checkbox
- Active toggle

### Saved Checklists Page

Replace department bundle UI.

Form fields:

- Checklist name
- Description optional
- Active toggle
- Item picker

List shows active checklists and item count.

### New Joiner Page

Sections:

- Identity Source
- Saved Checklists
- Onboarding Checklist
- Export

Identity:

- Existing directory user selector, or
- Manual user fields: name/email. No department.

Saved Checklists:

- Multi-select checklists.
- Apply button merges items into run.
- Duplicate items merge into one selected item.

Onboarding Checklist:

- Table/list of run items.
- Status control: pending/completed/not_required.
- Credential-capable items show login and password fields.
- Login defaults to full email.
- Common password field with "Apply to all credential items".
- Add item button.
- Remove item button.

Export:

- Download text file.
- Disabled when no completed credential items exist.
- Shows count of exportable completed credential items.

## Export Format

Standard text file:

```text
JKS IT ONBOARDING CREDENTIALS
User: Haziq Afendi
Email: haziq.afendi@jkseng.com
Generated: 2026-05-11T10:00:00.000Z

---------------------------------
Microsoft Account
URL: https://...
Username/Email: haziq.afendi@jkseng.com
Password: ...
Notes: ...
---------------------------------

---------------------------------
Sigma
URL: https://...
Username/Email: haziq.afendi@jkseng.com
Password: ...
Notes: ...
---------------------------------

End of onboarding credentials
```

Only include items where:

- `hasCredentialsSnapshot = true`
- `status = completed`
- `login` and `password` are present

Do not export monitor, hard disk, or other non-credential items.

## Migration Strategy

Prefer additive migration:

1. Add new checklist/run tables.
2. Add missing item fields such as `hasCredentials` and `isActive`.
3. Keep old department bundle tables temporarily if removing them risks breaking existing code.
4. Replace UI usage with saved checklists.
5. Leave credential template/export modules intact.

## Testing

API tests:

- Manual onboarding creates a real user when email/username is new.
- Existing LDAP user onboarding creates a run.
- Applying multiple saved checklists merges duplicate items.
- Run item status can be updated.
- Common password application can be service-tested if implemented server-side, otherwise UI-tested.
- Export excludes pending items.
- Export excludes non-credential items.
- Export includes completed credential items only.
- Export has no disk persistence.

Web tests:

- New Joiner page no longer requires department.
- IT can select multiple saved checklists.
- Duplicate items appear once.
- Credential item defaults login to email.
- Common password apply fills credential item passwords.
- Export button disabled when no completed credential items exist.
- Export button enabled when completed credential items exist.

Regression tests:

- LDAP sync still passes.
- Existing user credential exports still pass.
- Credential template tests still pass.

## Out of Scope

- Department-based defaulting.
- Network drive read/write permission fields.
- Automatic password generation as primary workflow.
- Hardware inventory assignment.
- Approval workflow for onboarding checklists.
- Employee self-service onboarding.

## Approved Decisions

- Use "Onboarding Items" wording.
- Use saved checklists, not department bundles.
- Allow multiple saved checklists per onboarding run.
- Merge duplicate items.
- Status values: `pending`, `completed`, `not_required`.
- Default login value is full email.
- Password is manual.
- Common password can apply to all credential-capable items.
- Per-item login/password override is allowed.
- Export only completed credential-capable items.
- Non-credential items are not exported.
