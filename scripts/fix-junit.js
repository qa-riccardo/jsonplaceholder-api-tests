import { readFileSync, writeFileSync } from 'fs';

const path = 'test-results/junit.xml';
const xml = readFileSync(path, 'utf-8');

const fixed = xml
  .replace('<testsuites>', '<testsuites><testsuite name="test">')
  .replace('</testsuites>', '</testsuite></testsuites>');

writeFileSync(path, fixed);
console.log('JUnit XML fixed for CircleCI');
