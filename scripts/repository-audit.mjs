#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const ciMode = args.has('--ci');
const jsonMode = args.has('--json');
const baselinePath = path.join(root, 'docs', 'repository-cleanup-baseline.json');

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.pnpm-store']);
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json'];
const FRONTEND_ROOT = 'artifacts/occu-med-insight-hub/src';
const FRONTEND_ENTRY = `${FRONTEND_ROOT}/main.tsx`;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
}

function isGeneratedArtifact(rel) {
  return /(^|\/)dist\//.test(rel) || rel.endsWith('.tsbuildinfo') || /(^|\/)coverage\//.test(rel) || /(^|\/)playwright-report\//.test(rel) || /(^|\/)test-results\//.test(rel) || rel.endsWith('.d.ts.map');
}

function resolveImport(fromRel, spec) {
  if (!spec || (!spec.startsWith('.') && !spec.startsWith('@/'))) return null;
  const base = spec.startsWith('@/')
    ? path.join(root, FRONTEND_ROOT, spec.slice(2))
    : path.resolve(path.dirname(path.join(root, fromRel)), spec);

  const candidates = [base];
  for (const ext of SOURCE_EXTS) candidates.push(`${base}${ext}`);
  for (const ext of SOURCE_EXTS) candidates.push(path.join(base, `index${ext}`));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(root, candidate).split(path.sep).join('/');
    }
  }
  return null;
}

function importsFor(rel) {
  const abs = path.join(root, rel);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  const specs = new Set();
  const patterns = [
    /\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'";]+?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) specs.add(match[1]);
  }
  return [...specs].map((spec) => resolveImport(rel, spec)).filter(Boolean);
}

function reachableFrontendFiles(allFiles) {
  const frontendFiles = new Set(allFiles.filter((f) => f.startsWith(`${FRONTEND_ROOT}/`)));
  const reachable = new Set();
  const queue = [FRONTEND_ENTRY];
  while (queue.length) {
    const rel = queue.shift();
    if (!rel || reachable.has(rel) || !frontendFiles.has(rel)) continue;
    reachable.add(rel);
    for (const dep of importsFor(rel)) {
      if (frontendFiles.has(dep) && !reachable.has(dep)) queue.push(dep);
    }
  }
  return { frontendFiles, reachable };
}

function scanCoordinates(files) {
  const issues = [];
  const coordPattern = /coordinates\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
  for (const rel of files.filter((f) => /\.(ts|tsx|js|jsx|json)$/.test(f))) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    let match;
    while ((match = coordPattern.exec(text))) {
      const lon = Number(match[1]);
      const lat = Number(match[2]);
      if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
        issues.push({ file: rel, longitude: lon, latitude: lat, reason: 'out-of-range' });
      }
    }
  }
  return issues;
}


function countComponentInjectedStyles(allFiles) {
  const matches = [];
  for (const rel of allFiles.filter((f) => f.startsWith(`${FRONTEND_ROOT}/`) && /\.(tsx|jsx)$/.test(f))) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    if (/<style(?:\s|>)/.test(text)) matches.push(rel);
  }
  return matches;
}

function countCssLayers() {
  const entry = path.join(root, FRONTEND_ENTRY);
  if (!fs.existsSync(entry)) return [];
  const text = fs.readFileSync(entry, 'utf8');
  return [...text.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)].map((m) => m[1]);
}

const files = walk(root).sort();
const duplicateMap = new Map();
for (const rel of files) {
  const hash = sha256(rel);
  const bucket = duplicateMap.get(hash) ?? [];
  bucket.push(rel);
  duplicateMap.set(hash, bucket);
}
const duplicateGroups = [...duplicateMap.values()].filter((group) => group.length > 1);
const duplicateFiles = duplicateGroups.reduce((sum, group) => sum + group.length, 0);
const generatedArtifacts = files.filter(isGeneratedArtifact);
const { frontendFiles, reachable } = reachableFrontendFiles(files);
const unreachableFrontend = [...frontendFiles]
  .filter((f) => !reachable.has(f))
  .filter((f) => !/(^|\/)tests?\//.test(f))
  .filter((f) => !/\.d\.ts$/.test(f))
  .sort();
const cssLayers = countCssLayers();
const componentInjectedStyles = countComponentInjectedStyles(files);
const coordinateIssues = scanCoordinates(files);

const appShells = [
  'app/page.tsx',
  'artifacts/mockup-sandbox/src/main.tsx',
  FRONTEND_ENTRY,
].filter((rel) => files.includes(rel));

const knownArchitectureCandidates = [
  'app/page.tsx',
  'artifacts/mockup-sandbox/src/main.tsx',
  'artifacts/occu-med-insight-hub/src/data/visualizationIntelligenceAdapter.ts',
  'artifacts/api-server/src/services/dataVisualizationFeedService.ts',
  'artifacts/occu-med-insight-hub/src/pages/entity-discovery.tsx',
].filter((rel) => files.includes(rel));

const report = {
  generatedAt: new Date().toISOString(),
  totalFiles: files.length,
  duplicateGroups: duplicateGroups.length,
  duplicateFiles,
  generatedArtifactCount: generatedArtifacts.length,
  generatedArtifacts,
  frontendSourceFiles: frontendFiles.size,
  reachableFrontendFiles: reachable.size,
  unreachableFrontendFiles: unreachableFrontend.length,
  unreachableFrontend,
  appShellCount: appShells.length,
  appShells,
  globalCssLayerCount: cssLayers.length,
  globalCssLayers: cssLayers,
  componentInjectedStyleCount: componentInjectedStyles.length,
  componentInjectedStyles,
  invalidCoordinateCount: coordinateIssues.length,
  invalidCoordinates: coordinateIssues,
  knownArchitectureCandidateCount: knownArchitectureCandidates.length,
  knownArchitectureCandidates,
  duplicateSamples: duplicateGroups.slice(0, 20),
};

const failures = [];
if (ciMode) {
  if (!fs.existsSync(baselinePath)) {
    failures.push('Missing docs/repository-cleanup-baseline.json');
  } else {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const max = baseline.maximums ?? {};
    const comparisons = [
      ['totalFiles', report.totalFiles],
      ['duplicateGroups', report.duplicateGroups],
      ['duplicateFiles', report.duplicateFiles],
      ['generatedArtifactCount', report.generatedArtifactCount],
      ['unreachableFrontendFiles', report.unreachableFrontendFiles],
      ['appShellCount', report.appShellCount],
      ['globalCssLayerCount', report.globalCssLayerCount],
      ['componentInjectedStyleCount', report.componentInjectedStyleCount],
      ['invalidCoordinateCount', report.invalidCoordinateCount],
      ['knownArchitectureCandidateCount', report.knownArchitectureCandidateCount],
    ];
    for (const [key, current] of comparisons) {
      if (typeof max[key] === 'number' && current > max[key]) {
        failures.push(`${key} increased from allowed ${max[key]} to ${current}`);
      }
    }
    for (const required of baseline.requiredFiles ?? []) {
      if (!files.includes(required)) failures.push(`Required production file is missing: ${required}`);
    }
    for (const forbidden of baseline.forbiddenNewPatterns ?? []) {
      const regex = new RegExp(forbidden);
      const matches = files.filter((f) => regex.test(f));
      const allowed = new Set(baseline.allowedExistingMatches?.[forbidden] ?? []);
      for (const match of matches) {
        if (!allowed.has(match)) failures.push(`New forbidden artifact: ${match}`);
      }
    }
  }
}

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('Insight Hub 2.0 repository integrity audit');
  console.log(`Files: ${report.totalFiles}`);
  console.log(`Exact duplicate groups/files: ${report.duplicateGroups}/${report.duplicateFiles}`);
  console.log(`Generated artifacts tracked: ${report.generatedArtifactCount}`);
  console.log(`Frontend reachable/unreachable: ${report.reachableFrontendFiles}/${report.unreachableFrontendFiles}`);
  console.log(`Application shells: ${report.appShellCount}`);
  console.log(`Global CSS layers: ${report.globalCssLayerCount}`);
  console.log(`Component-injected style files: ${report.componentInjectedStyleCount}`);
  console.log(`Invalid coordinate literals: ${report.invalidCoordinateCount}`);
  console.log(`Known architecture candidates: ${report.knownArchitectureCandidateCount}`);
  if (failures.length) {
    console.error('\nRepository integrity regressions:');
    for (const failure of failures) console.error(`- ${failure}`);
  } else if (ciMode) {
    console.log('\nNo repository-integrity regression detected against the cleanup baseline.');
  }
}

process.exitCode = failures.length ? 1 : 0;
