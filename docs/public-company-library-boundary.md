# Public Company Library boundary

The public Insight Hub company workspace is company-first and relationship-neutral.

## Public UI may show

- Saved company/entity names from the neutral `entities` table.
- Public-source location evidence and verification state.
- Official website / Wikidata identifiers when present in saved public metadata.
- Public-source discovery timestamps/status.
- Links into public intelligence workspaces such as federal awards, legal/injury records, and FEC evidence.

## Public UI must not show or infer

- Occu-Med client status or prospect status.
- Any commercial relationship with Occu-Med.
- Internal pricing, revenue, referrals, scheduling, medical/case data, provider data, applicant/employee data, internal notes, or internal uploads.

Legacy `/prospects` and `/clients` URLs remain compatibility aliases only. They resolve to the same neutral Company Library and do not change the data classification shown to the user.

Opening the Company Library reads saved Neon-backed entity data only. External public-source scans must be explicit actions in the research workflows rather than page-load side effects.
