#!/usr/bin/env node
/**
 * Generates a Slack payload JSON file from test-results/junit.xml.
 * Usage: node scripts/slack-payload.js <success|failure> <run_url>
 * Writes the payload to test-results/slack-payload.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const jobStatus   = process.argv[2] || 'success';
const runUrl      = process.argv[3] || '';
const branch      = process.argv[4] || '';
const commitSha   = process.argv[5] || '';
const commitMsg   = process.argv[6] || '';
const actor       = process.argv[7] || '';
const trigger     = process.argv[8] || '';

const icon  = jobStatus === 'success' ? '✅' : '❌';
let passed = '?', failed = '?', skipped = '?', duration = '?s';
const tests = [];

if (existsSync('test-results/junit.xml')) {
  const xml = readFileSync('test-results/junit.xml', 'utf8');

  passed   = parseInt((xml.match(/<!--\s*pass (\d+)/)    || [])[1] ?? '0');
  failed   = parseInt((xml.match(/<!--\s*fail (\d+)/)    || [])[1] ?? '0');
  skipped  = parseInt((xml.match(/<!--\s*skipped (\d+)/) || [])[1] ?? '0');
  const ms = parseFloat((xml.match(/<!--\s*duration_ms ([\d.]+)/) || [])[1] ?? '0');
  duration = (ms / 1000).toFixed(2) + 's';

  for (const block of xml.split(/(?=<testcase[\s>])/)) {
    if (!block.trimStart().startsWith('<testcase')) continue;
    const name = (block.match(/\bname="([^"]*)"/) || [])[1] ?? '';
    const time = parseFloat((block.match(/\btime="([^"]*)"/) || [])[1] ?? '0');
    const ms   = Math.round(time * 1000);

    let icon, label;
    if (/<failure/.test(block) || /<error/.test(block)) { icon = '❌'; label = 'Failed';  }
    else if (/<skipped/.test(block))                    { icon = '⏭️'; label = 'Skipped'; }
    else                                                { icon = '✅'; label = 'Passed';  }

    tests.push({ name, ms, label, icon });
  }
}

const failedTests  = tests.filter(t => t.label === 'Failed');
const skippedTests = tests.filter(t => t.label === 'Skipped');

// Detail block: only failed tests (or a short skipped note if all pass)
const detailBlocks = [];

if (failedTests.length > 0) {
  const lines = failedTests.map(t => `❌ ${t.name} _(${t.ms}ms)_`).join('\n');
  detailBlocks.push({ type: 'divider' });
  detailBlocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*Failed Tests*\n${lines}` },
  });
}

if (skippedTests.length > 0 && failedTests.length === 0) {
  const lines = skippedTests.map(t => `⏭️ ${t.name}`).join('\n');
  detailBlocks.push({ type: 'divider' });
  detailBlocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*Skipped*\n${lines}` },
  });
}

const payload = {
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${icon} API Tests — ${jobStatus.toUpperCase()}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *${passed}/${passed + failed + skipped}* passed   •   ❌ *${failed}* failed   •   ⏭️ *${skipped}* skipped   •   ⏱️ *${duration}*`,
      },
    },
    ...detailBlocks,
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Branch:* \`${branch}\`` },
        { type: 'mrkdwn', text: `*Commit:* \`${commitSha.slice(0, 7)}\` — ${commitMsg}` },
        { type: 'mrkdwn', text: `*By:* ${actor}   •   *Trigger:* ${trigger}` },
      ],
    },
    ...(runUrl ? [{
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '🔗 View logs on GitHub', emoji: true },
        url: runUrl,
        style: jobStatus === 'success' ? 'primary' : 'danger',
      }],
    }] : []),
  ],
};

writeFileSync('test-results/slack-payload.json', JSON.stringify(payload));
console.log('Slack payload written.');
