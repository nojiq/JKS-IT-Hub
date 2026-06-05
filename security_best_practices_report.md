# Security Best Practices Report

Date: 2026-05-25

Scope: Fastify API, React/Vite frontend, Prisma/MySQL schema, credential generation/storage/export flows, onboarding password storage, auth/session handling, CORS/CSRF/header posture, dependency audit, and repository secret hygiene.

## Executive Summary

The app has some good foundations: LDAP-backed login, HTTP-only session cookies, Zod validation in many route boundaries, UUID primary keys, AES-256-GCM encryption for `UserCredential`, `CredentialVersion`, and onboarding draft credential passwords, audit logs for many sensitive operations, no public committed `.env`, and no frontend token storage.

The current posture is not sufficient for an app that stores recoverable passwords. Most important: `user_field_values.value` stores seeded password-type profile fields in plaintext, credential encryption falls back to the JWT secret and is not enforced as a separate key, credential passwords are routinely decrypted and returned/exported to broad IT roles, generated passwords are deterministic, and there is no CSRF or login rate-limit protection visible in app code.

Read-only local DB count, values not printed: `user_credentials` has 85 non-`enc:v1` password rows, `credential_versions` has 0, `onboarding_draft_credentials` has 0, and sensitive `user_field_values` has 3 non-encrypted values.

## Critical Findings

### C-01: Password profile fields are stored plaintext in `user_field_values`

- Rule ID: SECRET-STORAGE-001
- Severity: Critical
- Location: `apps/api/prisma/schema.prisma:131-154`, `apps/api/prisma/migrations/20260512000100_add_user_profile_fields/migration.sql:18-23`, `apps/api/prisma/migrations/20260512000100_add_user_profile_fields/migration.sql:47-49`, `apps/api/src/features/users/profileFieldsRepo.js:29-73`
- Evidence:
  - `UserFieldDefinition.sensitive` exists, and the migration seeds `temporary-password`, `actual-password`, and `android-password` as `field_type='password'` and `sensitive=true`.
  - `UserFieldValue.value` is plain `String? @db.Text`.
  - `updateProfileFieldValues()` writes `value` directly without encryption.
  - Read-only local DB count found 3 sensitive `user_field_values` rows with non-empty values that do not start with `enc:v1:`.
- Impact: Anyone with DB read access, backups, SQL dumps, local dev DB access, or a DB compromise can read these password values directly.
- Fix: Encrypt sensitive `UserFieldValue.value` before storage. Use a shared encryption module for all recoverable secrets, encrypt only fields whose definition has `sensitive=true`, and decrypt only at controlled reveal/export boundaries.
- Mitigation: Backfill existing sensitive rows to `enc:v1` format, rotate exposed values, and add tests that assert sensitive profile rows are not stored as plaintext.
- False positive notes: The dedicated credential tables are encrypted. This finding is specifically about profile field values.

## High Findings

### H-01: Credential encryption key falls back to the JWT secret and is not enforced independently

- Rule ID: SECRET-KEY-001
- Severity: High
- Location: `apps/api/src/features/credentials/repo.js:13-24`, `apps/api/src/features/onboarding/repo.js:13-24`, `apps/api/src/config/authConfig.js:30-69`, `.env.example:25-27`
- Evidence:
  - `getEncryptionKey()` uses `CREDENTIAL_ENCRYPTION_KEY || JWT_SECRET || AUTH_JWT_SECRET`.
  - `authConfig` validates `JWT_SECRET` but does not validate or require `CREDENTIAL_ENCRYPTION_KEY`.
  - Local masked env scan showed `.env` and `apps/api/prisma/.env` contain `JWT_SECRET` but no `CREDENTIAL_ENCRYPTION_KEY`.
- Impact: A JWT signing secret leak also decrypts stored recoverable credentials. JWT rotation and credential encryption rotation are coupled.
- Fix: Require `CREDENTIAL_ENCRYPTION_KEY` in production, reject fallback outside local dev/test, and keep JWT signing and credential encryption keys separate.
- Mitigation: Add key version metadata, support rotation/decryption by key id, rotate current stored credentials after deploying a dedicated key.
- False positive notes: AES-256-GCM itself is appropriate. The key management is the weak part.

### H-02: Existing plaintext credential rows are accepted silently; no encryption backfill is visible

- Rule ID: SECRET-MIGRATION-001
- Severity: High
- Location: `apps/api/src/features/credentials/repo.js:49-57`, `apps/api/src/features/onboarding/repo.js:49-57`, `apps/api/prisma/migrations/20260201210000_add_user_credentials_and_versions/migration.sql:7-27`, `apps/api/prisma/migrations/20260314000100_add_onboarding_module/migration.sql:70`
- Evidence:
  - `decryptSecret()` returns non-`enc:v1` strings unchanged.
  - Initial migrations created plaintext `password TEXT NOT NULL` columns.
  - No migration/backfill script was found that converts existing plaintext credential/onboarding rows to encrypted format.
  - Read-only local DB count found 85 `user_credentials.password` rows that do not start with `enc:v1:`; `credential_versions` and `onboarding_draft_credentials` currently counted 0.
- Impact: Any password rows created before encryption was added, or inserted through direct SQL/import tooling, may remain plaintext indefinitely.
- Fix: Add a one-time backfill command that counts non-`enc:v1` password rows, encrypts them in place, and refuses production startup if plaintext rows remain.
- Mitigation: Run a read-only production check first: counts only, no values printed. Rotate any credentials found plaintext.

### H-03: Credential reveal/list/export paths expose plaintext passwords to broad IT role group

- Rule ID: LEAST-PRIVILEGE-001
- Severity: High
- Location: `apps/api/src/shared/auth/rbac.js:13-26`, `apps/api/src/features/credentials/routes.js:277-303`, `apps/api/src/features/credentials/routes.js:1173-1220`, `apps/api/src/features/exports/routes.js:33-83`, `apps/api/src/features/exports/routes.js:114-185`, `apps/api/src/features/exports/formatter.js:15-24`
- Evidence:
  - `hasItRole()` includes `dev`, `it`, `admin`, and `head_it`.
  - Listing user credentials returns decrypted credential objects.
  - Password reveal returns `password.revealed`.
  - Export formatter writes `Password: ${credential.password}` and compressed exports include plaintext password fields.
- Impact: Any account in the IT role group can retrieve/export recoverable credentials at scale. A compromised IT session becomes a bulk credential compromise.
- Fix: Split permissions: `credential:view-masked`, `credential:reveal`, `credential:export`, `credential:manage-template`. Require explicit reason, recent re-auth, and per-action audit for reveal/export.
- Mitigation: Limit batch export size further, alert on exports/reveals, require head_it/admin approval for bulk export, and default list endpoints to masked values.

### H-04: Password generation is deterministic, including tokens named `random`

- Rule ID: PASSWORD-GENERATION-001
- Severity: High
- Location: `apps/api/src/features/credentials/generator.js:42-63`, `apps/api/src/features/credentials/generator.js:155-159`, `apps/api/src/features/credentials/generator.js:245-256`, `apps/api/src/features/credentials/generator.js:387-414`, `apps/api/src/features/credentials/generator.js:488-496`
- Evidence:
  - `deriveDeterministicChars()` uses SHA-256 from seed/counter, not `crypto.randomBytes`.
  - `{random:n}` pattern tokens are deterministic.
  - Seeds include user id, system, template version, LDAP attributes, normalized values, and password pattern.
  - Yahoo actual password generation is explicitly deterministic from identity and temporary password.
- Impact: Anyone who obtains enough user/template/LDAP input context can recompute current or old passwords. Same inputs regenerate same password, so rotation may not create new secrets unless input/template changes.
- Fix: For real external account credentials, use CSPRNG-generated passwords and store audit metadata separately. If determinism is a hard product requirement, include a server-side HMAC pepper/key that is independent from DB data and rotateable.
- Mitigation: Enforce minimum length/charset/pattern strength in templates, forbid fixed/LDAP-only password patterns, and flag deterministic passwords as lower assurance.

### H-05: Login has no visible brute-force/rate-limit control and trusts `X-Forwarded-For`

- Rule ID: AUTH-RATE-LIMIT-001
- Severity: High
- Location: `apps/api/src/features/auth/routes.js:23-31`, `apps/api/src/features/auth/routes.js:43-74`, `apps/api/package.json:10-29`
- Evidence:
  - `/auth/login` authenticates directly against LDAP.
  - No `@fastify/rate-limit` or equivalent login throttle is registered.
  - `getClientIp()` prefers `x-forwarded-for` directly from request headers.
- Impact: Attackers can brute-force LDAP credentials or cause LDAP load. Audit IP metadata can be spoofed unless a trusted proxy strips/sets forwarded headers.
- Fix: Add rate limiting by normalized username and trusted client IP, progressive backoff, lockout/alerting, and trusted-proxy-aware IP extraction.
- Mitigation: Apply edge/WAF limits immediately if available, but keep app-level limits too.

## Medium Findings

### M-01: Cookie-authenticated state-changing routes have no active CSRF protection

- Rule ID: CSRF-001
- Severity: Medium
- Location: `apps/api/src/features/auth/routes.js:110-116`, `apps/web/src/shared/utils/api-client.js:16-18`, `apps/api/src/features/credentials/schema.js:50-70`, `apps/api/src/features/credentials/routes.js:485-568`, `apps/api/src/features/credentials/routes.js:824-903`, `apps/api/src/features/credentials/routes.js:1363-1452`
- Evidence:
  - Auth uses an HTTP-only cookie.
  - Frontend sends `credentials: "include"`.
  - Schemas include optional `csrfToken`, but routes do not validate it.
  - Sensitive POST/PATCH routes rely on cookie auth only.
- Impact: SameSite=Lax reduces many cross-site XHR attacks, but app code has no explicit CSRF/origin defense for credential creation, regeneration, override, export, role updates, or profile-password updates.
- Fix: Add CSRF tokens or signed double-submit cookies for all state-changing requests, and enforce `Origin`/`Referer` allowlist checks for cookie-authenticated requests.
- Mitigation: Keep `SameSite=Lax` or stronger, never set `SameSite=None` without CSRF protection.

### M-02: Preview sessions store plaintext passwords in memory and some tokens use `Math.random`

- Rule ID: SESSION-SECRET-001
- Severity: Medium
- Location: `apps/api/src/features/credentials/service.js:410-421`, `apps/api/src/features/credentials/service.js:735-751`, `apps/api/src/features/credentials/service.js:1191-1211`, `apps/api/src/features/credentials/repo.js:410-458`
- Evidence:
  - Generation preview token: `preview_${Date.now()}_${Math.random()...}`.
  - Regeneration preview token: `regen_${Date.now()}_${Math.random()...}`.
  - Override token uses `randomUUID()`, which is better.
  - Preview session Map stores plaintext `credentials`, `comparisons`, and `newCredentials`.
- Impact: A process memory disclosure, crash dump, debugger, or guessed token path can expose or confirm plaintext credentials. Math.random tokens are weaker than cryptographic tokens.
- Fix: Use `randomBytes(32).toString("base64url")` or `randomUUID()` for every preview token, bind preview sessions to `actor.id`, and store only encrypted payloads or short-lived references.
- Mitigation: Reduce preview TTL, avoid storing old/new plaintext comparisons, and clear sessions on confirm/error.

### M-03: Missing global security headers and CSP

- Rule ID: WEB-HEADERS-001
- Severity: Medium
- Location: `apps/api/src/server.js:28-42`, `apps/api/src/features/exports/routes.js:75-82`, `apps/api/src/plugins/staticFiles.js:88-91`, `apps/web/index.html:11-20`
- Evidence:
  - API registers cookie and CORS, but no global `@fastify/helmet` or security-header hook is visible.
  - Export/static routes set partial headers only for those responses.
  - Frontend has an inline script, so a strict CSP needs nonce/hash or script relocation.
- Impact: Weaker browser defense-in-depth against XSS, clickjacking, MIME sniffing, and referrer leakage.
- Fix: Add global security headers: CSP, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and compatible cache headers for authenticated API responses.
- Mitigation: Move inline theme script to a hashed/nonce-compatible pattern before enforcing strict CSP.

### M-04: CORS can be configured as any-origin while credentials are enabled

- Rule ID: CORS-001
- Severity: Medium
- Location: `apps/api/src/server.js:8-20`, `apps/api/src/server.js:26-42`, `apps/api/src/config/authConfig.js:108-110`
- Evidence:
  - `CORS_ORIGIN="*"` or `"true"` maps to `allowedOrigins === true`.
  - CORS is registered with `credentials: true`.
- Impact: If deployed with wildcard CORS and cookie SameSite is relaxed later, arbitrary origins can make credentialed API calls and read CORS-enabled responses.
- Fix: Reject wildcard CORS when `credentials: true`, especially in production. Require explicit origins.
- Mitigation: Add startup validation that fails production boot if `CORS_ORIGIN` is `*` or `true`.

### M-05: Production dependency audit has unresolved vulnerabilities

- Rule ID: DEP-AUDIT-001
- Severity: Medium
- Location: `apps/api/package.json:13-26`, `pnpm-lock.yaml`
- Evidence:
  - `pnpm audit --prod --json` exited non-zero.
  - Summary: 0 critical, 11 high, 26 moderate, 4 low production dependency advisories.
  - Affected areas include `fastify`, `@fastify/static`, `nodemailer`, `fast-uri`, `ajv`, `minimatch`, `hono`, `effect`, and transitive Prisma dev/runtime packages.
- Impact: Some advisories touch URL parsing, path traversal, Fastify behavior, static serving, and mail handling. Exact exploitability depends on reachable code paths.
- Fix: Upgrade direct dependencies and lockfile, then rerun `pnpm audit --prod`.
- Mitigation: Prioritize direct runtime packages first: `fastify`, `@fastify/static`, `nodemailer`, and transitive URL/parser packages used by request handling.

## Low Findings

### L-01: Sensitive operational artifacts are tracked

- Rule ID: REPO-HYGIENE-001
- Severity: Low
- Location: `.gitignore:35-41`, `.superpowers/brainstorm/*`, `.planning/ui-reviews/*`, `diff.txt`, `diff_utf8.txt`, `full_diff.txt`, `docker-compose.yml:31`, `README.md:13`
- Evidence:
  - `.gitignore` ignores `.superpowers/` and `.planning/`, but those paths are already tracked.
  - `diff*.txt` and `full_diff.txt` contain historical code/test fragments with credential-like strings.
  - `docker-compose.yml` contains a hard-coded dev database password in `DATABASE_URL`.
- Impact: Mostly repo hygiene risk, but historical artifacts increase accidental leakage and review noise.
- Fix: Remove tracked local workflow artifacts from git, keep them ignored, and use environment expansion for dev database URLs.
- Mitigation: Run a real secret scanner before pushing public/shared repos.

### L-02: IMAP detail path has a broken secondary role check

- Rule ID: AUTHZ-CORRECTNESS-001
- Severity: Low
- Location: `apps/api/src/features/credentials/routes.js:316-359`, `apps/api/src/shared/auth/middleware.js:16-31`, `apps/api/src/shared/auth/requireAuthenticated.js:13-88`
- Evidence:
  - Route gets `actor = await requireAuthenticated(...)`.
  - `requireItRole()` later checks `request.user`, but `requireAuthenticated()` returns the user and does not set `request.user`.
- Impact: This likely blocks authorized IT users from the `/detail/:id` path for `isItOnly` credentials. It appears fail-closed, so not a credential leak, but it may break intended access/audit behavior.
- Fix: Use the returned `actor` for this check or set `request.user = actor` in auth middleware consistently.

## Positive Controls Observed

- Passwords in `UserCredential`, `CredentialVersion`, and onboarding draft credentials are encrypted before app-managed writes: `apps/api/src/features/credentials/repo.js:188-204`, `apps/api/src/features/credentials/repo.js:281-286`, `apps/api/src/features/onboarding/repo.js:416-427`.
- AES-256-GCM uses random 12-byte IVs and auth tags: `apps/api/src/features/credentials/repo.js:41-46`.
- Session cookie is `httpOnly`, `secure` by config, and `sameSite=lax`: `apps/api/src/features/auth/routes.js:110-116`, `apps/api/src/config/authConfig.js:95-99`.
- Credential reveal/export operations have audit logs, though controls should be stronger: `apps/api/src/features/credentials/routes.js:1204-1218`, `apps/api/src/features/exports/service.js:69-81`, `apps/api/src/features/exports/service.js:185-210`.
- Marketplace preview has host allowlisting and per-actor rate limiting: `apps/api/src/features/purchase-records/marketplace.js:1-35`, `apps/api/src/features/purchase-records/routes.js:125-134`.

## Recommended Fix Order

1. Encrypt `user_field_values.value` for sensitive fields and backfill existing sensitive rows.
2. Require a dedicated `CREDENTIAL_ENCRYPTION_KEY`; remove production fallback to JWT secret.
3. Add plaintext-row detection/backfill for all credential password tables.
4. Change credential list/reveal/export to least-privilege, masked-by-default, reasoned, recently re-authenticated actions.
5. Replace deterministic password generation for real credentials, or add an HMAC pepper and stricter template policy if determinism must stay.
6. Add login rate limiting and trusted IP extraction.
7. Add CSRF/origin checks for cookie-authenticated state changes.
8. Add global security headers/CSP.
9. Upgrade dependencies until `pnpm audit --prod` is clean or every remaining advisory is documented as non-exploitable.
10. Remove tracked local artifacts and run a secret scanner.
