# Story 1.2: LDAP Sign-In & Session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an internal user,
I want to sign in with my LDAP credentials,
so that I can securely access IT-Hub.

## Acceptance Criteria

1. **Given** an active internal user with valid LDAP credentials **When** they sign in **Then** the API authenticates via LDAP bind and issues a session (JWT in HttpOnly/Secure/SameSite cookie) **And** the user is redirected into the app.
2. **Given** invalid LDAP credentials **When** the user attempts to sign in **Then** access is denied with a clear error message.
3. **Given** a disabled user **When** they attempt to sign in **Then** access is denied and the account remains disabled.

## Tasks / Subtasks

- [x] Define auth persistence + configuration (AC: #1, #3)
  - [x] Add Prisma + @prisma/client (v7.3.0) and create initial `User` model with `status` (active/disabled) and `role` fields; map DB names to snake_case
  - [x] Add API env config module for LDAP + JWT settings; update `.env.example` with required variables
  - [x] Implement `apps/api/src/features/users/repo.js` for user lookup/create and disabled status check (DB access only here)
- [x] Implement LDAP authentication service (AC: #1, #2, #3)
  - [x] Add `ldapts` client wrapper with secure connection support (LDAPS or StartTLS) and timeouts
  - [x] Implement `authenticateLdapUser` to search for user DN + attributes, then bind as user to verify password
  - [x] Map LDAP bind/search errors to RFC 9457 Problem Details (invalid credentials vs server error)
- [x] Implement API auth/session routes (AC: #1, #2, #3)
  - [x] Register `@fastify/cookie` + `@fastify/cors` in `apps/api/src/server.js` with credentials enabled and origin from env
  - [x] Create `POST /auth/login` route with Zod validation; on success, check local user status, issue JWT via `jose`, set HttpOnly/Secure/SameSite cookie
  - [x] Create `GET /auth/me` (or `/session`) to validate cookie + return current user payload for client session checks
  - [x] Ensure success responses are `{ data }` and errors follow RFC 9457 format
- [x] Build web login flow + redirect (AC: #1)
  - [x] Add React Router DOM (v7.12.0) and TanStack Query (v5.90.20); set up Router + QueryClientProvider
  - [x] Create `/login` route with LDAP username + password form; call API via Query mutation using `fetch` with `credentials: 'include'`
  - [x] On success, navigate to app root; on failure show clear error; add minimal session guard using `/auth/me`
- [x] Tests and verification (AC: #1, #2, #3)
  - [x] Add API integration tests using Node `node:test` + `app.inject` for: success login, invalid credentials, disabled user
  - [x] Make LDAP client injectable so tests can stub LDAP responses (avoid real LDAP dependency)
  - [x] If no web test framework is approved, document manual verification steps in Completion Notes

## Dev Notes

### Story Foundation
- Implements LDAP sign-in and session cookie for internal users. This is the first real authentication flow.
- Must use LDAP bind for credential verification and issue a JWT session cookie on success.

### Scope Boundaries (Do NOT do in this story)
- Do not implement LDAP sync jobs, user directory UI, or LDAP change history.
- Do not implement role management, audit log UI, or any credential/maintenance/request features.
- Do not add a full testing framework without approval; use Node built-in testing for API only.

### Developer Context (Guardrails)
- **Auth mechanics:** LDAP bind is the source of truth for password validation. No local passwords.
- **Disabled users:** Block sign-in when local user status is `disabled` even if LDAP bind succeeds.
- **JWT cookie:** Use `jose` to sign; set HttpOnly + Secure + SameSite; keep payload minimal (sub, role, status, iat/exp).
- **Errors:** Use RFC 9457 Problem Details for failures; include clear, user-friendly `detail` for invalid credentials/disabled.
- **Zod validation:** Validate login body before LDAP calls. Use Zod 4.3.0.
- **ESM only** and follow folder conventions in architecture + project context.

### Technical Requirements
- **API deps:** `@fastify/cookie`, `@fastify/cors`, `jose`, `ldapts`, `zod`, `@prisma/client`, `prisma` (dev).
- **Web deps:** `react-router-dom@7.12.0`, `@tanstack/react-query@5.90.20`.
- **Env vars (add to `.env.example`):**
  - `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_USER_FILTER`
  - `LDAP_USE_STARTTLS` (true/false) and optional `LDAP_TLS_CA_PATH`
  - `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`
  - `AUTH_COOKIE_NAME`, `CORS_ORIGIN`
- **Cookie name:** Prefer `__Host-it-hub-session` if HTTPS is enforced; otherwise use a non-prefixed name for local dev.

### Architecture Compliance
- Place LDAP client/service under `apps/api/src/features/ldap/`.
- Place auth helpers (JWT sign/verify + request user extraction) under `apps/api/src/shared/auth/`.
- Keep DB access in `apps/api/src/features/users/repo.js` only; services should call repo.
- Keep React feature files under `apps/web/src/features/users/` (login UI belongs here).

### Testing Requirements
- API tests use Node built-in runner (`node:test`) + Fastify `inject`.
- No web test framework added until a project decision is made; document manual verification steps.

### Previous Story Intelligence
- ESM is required everywhere; project structure already aligned with architecture tree.
- Node runtime must meet Vite requirements (Node 20.19+ or 22.12+).
- Test framework selection was explicitly deferred; do not introduce Vitest/Jest/etc. yet.

### Latest Tech Information (2026-01-28)
- **LDAPts** supports secure LDAP connections via `ldaps://` or StartTLS, and accepts TLS options like `minVersion` and CA certs. Prefer LDAPS; if only StartTLS is available, connect over `ldap://` then call `startTLS` before bind/search. [Source: https://app.unpkg.com/ldapts@8.1.3/files/README.md]
- **@fastify/cookie** parses cookies on `onRequest` (`request.cookies`) and provides `reply.setCookie(name, value, options)` with options like `sameSite` and `secure` to control cookie behavior. [Source: https://github.com/fastify/fastify-cookie]
- **jose** is the ESM JWT/JWS/JWE library used for signing and verifying JWTs; `SignJWT` and `jwtVerify` are the core primitives. Latest documented version is 6.1.3. [Source: https://jsr.io/@panva/jose]

### Open Questions (Confirm before implementation if unclear)
- Should first-time LDAP sign-ins auto-create local user records (default role/status), or should login fail if the user is missing locally?
- Where should the auth routes live: `shared/auth` or a dedicated `features/auth` module (not in the current architecture tree)?
- Desired JWT TTL and cookie expiry policy for initial MVP?

### References
- Epic story definition and ACs: [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- Architecture decisions + stack versions: [Source: _bmad-output/planning-artifacts/architecture.md]
- Project rules and versions: [Source: _bmad-output/project-context.md]
- Previous story learnings: [Source: _bmad-output/implementation-artifacts/1-1-initialize-project-from-starter-template.md]

## Dev Agent Record

### Agent Model Used

Codex CLI (GPT-5)

### Debug Log References

- Tests: `~/.local/node/bin/node --test tests/api/auth-login.test.mjs` (passed; includes `/auth/me` coverage)
- Prisma CLI (local): P1012 schema validation error (datasource url in schema). Updated to Prisma 7 config + driver adapter.

### Completion Notes List

- Implemented LDAP authentication service with bind + search flow, StartTLS/LDAPS support, and problem-details error mapping.
- Added JWT session helpers and auth routes; login auto-creates local users with default `requester` role and blocks disabled users.
- Built web login flow with React Router + TanStack Query, session guard via `/auth/me`, and lightweight UI styling.
- Added API auth integration tests using `node:test` and executed them with Node 20.19.0.
- Fixed user repo DB path parsing regex and lazy-loaded the default user repo in auth routes to keep tests DB-free.
- Updated `.env.example` JWT expiry default to 12h per MVP decision.
- Updated Prisma 7 setup to use `prisma.config.ts`, moved datasource URL out of schema, and switched client generation + MariaDB adapter.
- Manual verification: 1) set LDAP/JWT env vars, 2) run API (`pnpm -C apps/api dev`), 3) run web (`pnpm -C apps/web dev`), 4) sign in via `/login`, 5) confirm session cookie + `/auth/me` response, 6) verify disabled user is rejected.
- Switched User IDs to UUID strings in Prisma and API payloads to match architecture rules.
- Added session checks in `/auth/me` to block disabled or missing users even with valid JWTs.
- Added LDAP TLS `rejectUnauthorized` support and adjusted `.env.example` defaults for local cookie usage.
- Expanded API auth tests to validate cookie flags and `/auth/me` behavior; added API test script.

### File List

- .gitignore
- .env
- .env.example
- apps/api/package.json
- apps/api/prisma.config.ts
- apps/api/prisma/schema.prisma
- apps/api/src/config/authConfig.js
- apps/api/src/features/auth/routes.js
- apps/api/src/features/ldap/service.js
- apps/api/src/features/users/repo.js
- apps/api/src/server.js
- apps/api/src/shared/auth/jwt.js
- apps/api/src/shared/auth/session.js
- apps/api/src/shared/errors/problemDetails.js
- apps/web/package.json
- apps/web/src/app.jsx
- apps/web/src/features/users/auth-api.js
- apps/web/src/features/users/home-page.jsx
- apps/web/src/features/users/login-page.jsx
- apps/web/src/main.jsx
- apps/web/src/routes/router.jsx
- apps/web/src/shared/utils/api-client.js
- apps/web/src/styles/index.css
- tests/api/auth-login.test.mjs
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/1-2-ldap-sign-in-session.md

## Change Log

- 2026-01-28: Created story context for LDAP sign-in and session.
- 2026-01-28: Added LDAP auth, JWT session cookie, login UI flow, and API auth tests (pending local test run).
- 2026-01-28: Updated Prisma 7 config + generated client output and added MariaDB adapter.
- 2026-01-28: Fixed user repo DB path parsing, lazy-loaded auth user repo for tests, ran API auth tests, and updated JWT expiry default.
- 2026-01-28: Code review fixes (UUID IDs, `/auth/me` disabled checks, LDAP TLS flags, env defaults, and expanded tests).
