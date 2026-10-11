import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const templatesRoot = join(process.cwd(), 'src/app');

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [file] : [];
  });
}

const violations = [];
const inFlightState =
  /\[disabled\]="[^"]*(?:busy|loading|saving|pending|masterBusy|actionBusy|Downloading)[^"]*"/i;

for (const file of htmlFiles(templatesRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
    const button = match[0];
    const line = source.slice(0, match.index).split('\n').length;
    const location = `${relative(process.cwd(), file)}:${line}`;
    if (!/\bpButton\b/.test(button)) violations.push(`${location}: falta pButton`);
    if (/\(click\)=/.test(button) && inFlightState.test(button) && !/\[loading\]=/.test(button)) {
      violations.push(`${location}: falta [loading] para el estado en curso`);
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Button policy: OK');
}
