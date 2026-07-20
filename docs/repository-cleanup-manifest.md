# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file controls the staged cleanup of Insight Hub 2.0. Cleanup must proceed through isolated pull requests, preserve production behavior, and lower—never silently raise—the repository integrity baseline.

## Phase status

- **Phase 1 — safety and inventory:** complete in PR #29.
- **Phase 2 — proven garbage removal:** complete in PR #30.
- **Phase 3 — canonical data spine:** complete in PR #31.
- **Phase 4 — visualization validity:** complete in PR #32.
- **Phase 5 — style consolidation:** complete in PR #33.
- **Phase 6 — shared-data security:** implemented in PR #34.

## Canonical data path

`seed -> configuration registry -> uploaded workbooks -> curated dossiers -> uploaded report replacements -> live intelligence`

## Visual architecture

`foundation.css -> Leaflet vendor CSS -> application.css`

The current dark navy, luminous cyan/emerald/violet, aurora, liquid-glass, map, cinematic, motion, and reduced-motion language remains the protected presentation system.

## Phase 6 access model

Insight Hub uses one shared workspace with two roles:

- **Admin:** may change portal links, create/import/update/verify shared entity locations, run intelligence ingestion, create invitations, and manage user role/enabled status.
- **User:** may sign in and use the shared read-only intelligence workspace but may not mutate shared records.

The access model deliberately excludes organizations, employer accounts, multiple tenants, teams, departments, OAuth, SSO, public registration, password reset automation, and a complex permission matrix.

## Phase 6 security controls

- secure opaque session tokens stored as SHA-256 hashes in Postgres;
- HTTP-only, secure-in-production, strict SameSite cookies;
- scrypt password hashing with per-password random salts;
- invite-only account creation with expiring, hashed, single-use invitation tokens;
- automatic first-Admin bootstrap from server-only `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD` environment variables;
- account disablement immediately revokes active sessions;
- last-enabled-Admin protection prevents administrative lockout;
- same-origin credential policy replaces unrestricted CORS;
- successful security-sensitive operations write metadata-only audit events without logging passwords, invitation tokens, session tokens, or API keys;
- CI audits the eight protected shared-write operations and rejects unrestricted CORS or weakened session-cookie settings.

## Protected shared writes

- portal-link changes;
- entity discovery candidate persistence;
- manual location creation;
- location detail updates;
- entity/location verification;
- company-location text imports;
- bulk manual location imports;
- company intelligence ingestion.

Read-only profile, chart, source-status, map, and public health endpoints remain available without forcing Insight Hub into an unnecessary full-SaaS access model.

## Deployment requirement

Set the following server-side environment variables before using protected writes:

- `AUTH_ADMIN_EMAIL`
- `AUTH_ADMIN_PASSWORD` — at least 12 characters
- `AUTH_ADMIN_NAME` — optional
- `PUBLIC_APP_URL` — recommended for generated invitation links

Private provider credentials remain server-side only and must never use `VITE_` names.

## Keep: production-critical

Production entrypoints, live routes, reachable components, API services, database schemas, Render configuration, company data, uploaded workbooks, reports, dossiers, and source material remain protected.

## Review rule

Every cleanup pull request must state what it removes or replaces, how production behavior was validated, how the baseline changed, and whether data or visual behavior changed.
