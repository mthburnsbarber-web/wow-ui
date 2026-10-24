import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, symlinkSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseTarget, findBrowser } from '../tools/sheet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'cli.mjs');
const run = (args, opts = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: ROOT, ...opts });

test('lint exits 1 with findings and 0 when clean', () => {
  const bad = run(['lint', 'examples/flat']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /17 problems \(16 errors, 1 warning\) in 3 files/);
  const good = run(['lint', 'kit', 'worlds', 'demo']);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /Nothing flat\./);
});

test('lint --json and --rules', () => {
  const r = run(['lint', 'examples/flat/styles.css', '--json']);
  const data = JSON.parse(r.stdout);
  assert.equal(data.files, 1);
  assert.equal(data.findings.length, 6); // five in the file, plus no Reduce Motion fallback in the scanned set
  assert.ok(data.findings.every((f) => f.file && f.line && f.rule && f.level && f.message));
  const rules = run(['lint', '--rules']);
  assert.equal(rules.status, 0);
  assert.match(rules.stdout, /^stock-spinner/m);
});

test('lint honours .wowlintrc.json and --max-warnings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wow cli '));
  writeFileSync(join(dir, 'a.css'), '.c{border:1px solid #ddd}');
  let r = run(['lint', '.'], { cwd: dir });
  assert.equal(r.status, 1);
  writeFileSync(join(dir, '.wowlintrc.json'), JSON.stringify({ rules: { 'flat-grey-border': 'warn' } }));
  r = run(['lint', '.'], { cwd: dir });
  assert.equal(r.status, 0);
  r = run(['lint', '.', '--max-warnings', '0'], { cwd: dir });
  assert.equal(r.status, 1);
  writeFileSync(join(dir, '.wowlintrc.json'), JSON.stringify({ rules: { 'not-a-rule': 'off' } }));
  r = run(['lint', '.'], { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown rule/);
});

test('usage errors exit 2', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(['explode']).status, 2);
  assert.equal(run(['spring', '--response', 'fast']).status, 2);
  assert.equal(run(['lint', 'no/such/path']).status, 1);
});

test('spring and guilloche commands', () => {
  const s = run(['spring', '--response', '0.4', '--damping', '1']);
  assert.equal(s.status, 0);
  assert.match(s.stdout, /^transition: transform \d+ms linear\(0, /);
  const dir = mkdtempSync(join(tmpdir(), 'wow-g-'));
  const out = join(dir, 'r.svg');
  const g = run(['guilloche', '--lobes', '12', '--strands', '8', '--out', out]);
  assert.equal(g.status, 0);
  assert.match(readFileSync(out, 'utf8'), /^<svg /);
});

test('runs through an npm-style bin symlink from a path with spaces', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wow bin '));
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  const link = join(dir, 'node_modules', '.bin', 'wow-ui');
  symlinkSync(CLI, link);
  assert.ok(statSync(CLI).mode & 0o111, 'cli.mjs is executable');
  const r = spawnSync(link, ['spring'], { encoding: 'utf8', cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /linear\(/);
});

test('sheet target parsing', () => {
  assert.deepEqual(parseTarget('Home=http://localhost:3000/'), { label: 'Home', url: 'http://localhost:3000/' });
  assert.deepEqual(parseTarget('https://a.test/settings?tab=2'), { label: 'settings?tab=2', url: 'https://a.test/settings?tab=2' });
  const f = parseTarget('demo/index.html', ROOT);
  assert.equal(f.url, pathToFileURL(join(ROOT, 'demo/index.html')).href);
  assert.throws(() => findBrowser({ CHROME_PATH: '/nope/chrome' }), /does not exist/);
});

let browser = null;
try {
  browser = findBrowser();
} catch {
  /* no browser on this machine */
}

test('sheet photographs pages into one PNG', { skip: browser ? false : 'no Chrome-family browser installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wow sheet '));
  const a = join(dir, 'a.html');
  const b = join(dir, 'b.html');
  writeFileSync(a, '<body style="margin:0;background:#103">A</body>');
  writeFileSync(b, '<body style="margin:0;background:#310">B</body>');
  const out = join(dir, 'sheet.png');
  const r = run(['sheet', `First=${a}`, `Second=${b}`, '--out', out, '--width', '400', '--height', '300', '--wait', '200']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(out));
  const png = readFileSync(out);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width > 400 && height > 200, `${width}x${height}`);
  assert.match(r.stdout, /First .*a\.html/);
});
