# Insight Hub 2.0 Repository Cleanup Manifest

## Purpose

This file controls the staged cleanup of Insight Hub 2.0. Cleanup must proceed through isolated pull requests, preserve production behavior, and lower—never silently raise—the repository integrity baseline.

## Phase status

- **Phase 1 — safety and inventory:** complete in PR #29.
- **Phase 2 — proven garbage removal:** complete in PR #30.
- **Phase 3 — canonical data spine:** complete in PR #31.
- **Phase 4 — visualization validity:** complete in PR #32.
- **Phase 5 — style consolidation:** implemented in PR #33.
- **Phase 6 — shared-data security:** pending.

## Canonical data path

`seed -> configuration registry -> uploaded workbooks -> curated dossiers -> uploaded report replacements -> live intelligence`

## Phase 5 visual architecture

The frontend now has one explicit style order:

`foundation.css -> Leaflet vendor CSS -> application.css`

- `foundation.css` owns Tailwind integration, semantic theme values, typography, base elements, and the unified dark-glass token system.
- `application.css` owns the aurora field, liquid-glass cards, landing page, map treatment, cinematic components, and Data Visualization page styles.
- the five former patch files are removed;
- the React-injected cinematic `<style>` block is removed;
- broad CSS that hid arbitrary fixed-position widgets is removed;
- old selectors that hid already-removed prototype components are removed;
- broad utility matching is scoped beneath `.aurora-bg`;
- CI now prevents the global import stack from growing beyond three layers and prevents component-injected style tags from returning.

## Visual preservation rule

The consolidation preserves the existing dark navy palette, luminous cyan/emerald/violet accents, aurora depth, liquid-glass cards, landing logo sizing, Leaflet presentation, cinematic panels, motion behavior, and reduced-motion fallback. Phase 5 changes ownership and cascade structure rather than redesigning the interface.

## Keep: production-critical

Production entrypoints, live routes, reachable components, API services, database schemas, migrations, Render configuration, company data, and uploaded source material remain protected.

## Remaining phase

### Phase 6: shared-data security

Require authenticated, role-protected access for portal-link changes, entity verification, location imports, and intelligence ingestion.

## Review rule

Every cleanup pull request must state what it removes or replaces, how production behavior was validated, how the baseline changed, and whether data or visual behavior changed.
