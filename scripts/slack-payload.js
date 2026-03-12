#!/usr/bin/env node
/**
 * Generates a Slack payload JSON file from test-results/junit.xml.
 * Usage: node scripts/slack-payload.js <success|failure> <run_url>
 * Writes the payload to test-results/slack-payload.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const jobStatus = process.argv[2] || 'success';
const runUrl    = process.argv[3] || '';

const icon  = jobStatus === 'success' ? '✅' : '❌';
const color = jobStatus === 'success' ? 'good' : 'danger';

let total = '?', passed = '?', failed = '?', skipped = '?', duration = '?s';
const tests = [];

if (existsSync('test-results/junit.xml')) {
  const xml = readFileSync('test-results/junit.xml', 'utf8');

  total    = (xml.match(/<!--\s*tests (\d+)/)       || [])[1] ?? '?';
  passed   = (xml.match(/<!--\s*pass (\d+)/)        || [])[1] ?? '?';
  failed   = (xml.match(/<!--\s*fail (\d+)/)        || [])[1] ?? '?';
  skipped  = (xml.match(/<!--\s*skipped (\d+)/)     || [])[1] ?? '?';
  const ms = parseFloat((xml.match(/<!--\s*duration_ms ([\d.]+)/) || [])[1] ?? '0');
  duration = (ms / 1000).toFixed(2) + 's';

  for (const block of xml.split(/(?=<testcase[\s>])/)) {
    if (!block.trimStart().startsWith('<testcase')) continue;
    const name = (block.match(/\bname="([^"]*)"/) || [])[1] ?? '';
    const time = parseFloat((block.match(/\btime="([^"]*)"/) || [])[1] ?? '0');
    const ms   = Math.round(time * 1000);

    let icon;
    if (/<failure/.test(block) || /<error/.test(block)) icon = '❌';
    else if (/<skipped/.test(block))                    icon = '⏭️';
    else                                                icon = '✅';

    tests.push(`${icon} ${name} _(${ms}ms)_`);
  }
}

const testList = tests.join('\n') || '_No test data available_';

const payload = {
  attachments: [
    {
      color,
      title: `${icon} API Tests — ${jobStatus.toUpperCase()}`,
      fields: [
        { title: '✅ Passed',   value: passed,   short: true },
        { title: '❌ Failed',   value: failed,   short: true },
        { title: '⏭️ Skipped',  value: skipped,  short: true },
        { title: '⏱️ Duration', value: duration, short: true },
      ],
      text: `*Test Details:*\n${testList}`,
      footer: runUrl ? `<${runUrl}|View full run on GitHub>` : '',
      mrkdwn_in: ['text'],
    },
  ],
};

writeFileSync('test-results/slack-payload.json', JSON.stringify(payload));
console.log('Slack payload written.');
