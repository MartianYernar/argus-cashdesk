import gsap from 'gsap';

export const fine = matchMedia('(pointer: fine)').matches;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();

// ---------------- block cursor ----------------
export function initCursor() {
  if (!fine) return;
  document.body.classList.add('has-cursor');
  const el = document.getElementById('cursor');
  const label = document.getElementById('cursorLabel');
  const x = gsap.quickTo(el, 'x', { duration: 0.12, ease: 'steps(3)' });
  const y = gsap.quickTo(el, 'y', { duration: 0.12, ease: 'steps(3)' });
  addEventListener('pointermove', (e) => { x(e.clientX); y(e.clientY); });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button, label, .frame, .mark, input');
    el.classList.toggle('is-text', !!t && t.matches('input'));
    el.classList.toggle('is-hover', !!t && !t.matches('input'));
    label.textContent = t && !t.matches('input') ? (t.dataset.cursor || (t.classList.contains('frame') ? 'zoom' : t.classList.contains('mark') ? 'seek' : '')) : '';
  });
}

// ---------------- text scramble ----------------
const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&01アカサタナ░▒▓█';
export function scramble(el, to = el.textContent, dur = 0.6) {
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const q = Array.from({ length: len }, (_, i) => ({ to: to[i] || '', start: Math.random() * 0.4, end: 0.4 + Math.random() * 0.6 }));
  const o = { p: 0 };
  if (el._scr) el._scr.kill();
  el._scr = gsap.to(o, {
    p: 1, duration: dur, ease: 'none',
    onUpdate() { el.textContent = q.map((c, i) => (o.p >= c.end ? c.to : o.p >= c.start ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : from[i] || '')).join(''); },
    onComplete() { el.textContent = to; },
  });
}
export function initScramble(root = document) {
  root.querySelectorAll('[data-scramble]').forEach((el) => {
    if (el._sb) return; el._sb = 1;
    el.addEventListener('pointerenter', () => { if (!el._scr?.isActive()) scramble(el, el.textContent, 0.5); });
  });
}

// ---------------- typewriter ----------------
export function typeText(el, text, speed = 28) {
  return new Promise((res) => {
    el.classList.add('is-typing');
    if (reduced) { el.textContent = text; el.classList.remove('is-typing'); return res(); }
    el.textContent = '';
    let i = 0;
    const tick = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, speed + Math.random() * speed);
      else { setTimeout(() => el.classList.remove('is-typing'), 600); res(); }
    };
    tick();
  });
}

// ---------------- ascii bursts ----------------
const parts = [];
export function initSparks() {
  const c = document.getElementById('sparks');
  const ctx = c.getContext('2d');
  const size = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  size(); addEventListener('resize', size);
  addEventListener('pointerdown', (e) => { if (!reduced) burst(e.clientX, e.clientY, 12); });
  gsap.ticker.add(() => {
    if (!parts.length) { ctx.clearRect(0, 0, innerWidth, innerHeight); return; }
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.font = '700 14px "JetBrains Mono", monospace';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.98; p.life -= 0.022;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c; ctx.shadowBlur = 8;
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  });
}
export function burst(x, y, n = 30, colors) {
  colors ||= [css('--lime') || '#c6ff3d', '#ff2e7e', '#3df2ff'];
  const chars = '01#*+x█▓░<>$';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * (n > 30 ? 9 : 5);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, ch: chars[(Math.random() * chars.length) | 0], c: colors[(Math.random() * colors.length) | 0] });
  }
}

// ---------------- matrix rain (background) ----------------
export function initRain() {
  const c = document.getElementById('rain');
  const ctx = c.getContext('2d');
  const FS = 16;
  let cols = [], w, h;
  const size = () => { w = c.width = innerWidth; h = c.height = innerHeight; cols = Array.from({ length: Math.ceil(w / FS) }, () => Math.random() * -h / FS); };
  size(); addEventListener('resize', size);
  const chars = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFКАССАНБРК$₸';
  let last = 0;
  gsap.ticker.add((t) => {
    if (reduced || t - last < 0.06) return;
    last = t;
    ctx.fillStyle = 'rgba(6,7,8,0.12)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${FS}px "JetBrains Mono", monospace`;
    const lime = css('--lime') || '#c6ff3d';
    for (let i = 0; i < cols.length; i++) {
      if (Math.random() > 0.55) continue; // sparse
      const y = cols[i] * FS;
      ctx.fillStyle = Math.random() < 0.04 ? '#ff2e7e' : lime;
      ctx.globalAlpha = 0.18;
      ctx.fillText(chars[(Math.random() * chars.length) | 0], i * FS, y);
      cols[i] = y > h && Math.random() > 0.97 ? 0 : cols[i] + 1;
    }
    ctx.globalAlpha = 1;
  });
}

// ---------------- radar eye ----------------
export function initRadar() {
  const wrap = document.getElementById('radarWrap');
  const c = document.getElementById('radar');
  const ctx = c.getContext('2d');
  const tsEl = document.getElementById('radarTs');
  const xyEl = document.getElementById('radarXY');
  const objEl = document.getElementById('radarObj');
  let S = 0;
  const size = () => { const r = wrap.getBoundingClientRect(); S = r.width; c.width = S * devicePixelRatio; c.height = S * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  size(); addEventListener('resize', size);
  const blips = [];
  const LABELS = ['cashier', 'client', 'cash', 'tray', 'safe', 'hand', 'collector'];
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(c);
  const look = { x: 0, y: 0 };
  let alarm = 0;
  const state = { alarm: (v) => gsap.to({ v: alarm }, { v, duration: 0.3, onUpdate() { alarm = this.targets()[0].v; } }) };

  gsap.ticker.add((t) => {
    if (!visible || !S) return;
    const lime = css('--lime') || '#c6ff3d';
    const cx = S / 2, cy = S / 2, R = S * 0.46;
    ctx.clearRect(0, 0, S, S);
    // mouse look
    const r = c.getBoundingClientRect();
    const dx = mouse.x - (r.left + cx), dy = mouse.y - (r.top + cy);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 400);
    look.x += ((dx / d) * k * R * 0.22 - look.x) * 0.08;
    look.y += ((dy / d) * k * R * 0.22 - look.y) * 0.08;

    ctx.lineWidth = 1;
    // rings + crosshair
    ctx.strokeStyle = 'rgba(198,255,61,.14)';
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    // ticks
    ctx.strokeStyle = lime; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, l = i % 6 ? 6 : 14;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // outer glowing arc (like the boot screen)
    ctx.shadowColor = lime; ctx.shadowBlur = 16; ctx.strokeStyle = lime; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, t * 0.4, t * 0.4 + Math.PI * 1.3); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ff2e7e'; ctx.shadowColor = '#ff2e7e';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, -t * 0.7, -t * 0.7 + Math.PI * 0.35); ctx.stroke();
    ctx.shadowBlur = 0;
    // sweep
    const sa = t * 1.6;
    const g = ctx.createConicGradient ? ctx.createConicGradient(sa - Math.PI * 0.35, cx, cy) : null;
    if (g) {
      g.addColorStop(0, 'rgba(198,255,61,0)'); g.addColorStop(0.0972, alarm > 0.5 ? 'rgba(255,46,126,.35)' : 'rgba(198,255,61,.28)'); g.addColorStop(0.0973, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = lime; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); ctx.stroke();
    // spawn blips
    if (Math.random() < 0.035 && blips.length < 7) {
      const a = Math.random() * Math.PI * 2, rr = R * (0.3 + Math.random() * 0.6);
      blips.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, life: 1, bad: Math.random() < 0.18, label: LABELS[(Math.random() * LABELS.length) | 0], conf: (0.6 + Math.random() * 0.39).toFixed(2) });
    }
    ctx.font = '10px "JetBrains Mono", monospace';
    for (let i = blips.length - 1; i >= 0; i--) {
      const b = blips[i]; b.life -= 0.004;
      if (b.life <= 0) { blips.splice(i, 1); continue; }
      const col = b.bad ? '#ff2e7e' : '#3df2ff';
      ctx.globalAlpha = Math.min(1, b.life * 2);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
      const s = 14 + (1 - b.life) * 4;
      ctx.strokeRect(b.x - s / 2, b.y - s / 2, s, s);
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      ctx.shadowBlur = 0;
      ctx.fillText(`${b.bad ? '! ' : ''}${b.label} ${b.conf}`, b.x + s / 2 + 4, b.y - s / 2);
    }
    ctx.globalAlpha = 1;
    // the eye: cyan iris + raspberry pupil, follows mouse
    const ex = cx + look.x, ey = cy + look.y;
    ctx.strokeStyle = '#3df2ff'; ctx.shadowColor = '#3df2ff'; ctx.shadowBlur = 14; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ex, ey, R * 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2 + t * 0.2; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * R * 0.11, ey + Math.sin(a) * R * 0.11); ctx.lineTo(ex + Math.cos(a) * R * 0.19, ey + Math.sin(a) * R * 0.19); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const pr = R * (0.085 + Math.sin(t * 3) * 0.008 + alarm * 0.03);
    ctx.fillStyle = '#ff2e7e'; ctx.shadowColor = '#ff2e7e'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(ex, ey, pr, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - pr * 0.35, ey - pr * 0.35, pr * 0.22, 0, Math.PI * 2); ctx.fill();

    tsEl.textContent = `${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    xyEl.textContent = `x=${String(Math.round(mouse.x)).padStart(4, '0')} y=${String(Math.round(mouse.y)).padStart(4, '0')}`;
    objEl.textContent = `objects: ${blips.length} · alerts: ${blips.filter((b) => b.bad).length}`;
  });
  return state;
}
