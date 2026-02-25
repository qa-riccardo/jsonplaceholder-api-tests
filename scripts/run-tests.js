#!/usr/bin/env node
/**
 * Cross-platform test runner.
 * Replaces shell-specific syntax (RUN_LIVE=true, &&, ;) with plain Node.
 *
 * Usage:
 *   node scripts/run-tests.js              → mock tests only
 *   node scripts/run-tests.js --live       → mock + live tests
 *   node scripts/run-tests.js --report     → mock tests + HTML report
 *   node scripts/run-tests.js --live --report → all tests + HTML report
 */

import { mkdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const args   = process.argv.slice(2);
const live   = args.includes('--live');
const report = args.includes('--report');

// Set env vars cross-platform
if (live) process.env.RUN_LIVE = 'true';

// Ensure output directory exists
mkdirSync('test-results', { recursive: true });

// Build reporter args
const reporterArgs = report
  ? [
      '--test-reporter=junit',
      '--test-reporter-destination=test-results/junit.xml',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
    ]
  : [];

// Explicitly list only spec files — prevents helpers (e.g. mockServer.js)
// from being picked up as test files by the runner
const specFiles = [
  'test/comments-email-validation.spec.js',
  'test/contract.spec.js',
];

// Run tests
const result = spawnSync(
  process.execPath,
  ['--test', ...reporterArgs, ...specFiles],
  { stdio: 'inherit', env: process.env }
);

// Generate HTML report if requested
if (report && existsSync('test-results/junit.xml')) {
  const gen = spawnSync(process.execPath, [resolve('scripts/generate-report.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (gen.status !== 0) process.exit(gen.status ?? 1);
}

process.exit(result.status ?? 0);
