import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERIFICATION_DIR = path.join(__dirname, '../verification/data-profiles');
const REPORT_PATH = path.join(__dirname, '../docs/data-profiles-browser-verification.md');

// Sample companies to test (representative of different types)
const SAMPLE_COMPANIES = [
  'v2x',           // Full config with charts
  'jacobs',        // Stub company (should show pending state)
  'datapath',      // Stub company (should show pending state)
  'caci',          // Dossier company
  'trace-systems', // Visual dossier
];

interface TestResult {
  companyId: string;
  companyName: string;
  loads: boolean;
  crashes: boolean;
  consoleErrors: string[];
  executiveSignalsRender: boolean;
  chartsRender: boolean;
  pendingState: boolean;
  sourceLibraryV2XLeak: boolean;
  screenshot: string;
  notes: string[];
}

const results: TestResult[] = [];

test.beforeAll(async () => {
  // Create verification directories
  if (!fs.existsSync(VERIFICATION_DIR)) {
    fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
  }
  const docsDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
});

test.describe('Data Profiles Browser Verification', () => {
  test('should load data profiles page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/data-profiles');
    await page.waitForLoadState('networkidle');

    // Check for page crashes
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    // Check for console errors
    if (consoleErrors.length > 0) {
      console.log('Console errors on initial load:', consoleErrors);
    }
  });

  test('should test all company profiles', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/data-profiles');
    await page.waitForLoadState('networkidle');

    // Get all company options from dropdown
    const select = page.locator('select');
    await expect(select).toBeVisible();

    const options = await select.locator('option').all();
    const companyIds: string[] = [];
    const companyNames: Map<string, string> = new Map();

    for (const option of options) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      if (value && text) {
        companyIds.push(value);
        companyNames.set(value, text);
      }
    }

    console.log(`Found ${companyIds.length} companies in dropdown`);
    console.log(`Testing sample companies: ${SAMPLE_COMPANIES.join(', ')}`);

    // Test sample companies with fresh page load
    for (const companyId of SAMPLE_COMPANIES) {
      const result: TestResult = {
        companyId,
        companyName: companyNames.get(companyId) || companyId,
        loads: false,
        crashes: false,
        consoleErrors: [],
        executiveSignalsRender: false,
        chartsRender: false,
        pendingState: false,
        sourceLibraryV2XLeak: false,
        screenshot: '',
        notes: [],
      };

      try {
        console.log(`Testing company: ${companyId} (${companyNames.get(companyId)})`);

        // Fresh page load for each company
        await page.goto('/data-profiles');
        await page.waitForLoadState('networkidle');

        // Select company
        const select = page.locator('select');
        await expect(select).toBeVisible();
        await select.selectOption(companyId);
        await page.waitForTimeout(2000); // Wait for React state updates

        // Check if page loads
        const bodyVisible = await page.locator('body').isVisible();
        result.loads = bodyVisible;

        // Check for crashes
        const bodyText = await page.locator('body').textContent();
        result.crashes = !bodyText || bodyText.includes('Application error');

        // Capture console errors for this company
        result.consoleErrors = [...consoleErrors];

        // Check executive signals render
        const executiveStrip = page.locator('.executive-strip');
        const executiveSignalsVisible = await executiveStrip.isVisible().catch(() => false);
        result.executiveSignalsRender = executiveSignalsVisible;

        // Check if charts render or pending state appears
        // The pending state message contains "Detailed chart visualizations pending data upload"
        const pendingMessage = page.getByText(/Detailed chart visualizations pending data upload/i);
        const pendingVisible = await pendingMessage.isVisible().catch(() => false);
        
        // Check for actual company charts (CompanyChartRenderer output)
        // We look for multiple chart elements which indicates CompanyChartRenderer rendered
        const chartElements = page.locator('.recharts-wrapper');
        const chartCount = await chartElements.count();
        
        // If we have the pending message, it's a stub company
        // If we have many chart elements (more than the fallback metrics chart), it has company charts
        if (pendingVisible) {
          result.pendingState = true;
          result.notes.push('Pending state shown for stub company');
        } else if (chartCount > 1) {
          result.chartsRender = true;
          result.notes.push('Company charts rendered');
        } else {
          result.notes.push('No company charts detected (may be stub without pending state UI)');
        }

        // Check for V2X data leakage in Source Library
        const sourceLibrary = page.locator('h3:has-text("Source Library")').locator('..');
        const sourceLibraryVisible = await sourceLibrary.isVisible().catch(() => false);
        
        if (sourceLibraryVisible) {
          const v2xSources = sourceLibrary.getByText(/V2X|Vectrus/i);
          const v2xCount = await v2xSources.count();
          
          if (companyId !== 'v2x' && v2xCount > 0) {
            result.sourceLibraryV2XLeak = true;
            result.notes.push('V2X data detected in source library');
          } else {
            result.notes.push('No V2X data leakage detected');
          }
        } else {
          result.notes.push('Source Library not visible');
        }

        // Take screenshot
        const screenshotPath = path.join(VERIFICATION_DIR, `${companyId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;

        // Verify company name appears
        const companyNameInPage = await page.getByText(companyNames.get(companyId) || companyId, { exact: false }).count();
        if (companyNameInPage === 0) {
          result.notes.push('Company name not found in page');
        }

        // Basic checks
        if (!result.loads) {
          result.notes.push('Page failed to load');
        }
        if (result.crashes) {
          result.notes.push('Page crashed');
        }

        results.push(result);

      } catch (error) {
        result.crashes = true;
        result.notes.push(`Error during testing: ${error}`);
        results.push(result);
        console.error(`Error testing ${companyId}:`, error);
        // Don't throw - continue testing other companies
      }
    }

    // Overall assertions
    const failedLoads = results.filter(r => !r.loads);
    const crashes = results.filter(r => r.crashes);
    const v2xLeaks = results.filter(r => r.sourceLibraryV2XLeak);

    console.log(`Test results: ${results.length} total, ${failedLoads.length} failed loads, ${crashes.length} crashes, ${v2xLeaks.length} V2X leaks`);

    expect(failedLoads.length).toBe(0);
    expect(crashes.length).toBe(0);
    expect(v2xLeaks.length).toBe(0);
  });
});

test.afterAll(async () => {
  // Generate markdown report
  let report = `# Data Profiles Browser Verification Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `Total companies tested: ${results.length}\n`;
  report += `Successful loads: ${results.filter(r => r.loads).length}\n`;
  report += `Crashes: ${results.filter(r => r.crashes).length}\n`;
  report += `Companies with charts: ${results.filter(r => r.chartsRender).length}\n`;
  report += `Companies with pending state: ${results.filter(r => r.pendingState).length}\n`;
  report += `V2X data leaks: ${results.filter(r => r.sourceLibraryV2XLeak).length}\n\n`;

  report += `## Detailed Results\n\n`;
  report += `| Company | Loads | Crashes | Executive Signals | Charts | Pending State | V2X Leak | Notes |\n`;
  report += `|---------|-------|---------|-------------------|--------|---------------|----------|-------|\n`;

  for (const result of results) {
    const notes = result.notes.join('; ');
    report += `| ${result.companyName} | ${result.loads ? '✓' : '✗'} | ${result.crashes ? '✗' : '✓'} | ${result.executiveSignalsRender ? '✓' : '✗'} | ${result.chartsRender ? '✓' : '✗'} | ${result.pendingState ? '✓' : '✗'} | ${result.sourceLibraryV2XLeak ? '✗' : '✓'} | ${notes} |\n`;
  }

  report += `\n## Issues Found\n\n`;
  const issues = results.filter(r => r.crashes || r.consoleErrors.length > 0 || r.sourceLibraryV2XLeak);
  if (issues.length === 0) {
    report += `No critical issues found.\n`;
  } else {
    for (const issue of issues) {
      report += `### ${issue.companyName}\n`;
      if (issue.crashes) {
        report += `- **CRASH**: Page crashed during testing\n`;
      }
      if (issue.consoleErrors.length > 0) {
        report += `- **Console Errors**: ${issue.consoleErrors.join(', ')}\n`;
      }
      if (issue.sourceLibraryV2XLeak) {
        report += `- **DATA LEAK**: V2X data detected in source library\n`;
      }
      report += `\n`;
    }
  }

  report += `\n## Screenshots\n\n`;
  report += `Screenshots saved to: \`verification/data-profiles/\`\n\n`;

  fs.writeFileSync(REPORT_PATH, report);
  console.log(`Verification report saved to: ${REPORT_PATH}`);
});
