// wow.js — the motion and light half of the Wow UI kit. Zero dependencies.
//
// Pure functions (spring, guilloche) run anywhere, including Node, so they can be
// tested and used at build time. Everything that touches the page checks for a
// document first and does nothing on the server.
//
//   import * as wow from './kit/wow.js';
//   wow.auto();                       // wire every data-wow-* attribute on the page
//   wow.tilt(card);                   // pointer + gyroscope tilt, foil and light
//   await wow.deal(cards, { stagger: 0.07 });
//   wow.flip(card);  wow.toss(chip);  wow.shake(field);  wow.haptic('success');

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

// ---------------------------------------------------------------------------
// Spring physics
// ---------------------------------------------------------------------------

/**
 * A damped spring, solved exactly and returned as a CSS `linear()` easing.
 *
 * `response` is the period of the undamped spring in seconds and
 * `dampingFraction` is 1 for critical damping, below 1 to overshoot — the same
 * two numbers SwiftUI's `.spring(response:dampingFraction:)` takes, so a web
 * screen and its native twin can move identically.
 *
 * Returns { easing, duration, points, overshoot }. `duration` is in milliseconds
 * and is the time the spring takes to settle within `precision` of its target.
 * Use both together: `transition: transform var(--dur) var(--easing)` or
 * `el.animate(frames, { duration, easing })`.
 */
export function spring({ response = 0.55, dampingFraction = 0.78, velocity = 0, precision = 0.0015, fps = 60, maxDuration = 4 } = {}) {
  if (!(response > 0)) throw new RangeError('spring: response must be greater than 0');
  if (!(dampingFraction > 0)) throw new RangeError('spring: dampingFraction must be greater than 0');
  const position = springSolver(response, dampingFraction, velocity);

  // Settle time: the last moment the spring is still outside the precision band.
  const dt = 1 / 240;
  let settle = 0;
  for (let t = 0; t <= maxDuration; t += dt) {
    if (Math.abs(1 - position(t)) > precision) settle = t + dt;
  }
  settle = Math.max(settle, 0.12);

  const steps = Math.max(2, Math.ceil(settle * fps));
  const points = [];
  let overshoot = 0;
  for (let i = 0; i <= steps; i++) {
    const x = i === steps ? 1 : position((settle * i) / steps);
    overshoot = Math.max(overshoot, x - 1);
    points.push(Number(x.toFixed(4)));
  }
  points[0] = 0;
  return {
    easing: `linear(${points.join(', ')})`,
    duration: Math.round(settle * 1000),
    points,
    overshoot: Number(Math.max(0, overshoot).toFixed(4)),
  };
}

/** Exact position (0 → 1) of a unit-mass spring released at 0 toward 1. */
export function springSolver(response, dampingFraction, velocity = 0) {
  const w0 = (2 * Math.PI) / response;
  const z = dampingFraction;
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const b = (velocity - z * w0) / wd;
    return (t) => 1 + Math.exp(-z * w0 * t) * (-Math.cos(wd * t) + b * Math.sin(wd * t));
  }
  if (z === 1) {
    const b = velocity - w0;
    return (t) => 1 + Math.exp(-w0 * t) * (-1 + b * t);
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s);
  const r2 = -w0 * (z + s);
  const c1 = (velocity + r2) / (r1 - r2);
  const c2 = -1 - c1;
  return (t) => 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

/** The named springs the standard uses. Each is a `spring()` result. */
export const springs = {
  get snappy() { return memo('snappy', { response: 0.38, dampingFraction: 0.82 }); },
  get deal() { return memo('deal', { response: 0.62, dampingFraction: 0.72 }); },
  get flip() { return memo('flip', { response: 0.7, dampingFraction: 0.78 }); },
  get toss() { return memo('toss', { response: 0.9, dampingFraction: 0.68 }); },
  get settle() { return memo('settle', { response: 0.85, dampingFraction: 0.86 }); },
};
const springCache = new Map();
function memo(key, opts) {
  if (!springCache.has(key)) springCache.set(key, spring(opts));
  return springCache.get(key);
}

// ---------------------------------------------------------------------------
// Guilloché — banknote line work
// ---------------------------------------------------------------------------

/**
 * Generate a guilloché rosette as an SVG string.
 *
 * Each strand is a closed ring whose radius is the sum of two sine waves; the
 * strands are offset in phase, which is what makes the woven, engraved look.
 * Deterministic: the same options always produce the same bytes.
 */
export function guilloche({
  size = 600,
  strands = 24,
  lobes = 18,
  lobes2 = 5,
  amplitude = 0.07,
  amplitude2 = 0.035,
  radius = 0.42,
  rings = 2,
  ringGap = 0.11,
  stroke = 'currentColor',
  strokeWidth = 0.6,
  opacity = 1,
  precision = 1,
} = {}) {
  const c = size / 2;
  const samples = Math.max(180, (lobes + lobes2) * 8);
  const paths = [];
  for (let ring = 0; ring < rings; ring++) {
    const base = size * (radius - ring * ringGap);
    if (base <= 0) break;
    const a1 = size * amplitude * (1 - ring * 0.18);
    const a2 = size * amplitude2;
    for (let k = 0; k < strands; k++) {
      const phase = (2 * Math.PI * k) / (strands * (ring % 2 ? 1 : 2)) / Math.max(1, lobes / 6);
      let d = '';
      for (let i = 0; i <= samples; i++) {
        const t = (2 * Math.PI * i) / samples;
        const r = base + a1 * Math.sin(lobes * t + phase * lobes) + a2 * Math.sin(lobes2 * t - phase * lobes2 * 2);
        const x = (c + r * Math.cos(t)).toFixed(precision);
        const y = (c + r * Math.sin(t)).toFixed(precision);
        d += (i === 0 ? 'M' : 'L') + x + ' ' + y;
      }
      paths.push(d + 'Z');
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
    `<path d="${paths.join('')}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}

/** A guilloché band for borders: a sine weave along a straight line. */
export function guillocheBand({ width = 600, height = 28, strands = 7, waves = 24, stroke = 'currentColor', strokeWidth = 0.6, precision = 2 } = {}) {
  const paths = [];
  const samples = waves * 16;
  for (let k = 0; k < strands; k++) {
    const phase = (Math.PI * 2 * k) / strands;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const x = (width * i) / samples;
      const y = height / 2 + (height / 2 - strokeWidth) * Math.sin((waves * 2 * Math.PI * i) / samples + phase);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(precision) + ' ' + y.toFixed(precision);
    }
    paths.push(d);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${paths.join('')}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Wrap an SVG string as a CSS url() value. */
export function svgURL(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------------------------------------------------------------------------
// Reduced motion and haptics
// ---------------------------------------------------------------------------

const motionQuery = hasDOM && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True when the person has asked the OS for less motion. Read it live, every time. */
export function reducedMotion() {
  return Boolean(motionQuery && motionQuery.matches);
}

const HAPTICS = {
  tick: [4],
  select: [8],
  tap: [12],
  land: [10, 30, 6],
  success: [12, 60, 18, 40, 30],
  error: [40, 50, 40],
};

/**
 * Fire a haptic tied to a physical event. Uses the Vibration API where the
 * browser has one (Android Chrome) and does nothing elsewhere — never throws.
 * Native apps: map these names to UIImpactFeedbackGenerator / UINotificationFeedbackGenerator.
 */
export function haptic(kind = 'tap') {
  if (!hasDOM || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  if (reducedMotion() && kind === 'tick') return false;
  // Browsers refuse vibration before the person has interacted with the page.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
  try {
    return navigator.vibrate(HAPTICS[kind] || HAPTICS.tap);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Film grain at device resolution
// ---------------------------------------------------------------------------

/**
 * Paint a noise tile at the screen's real pixel density and expose it as
 * `--wow-grain` on the root. One noise pixel is one device pixel, so the grain
 * stays fine on a 3x phone instead of turning into 1x mush.
 */
export function grain({ size = 120, alpha = 22, target = hasDOM ? document.documentElement : null } = {}) {
  if (!hasDOM || !target) return null;
  const dpr = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
  const px = Math.round(size * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(px, px);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  target.style.setProperty('--wow-grain', `url("${url}")`);
  target.style.setProperty('--wow-grain-size', `${size}px`);
  return url;
}

// ---------------------------------------------------------------------------
// Tilt, foil and light
// ---------------------------------------------------------------------------

let gyroGranted = false;
const gyroListeners = new Set();
function onOrientation(e) {
  for (const fn of gyroListeners) fn(e);
}

/**
 * Make an element react to the pointer and the phone's gyroscope.
 *
 * Writes four custom properties on the element, low-pass filtered every frame:
 *   --wow-rx / --wow-ry  rotation in degrees (used by .wow-tilt)
 *   --wow-mx / --wow-my  light position, 0%–100% (used by .wow-foil and .wow-leaf)
 *   --wow-tx / --wow-ty  the same position as plain 0–1 numbers, for calc()
 * On iOS the gyroscope needs one tap to grant; the first tap on the page asks.
 */
export function tilt(el, { max = 12, smoothing = 0.14, gyro = true, rest = { x: 0.5, y: 0.35 } } = {}) {
  if (!hasDOM || !el) return { destroy() {} };
  let target = { x: rest.x, y: rest.y };
  let current = { ...target };
  let raf = 0;
  let active = true;

  const write = () => {
    const rx = (0.5 - current.y) * max * 2;
    const ry = (current.x - 0.5) * max * 2;
    el.style.setProperty('--wow-rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--wow-ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--wow-mx', `${(current.x * 100).toFixed(1)}%`);
    el.style.setProperty('--wow-my', `${(current.y * 100).toFixed(1)}%`);
    el.style.setProperty('--wow-tx', current.x.toFixed(3));
    el.style.setProperty('--wow-ty', current.y.toFixed(3));
  };
  const loop = () => {
    raf = 0;
    if (!active) return;
    const k = reducedMotion() ? 1 : smoothing;
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    write();
    if (Math.abs(target.x - current.x) > 0.0005 || Math.abs(target.y - current.y) > 0.0005) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    target = {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
    kick();
  };
  const onLeave = () => {
    target = { ...rest };
    kick();
  };
  const onGyro = (e) => {
    if (e.beta == null || e.gamma == null) return;
    // Phone held upright at about 45°: map ±25° of gamma and beta to the full range.
    target = {
      x: clamp(0.5 + e.gamma / 50, 0, 1),
      y: clamp(0.5 + (e.beta - 45) / 50, 0, 1),
    };
    kick();
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  if (gyro && 'DeviceOrientationEvent' in window) {
    gyroListeners.add(onGyro);
    if (gyroListeners.size === 1) enableGyro();
  }
  write();
  return {
    destroy() {
      active = false;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gyroListeners.delete(onGyro);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}

function enableGyro() {
  const DOE = window.DeviceOrientationEvent;
  const attach = () => {
    if (gyroGranted) return;
    gyroGranted = true;
    window.addEventListener('deviceorientation', onOrientation);
  };
  if (typeof DOE.requestPermission === 'function') {
    const ask = () => {
      DOE.requestPermission()
        .then((state) => state === 'granted' && attach())
        .catch(() => {});
    };
    window.addEventListener('pointerup', ask, { once: true });
  } else {
    attach();
  }
}

// ---------------------------------------------------------------------------
// Motion verbs
// ---------------------------------------------------------------------------

function asList(els) {
  if (!els) return [];
  if (typeof els === 'string') return hasDOM ? [...document.querySelectorAll(els)] : [];
  if (hasDOM && els instanceof Element) return [els];
  if (typeof els[Symbol.iterator] !== 'function') return [els];
  return [...els];
}

// Animations end where the element's own CSS already rests, so they are simply
// cancelled at the finish. `keep` commits the last frame inline instead, for
// verbs that leave the object somewhere new (a played card).
function run(el, frames, { keep = false, ...timing } = {}) {
  if (!el.animate) return Promise.resolve();
  const anim = el.animate(frames, { fill: 'both', ...timing });
  return anim.finished.then(
    () => {
      if (keep) {
        try {
          anim.commitStyles();
        } catch {
          /* element left the document mid-animation */
        }
      }
      anim.cancel();
    },
    () => {}
  );
}

function calm(el, { delay = 0 } = {}) {
  // Reduce Motion: a short cross-fade in place, no travel, no rotation.
  return run(el, [{ opacity: 0 }, { opacity: 1, transform: 'none' }], { duration: 180, delay: delay * 1000, easing: 'ease-out' });
}

/**
 * Deal elements onto the table like cards: they fly in from the deck, rotate
 * to rest and land with a soft haptic each. `from` is where the deck sits
 * relative to each element, in px.
 */
export function deal(els, { from = { x: 0, y: -220 }, rotate = -14, stagger = 0.06, delay = 0, haptics = true } = {}) {
  const list = asList(els);
  const s = springs.deal;
  return Promise.all(
    list.map((el, i) => {
      const d = delay + i * stagger;
      if (reducedMotion()) return calm(el, { delay: d });
      const rest = getComputedStyle(el).getPropertyValue('--wow-rest').trim() || 'none';
      if (haptics) setTimeout(() => haptic('tick'), (d + s.duration / 2600) * 1000);
      return run(
        el,
        [
          { opacity: 0, transform: `translate(${from.x}px, ${from.y}px) rotate(${rotate + i * 3}deg) scale(0.86)` },
          { opacity: 1, offset: 0.18 },
          { opacity: 1, transform: rest },
        ],
        { duration: s.duration, easing: s.easing, delay: d * 1000 }
      );
    })
  );
}

/**
 * Flip a two-faced object (`.wow-flip` with `.wow-face` children). Toggles the
 * `is-flipped` class so the resting state lives in CSS, and animates the turn
 * with the flip spring.
 */
export function flip(el, { to } = {}) {
  const node = asList(el)[0];
  if (!node) return Promise.resolve(false);
  const next = to === undefined ? !node.classList.contains('is-flipped') : Boolean(to);
  node.classList.toggle('is-flipped', next);
  haptic('select');
  return Promise.resolve(next);
}

/**
 * Toss a coin or chip: it leaves the table, spins between its faces and lands.
 * Swaps the face at the top of the arc when `swap` is given.
 */
export function toss(el, { turns = 2, height = 46, swap } = {}) {
  const node = asList(el)[0];
  if (!node) return Promise.resolve();
  if (reducedMotion()) {
    if (swap) swap();
    return calm(node);
  }
  const s = springs.toss;
  if (swap) setTimeout(swap, s.duration * 0.28);
  setTimeout(() => haptic('land'), s.duration * 0.6);
  return run(
    node,
    [
      { transform: 'translateY(0) rotateY(0deg) scale(1)' },
      { transform: `translateY(-${height}px) rotateY(${turns * 180}deg) scale(1.08)`, offset: 0.4 },
      { transform: `translateY(0) rotateY(${turns * 360}deg) scale(1)` },
    ],
    { duration: s.duration, easing: 'cubic-bezier(.2,.7,.25,1)' }
  );
}

/** Drop chips onto a stack one at a time, each with a click. */
export function stack(els, { height = 90, stagger = 0.085, delay = 0 } = {}) {
  const list = asList(els);
  const s = springs.snappy;
  return Promise.all(
    list.map((el, i) => {
      const d = delay + i * stagger;
      if (reducedMotion()) return calm(el, { delay: d });
      setTimeout(() => haptic('tap'), (d + s.duration / 3000) * 1000);
      return run(
        el,
        [
          { opacity: 0, transform: `translateY(-${height}px) rotateX(55deg)` },
          { opacity: 1, offset: 0.3 },
          { opacity: 1, transform: 'none' },
        ],
        { duration: s.duration, easing: s.easing, delay: d * 1000 }
      );
    })
  );
}

/** Refuse: a wrong answer shakes like a card snapped back on the felt. */
export function shake(el, { distance = 12 } = {}) {
  const node = asList(el)[0];
  if (!node) return Promise.resolve();
  haptic('error');
  if (reducedMotion()) return run(node, [{ outline: '2px solid currentColor' }, { outline: '0 solid transparent' }], { duration: 400 });
  const d = distance;
  return run(
    node,
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${d}px) rotate(-1.5deg)` },
      { transform: `translateX(${d * 0.8}px) rotate(1.2deg)` },
      { transform: `translateX(-${d * 0.5}px) rotate(-0.6deg)` },
      { transform: `translateX(${d * 0.25}px)` },
      { transform: 'translateX(0)' },
    ],
    { duration: 460, easing: 'cubic-bezier(.36,.07,.19,.97)' }
  );
}

/** Play a card: it lifts, travels to `to` (an element or {x,y}) and lands. */
export function play(el, { to = { x: 0, y: -60 }, scale = 1.04 } = {}) {
  const node = asList(el)[0];
  if (!node) return Promise.resolve();
  haptic('tap');
  let dx = to.x || 0;
  let dy = to.y || 0;
  if (hasDOM && to instanceof Element) {
    const a = node.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    dx = b.left + b.width / 2 - (a.left + a.width / 2);
    dy = b.top + b.height / 2 - (a.top + a.height / 2);
  }
  if (reducedMotion()) return calm(node);
  const s = springs.deal;
  return run(
    node,
    [
      { transform: getComputedStyle(node).transform === 'none' ? 'none' : getComputedStyle(node).transform },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${scale + 0.06}) rotate(0deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)` },
    ],
    { duration: s.duration, easing: s.easing, keep: true }
  );
}

/** Light burst for the big moments: deterministic sparks drawn with WAAPI. */
export function burst(el, { count = 18, distance = 120, hue = 'var(--wow-metal-light)' } = {}) {
  const host = asList(el)[0];
  if (!hasDOM || !host || reducedMotion()) return Promise.resolve();
  const r = host.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:0;height:0;pointer-events:none;z-index:9999`;
  document.body.appendChild(layer);
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (i % 2) * 0.2;
    const len = distance * (0.6 + ((i * 37) % 10) / 25);
    const p = document.createElement('i');
    p.style.cssText = `position:absolute;width:3px;height:${10 + (i % 4) * 3}px;margin:-6px 0 0 -1.5px;border-radius:2px;background:${hue};box-shadow:0 0 8px ${hue};transform-origin:center`;
    layer.appendChild(p);
    const deg = (a * 180) / Math.PI + 90;
    jobs.push(
      p.animate(
        [
          { transform: `rotate(${deg}deg) translateY(0) scaleY(0.4)`, opacity: 1 },
          { transform: `rotate(${deg}deg) translateY(${-len}px) scaleY(1)`, opacity: 0 },
        ],
        { duration: 700 + (i % 5) * 60, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' }
      ).finished
    );
  }
  return Promise.all(jobs).then(() => layer.remove(), () => layer.remove());
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Publish the named springs as CSS custom properties: --wow-spring-<name> and --wow-dur-<name>. */
export function publishSprings(target = hasDOM ? document.documentElement : null) {
  if (!target) return;
  for (const name of Object.keys(springs)) {
    const s = springs[name];
    target.style.setProperty(`--wow-spring-${name}`, s.easing);
    target.style.setProperty(`--wow-dur-${name}`, `${s.duration}ms`);
  }
}

/**
 * Wire the page from data attributes:
 *   data-wow-tilt            pointer/gyro tilt and foil
 *   data-wow-deal            deal in when it scrolls into view (children if it has [data-wow-hand])
 *   data-wow-stack           drop children in as a chip stack when visible
 *   data-wow-rosette="opts"  fill with a guilloché rosette (JSON options)
 * plus device-resolution grain and the spring custom properties.
 */
export function auto(root = hasDOM ? document : null) {
  if (!root) return;
  publishSprings();
  grain();
  for (const el of root.querySelectorAll('[data-wow-tilt]')) tilt(el);
  for (const el of root.querySelectorAll('[data-wow-rosette]')) {
    let opts = {};
    try {
      opts = JSON.parse(el.getAttribute('data-wow-rosette') || '{}');
    } catch {
      /* attribute holds no options */
    }
    el.innerHTML = guilloche(opts);
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          if (e.target.hasAttribute('data-wow-stack')) stack(e.target.children);
          else deal(e.target.hasAttribute('data-wow-hand') ? e.target.children : e.target);
        }
      }, { threshold: 0.35 })
    : null;
  for (const el of root.querySelectorAll('[data-wow-deal], [data-wow-stack]')) {
    if (io) io.observe(el);
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
