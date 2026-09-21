# Insight Hub 2.0 — Sourced-Asset Redesign Design

Date: 2026-09-21

## Purpose

Replace the remaining generic-card / generic-dashboard presentation in Insight Hub 2.0 with higher-fidelity, domain-native workspaces while obeying a strict source-only rule: no visual language, layout, component, diagram, effect, illustration, molecule, anatomy model, or interaction pattern may be invented for this pass.

The implementation must adapt existing, inspectable assets/templates/components and connect them to the existing Insight Hub data and behavior.

## Non-negotiable source-only rule

For every changed visual or interaction:

- It must originate from a real existing template, asset, component, diagram template, or open-source visual package.
- The source must be recorded before implementation: provider, title/name, URL or repository, license/usage terms when available, and which Insight Hub surface it is being adapted into.
- Allowed source families for workspace composition: Figma, Magic Patterns, Mermaid Chart, Lucid, and Miro.
- Existing external visualization packages may be used for special-purpose scientific/medical rendering when they are the actual source asset rather than a hand-built substitute.
- Tailoring is allowed: labels, data bindings, filters, field names, routes, copy, sizing, approved palette/token mapping, and integration behavior.
- Reinvention is forbidden.

### Explicitly forbidden

- No blank-canvas UI generation.
- No AI-prompted Magic Patterns design generation from scratch.
- No original Figma layout authored from scratch.
- No hand-authored “futuristic” cards, shells, hero sections, shaders, gradients, HUDs, glows, or decorative geometry.
- No hand-authored Mermaid/Lucid/Miro diagram style created from an empty canvas; start from an existing template/example.
- No custom molecule drawing.
- No custom anatomy/hologram drawing or procedural stand-in.
- No copy-paste universal dashboard shell across unrelated tools.
- No replacement of working data/API behavior merely to fit a template.

## Protected / excluded surfaces

Do not redesign these pages:

- Landing / Home: `/`
- DBA Data Hub: `/dba-intelligence`
- O*NET Master Tool: `/onet-master-tool`
- Occupational Data Explorer: `/occupational-data-explorer`

AOR Factors is also excluded from this redesign pass because its globe-first workspace has already been rebuilt and merged.

## Explicitly in scope

The redesign pass includes the remaining non-protected generic surfaces, including the two currently open redesign PRs:

- Job Intelligence — include PR #202; do not assume its current visual work is approved.
- Federal Awards Intelligence — include PR #203; do not assume its current visual work is approved.
- Injuries & Medical Conditions — replace the current weak hologram/anatomy treatment with a sourced interactive anatomy asset.
- Drug Checker — replace the current molecule treatment with a sourced, scientifically grounded interactive molecular viewer.
- Clinical Calculators
- Standards Intelligence
- Federal Agencies
- State Agencies
- SEC Filings
- Organizational Chart
- Industry Impact Calculator
- Occupational Calculators
- Defense Medical Support surfaces outside the already-specialized map/globe
- Legal & Injury Intelligence

Routes or compatibility aliases feeding an in-scope production workspace should inherit the same sourced visual surface rather than creating a second presentation.

## Sourced special visual replacements

### Drug Checker molecule

Primary source candidate:
- Mol* / Molstar Components
- Repository: https://github.com/molstar/molstar-components
- Existing components include `MolstarViewer`, `EditorWithViewer`, `MolViewStateBuilder`, `BuilderWithViewer`, and `BuilderWithEditorAndViewer`.
- Use the existing viewer/component behavior and connect it to real drug/structure data already available to the application or a documented structure source.
- Do not build a custom molecule renderer.

### Injuries & Medical anatomy visual

Primary source candidates:
- Human Atlas: https://github.com/ashemag/human-atlas
- Human Atlas alternative: https://github.com/slorksmo/Human-Atlas
- Vanatome: https://github.com/vixotic/Vanatome

Selection must be made from the existing viewers after inspecting their actual rendered behavior, licensing, embed/integration path, and anatomy fidelity. The chosen viewer is adapted into the workspace; no new hologram is drawn.

## Existing template/asset families already identified for evaluation

### Figma

Use existing community/template files only. Candidate sources identified for evaluation include:

- Figma Dashboard Design Templates: https://www.figma.com/templates/dashboard-designs/
  - Vision UI dashboard
  - Healthcare Dashboard
  - dark-mode dashboard kits and chart systems available from the same template collection
- Turing UI Kit — AI Healthcare Analytics / Predictive Health (Figma-format healthcare/biotech kit; existing screens/components)
- Editorial data-viz community file: https://www.figma.com/community/file/1638658339772486828
- SaaS Analytics Dashboard components community file: https://www.figma.com/community/file/1484134508275174299/saas-analytics-dashboard-components

A page may use only the parts of a kit that materially fit its workflow; do not force a template onto unrelated data.

### Magic Patterns

Use existing template/community designs or an existing imported design-system artifact only.

Do not call blank `create_design` generation to invent a replacement screen. If a Magic Patterns source is selected, it must be an existing design/template that can be forked or read, then tailored to the Insight Hub content.

### Miro

Use existing Miro template-library structures for network, relationship, evidence-flow, or process surfaces. Candidate collections include:
- Dashboard Wireframes
- Network Diagram templates
- ERD Healthcare Management System
- other relevant built-in/community templates surfaced from Miro’s template library

### Lucid

Use existing Lucid templates for relationship, hierarchy, system, evidence, or status surfaces. Candidate template families include:
- Network diagram example
- Network config and status
- Health — Overview
- Health — Disease Surveillance
- Health — Utilization Management

### Mermaid Chart

Use existing Mermaid Chart diagram examples/templates and supported diagram styles where a workspace genuinely benefits from a relationship/flow view. Do not create a decorative flowchart merely to use Mermaid.

## Workspace mapping rule

Every in-scope route gets a source manifest before code changes:

| Field | Required |
| --- | --- |
| Route/workspace | Yes |
| Existing source asset/template | Yes |
| Source provider | Yes |
| Exact URL/repository/template ID | Yes |
| License/usage note | Yes when available |
| Existing Insight Hub data/API preserved | Yes |
| Exact template elements reused | Yes |
| Exact elements omitted | Yes |
| Tailoring limited to data/content/integration/token fit | Yes |

If a page has no satisfactory sourced asset, stop that page. Do not fill the gap with an original design.

## Visual quality target

The user’s requested quality target is futuristic, spatial, cinematic, data-rich, and substantially beyond generic SaaS cards. That target is a selection criterion for choosing existing assets, not permission to invent a visual style.

Across the app, coherence comes from preserving the existing Insight Hub navigation, approved palette/tokens where compatible, data models, and behavior. The page body may differ radically when the sourced template demands it.

## Data and behavior preservation

The redesign is visual/interaction architecture work, not a data rewrite.

Preserve:
- existing production routes and compatibility aliases
- existing API contracts and source integrations
- saved-state behavior
- filters, queries, search, selected-row/detail behavior
- official-source links and evidence provenance
- map/globe behavior already approved
- current Neon persistence and backend service boundaries

When a sourced template contains fake metrics or placeholder data, replace them only with values already supported by the application. Do not invent KPIs.

## Job Intelligence and Federal Awards

PR #202 and PR #203 are source material only, not approved final design.

Before either is merged:
1. Re-evaluate the page against the source-only rule.
2. Replace any assistant-invented layout/chrome with selected sourced template/component structures.
3. Preserve the useful semantic/data wiring from the PR only where it does not dictate unsourced visual design.
4. Supersede or update those PRs rather than treating their current presentation as final.

## Implementation boundaries

- No GitHub Actions/workflows for this redesign.
- Direct/manual repository edits only.
- Keep page changes isolated so one workspace cannot overwrite another.
- No shared new “futuristic shell” component that makes every tool look identical.
- Preserve the four protected pages byte-for-byte in presentation source unless the user explicitly reverses protection.

## Acceptance criteria

A redesigned page is complete only when:

1. Every major visible structure can be traced to a named existing source asset/template/component.
2. The source manifest is present.
3. No invented placeholder metric/data appears.
4. Existing app behavior still works.
5. The page no longer reads as a generic grid of cards.
6. The page remains visually distinct from unrelated workspaces.
7. Special scientific/medical visuals are sourced from real existing viewers/assets rather than improvised graphics.
8. Protected pages remain untouched.
