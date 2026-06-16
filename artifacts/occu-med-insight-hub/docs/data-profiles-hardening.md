# Data Profiles Hardening Checklist

PR #20 was merged before final browser verification. This file tracks the remaining checks.

## Confirmed in code

- Metrics filter only by selected company ID.
- Source Library filters only by selected company ID.
- `CompanyDossierRenderer` is wired into `data-profiles.tsx`.
- Stub profiles show a pending chart-data card instead of inheriting another company's charts.
- `ChartDefinition` includes typed interaction fields for tooltips, drill-down, filters, linked charts, detail panels, transitions, and advanced visual presets.

## Browser verification required

For every company in the Data Profiles dropdown, verify:

- page does not crash
- company name and executive signals render
- full chart profiles show charts
- stub profiles show the pending chart-data state
- no V2X fallback metrics or source records leak into unrelated companies
- dossier sections render through `CompanyDossierRenderer`
- luminous glass tooltips render correctly
- the macOS Tahoe liquid-glass design is preserved

## Interaction layer follow-up

The type system supports the intended interaction language, but runtime behavior still needs hardening before claiming full implementation.

Required follow-up behaviors:

- configured filters actually filter chart data
- configured detail panels open from chart data points
- configured linked chart groups visibly highlight related charts
- advanced visual presets map to controlled visual effects without redesigning the app

## Deployment note

Cloudflare Pages was failing before merge. Confirm whether the failure is caused by Cloudflare dashboard build settings, root workspace build behavior, or a real app build issue.
