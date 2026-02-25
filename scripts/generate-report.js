#!/usr/bin/env node
/**
 * Converts test-results/junit.xml → test-results/report.html
 * No dependencies required — uses only Node built-ins.
 * Run: node scripts/generate-report.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const xmlPath = resolve('test-results/junit.xml');
const htmlPath = resolve('test-results/report.html');

const xml = readFileSync(xmlPath, 'utf-8');

// -----------------------------------------------------------------------
// Parser: split on <testcase openings so that ">" inside quoted attribute
// values (e.g. test names containing "->") never breaks extraction.
// -----------------------------------------------------------------------
const testCases = [];
const blocks = xml.split(/(?=<testcase[\s>])/);

for (const block of blocks) {
  if (!block.trimStart().startsWith('<testcase')) continue;

  // name="..." — safe because we match the quoted string, not up to >
  const name = (block.match(/\bname="([^"]*)"/) || [])[1] || '';
  const time = parseFloat((block.match(/\btime="([^"]*)"/) || [])[1] || '0');

  let status = 'pass';
  if (/<skipped/.test(block))      status = 'skip';
  else if (/<failure/.test(block)) status = 'fail';
  else if (/<error/.test(block))   status = 'fail';

  const msgMatch = block.match(/<(?:failure|error)[^>]*message="([^"]*)"/) ||
                   block.match(/<(?:failure|error)[^>]*>([\s\S]*?)<\/(?:failure|error)>/);
  const message = msgMatch
    ? msgMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    : '';

  testCases.push({ name, time, status, message });
}

// -----------------------------------------------------------------------
// Summary from XML comments written by Node's test runner
// -----------------------------------------------------------------------
const total    = parseInt((xml.match(/<!--\s*tests (\d+)/)    || [])[1] || testCases.length);
const passed   = parseInt((xml.match(/<!--\s*pass (\d+)/)     || [])[1] || 0);
const failed   = parseInt((xml.match(/<!--\s*fail (\d+)/)     || [])[1] || 0);
const skipped  = parseInt((xml.match(/<!--\s*skipped (\d+)/)  || [])[1] || 0);
const duration = parseFloat((xml.match(/<!--\s*duration_ms ([\d.]+)/) || [])[1] || 0);
const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

// -----------------------------------------------------------------------
// HTML generation
// -----------------------------------------------------------------------
function badge(status) {
  const map = { pass: ['#22c55e', '✔ PASS'], fail: ['#ef4444', '✘ FAIL'], skip: ['#a855f7', '— SKIP'] };
  const [color, label] = map[status] || ['#6b7280', status.toUpperCase()];
  return `<span class="badge" style="background:${color}">${label}</span>`;
}

function esc(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const rows = testCases.map((tc, i) => `
  <tr>
    <td class="num">${i + 1}</td>
    <td class="name">${esc(tc.name)}</td>
    <td class="center">${badge(tc.status)}</td>
    <td class="center">${(tc.time * 1000).toFixed(0)} ms</td>
    <td class="msg">${tc.message ? `<code>${esc(tc.message)}</code>` : ''}</td>
  </tr>`).join('');

const rateColor = passRate === 100 ? 'green' : passRate >= 80 ? 'blue' : 'red';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Test Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body  { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1    { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #f8fafc; }

    .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .card    { background: #1e293b; border-radius: 10px; padding: 1rem 1.5rem;
               min-width: 130px; text-align: center; border: 1px solid #334155; }
    .card .val { font-size: 2rem; font-weight: 800; }
    .card .lbl { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase;
                 letter-spacing: .05em; margin-top: .2rem; }
    .green  { color: #22c55e; } .red    { color: #ef4444; }
    .purple { color: #a855f7; } .blue   { color: #60a5fa; } .gray { color: #94a3b8; }

    .progress-bar  { background: #1e293b; border-radius: 99px; height: 8px;
                     margin-bottom: 2rem; overflow: hidden; border: 1px solid #334155; }
    .progress-fill { height: 100%; background: linear-gradient(90deg,#22c55e,#16a34a);
                     border-radius: 99px; }

    table  { width: 100%; border-collapse: collapse; background: #1e293b;
             border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
    thead  { background: #0f172a; }
    th     { padding: .75rem 1rem; text-align: left; font-size: .75rem;
             text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }
    td     { padding: .75rem 1rem; font-size: .875rem;
             border-top: 1px solid #334155; vertical-align: middle; }
    td.num    { color: #64748b; width: 40px; }
    td.name   { font-weight: 500; }
    td.center { text-align: center; width: 110px; }
    td.msg    { color: #94a3b8; font-size: .8rem; }
    tr:hover  { background: #263245; }

    .badge { display: inline-block; padding: .2rem .6rem; border-radius: 99px;
             font-size: .7rem; font-weight: 700; color: #fff; letter-spacing: .04em; }
    code   { background: #0f172a; padding: .1rem .4rem; border-radius: 4px;
             font-family: monospace; font-size: .8rem; }
    .footer { margin-top: 1.5rem; text-align: right; font-size: .75rem; color: #475569; }
  </style>
</head>
<body>
  <h1>🧪 Test Report — JSONPlaceholder API</h1>

  <div class="summary">
    <div class="card"><div class="val gray">${total}</div><div class="lbl">Total</div></div>
    <div class="card"><div class="val green">${passed}</div><div class="lbl">Passed</div></div>
    <div class="card"><div class="val red">${failed}</div><div class="lbl">Failed</div></div>
    <div class="card"><div class="val purple">${skipped}</div><div class="lbl">Skipped</div></div>
    <div class="card"><div class="val blue">${(duration / 1000).toFixed(2)}s</div><div class="lbl">Duration</div></div>
    <div class="card"><div class="val ${rateColor}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width:${passRate}%"></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Test Name</th>
        <th style="text-align:center">Status</th>
        <th style="text-align:center">Duration</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">Generated ${new Date().toLocaleString()}</div>
</body>
</html>`;

writeFileSync(htmlPath, html, 'utf-8');
console.log(`✔ Report generated → ${htmlPath} (${testCases.length} tests)`);
