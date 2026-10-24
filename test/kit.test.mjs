import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spring, springSolver, springs, guilloche, guillocheBand, svgURL, haptic, reducedMotion, grain, tilt, deal } from '../kit/wow.js';
import { render } from '../tools/build.mjs';

test('spring starts at 0, ends at 1 and settles within precision', () => {
  for (const [response, dampingFraction] of [[0.3, 0.5], [0.55, 0.78], [0.8, 1], [0.6, 1.6]]) {
    const s = spring({ response, dampingFraction });
    assert.equal(s.points[0], 0);
    assert.equal(s.points.at(-1), 1);
    assert.match(s.easing, /^linear\(0, .*, 1\)$/);
    assert.ok(s.duration >= 120 && s.duration <= 4000, `duration ${s.duration}`);
    const x = springSolver(response, dampingFraction);
    for (let t = s.duration / 1000; t < 4; t += 0.05) assert.ok(Math.abs(1 - x(t)) <= 0.0016, `unsettled at ${t}`);
  }
});

test('underdamped springs overshoot; critical and overdamped never do', () => {
  assert.ok(spring({ response: 0.6, dampingFraction: 0.5 }).overshoot > 0.1);
  assert.equal(spring({ response: 0.6, dampingFraction: 1 }).overshoot, 0);
  const over = spring({ response: 0.6, dampingFraction: 1.6 });
  assert.equal(over.overshoot, 0);
  for (let i = 1; i < over.points.length; i++) assert.ok(over.points[i] >= over.points[i - 1], 'overdamped is monotonic');
});

test('spring solver matches the closed form at known points', () => {
  // Critically damped, w0 = 2π: x(t) = 1 - e^(-2πt)(1 + 2πt)
  const x = springSolver(1, 1);
  const w = 2 * Math.PI;
  for (const t of [0.05, 0.2, 0.5]) assert.ok(Math.abs(x(t) - (1 - Math.exp(-w * t) * (1 + w * t))) < 1e-12);
  // Initial velocity moves the start of the curve.
  assert.ok(springSolver(0.5, 0.8, 10)(0.02) > springSolver(0.5, 0.8, 0)(0.02));
});

test('spring rejects nonsense', () => {
  assert.throws(() => spring({ response: 0 }), RangeError);
  assert.throws(() => spring({ dampingFraction: -1 }), RangeError);
});

test('named springs exist and are cached', () => {
  for (const name of ['snappy', 'deal', 'flip', 'toss', 'settle']) {
    assert.equal(springs[name], springs[name]);
    assert.ok(springs[name].duration > 0);
  }
});

test('guilloché is deterministic, valid SVG with the requested strands', () => {
  const a = guilloche({ strands: 12, rings: 2 });
  assert.equal(a, guilloche({ strands: 12, rings: 2 }));
  assert.match(a, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 600 600"/);
  assert.equal((a.match(/Z/g) || []).length, 24);
  assert.ok(!/NaN|Infinity/.test(a));
  assert.ok(a.length < 150000, `default-ish rosette stays small: ${a.length}`);
  const band = guillocheBand({ strands: 3 });
  assert.equal((band.match(/M/g) || []).length, 3);
  assert.match(svgURL('<svg/>'), /^url\("data:image\/svg\+xml,%3Csvg%2F%3E"\)$/);
});

test('page functions are safe without a browser', async () => {
  assert.equal(haptic('tap'), false);
  assert.equal(reducedMotion(), false);
  assert.equal(grain(), null);
  assert.doesNotThrow(() => tilt(null).destroy());
  assert.deepEqual(await deal([]), []);
});

test('wow.css carries the current springs', () => {
  const css = readFileSync(new URL('../kit/wow.css', import.meta.url), 'utf8');
  assert.equal(render(css), css, 'run npm run build');
  for (const name of Object.keys(springs)) assert.ok(css.includes(`--wow-spring-${name}: ${springs[name].easing};`));
});

test('every world defines the full token set', () => {
  const css = readFileSync(new URL('../worlds/worlds.css', import.meta.url), 'utf8');
  const tokens = ['--wow-base:', '--wow-base-2:', '--wow-surface:', '--wow-paper:', '--wow-ink:', '--wow-accent:', '--wow-metal-shadow:', '--wow-metal-deep:', '--wow-metal-mid:', '--wow-metal-light:', '--wow-metal-hi:', '--wow-key:', '--wow-font-display:'];
  const worlds = [...css.matchAll(/\[data-wow-world="([a-z-]+)"\]\s*\{([^}]*)\}/g)];
  assert.deepEqual(worlds.map((m) => m[1]), ['card-table', 'console', 'blueprint', 'certificate', 'night-watch', 'film-studio']);
  for (const [, name, body] of worlds) for (const t of tokens) assert.ok(body.includes(t), `${name} is missing ${t}`);
});
