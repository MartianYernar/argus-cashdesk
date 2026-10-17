import gsap from 'gsap';
import * as THREE from 'three';

export const fine = matchMedia('(pointer: fine)').matches;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = (e.clientX / innerWidth) * 2 - 1;
  mouse.ny = -((e.clientY / innerHeight) * 2 - 1);
});

// ---------------- cursor ----------------
export function initCursor() {
  if (!fine) return;
  document.body.classList.add('has-cursor');
  const el = document.getElementById('cursor');
  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = document.getElementById('cursorLabel');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => { rx(e.clientX); ry(e.clientY); gsap.set(dot, { x: e.clientX, y: e.clientY }); });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button, input, label, .frame, .mark');
    if (!t) { el.classList.remove('is-hover', 'is-text'); return; }
    if (t.matches('input[type=url], input[type=password], input[type=number]')) { el.classList.add('is-text'); el.classList.remove('is-hover'); return; }
    el.classList.remove('is-text');
    el.classList.add('is-hover');
    label.textContent = t.dataset.cursor || (t.classList.contains('frame') ? 'ZOOM' : t.classList.contains('mark') ? 'SEEK' : '');
  });
}

// ---------------- magnetic ----------------
export function initMagnetic(root = document) {
  if (!fine) return;
  root.querySelectorAll('[data-magnetic]').forEach((el) => {
    if (el._mag) return; el._mag = 1;
    const label = el.querySelector('.btn__label');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      gsap.to(el, { x: x * 0.35, y: y * 0.45, duration: 0.5, ease: 'power3' });
      if (label) gsap.to(label, { x: x * 0.15, y: y * 0.2, duration: 0.5, ease: 'power3' });
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .35)' });
      if (label) gsap.to(label, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .35)' });
    });
  });
}

// ---------------- 3D tilt + glare ----------------
export function initTilt(root = document) {
  if (!fine) return;
  root.querySelectorAll('[data-tilt]').forEach((el) => {
    if (el._tilt) return; el._tilt = 1;
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      gsap.to(el, { rotateY: (px - 0.5) * 14, rotateX: (0.5 - py) * 14, duration: 0.6, ease: 'power3' });
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 1.2, ease: 'elastic.out(1, .4)' }));
  });
}

// ---------------- text scramble ----------------
const GLYPHS = '!<>-_\\/[]{}—=+*^?#░▒▓█ABCDEFXYZ0123456789';
export function scramble(el, to = el.textContent, dur = 0.7) {
  const from = el.textContent;
  const len = Math.max(from.length, to.length);
  const q = Array.from({ length: len }, (_, i) => ({ to: to[i] || '', start: Math.random() * 0.4, end: 0.4 + Math.random() * 0.6 }));
  const o = { p: 0 };
  gsap.killTweensOf(el._scr);
  el._scr = o;
  gsap.to(o, {
    p: 1, duration: dur, ease: 'none',
    onUpdate() {
      el.textContent = q.map((c, i) => (o.p >= c.end ? c.to : o.p >= c.start ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : from[i] || '')).join('');
    },
    onComplete() { el.textContent = to; },
  });
}
export function initScramble(root = document) {
  root.querySelectorAll('[data-scramble]').forEach((el) => {
    if (el._sb) return; el._sb = 1;
    el.addEventListener('pointerenter', () => scramble(el, el.textContent, 0.5));
  });
}

// ---------------- split chars ----------------
export function split(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((w) =>
    `<span class="wd" aria-hidden="true">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`
  ).join(' ');
  return el.querySelectorAll('.ch');
}

// ---------------- sparks (click burst) ----------------
const parts = [];
let sctx;
export function initSparks() {
  const c = document.getElementById('sparks');
  sctx = c.getContext('2d');
  const size = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; sctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  size(); addEventListener('resize', size);
  addEventListener('pointerdown', (e) => { if (!reduced) burst(e.clientX, e.clientY, 14); });
  gsap.ticker.add(() => {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.98; p.life -= 0.02;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      sctx.globalAlpha = p.life;
      sctx.fillStyle = p.c;
      sctx.fillRect(p.x, p.y, p.s, p.s);
    }
    sctx.globalAlpha = 1;
  });
}
export function burst(x, y, n = 40, colors = ['#c6ff3d', '#3df2ff', '#ff3b5c', '#ffffff']) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * (n > 30 ? 10 : 5);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, s: 2 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0] });
  }
}

// ---------------- hero WebGL shader ----------------
export function initHeroGL() {
  const canvas = document.getElementById('heroGL');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true }); } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2() },
    uMouse: { value: new THREE.Vector2() },
    uAlarm: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uAlarm;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= .5; } return v; }
      void main(){
        vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y;
        vec2 m = uMouse * vec2(uRes.x/uRes.y, 1.) * .5;
        float t = uTime * .12;
        // domain-warped flow
        vec2 q = vec2(fbm(uv*1.6 + t), fbm(uv*1.6 - t + 4.));
        float f = fbm(uv*2.2 + q*1.8 + m*.6);
        vec3 col = mix(vec3(.02,.02,.04), vec3(.05,.08,.03), f);
        col += vec3(.78,1.,.24) * pow(f, 4.) * .9;
        col += vec3(.24,.95,1.) * pow(q.x, 6.) * .35;
        // iris following the mouse
        vec2 eye = vec2(.55, 0.) + m*.18;
        float d = length(uv - eye);
        float ang = atan(uv.y - eye.y, uv.x - eye.x);
        float ring = smoothstep(.36,.35,d) * smoothstep(.12,.14,d);
        float fibers = .5 + .5*sin(ang*48. + fbm(vec2(ang*3., d*8.) + t*2.)*6.);
        col += ring * mix(vec3(.24,.95,1.), vec3(.78,1.,.24), fibers) * .22 * (1. - d*1.8);
        col += smoothstep(.13,.1,d) * vec3(1.,.23,.36) * .5;
        col += smoothstep(.006,.0,abs(d-.36)) * vec3(.78,1.,.24) * .6;
        // radar sweep
        float sweep = fract((ang/6.2831) - uTime*.15);
        col += smoothstep(.9,1.,sweep) * smoothstep(.75,.0,d) * vec3(.78,1.,.24) * .18;
        // grid
        vec2 g = abs(fract(uv*8.) - .5);
        col += smoothstep(.49,.5,max(g.x,g.y)) * .035;
        // alarm tint
        col = mix(col, col*vec3(1.6,.4,.5) + vec3(.15,0.,.02), uAlarm);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    uniforms.uRes.value.set(r.width * renderer.getPixelRatio(), r.height * renderer.getPixelRatio());
  };
  resize(); addEventListener('resize', resize);
  const sm = new THREE.Vector2();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  gsap.ticker.add((time) => {
    if (!visible) return;
    sm.lerp(new THREE.Vector2(mouse.nx, mouse.ny), 0.05);
    uniforms.uMouse.value.copy(sm);
    uniforms.uTime.value = time;
    renderer.render(scene, camera);
  });
  return uniforms;
}
