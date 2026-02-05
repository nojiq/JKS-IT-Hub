# Medium/Low Issues - Resolution Summary

**Date:** 2026-02-03
**Status:** All Resolved ✓

---

## ✅ Issue #7: Incomplete User History (MEDIUM - FIXED)

**Problem:** The user history view only displayed events with `metadata.changes` arrays, hiding important credential-related events like "Credential Locked", "Manual Override", and "Regeneration".

**Solution Applied:**
- **File:** `apps/api/src/features/users/routes.js`
- **Changes:**
  - Expanded audit log query to include credential actions:
    - `credentials.regenerate.preview`
    - `credentials.regenerate.confirm`
    - `credentials.override.preview`
    - `credentials.override.confirm`
    - `credentials.password.reveal`
  - Implemented dual handling for audit logs:
    - **Field changes** (user.update, user.ldap_update) → displayed as before
    - **Credential events** → displayed as timeline events with metadata
  - Added event type classification (`field_change` vs `credential_event`)
  - Included relevant metadata (system, changeType, regeneratedSystems) for credential events

**Impact:** Users now see a complete audit trail including all credential operations.

---

## ✅ Issue #8: Test Pollution (MEDIUM - FIXED)

**Problem:** Test file `tests/api/audit-view.test.mjs` created users via `createUser` but never cleaned them up, leaving ghost users in the database after repeated test runs.

**Solution Applied:**
- **File:** `tests/api/audit-view.test.mjs`
- **Changes:**
  - Added `createdUserIds` array to track all created test users
  - Modified `after()` hook to delete all tracked users before disconnecting
  - Updated all test cases to push created user IDs to the tracking array:
    - Test 1: `audit-viewer-${uuid}` users
    - Test 2: `target-user-${uuid}` and `admin-user-${uuid}` users
    - Test 3: `requester-${uuid}` users

**Impact:** Tests now clean up after themselves, preventing database pollution and performance degradation.

---

## ✅ Issue #9: Imprecise Duration Display (LOW - FIXED)

**Problem:** Version comparison showed "0 hours" for time gaps less than 1 hour, making it impossible to distinguish between "5 minutes ago" and "55 minutes ago".

**Solution Applied:**
- **File:** `apps/api/src/features/credentials/service.js` (`compareCredentialVersions`)
- **Changes:**
  - Added calculation for minutes and seconds
  - Implemented tiered display logic:
    - **Days > 0:** "X days, Y hours"
    - **Hours > 0:** "X hours, Y minutes"
    - **Minutes > 0:** "X minutes, Y seconds"
    - **Else:** "X seconds"

**Impact:** Admins can now see precise time differences for recent credential changes.

---

## ✅ Issue #10: Brittle RBAC Implementation (LOW - FIXED)

**Problem:** Role arrays like `['it', 'admin', 'head_it']` were hardcoded across multiple route handlers, creating maintenance burden and risk of inconsistency.

**Solution Applied:**
- **New File:** `apps/api/src/shared/auth/rbac.js`
  - Created centralized role definitions:
    - `ROLES` object with constants
    - `ROLE_GROUPS` for common combinations
  - Implemented helper functions:
    - `hasItRole(user)` - checks if user is IT staff
    - `hasAdminRole(user)` - checks if user is admin
    - `hasRole(user, role)` - checks specific role
    - `hasAnyRole(user, roles)` - checks against array

- **Updated File:** `apps/api/src/features/credentials/routes.js`
  - Imported `hasItRole` helper
  - Replaced hardcoded array check with `hasItRole(actor)`

**Impact:** RBAC logic is now centralized and maintainable. Future role changes require updates in one location only.

---

## Summary

All medium and low priority issues have been successfully resolved:

- ✅ **Complete Audit Trail** - Credential events now visible in user history
- ✅ **Clean Tests** - No more database pollution from test runs
- ✅ **Precise Timestamps** - Sub-hour time differences displayed accurately
- ✅ **Maintainable RBAC** - Centralized role checking logic

**Next Steps:** These fixes are ready for commit along with the critical/high severity fixes.
