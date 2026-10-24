import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintSource, lintFiles, stripComments, checkDeclaration } from '../tools/lint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = (src, kind) => lintSource(src, { kind }).findings.map((f) => f.rule);

test('plain fade: opacity-only transition and keyframes', () => {
  assert.deepEqual(rules('.a{transition: opacity .2s ease}', 'css'), ['plain-fade']);
  assert.deepEqual(rules('.a{transition-property: opacity}', 'css'), ['plain-fade']);
  assert.deepEqual(rules('@keyframes f{from{opacity:0}to{opacity:1}}', 'css'), ['plain-fade']);
  assert.deepEqual(rules('.a{transition: opacity .2s, transform .4s}', 'css'), []);
  assert.deepEqual(rules('@keyframes r{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}', 'css'), []);
});

test('fades inside the Reduce Motion fallback are allowed', () => {
  const css = '@media (prefers-reduced-motion: reduce){.a{transition: opacity .2s linear}}';
  assert.deepEqual(rules(css, 'css'), []);
});

test('linear easing: one-shot fails, infinite loops and linear() springs pass', () => {
  assert.deepEqual(rules('.a{transition: transform .3s linear}', 'css'), ['linear-easing']);
  assert.deepEqual(rules('.a{animation: slide 1s linear}', 'css'), ['linear-easing']);
  assert.deepEqual(rules('.a{animation: spin 2s linear infinite}', 'css'), []);
  assert.deepEqual(rules('.a{animation-timing-function: linear; animation-iteration-count: infinite}', 'css'), []);
  assert.deepEqual(rules('.a{transition: transform .5s linear(0, .4, 1.04, 1)}', 'css'), []);
  assert.deepEqual(rules("el.animate(k, { duration: 300, easing: 'linear' })", 'script'), ['linear-easing']);
  assert.deepEqual(rules('.animation(.linear(duration: 0.3), value: x)', 'swift'), ['linear-easing']);
  assert.deepEqual(rules('.animation(.linear(duration: 2).repeatForever(autoreverses: false), value: x)', 'swift'), []);
});

test('flat grey borders in CSS, Tailwind and SwiftUI', () => {
  assert.deepEqual(rules('.c{border:1px solid #e5e7eb}', 'css'), ['flat-grey-border']);
  assert.deepEqual(rules('.c{border-bottom: 1px solid #ccc}', 'css'), ['flat-grey-border']);
  assert.deepEqual(rules('.c{border:1px solid var(--wow-rule)}', 'css'), []);
  assert.deepEqual(rules('<div className="border border-gray-200 p-2"/>', 'script'), ['flat-grey-border']);
  assert.deepEqual(rules('Text("a").border(Color.gray)', 'swift'), ['flat-grey-border']);
});

test('flat gold', () => {
  assert.deepEqual(rules('.b{background: gold}', 'css'), ['flat-gold']);
  assert.deepEqual(rules('.b{color:#FFD700}', 'css'), ['flat-gold']);
  assert.deepEqual(rules('.b{background: var(--wow-metal)}', 'css'), []);
  assert.deepEqual(rules('.goldenrod-title{color:goldenrod}', 'css'), []);
  assert.deepEqual(rules('Text("Pro").foregroundColor(.yellow)', 'swift'), ['flat-gold']);
});

test('stock spinners', () => {
  assert.deepEqual(rules('<div class="spinner-border"></div>', 'markup'), ['stock-spinner']);
  assert.deepEqual(rules('<Loader2 className="animate-spin" />', 'script'), ['stock-spinner']);
  assert.deepEqual(rules('<CircularProgress />', 'script'), ['stock-spinner']);
  assert.deepEqual(rules('if loading { ProgressView() }', 'swift'), ['stock-spinner']);
  assert.deepEqual(rules('ProgressView().progressViewStyle(RiffleStyle())', 'swift'), []);
  assert.deepEqual(rules('ProgressView(value: 0.4)', 'swift'), []);
  assert.deepEqual(rules('<progress value="40" max="100" aria-label="Upload"></progress>', 'markup'), []);
});

test('silent controls', () => {
  assert.deepEqual(rules('<button onClick={() => {}}>Share</button>', 'script'), ['silent-control']);
  assert.deepEqual(rules('<a href="#">Help</a>', 'markup'), ['silent-control']);
  assert.deepEqual(rules('<a href="#" onclick="openHelp()">Help</a>', 'markup'), []);
  assert.deepEqual(rules('Button("Upgrade") {}', 'swift'), ['silent-control']);
  assert.deepEqual(rules('Button("Upgrade") { store.buy() }', 'swift'), []);
});

test('unlabeled icon buttons and images', () => {
  assert.deepEqual(rules('<button><svg viewBox="0 0 1 1"></svg></button>', 'markup'), ['unlabeled-control']);
  assert.deepEqual(rules('<button aria-label="Close"><svg></svg></button>', 'markup'), []);
  assert.deepEqual(rules('<button><svg></svg> Close</button>', 'markup'), []);
  assert.deepEqual(rules('<img src="a.png">', 'markup'), ['unlabeled-control']);
  assert.deepEqual(rules('<img src="a.png" alt="">', 'markup'), []);
});

test('comments are not code', () => {
  assert.deepEqual(rules('/* never use transition: opacity .2s linear */ .a{color:red}', 'css'), []);
  assert.deepEqual(rules('// <div class="spinner"></div>\nconst url = "https://x.test/a"', 'script'), []);
  assert.equal(stripComments('a // b\nc', 'script'), 'a     \nc');
  assert.equal(stripComments('const u = "http://x"; // c', 'script'), 'const u = "http://x";     ');
});

test('suppressions need a reason', () => {
  const ok = '/* wow-lint-disable-next-line linear-easing -- marquee scrolls at constant speed */\n.a{transition: transform 1s linear}';
  assert.deepEqual(rules(ok, 'css'), []);
  const bare = '/* wow-lint-disable-next-line linear-easing */\n.a{transition: transform 1s linear}';
  assert.deepEqual(rules(bare, 'css'), ['bare-suppression']);
  const file = '/* wow-lint-disable-file flat-grey-border -- vendor embed */\n.a{border:1px solid #ddd}';
  assert.deepEqual(rules(file, 'css'), []);
});

test('config can lower or turn off a rule', () => {
  const r = lintSource('.c{border:1px solid #ddd}', { kind: 'css', config: { rules: { 'flat-grey-border': 'warn' } } });
  assert.equal(r.findings[0].level, 'warn');
  const off = lintSource('.c{border:1px solid #ddd}', { kind: 'css', config: { rules: { 'flat-grey-border': 'off' } } });
  assert.equal(off.findings.length, 0);
});

test('no-reduced-motion is project-wide', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wow-lint-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.css'), '.a{transition: transform .4s var(--wow-spring-snappy)}');
  let r = lintFiles(['src'], { cwd: dir });
  assert.deepEqual(r.findings.map((f) => f.rule), ['no-reduced-motion']);
  writeFileSync(join(dir, 'src', 'b.css'), '@media (prefers-reduced-motion: reduce){.a{transition:none}}');
  r = lintFiles(['src'], { cwd: dir });
  assert.deepEqual(r.findings, []);
});

test('the flat example fails on every planted problem', () => {
  const { findings } = lintFiles(['examples/flat'], { cwd: ROOT });
  const got = findings.map((f) => `${f.file.split('/').pop()}:${f.line}:${f.rule}`);
  assert.deepEqual(got, [
    'SettingsView.swift:13:system-segmented',
    'SettingsView.swift:15:stock-spinner',
    'SettingsView.swift:17:silent-control',
    'SettingsView.swift:18:flat-gold',
    'SettingsView.swift:20:plain-fade',
    'SettingsView.swift:20:no-reduced-motion',
    'SettingsView.swift:21:linear-easing',
    'styles.css:3:flat-grey-border',
    'styles.css:9:plain-fade',
    'styles.css:13:linear-easing',
    'styles.css:16:plain-fade',
    'styles.css:22:flat-gold',
    'Toolbar.jsx:3:flat-grey-border',
    'Toolbar.jsx:4:stock-spinner',
    'Toolbar.jsx:6:silent-control',
    'Toolbar.jsx:7:unlabeled-control',
    'Toolbar.jsx:8:silent-control',
  ]);
});

test('the kit and the demo pass their own linter', () => {
  const { findings } = lintFiles(['kit', 'worlds', 'demo'], { cwd: ROOT });
  assert.deepEqual(findings, []);
});

test('checkDeclaration is usable on its own', () => {
  assert.deepEqual(checkDeclaration('transition', 'opacity 1s'), ['plain-fade']);
  assert.deepEqual(checkDeclaration('transition', 'opacity 1s', { reduce: true }), []);
});
