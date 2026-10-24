#!/usr/bin/env node
// Bake the named springs from kit/wow.js into kit/wow.css so the CSS works
// without JavaScript. `--check` exits 1 if wow.css is out of date (used by tests).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { springs } from '../kit/wow.js';

const cssPath = fileURLToPath(new URL('../kit/wow.css', import.meta.url));
const START = '/* @springs:start */';
const END = '/* @springs:end */';

export function springBlock(indent = '    ') {
  const lines = [START];
  for (const name of Object.keys(springs)) {
    const s = springs[name];
    lines.push(`--wow-spring-${name}: ${s.easing};`);
    lines.push(`--wow-dur-${name}: ${s.duration}ms;`);
  }
  lines.push(END);
  return lines.map((l, i) => (i === 0 ? l : indent + l)).join('\n');
}

export function render(css) {
  const a = css.indexOf(START);
  const b = css.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('wow.css is missing the @springs markers');
  return css.slice(0, a) + springBlock() + css.slice(b + END.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:fs')).realpathSync(process.argv[1])) {
  const css = readFileSync(cssPath, 'utf8');
  const next = render(css);
  if (process.argv.includes('--check')) {
    if (next !== css) {
      console.error('kit/wow.css springs are out of date. Run: npm run build');
      process.exit(1);
    }
    console.log('kit/wow.css springs are current.');
  } else {
    writeFileSync(cssPath, next);
    console.log(`Baked ${Object.keys(springs).length} springs into kit/wow.css.`);
  }
}
