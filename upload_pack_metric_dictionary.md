# Weatherford + Freeport + CACI Upload Pack — Metric Dictionary

Use these formulas in the Data Profiles portal so client pages remain dynamic after each refresh.

## Required dimensions
- `client_id`
- `client_name`
- `reporting_year`

## Core numeric fields
- `trir`
- `bls_industry_trir`
- `total_recordables`
- `near_miss_count`
- `fatalities`
- `employee_trir`
- `contractor_trir`
- `injuries_avoided_annual`
- `injury_cost_low_usd`
- `injury_cost_high_usd`

## Calculated metrics
1. **TRIR vs Benchmark Gap %**
   - Formula: `(1 - trir / bls_industry_trir) * 100`
   - Interpretation: Positive means better than benchmark.

2. **Near-Miss per Recordable**
   - Formula: `near_miss_count / total_recordables`
   - Use for leading-indicator pressure.

3. **Fatality Risk Flag**
   - Formula: `CASE WHEN fatalities > 0 THEN 'RED' ELSE 'GREEN' END`

4. **Contractor Risk Flag**
   - Formula: `CASE WHEN contractor_trir > employee_trir THEN 'RED' ELSE 'GREEN' END`

5. **Direct Cost Avoided (Low/High)**
   - Low: `injuries_avoided_annual * injury_cost_low_usd`
   - High: `injuries_avoided_annual * injury_cost_high_usd`

6. **Occ-Med Value Band (text)**
   - Formula: `concat('$', format(direct_cost_avoided_low_usd), ' - $', format(direct_cost_avoided_high_usd))`

## Visual layout recommendation (per client profile)
1. KPI cards: TRIR, Fatalities, Near-Miss Rate, Benchmark Gap %
2. Trend line: Employee TRIR vs Contractor TRIR vs Near-Miss Rate
3. Benchmark bars: Client vs BLS vs peer set
4. Site hotspot bars: citations/penalties by site
5. Executive narrative tile: "What Occu-Med Should Say"

## CACI-specific notes
- Use `reporting_year=2023` for safety rate data to match CACI’s disclosed CY2023 metrics.
- Keep CACI high-consequence trend content in narrative fields and optional supporting tables.
- If using CACI vs Amentum comparison visuals, store those in a separate comparative dataset (not this client-level upload file).

## Data QA before publish
- Ensure `client_id` is not null and unique per client-year.
- Confirm all rate fields are numeric (no `%` symbols in source).
- Verify `total_recordables > 0` before calculating near-miss ratio.
- Keep currency fields in plain USD numbers (no commas) in raw upload.
