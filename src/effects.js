export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- text scramble ----------------
const GLYPHS = '!<>-_\\/[]{}=+*^?#$%&01░▒▓█';
export function scramble(el, to = el.textContent, dur = 500) {
  if (reduced) { el.textContent = to; return; }
  const from = el.textContent;
  const q = Array.from({ length: Math.max(from.length, to.length) }, (_, i) => ({ to: to[i] || '', from: from[i] || '', s: Math.random() * 0.4, e: 0.4 + Math.random() * 0.6 }));
  const t0 = performance.now();
  cancelAnimationFrame(el._scr);
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = q.map((c) => (p >= c.e ? c.to : p >= c.s ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : c.from)).join('');
    if (p < 1) el._scr = requestAnimationFrame(tick);
  };
  el._scr = requestAnimationFrame(tick);
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
      else { setTimeout(() => el.classList.remove('is-typing'), 700); res(); }
    };
    tick();
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
export const bar = (v, max, w) => { const n = Math.max(0, Math.min(w, Math.round((v / max) * w))); return '█'.repeat(n) + '░'.repeat(w - n); };
