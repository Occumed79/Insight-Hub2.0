# Federal Agencies — Edolus proof source manifest

Route: `/federal-agencies`
Branch: `design/federal-agencies-edolus-proof`

## Source mechanics

Primary source: Edolus — https://www.edolus.com/

Extracted source evidence supplied by the user and recorded in `docs/design-sources/edolus-extracted-source-reference.md`.

Reused mechanics:
- full-viewport scene composition
- split black-band reveal at 1600ms using `cubic-bezier(.65,0,.35,1)`
- title de-blur/fade presentation
- General Sans + JetBrains Mono typography pairing
- sparse perimeter controls
- persistent cinematic scene with operational content layered into the same workspace

Not reused:
- Edolus copy, branding, AI subject matter, logos, GLB models, textures, videos, photographs, or rendered media assets

## Federal subject assets

Initial proof photo:
- DOD "Pentagon Sign"
- Official source page: https://www.defense.gov/Multimedia/Photos/igphoto/2002570077/
- Direct media source: https://media.defense.gov/2021/Jan/25/2002570077/-1/-1/0/210122-D-BN624-0029Y.JPG
- Credit listed by DOD: Lisa Ferdinando, DOD
- DOD states its photographs/imagery are generally public domain unless otherwise noted; seal/logo restrictions remain separate.

Agency website identities are referenced through each agency's official domain/favicon. Do not add restricted federal seals merely as decoration.

## Preserved application behavior

- agency directory navigation
- search/filter
- all ten existing federal intelligence views
- SAM.gov opportunity loading
- persisted forecast/recompete/incumbent/deployment-medical buckets
- contracting-office aggregation
- leadership source links
- organization structure
- evidence inspector
- official/source record links
- loading/error/empty states
- manual feed refresh added without changing API contracts
