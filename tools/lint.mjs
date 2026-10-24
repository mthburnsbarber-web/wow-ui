// wow-lint — fails the build on what the Wow UI standard bans. Zero dependencies.
//
// Reads CSS/SCSS/Less, HTML, JS/TS/JSX/TSX, Vue, Svelte, Astro and SwiftUI.
// Comments and strings that are not code are blanked before matching, so a
// comment saying "no linear easing" is not a finding.
//
// Suppress one finding with a reason (a bare suppression is itself an error):
//   /* wow-lint-disable-next-line linear-easing -- marquee scrolls at constant speed */
//   // wow-lint-disable-line plain-fade -- tooltip, fades by platform convention
//   /* wow-lint-disable-file flat-grey-border -- third-party embed styles */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, resolve, sep } from 'node:path';

export const RULES = {
  'stock-spinner': {
    level: 'error',
    message: 'Stock spinner. Make loading an object from your world.',
  },
  'plain-fade': {
    level: 'error',
    message: 'Plain fade. Give it a verb with a spring; fades are for Reduce Motion only.',
  },
  'linear-easing': {
    level: 'error',
    message: 'Linear easing on one-shot motion. Use a spring: var(--wow-spring-*).',
  },
  'flat-grey-border': {
    level: 'error',
    message: 'Flat grey border. Use an engraved rule: .wow-plate, var(--wow-rule).',
  },
  'flat-gold': {
    level: 'error',
    message: 'Flat yellow gold. Metal is a three-stop gradient: var(--wow-metal).',
  },
  'silent-control': {
    level: 'error',
    message: "Control that does nothing. Say why it can't act and offer the fix.",
  },
  'unlabeled-control': {
    level: 'error',
    message: 'No accessible label. Every object needs a name.',
  },
  'no-reduced-motion': {
    level: 'error',
    message: 'Motion with no Reduce Motion fallback in any scanned file.',
  },
  'system-segmented': {
    level: 'warn',
    message: 'Unstyled segmented control. Make it an object from your world.',
  },
  'bare-suppression': {
    level: 'error',
    message: 'Suppression without a reason. Add: -- <why>.',
  },
};

const KINDS = {
  css: ['.css', '.scss', '.sass', '.less', '.pcss'],
  markup: ['.html', '.htm'],
  script: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],
  sfc: ['.vue', '.svelte', '.astro'],
  swift: ['.swift'],
};
const EXT_KIND = Object.fromEntries(Object.entries(KINDS).flatMap(([k, exts]) => exts.map((e) => [e, k])));
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'out', 'coverage', 'vendor', 'Pods', 'DerivedData', '.build', '.turbo', '.cache']);

// ---------------------------------------------------------------------------
// Source preparation
// ---------------------------------------------------------------------------

/** Replace comments with spaces (newlines kept) so offsets and line numbers survive. */
export function stripComments(src, kind) {
  const out = src.split('');
  const n = src.length;
  const blank = (a, b) => {
    for (let i = a; i < b && i < n; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  const lineComments = kind === 'script' || kind === 'swift' || kind === 'sfc';
  const markup = kind === 'markup' || kind === 'sfc';
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (markup && src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const stop = end < 0 ? n : end + 3;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
    } else if (lineComments && c === '/' && d === '/' && src[i - 1] !== ':') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
    } else if ((c === '"' || c === "'" || c === '`') && kind !== 'markup' && kind !== 'css') {
      // Skip over string literals so comment markers inside them are left alone.
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        if (c !== '`' && src[j] === '\n') break;
        j++;
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - starts[lo] + 1 };
  };
}

const SUPPRESS = /wow-lint-disable(-next-line|-line|-file)\s+([a-z0-9,\s-]+?)(?:\s+--\s*(.*?))?\s*(?:\*\/|-->|$)/;

function readSuppressions(src) {
  const lines = src.split('\n');
  const byLine = new Map();
  const file = new Set();
  const bare = [];
  lines.forEach((text, idx) => {
    const m = text.match(SUPPRESS);
    if (!m) return;
    const rules = m[2].split(/[\s,]+/).filter(Boolean);
    const reason = (m[3] || '').trim();
    if (!reason) bare.push({ line: idx + 1, col: text.indexOf('wow-lint') + 1 });
    if (m[1] === '-file') rules.forEach((r) => file.add(r));
    else {
      const target = m[1] === '-next-line' ? idx + 2 : idx + 1;
      if (!byLine.has(target)) byLine.set(target, new Set());
      rules.forEach((r) => byLine.get(target).add(r));
    }
  });
  return { byLine, file, bare };
}

// ---------------------------------------------------------------------------
// CSS analysis (also used for <style> blocks and inline style values)
// ---------------------------------------------------------------------------

const GREYS = '(?:#c{3}(?:c{3})?|#d{3}(?:d{3})?|#e{3}(?:e{3})?|#b{3}(?:b{3})?|#9{3}(?:9{3})?|#e5e7eb|#d1d5db|#e5e5e5|#e0e0e0|#dee2e6|#ced4da|#e2e8f0|#cbd5e1|#d4d4d4|#e4e4e7|gr[ae]y|lightgr[ae]y|silver|gainsboro|rgba?\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0?\\.(?:0\\d|1\\d?|2)\\d*\\s*\\))';
const GREY_BORDER = new RegExp(`^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$`, 'i');
const GREY_VALUE = new RegExp(`(?:^|\\s)(?:\\d*\\.?\\d+px\\s+)?solid\\s+${GREYS}(?:\\s|$|!)|(?:^|\\s)${GREYS}\\s+solid(?:\\s|$)|^\\s*\\d*\\.?\\d+px\\s+${GREYS}\\s+solid`, 'i');
const FLAT_GOLD = /(?:^|[\s:,(])(?:#ffd700\b|gold\b)(?![-\w])/i;

function splitTopLevel(value, sepChar = ',') {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sepChar && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const LINEAR_KEYWORD = /(^|[\s,])linear(?!\s*\()(?=$|[\s,;!])/i;

/** Check one declaration. `ctx` = { reduce, infiniteInBlock }. Returns [{rule, offsetInValue}] */
export function checkDeclaration(prop, value, ctx = {}) {
  const found = [];
  const p = prop.trim().toLowerCase();
  const v = value.trim();
  if (!ctx.reduce) {
    if (p === 'transition' || p === 'transition-property') {
      const parts = splitTopLevel(v);
      const props = parts.map((part) => (p === 'transition' ? part.split(/\s+/)[0] : part).toLowerCase());
      if (props.length && props.every((x) => x === 'opacity')) found.push('plain-fade');
    }
    if (p === 'transition' || p === 'transition-timing-function') {
      if (LINEAR_KEYWORD.test(v)) found.push('linear-easing');
    }
    if (p === 'animation' || p === 'animation-timing-function') {
      const parts = p === 'animation' ? splitTopLevel(v) : [v];
      for (const part of parts) {
        const infinite = /\binfinite\b/i.test(part) || ctx.infiniteInBlock;
        if (LINEAR_KEYWORD.test(part) && !infinite) {
          found.push('linear-easing');
          break;
        }
      }
    }
  }
  if (GREY_BORDER.test(p) && GREY_VALUE.test(' ' + v + ' ')) found.push('flat-grey-border');
  if (/^(?:color|background(?:-color)?|fill|stroke|border(?:-\w+)*-color|border|outline|text-decoration-color|caret-color|accent-color)$/.test(p) && FLAT_GOLD.test(' ' + v)) found.push('flat-gold');
  return found;
}

/** Walk CSS text; report via cb(rule, absoluteOffset). `base` shifts offsets for embedded CSS. */
export function analyzeCSS(css, base, cb, motion) {
  // Stack of blocks: { prelude, reduce, keyframes, decls: [] }
  const stack = [];
  let i = 0;
  let segStart = 0;
  const n = css.length;
  const inReduce = () => stack.some((b) => b.reduce);
  const flushDecls = (text, start) => {
    // text is the content between `{`/`;` and `;`/`}`; may hold one declaration
    const colon = text.indexOf(':');
    if (colon < 0) return;
    const prop = text.slice(0, colon).trim();
    if (!/^-?[a-z][a-z0-9-]*$/i.test(prop)) return;
    const value = text.slice(colon + 1);
    const block = stack[stack.length - 1];
    if (block) block.decls.push({ prop: prop.toLowerCase(), value, offset: start + text.indexOf(prop) });
  };
  while (i < n) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < n && css[i] !== q) {
        if (css[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '{') {
      const prelude = css.slice(segStart, i).trim();
      const parent = stack[stack.length - 1];
      stack.push({
        prelude,
        offset: segStart + css.slice(segStart, i).search(/\S/),
        reduce: /prefers-reduced-motion\s*:\s*reduce/i.test(prelude),
        keyframes: /^@(?:-\w+-)?keyframes\b/i.test(prelude) || Boolean(parent && parent.keyframes),
        isKeyframesRoot: /^@(?:-\w+-)?keyframes\b/i.test(prelude),
        decls: [],
        frameProps: new Set(),
      });
      segStart = i + 1;
    } else if (ch === ';') {
      flushDecls(css.slice(segStart, i), segStart);
      segStart = i + 1;
    } else if (ch === '}') {
      flushDecls(css.slice(segStart, i), segStart);
      const block = stack.pop();
      if (block) {
        const reduce = block.reduce || inReduce();
        const infiniteInBlock = block.decls.some((d) => (d.prop === 'animation-iteration-count' && /infinite/i.test(d.value)) || (d.prop === 'animation' && /infinite/i.test(d.value)));
        if (block.keyframes && !block.isKeyframesRoot) {
          const root = [...stack].reverse().find((b) => b.isKeyframesRoot);
          if (root) block.decls.forEach((d) => root.frameProps.add(d.prop));
        } else {
          for (const d of block.decls) {
            if (/^(?:transition|animation)/.test(d.prop)) motion.has = true;
            for (const rule of checkDeclaration(d.prop, d.value, { reduce, infiniteInBlock })) cb(rule, base + d.offset);
          }
        }
        if (block.isKeyframesRoot) {
          motion.has = true;
          const props = [...block.frameProps].filter((p) => p !== 'visibility');
          if (!reduce && props.length && props.every((p) => p === 'opacity')) cb('plain-fade', base + block.offset);
        }
      }
      segStart = i + 1;
    }
    i++;
  }
}

// ---------------------------------------------------------------------------
// Pattern rules for markup, scripts and Swift
// ---------------------------------------------------------------------------

const P = (rule, re, kinds, extra = {}) => ({ rule, re, kinds, ...extra });
const ALL_WEB = ['markup', 'script', 'sfc'];

const PATTERNS = [
  // Stock spinners
  P('stock-spinner', /\bclass(?:Name)?\s*=\s*["'{`][^"'`}]*\b(?:spinner(?:-border|-grow)?|animate-spin|loading-spinner|lds-(?:ring|dual-ring|spinner|roller|ellipsis|default)|sk-(?:circle|fading-circle|spinner)|fa-spinner|fa-circle-notch)\b/g, ALL_WEB),
  P('stock-spinner', /<(?:CircularProgress|Spinner|ActivityIndicator|ClipLoader|BeatLoader|PulseLoader|RingLoader|MoonLoader|SyncLoader|PuffLoader|BounceLoader|FadeLoader|HashLoader|ScaleLoader|Loader2)\b/g, ['script', 'sfc']),
  P('stock-spinner', /<progress\b(?![^>]*\bvalue\s*=)[^>]*>/gi, ALL_WEB),
  P('stock-spinner', /\bUIActivityIndicatorView\b|\bProgressView\(\s*\)(?![\s\S]{0,120}?\.progressViewStyle\()/g, ['swift']),
  // Plain fades
  P('plain-fade', /\bclass(?:Name)?\s*=\s*["'{`][^"'`}]*\btransition-opacity\b/g, ALL_WEB),
  P('plain-fade', /\.transition\(\s*\.opacity\s*\)/g, ['swift']),
  P('plain-fade', /\btransition\s*:\s*(['"`])\s*opacity\b[^'"`,]*\1/g, ['script', 'sfc']),
  // Linear easing
  P('linear-easing', /\bclass(?:Name)?\s*=\s*["'{`][^"'`}]*\bease-linear\b/g, ALL_WEB),
  P('linear-easing', /\b(?:easing|ease|timingFunction|animationTimingFunction|transitionTimingFunction)\s*:\s*(['"`])linear\1(?![^\n]*(?:Infinity|infinite|repeat))/g, ['script', 'sfc']),
  P('linear-easing', /(?:withAnimation|\.animation)\(\s*\.linear\b(?![^\n]*repeatForever)/g, ['swift']),
  // Flat grey borders
  P('flat-grey-border', /\bclass(?:Name)?\s*=\s*["'{`](?=[^"'`}]*\bborder\b)[^"'`}]*\bborder-(?:gray|slate|zinc|neutral|stone)-(?:100|200|300)\b/g, ALL_WEB),
  P('flat-grey-border', /\.border\(\s*(?:Color\.)?\.?gray\b|\.stroke\(\s*(?:Color\.)?\.?gray\b/g, ['swift']),
  // Flat gold
  P('flat-gold', /#ffd700\b/gi, ['script', 'sfc', 'markup']),
  P('flat-gold', /\bColor\.yellow\b|\bUIColor\.yellow\b|\.foregroundStyle\(\s*\.yellow\s*\)|\.foregroundColor\(\s*\.yellow\s*\)/g, ['swift']),
  // Silent controls
  P('silent-control', /\bon(?:Click|Press|Tap|Submit)\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g, ['script', 'sfc']),
  P('silent-control', /\bon(?:Click|Press|Tap)\s*=\s*\{\s*(?:undefined|null|noop)\s*\}/g, ['script', 'sfc']),
  P('silent-control', /<a\b(?![^>]*\bon(?:click|Click)\b)(?![^>]*@click)[^>]*\bhref\s*=\s*["'](?:#|javascript:\s*(?:void\(0\);?)?)["'][^>]*>/gi, ALL_WEB),
  P('silent-control', /\bonclick\s*=\s*["']\s*["']/gi, ['markup', 'sfc']),
  P('silent-control', /\bButton\s*\(\s*(?:"[^"]*"|LocalizedStringKey\([^)]*\))\s*\)\s*\{\s*\}|\bButton\s*\(\s*action\s*:\s*\{\s*\}/g, ['swift']),
  // Unstyled segmented controls
  P('system-segmented', /\.pickerStyle\(\s*(?:\.segmented|SegmentedPickerStyle\(\s*\))\s*\)|\bUISegmentedControl\b/g, ['swift']),
];

const LABEL_ATTR = /\b(?:aria-label|aria-labelledby|title|:aria-label|\[attr\.aria-label\])\s*=/i;

function unlabeledControls(code, cb) {
  const buttonRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = buttonRe.exec(code))) {
    const attrs = m[1];
    const inner = m[2];
    if (LABEL_ATTR.test(attrs)) continue;
    if (/\{[^}]*\}/.test(inner.replace(/<[^>]+>/g, '')) && !/^\s*\{\s*\/?\*/.test(inner)) continue; // dynamic text: can't judge
    const text = inner
      .replace(/<(svg|i|img|span\s+[^>]*aria-hidden[^>]*)\b[\s\S]*?(?:<\/\1>|\/>)/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;|&#\d+;/gi, 'x')
      .trim();
    if (!text) cb('unlabeled-control', m.index);
  }
  const imgRe = /<img\b(?![^>]*\balt\s*=)(?![^>]*\baria-hidden\s*=\s*["']?true)(?![^>]*\brole\s*=\s*["']presentation)[^>]*>/gi;
  while ((m = imgRe.exec(code))) cb('unlabeled-control', m.index);
}

const MOTION_RE = {
  script: /\.animate\(|\banimation\s*:|\btransition\s*:|<motion\.|\buseSpring\b|\bgsap\b/,
  sfc: /\.animate\(|\banimation\s*:|\btransition\s*:|<motion\.|<Transition\b|\bgsap\b/,
  markup: /\.animate\(/,
  swift: /\bwithAnimation\b|\.animation\(|\.transition\(|\.matchedGeometryEffect\(/,
};
const REDUCE_RE = /prefers-reduced-motion|reducedMotion|ReducedMotion|accessibilityReduceMotion|isReduceMotionEnabled|reduceMotion/;

// ---------------------------------------------------------------------------
// Linting
// ---------------------------------------------------------------------------

/** Lint one source string. Returns { findings, motion, reduce }. */
export function lintSource(src, { file = '<input>', kind = 'css', config = {} } = {}) {
  const levels = { ...Object.fromEntries(Object.entries(RULES).map(([k, v]) => [k, v.level])), ...(config.rules || {}) };
  const code = stripComments(src, kind);
  const pos = lineIndex(src);
  const sup = readSuppressions(src);
  const raw = [];
  const motion = { has: false, at: null };
  const report = (rule, offset) => raw.push({ rule, offset });

  if (kind === 'css') analyzeCSS(code, 0, report, motion);
  if (kind === 'markup' || kind === 'sfc') {
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = styleRe.exec(code))) analyzeCSS(m[1], m.index + m[0].indexOf(m[1]), report, motion);
    const inlineRe = /\bstyle\s*=\s*"([^"]*)"/gi;
    while ((m = inlineRe.exec(code))) {
      for (const decl of m[1].split(';')) {
        const c = decl.indexOf(':');
        if (c < 0) continue;
        const prop = decl.slice(0, c);
        if (/^\s*(?:transition|animation)/i.test(prop)) motion.has = true;
        for (const rule of checkDeclaration(prop, decl.slice(c + 1))) report(rule, m.index);
      }
    }
  }
  if (kind !== 'css') {
    for (const p of PATTERNS) {
      if (!p.kinds.includes(kind)) continue;
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(code))) {
        report(p.rule, m.index);
        if (m[0].length === 0) p.re.lastIndex++;
      }
    }
    if (kind !== 'swift') unlabeledControls(code, report);
    if (kind === 'swift') {
      // Image-only buttons with no accessibility label.
      const re = /\bButton\s*\{[^{}]*\}\s*label\s*:\s*\{\s*Image\([^)]*\)\s*\}(?![\s\S]{0,160}?\.accessibilityLabel\()/g;
      let m;
      while ((m = re.exec(code))) report('unlabeled-control', m.index);
    }
    const mr = MOTION_RE[kind];
    if (mr) {
      const hit = code.search(mr);
      if (hit >= 0) {
        motion.has = true;
        motion.at = motion.at ?? hit;
      }
    }
  }
  if (motion.has && motion.at == null) {
    const first = code.search(/@keyframes|\btransition\s*:|\banimation\s*:/);
    motion.at = first >= 0 ? first : 0;
  }

  const findings = [];
  const seen = new Set();
  for (const r of raw) {
    const { line, col } = pos(r.offset);
    const key = `${r.rule}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (sup.file.has(r.rule) || sup.byLine.get(line)?.has(r.rule)) continue;
    const level = levels[r.rule];
    if (level === 'off') continue;
    findings.push({ file, line, col, rule: r.rule, level, message: RULES[r.rule].message });
  }
  for (const b of sup.bare) {
    if (levels['bare-suppression'] !== 'off') findings.push({ file, line: b.line, col: b.col, rule: 'bare-suppression', level: levels['bare-suppression'], message: RULES['bare-suppression'].message });
  }
  const motionAt = motion.has ? pos(motion.at || 0) : null;
  return {
    findings,
    motion: motion.has ? { file, ...motionAt, suppressed: sup.file.has('no-reduced-motion') || Boolean(sup.byLine.get(motionAt.line)?.has('no-reduced-motion')) } : null,
    reduce: REDUCE_RE.test(code),
  };
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function collectFiles(targets, { ignore = [], cwd = process.cwd() } = {}) {
  const ignores = ignore.map(globToRegExp);
  const files = [];
  const walk = (p) => {
    const rel = relative(cwd, p).split(sep).join('/');
    if (rel && ignores.some((r) => r.test(rel))) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p).sort()) {
        if (SKIP_DIRS.has(name) || (name.startsWith('.') && name !== '.')) continue;
        walk(join(p, name));
      }
    } else if (EXT_KIND[extname(p).toLowerCase()] && !/\.min\.(?:css|js)$/.test(p)) {
      files.push(p);
    }
  };
  for (const t of targets) {
    const abs = resolve(cwd, t);
    if (!existsSync(abs)) throw new Error(`No such file or directory: ${t}`);
    walk(abs);
  }
  return [...new Set(files)];
}

/** Lint files on disk. Returns { findings, files }. */
export function lintFiles(targets, { config = {}, cwd = process.cwd() } = {}) {
  const files = collectFiles(targets, { ignore: config.ignore || [], cwd });
  const findings = [];
  const motions = [];
  let anyReduce = false;
  for (const f of files) {
    const kind = EXT_KIND[extname(f).toLowerCase()];
    const rel = relative(cwd, f) || f;
    const r = lintSource(readFileSync(f, 'utf8'), { file: rel, kind, config });
    findings.push(...r.findings);
    if (r.motion) motions.push(r.motion);
    if (r.reduce) anyReduce = true;
  }
  const level = (config.rules || {})['no-reduced-motion'] ?? RULES['no-reduced-motion'].level;
  if (!anyReduce && motions.length && level !== 'off') {
    const m = motions.find((x) => !x.suppressed);
    if (m) findings.push({ file: m.file, line: m.line, col: m.col, rule: 'no-reduced-motion', level, message: RULES['no-reduced-motion'].message });
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  return { findings, files };
}

export function loadConfig(cwd = process.cwd(), explicit) {
  const path = explicit ? resolve(cwd, explicit) : join(cwd, '.wowlintrc.json');
  if (!existsSync(path)) {
    if (explicit) throw new Error(`Config not found: ${explicit}`);
    return {};
  }
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  for (const [rule, level] of Object.entries(cfg.rules || {})) {
    if (!RULES[rule]) throw new Error(`Unknown rule in ${path}: ${rule}`);
    if (!['error', 'warn', 'off'].includes(level)) throw new Error(`Rule ${rule} in ${path} must be "error", "warn" or "off"`);
  }
  return cfg;
}

export function format(findings, files, { color = false } = {}) {
  const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [];
  const where = (f) => `${f.file}:${f.line}:${f.col}`;
  const width = Math.max(0, ...findings.map((f) => where(f).length));
  for (const f of findings) {
    const lvl = f.level === 'error' ? paint('31', 'error') : paint('33', 'warn ');
    lines.push(`${paint('2', where(f).padEnd(width))}  ${lvl}  ${paint('1', f.rule.padEnd(17))}  ${f.message}`);
  }
  const errors = findings.filter((f) => f.level === 'error').length;
  const warns = findings.length - errors;
  if (findings.length) lines.push('');
  lines.push(
    findings.length
      ? `${findings.length} problem${findings.length === 1 ? '' : 's'} (${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}) in ${files.length} file${files.length === 1 ? '' : 's'}`
      : `${files.length} file${files.length === 1 ? '' : 's'} checked. Nothing flat.`
  );
  return lines.join('\n');
}
