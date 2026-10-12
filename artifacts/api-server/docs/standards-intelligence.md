# Standards Intelligence — Phase 1 (backend)

Continuously refreshed monitoring of authoritative regulatory and occupational-health publications.
It is **not** a case evaluator: there is no employee scoring, no clinical case entry, and no fitness-for-duty logic. A published item never changes a medical requirement by itself.
The retired `/api/standards/catalog` and `/api/standards/evaluate` are not present and must not be recreated.

Base path: `/api/standards-intel` (self-description at `GET /api/standards-intel`).

| Method | Path | Returns |
|---|---|---|
| GET | `/updates` | Recent updates, newest first. Filters: `q`, `category`, `industry`, `jurisdiction`, `country`, `source`, `agency`, `status`, `class`, `since=YYYY-MM-DD`, `newOnly=1`, `includeIndex=1`, `sort=published\|detected\|changed`, `limit` (≤100), `offset` |
| GET | `/documents` | Same filters, whole archive |
| GET | `/documents/:id` | One document, its `versions` (fingerprints), `events`, and `related` documents |
| GET | `/changes` | Change events. Verified only unless `includeUnverified=1`. Filters: `document`, `source`, `kind`, `since` |
| GET | `/agencies` | Monitored agencies with their sources, and issuers that have documents |
| GET | `/sources`, `/sources/:id` | Source registry with health. Filters: `status`, `country` |
| GET | `/facets` | Categories, industries, jurisdictions, document classes, statuses (with counts) and category definitions |
| GET | `/status` | Health summary, schedule, running/last run, unavailable and pending sources |
| GET | `/runs`, `/runs/:runId` | Ingestion history and per-source results |
| POST | `/refresh` | Manual refresh. Body `{ sourceIds?: string[], agency?: string, wait?: boolean }`. `200` with the run, `202` if still running after 40 s (poll `/runs/:id`), `409` if a refresh is already running |

## Source methods (priority order)
1. Official RSS/Atom (OSHA, BLS, GovInfo, UK legislation/HSE, FDA, CDC MMWR, WHO).
2. Official keyless APIs: Federal Register API (structured type, effective date, RIN, correction link) and the eCFR versioner (issuer-supplied amendment dates).
3. No scraping and no keys are used. No source requires a key.

Sources with no confirmed machine-readable endpoint (NIOSH publications, EU-OSHA, EUR-Lex, ILO, IARC, Cal/OSHA, NFPA, ANSI, ISO) are registered as `pending_verification`, fetch nothing, and say why.
A source is `active` only after a successful fetch **and** parse. Failures are recorded, never hidden: `degraded` (worked before, failing now), `unavailable` (never verified, or 3+ consecutive failures). Recovery is automatic.

## Change detection
* Stable document ids; dedupe by canonical URL and by Federal Register document number across feeds.
* The first successful pass over a source is a **baseline**: documents are stored but nothing is announced as new.
* `new_publication` events require a publication date inside the last 21 days; older documents newly discovered raise nothing. A missing date yields an *unverified* "newly observed publication".
* `amendment` (verified) only from the eCFR version list; `superseded`, `withdrawn`, `corrected` (verified) only from issuer identifiers (shared Regulation Identifier Number, correction link, document type).
* Feed text that changes without such a marker is an **unverified possible change** with before/after fields. Markup, case, punctuation, whitespace, and timestamps never create a change (normalised fingerprints).
* Events have deterministic ids, so re-processing is idempotent.

## Operation
* Twice-daily automatic refresh (every 12 h) run by the API server, resumed after restarts from persisted run history. Disable with `STANDARDS_INTEL_MONITOR=off`.
* One refresh at a time across instances (database lease). A scheduled pass skips sources fetched in the last 6 h; any pass skips sources fetched in the last 5 min (15 min after a failure). One retry for transient errors. At most 4 hosts in parallel, one request at a time per host.
* Tables (created on first use): `si_sources`, `si_documents`, `si_document_versions`, `si_change_events`, `si_ingestion_runs`, `si_leases`.
* Classification is evidence-based (matched terms are stored with each document) and multi-category; `applicabilityNote` states that legal applicability to a specific employer or worker is not determined.

## Retries
Between the twice-daily passes the scheduler (checked every 15 min) retries only unhealthy sources: 15 min after the first failure, doubling per consecutive failure up to 6 h; a partly degraded source is re-read hourly. Archive-style feeds are limited to their 150 newest entries.
