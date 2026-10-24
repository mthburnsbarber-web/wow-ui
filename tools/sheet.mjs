// wow-sheet — screenshot every screen into one contact sheet, so the product can
// be judged as one artwork. Zero dependencies: drives the Chrome, Chromium, Edge
// or Brave already on the machine in headless mode.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

export function findBrowser(env = process.env, platform = process.platform) {
  if (env.CHROME_PATH) {
    if (existsSync(env.CHROME_PATH)) return env.CHROME_PATH;
    throw new Error(`CHROME_PATH is set to ${env.CHROME_PATH}, which does not exist.`);
  }
  for (const c of CANDIDATES[platform] || []) {
    if (c.includes('/') || c.includes('\\')) {
      if (existsSync(c)) return c;
    } else {
      const r = spawnSync(platform === 'win32' ? 'where' : 'which', [c], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split('\n')[0];
    }
  }
  throw new Error('No Chrome, Chromium, Edge or Brave found. Install one or set CHROME_PATH.');
}

/** "Label=target" or "target". Files become file:// URLs. */
export function parseTarget(arg, cwd = process.cwd()) {
  let label = null;
  let target = arg;
  const eq = arg.indexOf('=');
  if (eq > 0 && !/^[a-z]+:\/\//i.test(arg.slice(0, eq)) && /^(?:https?:|file:|\.|\/|[a-z]:\\)/i.test(arg.slice(eq + 1))) {
    label = arg.slice(0, eq);
    target = arg.slice(eq + 1);
  }
  const url = /^[a-z]+:/i.test(target) && !/^[a-z]:\\/i.test(target) ? target : pathToFileURL(resolve(cwd, target)).href;
  if (!label) {
    try {
      const u = new URL(url);
      label = (u.pathname.split('/').filter(Boolean).pop() || u.host || url) + (u.search || '') + (u.hash || '');
    } catch {
      label = target;
    }
  }
  return { label, url };
}

function shoot(browser, url, file, { width, height, wait, dpr, dark }) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${dpr}`,
    `--virtual-time-budget=${wait}`,
    `--screenshot=${file}`,
  ];
  if (dark) args.push('--force-dark-mode', '--blink-settings=preferredColorScheme=0');
  args.push(url);
  const r = spawnSync(browser, args, { encoding: 'utf8', timeout: wait + 30000 });
  if (!existsSync(file)) throw new Error(`Screenshot of ${url} failed: ${(r.stderr || r.error?.message || 'no output').trim().split('\n').slice(-2).join(' ')}`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function sheetHTML(shots, { title, cols, thumb, ratio }) {
  const cells = shots
    .map((s) => `<figure><div class="frame"><img src="data:image/png;base64,${s.png}" alt=""></div><figcaption>${esc(s.label)}</figcaption></figure>`)
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#060507}
body{padding:56px 56px 64px;color:#f3e9d2;font:14px/1.4 -apple-system,"Segoe UI",Inter,sans-serif;
background:radial-gradient(120% 60% at 50% -10%,rgba(255,217,160,.14),transparent 60%),#060507}
h1{margin:0 0 6px;font:600 30px/1.1 "Cormorant Garamond",Didot,Georgia,serif;letter-spacing:.01em;
background:linear-gradient(100deg,#c39431,#f1d27e 30%,#fff8de 45%,#f1d27e 60%,#c39431 85%);-webkit-background-clip:text;color:transparent}
.meta{margin:0 0 34px;color:rgba(243,233,210,.5);font-size:12px;letter-spacing:.18em;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:34px 28px}
figure{margin:0}.frame{width:${thumb}px;aspect-ratio:${ratio};border-radius:10px;overflow:hidden;
box-shadow:inset 0 0 0 1px rgba(195,148,49,.35),0 0 0 4px #060507,0 0 0 5px rgba(195,148,49,.18),0 18px 40px -14px #000}
img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
figcaption{margin-top:12px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f1d27e}
</style><h1>${esc(title)}</h1><p class="meta">${shots.length} screen${shots.length === 1 ? '' : 's'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p><div class="grid">${cells}</div>`;
}

export function contactSheet(targets, opts = {}) {
  const o = { width: 1280, height: 800, wait: 3000, dpr: 1, cols: 0, thumb: 0, title: 'Contact sheet', out: 'contact-sheet.png', dark: false, html: false, ...opts };
  if (!targets.length) throw new Error('Give at least one URL or file to photograph.');
  const browser = o.browser || findBrowser();
  const dir = mkdtempSync(join(tmpdir(), 'wow-sheet-'));
  try {
    const shots = targets.map((t, i) => {
      const { label, url } = typeof t === 'string' ? parseTarget(t) : t;
      const file = join(dir, `shot-${i}.png`);
      shoot(browser, url, file, o);
      return { label, url, png: readFileSync(file).toString('base64') };
    });
    const cols = o.cols || Math.min(shots.length, shots.length <= 4 ? shots.length : shots.length <= 9 ? 3 : 4);
    const thumb = o.thumb || Math.round(Math.max(260, Math.min(520, 1500 / cols)));
    const rows = Math.ceil(shots.length / cols);
    const thumbH = Math.round((thumb * o.height) / o.width);
    const pageW = 56 * 2 + cols * thumb + (cols - 1) * 28;
    const pageH = 56 + 30 + 6 + 17 + 34 + rows * (thumbH + 12 + 17) + (rows - 1) * 34 + 64 + 8;
    const html = sheetHTML(shots, { title: o.title, cols, thumb, ratio: `${o.width} / ${o.height}` });
    const htmlFile = join(dir, 'sheet.html');
    writeFileSync(htmlFile, html);
    const out = resolve(o.out);
    shoot(browser, pathToFileURL(htmlFile).href, out, { width: pageW, height: pageH, wait: 500, dpr: o.dpr, dark: false });
    if (o.html) writeFileSync(out.replace(/\.png$/i, '') + '.html', html);
    return { out, shots: shots.map(({ label, url }) => ({ label, url })), size: [pageW, pageH] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
