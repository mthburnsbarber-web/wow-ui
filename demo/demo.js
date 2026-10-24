import * as wow from '../kit/wow.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

wow.auto();

// ------------------------------------------------------------------ worlds
const WORLDS = [
  { id: 'card-table', name: 'Card table', line: 'Lacquer, felt, gold leaf. Deal, flip, toss.', glyph: '♠' },
  { id: 'console', name: 'Studio console', line: 'Brushed aluminium, VU ballistics, valve amber.', glyph: 'VU' },
  { id: 'blueprint', name: 'Blueprint', line: 'Drafting film, ink that draws itself, brass.', glyph: 'A1' },
  { id: 'certificate', name: 'Bond certificate', line: 'Security paper, intaglio, a seal on confirm.', glyph: '№' },
  { id: 'night-watch', name: 'Night watch', line: 'Lantern copper, frosted glass, a radar sweep.', glyph: '◐' },
  { id: 'film-studio', name: 'Film studio', line: 'Slate, projector light, record red.', glyph: '●' },
];

function setWorld(id, { from } = {}) {
  if (!WORLDS.some((w) => w.id === id)) return;
  root.setAttribute('data-wow-world', id);
  const meta = getComputedStyle(root).getPropertyValue('--wow-base').trim();
  $('meta[name="theme-color"]').setAttribute('content', meta || '#060507');
  for (const chip of $$('.chips .wow-chip')) {
    const on = chip.dataset.world === id;
    chip.setAttribute('aria-checked', String(on));
    chip.setAttribute('aria-pressed', String(on));
  }
  const face = $(`.face[data-face="${id}"]`);
  face.classList.remove('is-entering');
  void face.offsetWidth;
  face.classList.add('is-entering');
  const obj = face.querySelector('.wow-tilt');
  if (id === 'card-table') wow.deal(obj, { from: { x: 0, y: -260 }, rotate: -18 });
  else if (id === 'night-watch') wow.haptic('tick');
  else wow.deal(obj, { from: { x: 0, y: 60 }, rotate: 0 });
  wow.publishSprings();
  const url = new URL(location.href);
  url.searchParams.set('world', id);
  history.replaceState(null, '', url);
  if (from) wow.toss(from, { turns: 1, height: 26 });
}

for (const chip of $$('.chips .wow-chip')) {
  chip.addEventListener('click', () => setWorld(chip.dataset.world, { from: chip }));
  chip.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const chips = $$('.chips .wow-chip');
    const i = chips.indexOf(chip);
    const next = chips[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
    next.focus();
    setWorld(next.dataset.world, { from: next });
  });
}

const grid = $('#world-grid');
for (const w of WORLDS) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'world';
  el.setAttribute('data-wow-world', w.id);
  el.setAttribute('aria-label', `Switch the page to the ${w.name} world`);
  el.innerHTML = `
    <h3 class="wow-leaf">${w.name}</h3>
    <p>${w.line}</p>
    <div class="row">
      <span class="wow-chip" aria-hidden="true"><span>${w.glyph}</span></span>
      <span class="wow-card mini-card" aria-hidden="true"><span class="wow-card__pip">${w.glyph === '♠' ? '♠' : '◆'}</span></span>
      <span class="wow-button" aria-hidden="true">Continue</span>
    </div>
    <div class="swatch-metal wow-metal" aria-hidden="true"></div>`;
  el.addEventListener('click', () => {
    setWorld(w.id);
    window.scrollTo({ top: 0, behavior: wow.reducedMotion() ? 'auto' : 'smooth' });
  });
  grid.appendChild(el);
}

// Tilt every hero object from its larger host so the pointer has room.
for (const host of $$('[data-tilt-host]')) {
  // The custom properties inherit, so the object inside follows its host.
  wow.tilt(host, { max: 13 });
}

// Certificate borders.
for (const band of $$('[data-band]')) band.innerHTML = wow.guillocheBand({ width: 400, height: 16, strands: 3, waves: 18, strokeWidth: 0.5 });

// VU meter scale and needle ballistics.
(function vu() {
  const svg = $('.vu-scale');
  const cx = 100;
  const cy = 132;
  const marks = [
    [-20, -45], [-10, -30], [-7, -20], [-5, -10], [-3, 0], [-1, 12], [0, 20], [1, 30], [3, 45],
  ];
  let out = `<path d="${arc(cx, cy, 96, 20, 45)}" stroke="#b3261e" stroke-width="7" fill="none" opacity=".85"/>`;
  out += `<path d="${arc(cx, cy, 99, -45, 45)}" stroke="#3a2a12" stroke-width="1.2" fill="none"/>`;
  for (const [label, deg] of marks) {
    const a = ((deg - 90) * Math.PI) / 180;
    const x1 = cx + 99 * Math.cos(a);
    const y1 = cy + 99 * Math.sin(a);
    const x2 = cx + 88 * Math.cos(a);
    const y2 = cy + 88 * Math.sin(a);
    const tx = cx + 78 * Math.cos(a);
    const ty = cy + 78 * Math.sin(a);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#3a2a12" stroke-width="1.4"/>`;
    out += `<text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" text-anchor="middle" font-size="8" font-family="Michroma, sans-serif" fill="${label >= 0 ? '#9b1d17' : '#3a2a12'}">${label > 0 ? '+' + label : label}</text>`;
  }
  svg.innerHTML = out;
  const needle = $('#needle');
  let level = 0.35;
  setInterval(() => {
    if (root.getAttribute('data-wow-world') !== 'console' || document.hidden) return;
    if (wow.reducedMotion()) {
      needle.style.setProperty('--needle', '-6deg');
      return;
    }
    level += (Math.random() - 0.48) * 0.28;
    level = Math.max(0.08, Math.min(0.95, level));
    needle.style.setProperty('--needle', `${(-42 + level * 86).toFixed(1)}deg`);
  }, 140);
  function arc(x, y, r, a0, a1) {
    const p = (d) => {
      const a = ((d - 90) * Math.PI) / 180;
      return `${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`;
    };
    return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`;
  }
})();

// ------------------------------------------------------------------ kit specimens
// Toss: Talk ↔ Send.
(function talk() {
  const chip = $('#talk');
  const face = $('#talk-face');
  chip.addEventListener('click', () => {
    const next = face.textContent === 'Talk' ? 'Send' : 'Talk';
    wow.toss(chip, {
      swap: () => {
        face.textContent = next;
        chip.setAttribute('aria-label', next);
      },
    });
  });
})();

// Deal and play.
(function hand() {
  const host = $('#hand');
  const cards = $$('.wow-card', host);
  let dealt = false;
  const dealIn = () => {
    for (const c of cards) {
      c.classList.remove('played');
      c.style.transform = '';
      c.style.opacity = '';
    }
    dealt = true;
    return wow.deal(cards, { from: { x: 0, y: -170 }, stagger: 0.09 });
  };
  new IntersectionObserver((entries, io) => {
    if (entries.some((e) => e.isIntersecting) && !dealt) {
      io.disconnect();
      dealIn();
    }
  }, { threshold: 0.4 }).observe(host);
  const playCard = (c) => {
    c.classList.add('played');
    wow.play(c, { to: { x: 0, y: -22 }, scale: 1.08 });
  };
  for (const c of cards) {
    c.addEventListener('click', () => playCard(c));
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playCard(c);
      }
    });
  }
  $('#redeal').addEventListener('click', dealIn);
})();

// Stack: balance.
(function balance() {
  const stack = $('#stack');
  const num = $('#balance');
  let total = 120;
  const add = (n, animate = true) => {
    const fresh = [];
    for (let i = 0; i < n; i++) {
      if (stack.children.length >= 9) stack.firstElementChild.remove();
      const d = document.createElement('i');
      d.className = 'wow-chip-disc';
      d.setAttribute('aria-hidden', 'true');
      stack.appendChild(d);
      fresh.push(d);
    }
    if (animate) wow.stack(fresh);
    total += n * 20;
    num.textContent = `$${total}`;
  };
  new IntersectionObserver((entries, io) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      total = 20;
      add(5);
    }
  }, { threshold: 0.4 }).observe(stack.parentElement);
  $('#add-chips').addEventListener('click', () => add(3));
})();

// Reveal: code on the card back.
(function code() {
  const inputs = $$('#code input');
  const box = $('#code');
  const flipper = $('#code-flip');
  const msg = $('#code-msg');
  const ANSWER = '7214';
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      box.classList.remove('is-cold');
      if (inp.value) {
        wow.haptic('tick');
        if (inputs[i + 1]) inputs[i + 1].focus();
      }
      const value = inputs.map((x) => x.value).join('');
      if (value.length === 4) check(value);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', (e) => {
      const digits = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach((d, j) => inputs[j] && (inputs[j].value = d));
      if (digits.length === 4) check(digits);
    });
  });
  function check(value) {
    if (value === ANSWER) {
      msg.textContent = 'Dealing you in…';
      setTimeout(() => {
        wow.flip(flipper, { to: true });
        wow.haptic('success');
        wow.burst(flipper.parentElement);
      }, 180);
    } else {
      box.classList.add('is-cold');
      msg.textContent = `${value} isn't the code. Try 7 2 1 4.`;
      wow.shake(box).then(() => {
        inputs.forEach((x) => (x.value = ''));
        inputs[0].focus();
      });
    }
  }
  $('#code-reset').addEventListener('click', () => {
    wow.flip(flipper, { to: false });
    inputs.forEach((x) => (x.value = ''));
    box.classList.remove('is-cold');
    msg.textContent = 'Each digit lights gold';
  });
})();

// Permissions turn face-up.
for (const btn of $$('.perm')) {
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    wow.flip(btn.querySelector('.wow-flip'), { to: on });
    if (on) wow.haptic('success');
  });
}

// The Joker.
(function joker() {
  const card = $('#joker');
  const original = card.innerHTML;
  const bind = () => {
    $('#joker-fix').addEventListener('click', async () => {
      await wow.play(card, { to: { x: 0, y: -12 }, scale: 0.98 });
      card.style.transform = '';
      card.innerHTML = `<div class="wow-joker__mark" style="background:var(--wow-metal);color:var(--wow-metal-shadow)">✓</div><div><strong style="display:block;margin-bottom:4px">Microphone ready.</strong><span style="font-size:.84rem;color:var(--wow-ink-dim)">In your product this is where the retry actually runs. This demo stops here.</span><div style="margin-top:12px"><button class="wow-button wow-button--quiet" type="button" id="joker-again" style="min-height:34px">Show the error again</button></div></div>`;
      card.setAttribute('role', 'status');
      wow.haptic('success');
      $('#joker-again').addEventListener('click', () => {
        card.innerHTML = original;
        card.setAttribute('role', 'alert');
        wow.shake(card);
        bind();
      });
    });
  };
  bind();
})();

// Seal: confirmation.
(function seal() {
  const btn = $('#seal-go');
  const seal = $('#seal');
  const msg = $('#seal-msg');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    msg.textContent = 'Sealing…';
    seal.classList.remove('is-set');
    void seal.offsetWidth;
    seal.classList.add('is-set');
    if (!wow.reducedMotion()) {
      const s = wow.springs.toss;
      await seal.animate(
        [
          { transform: 'translateY(-70px) scale(1.9) rotate(-28deg)', opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: s.duration, easing: s.easing }
      ).finished;
    }
    wow.haptic('success');
    wow.burst(seal, { count: 14, distance: 80 });
    msg.textContent = 'Order 1042 confirmed. Sealed at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
    btn.textContent = 'Seal again';
    btn.disabled = false;
  });
})();

// ------------------------------------------------------------------ springs
(function springs() {
  const resp = $('#resp');
  const damp = $('#damp');
  const curve = $('#curve');
  const card = $('#lane-card');
  const css = $('#spring-css');
  let current = null;
  const fill = (input) => input.style.setProperty('--fill', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
  function render() {
    const r = Number(resp.value);
    const d = Number(damp.value);
    fill(resp);
    fill(damp);
    $('#resp-out').textContent = `${r.toFixed(2)} s`;
    $('#damp-out').textContent = d.toFixed(2);
    current = wow.spring({ response: r, dampingFraction: d });
    const W = 400;
    const H = 230;
    const pad = 18;
    const top = 40;
    const y = (v) => H - pad - (v / 1.25) * (H - pad - top);
    const pts = current.points.map((v, i) => `${(pad + (i / (current.points.length - 1)) * (W - pad * 2)).toFixed(1)},${y(v).toFixed(1)}`);
    curve.innerHTML =
      `<line class="curve-grid" x1="${pad}" y1="${y(0)}" x2="${W - pad}" y2="${y(0)}"/>` +
      `<line class="curve-target" x1="${pad}" y1="${y(1)}" x2="${W - pad}" y2="${y(1)}"/>` +
      `<text x="${W - pad}" y="${y(1) - 6}" text-anchor="end" font-size="11" fill="currentColor" opacity=".55">target</text>` +
      `<text x="${pad}" y="22" font-size="12" fill="currentColor" opacity=".7">${current.duration} ms · overshoot ${(current.overshoot * 100).toFixed(1)}%</text>` +
      `<polyline class="curve-line" points="${pts.join(' ')}"/>`;
    curve.style.color = 'var(--wow-ink)';
    css.innerHTML =
      `<span class="k">/* CSS */</span>\ntransition: transform ${current.duration}ms ${current.easing};\n\n` +
      `<span class="k">/* JS */</span>\nwow.spring({ response: ${r}, dampingFraction: ${d} })\n\n` +
      `<span class="k">/* SwiftUI */</span>\n.animation(.spring(response: ${r}, dampingFraction: ${d}), value: x)`;
  }
  function play() {
    const lane = $('#lane');
    const dist = lane.clientWidth - 40 - 28;
    const at = card.dataset.at === '1';
    card.dataset.at = at ? '0' : '1';
    card.animate(
      [{ transform: `translateX(${at ? dist : 0}px)` }, { transform: `translateX(${at ? 0 : dist}px)` }],
      { duration: wow.reducedMotion() ? 1 : current.duration, easing: current.easing, fill: 'forwards' }
    );
    wow.haptic('tap');
  }
  resp.addEventListener('input', render);
  damp.addEventListener('input', render);
  resp.addEventListener('change', play);
  damp.addEventListener('change', play);
  $('#spring-play').addEventListener('click', play);
  $('#spring-copy').addEventListener('click', () => copy(`transition: transform ${current.duration}ms ${current.easing};`, $('#spring-toast')));
  render();
})();

// ------------------------------------------------------------------ guilloché
(function guillocheTool() {
  const ids = ['g-lobes', 'g-lobes2', 'g-strands', 'g-amp', 'g-rings'];
  const view = $('#g-view');
  let svg = '';
  let opts = {};
  let pending = 0;
  function render() {
    pending = 0;
    const v = Object.fromEntries(ids.map((id) => [id, Number($('#' + id).value)]));
    for (const id of ids) {
      const input = $('#' + id);
      input.style.setProperty('--fill', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
      $(`#${id}-out`).textContent = id === 'g-amp' ? v[id].toFixed(3).replace(/0$/, '') : v[id];
    }
    opts = { lobes: v['g-lobes'], lobes2: v['g-lobes2'], strands: v['g-strands'], amplitude: v['g-amp'], rings: v['g-rings'] };
    svg = wow.guilloche({ size: 600, ...opts, strokeWidth: 0.7 });
    view.innerHTML = svg;
  }
  for (const id of ids) $('#' + id).addEventListener('input', () => (pending ||= requestAnimationFrame(render)));
  $('#g-download').addEventListener('click', () => {
    const blob = new Blob([svg.replace('stroke="currentColor"', 'stroke="#c39431"')], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `guilloche-${opts.lobes}-${opts.lobes2}-${opts.strands}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('#g-toast').textContent = 'Downloaded.';
  });
  $('#g-copy').addEventListener('click', () => copy(`wow.guilloche(${JSON.stringify(opts)})`, $('#g-toast')));
  render();
})();

// ------------------------------------------------------------------ copy buttons
async function copy(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    if (toast) toast.textContent = 'Copied.';
    wow.haptic('select');
  } catch {
    if (toast) toast.textContent = 'Copy is blocked here. Select the text and copy it.';
  }
  if (toast) setTimeout(() => (toast.textContent = ''), 2400);
}
for (const btn of $$('[data-copy]')) {
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Select it';
    }
    setTimeout(() => (btn.textContent = label), 1800);
  });
}

// ------------------------------------------------------------------ start
const start = new URL(location.href).searchParams.get('world');
setWorld(WORLDS.some((w) => w.id === start) ? start : 'card-table');
