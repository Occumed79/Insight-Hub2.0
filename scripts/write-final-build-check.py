from pathlib import Path

FINAL_BUILD_CHECK = '''name: Build Check

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  typecheck-build-and-browser:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      NODE_ENV: test
      BASE_PATH: /
      CI: true
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          run_install: false

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies from lockfile
        run: pnpm install --frozen-lockfile

      - name: Repository integrity audit
        run: pnpm run audit:repository

      - name: Frontend reachability inventory
        shell: bash
        run: |
          node scripts/repository-audit.mjs --json > /tmp/hub2-repository-audit.json
          node --input-type=module - <<'NODE'
          import fs from 'node:fs';
          const report = JSON.parse(fs.readFileSync('/tmp/hub2-repository-audit.json', 'utf8'));
          console.log(`Reachable frontend files: ${report.reachableFrontendFiles}`);
          console.log(`Unreachable frontend files: ${report.unreachableFrontendFiles}`);
          for (const file of report.unreachableFrontend ?? []) console.log(`UNREACHABLE ${file}`);
          console.log('Known architecture candidates:');
          for (const file of report.knownArchitectureCandidates ?? []) console.log(`CANDIDATE ${file}`);
          NODE

      - name: Unit and persistence integration tests
        run: pnpm run test

      - name: Typecheck
        run: pnpm run typecheck

      - name: React 19 map and OSHA persistence audit
        run: pnpm run audit:osha-persistence

      - name: Production build
        run: pnpm run build

      - name: Install Playwright Chromium
        timeout-minutes: 5
        run: pnpm --filter @workspace/occu-med-insight-hub exec playwright install chromium

      - name: Browser acceptance — Hub 2 UI hardening
        timeout-minutes: 5
        run: pnpm run test:browser

      - name: Upload browser failure artifacts
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: hub2-playwright-failure
          if-no-files-found: ignore
          retention-days: 7
          path: |
            artifacts/occu-med-insight-hub/playwright-report
            artifacts/occu-med-insight-hub/test-results
'''

Path('.github/workflows/build-check.yml').write_text(FINAL_BUILD_CHECK, encoding='utf-8')
print('Normalized Build Check to read-only permissions and frozen-lockfile installation.')
