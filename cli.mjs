#!/usr/bin/env node
// wow-ui command line: lint, sheet, spring, guilloche.

import { writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES, lintFiles, loadConfig, format } from './tools/lint.mjs';
import { contactSheet } from './tools/sheet.mjs';
import { spring, guilloche } from './kit/wow.js';

const HELP = `wow-ui — the Wow UI standard, enforced

Usage:
  wow-ui lint [paths...] [--json] [--config file] [--max-warnings n]
      Fail on what the standard bans. Defaults to the current folder.
  wow-ui lint --rules
      List every rule.
  wow-ui sheet <Label=url|url|file>... [--out sheet.png] [--width 1280] [--height 800]
               [--cols n] [--wait ms] [--dpr 2] [--title text] [--html]
      Photograph every screen into one contact sheet with headless Chrome.
  wow-ui spring [--response 0.55] [--damping 0.78]
      Print a spring as a CSS linear() easing with its duration.
  wow-ui guilloche [--lobes 18] [--strands 24] [--amplitude 0.07] [--rings 2] [--out file.svg]
      Write a guilloché rosette as SVG.

Exit codes: 0 clean, 1 findings (or failure), 2 usage error.`;

function parse(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split(/=(.*)/s);
      const bool = ['json', 'rules', 'html', 'help', 'dark', 'no-color'].includes(k);
      flags[k] = bool ? true : inline ?? argv[++i];
      if (!bool && flags[k] === undefined) throw usage(`--${k} needs a value`);
    } else rest.push(a);
  }
  return { flags, rest };
}

function usage(msg) {
  const e = new Error(msg);
  e.usage = true;
  return e;
}

function num(v, name) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw usage(`--${name} must be a number`);
  return n;
}

export async function main(argv = process.argv.slice(2), io = { out: (s) => process.stdout.write(s + '\n'), err: (s) => process.stderr.write(s + '\n') }) {
  const [cmd, ...args] = argv;
  try {
    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
      io.out(HELP);
      return cmd ? 0 : 2;
    }
    const { flags, rest } = parse(args);
    if (cmd === 'lint') {
      if (flags.rules) {
        for (const [id, r] of Object.entries(RULES)) io.out(`${id.padEnd(18)} ${r.level.padEnd(5)}  ${r.message}`);
        return 0;
      }
      const config = loadConfig(process.cwd(), flags.config);
      const { findings, files } = lintFiles(rest.length ? rest : ['.'], { config });
      if (flags.json) io.out(JSON.stringify({ files: files.length, findings }, null, 2));
      else io.out(format(findings, files, { color: process.stdout.isTTY && !flags['no-color'] && !process.env.NO_COLOR }));
      const errors = findings.filter((f) => f.level === 'error').length;
      const warns = findings.length - errors;
      const maxWarn = flags['max-warnings'] === undefined ? Infinity : num(flags['max-warnings'], 'max-warnings');
      return errors > 0 || warns > maxWarn ? 1 : 0;
    }
    if (cmd === 'sheet') {
      const opts = {
        out: flags.out,
        width: num(flags.width, 'width'),
        height: num(flags.height, 'height'),
        cols: num(flags.cols, 'cols'),
        wait: num(flags.wait, 'wait'),
        dpr: num(flags.dpr, 'dpr'),
        title: flags.title,
        html: flags.html,
        dark: flags.dark,
      };
      const r = contactSheet(rest, Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)));
      io.out(`Wrote ${r.out} (${r.shots.length} screen${r.shots.length === 1 ? '' : 's'}, ${r.size[0]}×${r.size[1]})`);
      for (const s of r.shots) io.out(`  ${s.label}  ${s.url}`);
      return 0;
    }
    if (cmd === 'spring') {
      const s = spring({ response: num(flags.response, 'response') ?? 0.55, dampingFraction: num(flags.damping, 'damping') ?? 0.78 });
      if (flags.json) io.out(JSON.stringify(s));
      else io.out(`transition: transform ${s.duration}ms ${s.easing};\n/* settles in ${s.duration} ms, overshoot ${(s.overshoot * 100).toFixed(1)}% */`);
      return 0;
    }
    if (cmd === 'guilloche') {
      const opts = {};
      for (const k of ['size', 'lobes', 'lobes2', 'strands', 'amplitude', 'amplitude2', 'rings', 'ringGap', 'radius', 'strokeWidth']) {
        const v = num(flags[k], k);
        if (v !== undefined) opts[k] = v;
      }
      if (flags.stroke) opts.stroke = flags.stroke;
      const svg = guilloche({ stroke: '#c39431', ...opts });
      if (flags.out) {
        writeFileSync(flags.out, svg);
        io.out(`Wrote ${flags.out} (${svg.length} bytes)`);
      } else io.out(svg);
      return 0;
    }
    throw usage(`Unknown command: ${cmd}`);
  } catch (e) {
    io.err(e.usage ? `${e.message}\n\n${HELP}` : `wow-ui: ${e.message}`);
    return e.usage ? 2 : 1;
  }
}

const self = fileURLToPath(import.meta.url);
let invoked = '';
try {
  invoked = process.argv[1] ? realpathSync(process.argv[1]) : '';
} catch {
  /* not run directly */
}
if (invoked === realpathSync(self)) {
  main().then((code) => process.exit(code));
}
