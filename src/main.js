import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initCursor, initMagnetic, initTilt, initScramble, initSparks, initHeroGL, split, scramble, burst, reduced, fine, mouse } from './effects.js';
import { initI18n, toggleLang, onLang, getLang, t, pick } from './i18n.js';
import { RULES, TYPES, ruleById, typeByName } from './data.js';
import { analyze, getSettings, saveSettings, isLive, ping } from './api.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; };

initI18n();
renderTypes();
renderRules();

// ---------------- smooth scroll ----------------
const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  $('#mobileMenu').classList.remove('is-open'); $('#burger').classList.remove('is-open');
  lenis.start();
  lenis.scrollTo(id === '#top' ? 0 : id, { offset: -40, duration: 1.6 });
}));

initCursor(); initMagnetic(); initTilt(); initScramble(); initSparks();
const gl = initHeroGL();

// ---------------- preloader ----------------
const BOOT = [
  '> argus boot sequence v1.0',
  '> mounting local weights ........ ok',
  '> cloud endpoints ............... BLOCKED',
  '> opencv / ffmpeg ............... ok',
  '> face recognition .............. DISABLED',
  '> rule base: НБРК · adilet ...... loaded',
  '> camera CAM-01 top view ........ online',
  '> all eyes open.',
];
function preload() {
  return new Promise((resolve) => {
    const log = $('#bootLog'); const cnt = $('#bootCount');
    const o = { v: 0 };
    let line = 0;
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(o, {
      v: 100, duration: reduced ? 0.2 : 2.4, ease: 'power2.inOut',
      onUpdate() {
        cnt.textContent = String(Math.round(o.v)).padStart(3, '0');
        const want = Math.floor((o.v / 100) * BOOT.length);
        while (line < want) { log.innerHTML += (BOOT[line].includes('BLOCKED') || BOOT[line].includes('DISABLED') ? `<span class="err">${BOOT[line]}</span>` : BOOT[line]) + '\n'; line++; }
      },
    })
      .to('.preloader__eye', { scaleY: 0.05, duration: 0.18, ease: 'power2.in', yoyo: true, repeat: 1 })
      .to('.preloader__curtain', { scaleY: 1, duration: 0.6, ease: 'expo.inOut', stagger: 0.04 }, '+=.05')
      .set(['.preloader__term', '.preloader__count', '.preloader__eye', '.preloader__grid'], { opacity: 0 })
      .set('.preloader', { background: 'transparent' })
      .to('.preloader__curtain--top', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '+=.1')
      .to('.preloader__curtain--bot', { yPercent: 100, duration: 0.9, ease: 'expo.inOut' }, '<')
      .set('.preloader', { display: 'none' });
    tl.add(() => { document.body.classList.remove('is-loading'); lenis.start(); heroIn(); }, '-=.9');
  });
}

// ---------------- hero intro ----------------
function splitAll() { $$('.split').forEach((el) => split(el)); }
splitAll();
function heroIn() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__title .ch', { yPercent: 120, rotate: 12, opacity: 0, duration: 1.3, stagger: 0.025 })
    .from('.hero .reveal-up', { y: 60, opacity: 0, duration: 1.2, stagger: 0.12 }, '-=1')
    .from('.feed', { rotateY: -40, rotateX: 20, z: -300, opacity: 0, duration: 1.6, ease: 'power4.out' }, '-=1.2')
    .from('.hero__hud, .hero__corners i', { opacity: 0, scale: 1.6, duration: 0.6, stagger: 0.05 }, '-=1.2')
    .from('.nav > *', { y: -40, opacity: 0, duration: 0.8, stagger: 0.08 }, '-=1');
  // flicker the outline line forever
  gsap.to('.line--outline .ch', { opacity: 0.25, duration: 0.05, repeat: -1, repeatDelay: 3.5, yoyo: true, stagger: { each: 0.02, from: 'random' }, delay: 2 });
}

// hero HUD clock + coords + fps
{
  const clock = $('#hudClock'), coords = $('#hudCoords'), fpsEl = $('#hudFps'), feedTs = $('#feedTs');
  const t0 = performance.now(); let frames = 0, last = t0;
  gsap.ticker.add(() => {
    const ms = performance.now() - t0;
    const s = ms / 1000;
    clock.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}:${String(Math.floor((ms % 1000) / 40)).padStart(2, '0')}`;
    feedTs.textContent = fmt(s % 60);
    coords.textContent = `X ${String(Math.round(mouse.x)).padStart(4, '0')} · Y ${String(Math.round(mouse.y)).padStart(4, '0')}`;
    frames++;
    if (performance.now() - last > 500) { fpsEl.textContent = `FPS ${Math.round((frames * 1000) / (performance.now() - last))}`; frames = 0; last = performance.now(); }
  });
  // logo pupil follows the mouse
  const pupil = $('.logo-eye i');
  addEventListener('pointermove', () => gsap.to(pupil, { x: mouse.nx * 7, y: -mouse.ny * 3, duration: 0.3 }));
  // random glitch on logo
  setInterval(() => { const g = $('.nav__logo .glitch'); g.classList.add('is-glitching'); setTimeout(() => g.classList.remove('is-glitching'), 280); }, 4200);
}

// ---------------- scroll stuff ----------------
gsap.to('#scrollProgress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
{
  const nav = $('#nav'); let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    nav.classList.toggle('is-scrolled', scroll > 40);
    nav.classList.toggle('is-hidden', scroll > lastY && scroll > 400 && !$('#mobileMenu').classList.contains('is-open'));
    lastY = scroll;
  });
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    ScrollTrigger.create({ trigger: sec, start: 'top center', end: 'bottom center', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
}
// hero parallax out
ScrollTrigger.matchMedia({
  '(min-width: 1101px)': () => {
    gsap.to('.hero__content', { yPercent: 30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.feed', { yPercent: -20, rotateX: 25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  },
});

// velocity-reactive marquees
function marquee(sel, dir) {
  const track = $(sel);
  const tween = gsap.to(track, { xPercent: -50 * dir, duration: 22, ease: 'none', repeat: -1 });
  if (dir < 0) gsap.set(track, { xPercent: -50 });
  ScrollTrigger.create({ onUpdate: (s) => { const v = s.getVelocity() / 300; gsap.to(tween, { timeScale: 1 + Math.abs(v) * (s.direction), duration: 0.3, overwrite: true }); } });
  return tween;
}
marquee('#marquee1', 1); marquee('#marquee2', -1);

// section titles: chars fly in
$$('.section-title .split').forEach((el) => {
  gsap.from(el.querySelectorAll('.ch'), {
    yPercent: 110, opacity: 0, rotateX: -90, transformOrigin: '50% 100% -20px', duration: 1, ease: 'expo.out', stagger: 0.02,
    scrollTrigger: { trigger: el, start: 'top 85%' },
  });
});
$$('.section-head .muted, .section-head .eyebrow').forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));

// stats: count up + ring
$$('.stat').forEach((st, i) => {
  const num = st.querySelector('[data-count]');
  const target = +num.dataset.count;
  const o = { v: 0 };
  gsap.from(st, { y: 100, opacity: 0, rotate: i % 2 ? 4 : -4, duration: 1.2, ease: 'expo.out', delay: i * 0.08, scrollTrigger: { trigger: '.stats', start: 'top 80%' } });
  ScrollTrigger.create({
    trigger: st, start: 'top 85%', once: true,
    onEnter: () => {
      gsap.to(o, { v: target, duration: 2, ease: 'expo.out', onUpdate: () => (num.textContent = Math.round(o.v)) });
      gsap.to(st.querySelector('.stat__ring circle'), { strokeDashoffset: 0, duration: 2.2, ease: 'expo.out' });
    },
  });
});

// how: pinned horizontal scroll (desktop only)
ScrollTrigger.matchMedia({
  '(min-width: 861px)': () => {
    const track = $('#howTrack');
    const dist = () => track.scrollWidth - (innerWidth - track.getBoundingClientRect().left) + 40;
    const tw = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.how', start: 'top top', end: () => `+=${dist()}`, pin: '.how__pin', scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.to('#howBar', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.how', start: 'top top', end: () => `+=${dist()}`, scrub: true } });
    $$('.step').forEach((s) => gsap.from(s, { opacity: 0.2, scale: 0.85, rotateY: -25, ease: 'none', scrollTrigger: { trigger: s, containerAnimation: tw, start: 'left 100%', end: 'left 60%', scrub: true } }));
  },
  '(max-width: 860px)': () => {
    $$('.step').forEach((s) => gsap.from(s, { y: 80, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 88%' } }));
  },
});

// console entrance
gsap.from('.console', { y: 120, scale: 0.92, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.console', start: 'top 90%' } });

// types / rules / arch / api entrances
function revealCards() {
  gsap.from('.tcard', { y: 120, rotateX: -30, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: { each: 0.08, grid: 'auto', from: 'start' }, scrollTrigger: { trigger: '.types__grid', start: 'top 85%' } });
  gsap.from('.rule', { x: -80, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.rules__list', start: 'top 85%' } });
}
revealCards();
gsap.from('.chain > *', { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.12, scrollTrigger: { trigger: '.chain', start: 'top 85%' } });
gsap.from('.arch .node', { scale: 0.4, opacity: 0, transformOrigin: 'center', duration: 0.9, ease: 'back.out(1.8)', stagger: 0.1, scrollTrigger: { trigger: '.arch__svg', start: 'top 80%' } });
gsap.from('.arch .wire', { opacity: 0, duration: 0.6, stagger: 0.1, delay: 0.5, scrollTrigger: { trigger: '.arch__svg', start: 'top 80%' } });
gsap.from('.cloud-x', { scale: 0, rotate: -180, transformOrigin: 'center', duration: 1, ease: 'back.out(2)', delay: 1, scrollTrigger: { trigger: '.arch__svg', start: 'top 80%' } });
gsap.from('.arch__pills .tag', { y: 40, opacity: 0, rotate: () => gsap.utils.random(-20, 20), duration: 0.8, ease: 'back.out(2)', stagger: 0.05, scrollTrigger: { trigger: '.arch__pills', start: 'top 90%' } });
gsap.from('.ep, .code', { y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.api__grid', start: 'top 85%' } });
gsap.from('.footer__word', { yPercent: 60, scaleY: 1.6, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 80%' } });

// footer spotlight fill
{
  const big = $('#footerBig'), word = $('.footer__word');
  const r = { v: 0 };
  big.addEventListener('pointermove', (e) => {
    const b = word.getBoundingClientRect();
    word.style.setProperty('--fx', `${e.clientX - b.left}px`);
    word.style.setProperty('--fy', `${e.clientY - b.top}px`);
  });
  big.addEventListener('pointerenter', () => gsap.to(r, { v: 220, duration: 0.6, ease: 'expo.out', onUpdate: () => word.style.setProperty('--r', `${r.v}px`) }));
  big.addEventListener('pointerleave', () => gsap.to(r, { v: 0, duration: 0.6, ease: 'expo.out', onUpdate: () => word.style.setProperty('--r', `${r.v}px`) }));
}

// mobile menu
$('#burger').addEventListener('click', () => { $('#burger').classList.toggle('is-open'); $('#mobileMenu').classList.toggle('is-open'); });

// ---------------- language ----------------
$('#langToggle').addEventListener('click', toggleLang);
onLang((lang) => {
  $('.lang-on').textContent = lang.toUpperCase();
  $('.lang-off').textContent = lang === 'ru' ? 'EN' : 'RU';
  $$('.split').forEach((el) => { split(el); gsap.from(el.querySelectorAll('.ch'), { yPercent: 100, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.012 }); });
  renderTypes(); renderRules();
  initTilt(); initScramble();
  if (lastResult) renderResult(lastResult, false);
  renderCode(currentLang, false);
  ScrollTrigger.refresh();
});

// ---------------- types / rules render ----------------
function renderTypes() {
  $('#typesGrid').innerHTML = TYPES.map((ty) => `
    <article class="tcard" data-tilt>
      <div class="tcard__glare"></div>
      <span class="tcard__code">${ty.code}</span>
      <div class="tcard__ico">${ty.icon}</div>
      <h3>${esc(pick(ty.name))}</h3>
      <p>${esc(pick(ty.desc))}</p>
      <div class="tcard__foot">${ty.cues.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    </article>`).join('');
}
function renderRules() {
  $('#rulesList').innerHTML = RULES.map((r, i) => `
    <a class="rule" href="${esc(r.url)}" target="_blank" rel="noopener" data-cursor="OPEN">
      <span class="rule__n">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <div class="rule__title">${esc(pick(r.title))}${r.clauseVerified ? '' : '<span class="badge-draft">DRAFT</span>'}</div>
        <div class="rule__meta">${esc(pick(r.meta))} · ${esc(pick(r.clause))}</div>
      </div>
      <span class="rule__go">↗</span>
    </a>`).join('');
}

// ---------------- settings drawer ----------------
const drawer = $('#drawer');
function refreshMode() {
  const live = isLive();
  $('#modePill').classList.toggle('is-live', live);
  $('#modeLabel').textContent = live ? 'LIVE' : 'DEMO';
  const cm = $('#consoleMode');
  cm.textContent = live ? 'LIVE · ' + getSettings().url.replace(/^https?:\/\//, '') : 'DEMO MODE';
  cm.classList.toggle('is-live', live);
}
refreshMode();
$('#modePill').addEventListener('click', () => {
  const s = getSettings();
  $('#apiUrl').value = s.url; $('#apiKey').value = s.key; $('#apiPoll').value = s.poll;
  $('#settingsStatus').textContent = '';
  drawer.classList.add('is-open');
  gsap.from('.drawer__panel > *', { x: 60, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.15 });
});
$$('[data-close]', drawer).forEach((b) => b.addEventListener('click', () => drawer.classList.remove('is-open')));
$('#saveSettings').addEventListener('click', () => {
  saveSettings({ url: $('#apiUrl').value.trim(), key: $('#apiKey').value.trim(), poll: $('#apiPoll').value });
  refreshMode(); toast(t('saved')); drawer.classList.remove('is-open');
  const r = $('#modePill').getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40);
});
$('#testSettings').addEventListener('click', async () => {
  saveSettings({ url: $('#apiUrl').value.trim(), key: $('#apiKey').value.trim(), poll: $('#apiPoll').value });
  refreshMode();
  const st = $('#settingsStatus'); st.className = 'mono drawer__status'; st.textContent = '…';
  const ok = await ping();
  st.textContent = ok ? t('testOk') : t('testBad'); st.classList.add(ok ? 'ok' : 'bad');
});

// ---------------- toast / lightbox ----------------
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2200); }
const lb = $('#lightbox');
lb.addEventListener('click', () => lb.classList.remove('is-open'));
addEventListener('keydown', (e) => { if (e.key === 'Escape') { lb.classList.remove('is-open'); drawer.classList.remove('is-open'); } });

// =========================================================
//  ANALYZER
// =========================================================
const consoleEl = $('#console');
const drop = $('#drop');
const input = $('#fileInput');
let currentFile = null, fileURL = null, abortCtl = null, lastResult = null;

function setStage(name) {
  const cur = $('.stage.is-active');
  const next = $(`.stage[data-stage="${name}"]`);
  if (cur === next) return;
  gsap.to(cur, {
    opacity: 0, y: -30, filter: 'blur(10px)', duration: 0.35, ease: 'power2.in',
    onComplete() {
      cur.classList.remove('is-active'); gsap.set(cur, { clearProps: 'all' });
      next.classList.add('is-active');
      gsap.fromTo(next, { opacity: 0, y: 40, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', clearProps: 'filter,transform' });
      ScrollTrigger.refresh();
    },
  });
}

drop.addEventListener('pointermove', (e) => { const r = drop.getBoundingClientRect(); drop.style.setProperty('--mx', `${e.clientX - r.left}px`); drop.style.setProperty('--my', `${e.clientY - r.top}px`); });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) start(f, e.clientX, e.clientY); });
input.addEventListener('change', () => { const f = input.files[0]; if (f) { const r = drop.getBoundingClientRect(); start(f, r.left + r.width / 2, r.top + r.height / 2); } input.value = ''; });
// whole-page drop catches files dropped anywhere
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); if (!e.target.closest('#drop') && $('.stage--idle.is-active')) { const f = e.dataTransfer.files[0]; if (f) { lenis.scrollTo('#analyze', { offset: -40 }); start(f, e.clientX, e.clientY); } } });

function log(msg, cls = '') {
  const el = $('#log');
  const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  el.insertAdjacentHTML('beforeend', `<span class="${cls}">[${time}] ${esc(msg)}</span>\n`);
  el.scrollTop = el.scrollHeight;
}
const RING = 553;
function setProgress(p) {
  p = Math.max(0, Math.min(100, p));
  $('#procPct').textContent = Math.round(p);
  $('#ringFg').style.strokeDashoffset = RING - (RING * p) / 100;
}
const PHASES = ['upload', 'queue', 'frames', 'detect', 'rules'];
function setPhase(ph) {
  const idx = PHASES.indexOf(ph);
  $$('#phases li').forEach((li, i) => { li.classList.toggle('is-done', i < idx); li.classList.toggle('is-active', i === idx); });
  $('#procStatus').textContent = ph.toUpperCase();
  scramble($('#procStatus'), ph.toUpperCase(), 0.4);
}

let boxTimer;
function fakeBoxes(on) {
  clearInterval(boxTimer);
  const wrap = $('#procBoxes'); wrap.innerHTML = '';
  if (!on) return;
  const labels = ['person', 'hand', 'cash', 'tray', 'drawer', 'person'];
  boxTimer = setInterval(() => {
    if (wrap.children.length > 4) wrap.firstElementChild.remove();
    const b = document.createElement('div');
    const alert = Math.random() < 0.15;
    b.className = 'bbox' + (alert ? ' bbox--alert' : '');
    const w = 12 + Math.random() * 22, h = 12 + Math.random() * 26;
    Object.assign(b.style, { left: `${Math.random() * (100 - w)}%`, top: `${8 + Math.random() * (80 - h)}%`, width: `${w}%`, height: `${h}%` });
    b.innerHTML = `<span>${labels[(Math.random() * labels.length) | 0]} · ${(0.6 + Math.random() * 0.39).toFixed(2)}</span>`;
    wrap.appendChild(b);
  }, 650);
}

async function start(file, x, y) {
  if (!/video|quicktime/.test(file.type) && !/\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(file.name)) { toast(t('badFile')); consoleEl.classList.add('shake'); setTimeout(() => consoleEl.classList.remove('shake'), 600); return; }
  burst(x, y, 60);
  currentFile = file;
  if (fileURL) URL.revokeObjectURL(fileURL);
  fileURL = URL.createObjectURL(file);
  $('#procVideo').src = fileURL; $('#procVideo').play().catch(() => {});
  $('#procFile').textContent = file.name; $('#procSize').textContent = `${(file.size / 1e6).toFixed(1)} MB`;
  $('#consoleTitle').textContent = `argus://analyze/${file.name}`;
  $('#log').innerHTML = ''; $('#filmstrip').innerHTML = '';
  setProgress(0); setPhase('upload');
  consoleEl.classList.remove('is-alarm', 'is-ok');
  setStage('proc'); fakeBoxes(true);
  const t0 = performance.now();
  abortCtl = new AbortController();
  try {
    const res = await analyze(file, {
      signal: abortCtl.signal,
      onPhase: setPhase,
      onProgress: setProgress,
      onLog: log,
      onFrame: (c) => { const strip = $('#filmstrip'); strip.appendChild(c); if (strip.children.length > 14) strip.firstElementChild.remove(); },
    });
    res._elapsed = (performance.now() - t0) / 1000;
    fakeBoxes(false);
    lastResult = res;
    setStage('result');
    setTimeout(() => renderResult(res, true), 400);
  } catch (err) {
    fakeBoxes(false);
    if (err.name === 'AbortError') { setStage('idle'); return; }
    console.error(err);
    $('#errMsg').textContent = err.message || String(err);
    setStage('error');
  }
}
$('#cancelBtn').addEventListener('click', () => abortCtl?.abort());
$('#retryBtn').addEventListener('click', () => (currentFile ? start(currentFile, innerWidth / 2, innerHeight / 2) : setStage('idle')));
$('#againBtn').addEventListener('click', () => { lastResult = null; consoleEl.classList.remove('is-alarm', 'is-ok'); gl && (gl.uAlarm.value = 0); setStage('idle'); });

function normalizeViolation(v) {
  const ty = typeByName(v.type);
  const rule = v.rule || (v.rule_id && ruleById(v.rule_id)) || (ty && ruleById(ty.rule)) || null;
  return { ...v, _ty: ty, _rule: rule };
}
function ruleHTML(r) {
  if (!r) return `<span class="mono">${t('rule')}</span>${t('noRule')}`;
  // either our RULES entry or a backend object { document, clause, url }
  const title = r.document || pick(r.title);
  const clause = r.clause && typeof r.clause === 'object' ? pick(r.clause) : r.clause;
  const meta = r.meta ? pick(r.meta) : '';
  return `<span class="mono">${t('rule')}</span>${esc(title)}${meta ? ` — ${esc(meta)}` : ''}${clause ? `, ${esc(clause)}` : ''}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">adilet ↗</a>` : ''}`;
}

function renderResult(res, animate) {
  const bad = res.verdict === 'violation';
  const vs = (res.violations || []).map(normalizeViolation);
  const vEl = $('#verdict');
  vEl.classList.toggle('is-bad', bad); vEl.classList.toggle('is-good', !bad);
  $('#verdictIcon').textContent = bad ? '!' : '✓';
  $('#verdictKicker').textContent = `VERDICT · ${res.verdict}${res.demo ? ' · ' + t('demoTag') : ''}`;
  $('#verdictTitle').textContent = bad ? t('verdictBad') : t('verdictGood');
  $('#verdictSub').textContent = bad ? t('subBad', vs.length) : t('subGood');
  $('#jobId').textContent = res.job_id || '—';
  $('#jobTime').textContent = res._elapsed ? `${res._elapsed.toFixed(1)}s` : '—';
  $('#jobCount').textContent = vs.length;
  consoleEl.classList.toggle('is-alarm', bad); consoleEl.classList.toggle('is-ok', !bad);

  // player + timeline
  const video = $('#resVideo');
  if (video.src !== fileURL) video.src = fileURL || '';
  const marks = $('#tlMarks');
  const drawMarks = () => {
    const d = video.duration || Math.max(...vs.map((v) => v.timecode_sec), 1) * 1.2;
    $('#tlEnd').textContent = fmt(d).slice(0, 5);
    marks.innerHTML = vs.map((v, i) => `<div class="mark" style="left:${(v.timecode_sec / d) * 100}%; animation-delay:${0.3 + i * 0.15}s" data-t="${v.timecode_sec}" title="${esc(v.type)} @ ${v.timecode_sec}s"><b>${i + 1}</b></div>`).join('');
    $$('.mark', marks).forEach((m) => m.addEventListener('click', () => seek(+m.dataset.t)));
  };
  video.onloadedmetadata = drawMarks; drawMarks();
  video.ontimeupdate = () => { $('#tlPlayed').style.width = `${(video.currentTime / (video.duration || 1)) * 100}%`; };
  $('.timeline__track').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); video.currentTime = ((e.clientX - r.left) / r.width) * (video.duration || 0); };

  // cards
  const list = $('#violations');
  if (!vs.length) {
    list.innerHTML = `<div class="clean"><b>${t('cleanTitle')}</b>${t('cleanText')}</div>`;
  } else {
    list.innerHTML = vs.map((v, i) => {
      const frames = (v.evidence_frames || []).slice(0, 3);
      return `
      <article class="vcard">
        <span class="vcard__num">${String(i + 1).padStart(2, '0')}</span>
        <div class="vcard__frames n${frames.length || 1}">
          ${frames.map((f) => `<div class="frame" data-src="data:image/jpeg;base64,${f.image_base64}" data-cap="${esc(v.type)} · ${fmt(f.timestamp_sec)}"><img loading="lazy" src="data:image/jpeg;base64,${f.image_base64}" alt="evidence ${f.timestamp_sec}s"/><span>${fmt(f.timestamp_sec)}</span></div>`).join('')}
        </div>
        <div>
          <h4 class="vcard__type">${esc(v._ty ? pick(v._ty.name) : v.type)}</h4>
          <button class="vcard__tc" data-t="${v.timecode_sec}" data-cursor="SEEK">▶ ${fmt(v.timecode_sec)} · ${v.timecode_sec}s</button>
          <p class="vcard__desc">${esc(v.description)}</p>
          <div class="vcard__rule">${ruleHTML(v._rule)}</div>
          ${typeof v.confidence === 'number' ? `<div class="vcard__conf">${t('confidence')} <i style="--w:0%"></i> ${(v.confidence * 100).toFixed(0)}%</div>` : ''}
        </div>
      </article>`;
    }).join('');
    $$('.vcard__tc', list).forEach((b) => b.addEventListener('click', () => seek(+b.dataset.t)));
    $$('.frame', list).forEach((f) => f.addEventListener('click', () => { $('#lightboxImg').src = f.dataset.src; $('#lightboxCap').textContent = f.dataset.cap; lb.classList.add('is-open'); }));
    requestAnimationFrame(() => $$('.vcard__conf i', list).forEach((el, i) => el.style.setProperty('--w', `${vs[i].confidence * 100}%`)));
  }
  initTilt(list); initMagnetic(consoleEl);

  if (!animate) return;
  // ---- the overshoot moment ----
  const r = vEl.getBoundingClientRect();
  gsap.from(vEl, { scale: 0.6, opacity: 0, duration: 1, ease: 'elastic.out(1, .5)' });
  gsap.from('#verdictIcon', { scale: 0, rotate: -270, duration: 1.2, ease: 'back.out(2.5)', delay: 0.15 });
  scramble($('#verdictTitle'), $('#verdictTitle').textContent, 1.1);
  gsap.from('.player', { y: 60, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.3 });
  gsap.from('.vcard, .clean', { y: 80, opacity: 0, rotateX: -20, duration: 1, ease: 'expo.out', stagger: 0.15, delay: 0.5 });
  gsap.from('.result__actions > *', { y: 30, opacity: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.08, delay: 0.8 });
  lenis.scrollTo('#console', { offset: -80, duration: 1.2 });
  if (bad) {
    consoleEl.classList.add('shake'); setTimeout(() => consoleEl.classList.remove('shake'), 650);
    burst(r.left + 60, r.top + r.height / 2, 90, ['#ff3b5c', '#ff8a9e', '#ffffff']);
    gsap.fromTo('#playerFlash', { opacity: 0.6 }, { opacity: 0, duration: 0.8, repeat: 2 });
    if (gl) gsap.to(gl.uAlarm, { value: 1, duration: 0.4, yoyo: true, repeat: 5 });
  } else {
    for (let i = 0; i < 4; i++) setTimeout(() => burst(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 50, ['#c6ff3d', '#3df2ff', '#ffffff']), i * 160);
  }
}
function seek(tSec) {
  const v = $('#resVideo');
  v.currentTime = tSec; v.pause();
  lenis.scrollTo('.player', { offset: -100, duration: 1 });
  gsap.fromTo('#playerFlash', { opacity: 0.5 }, { opacity: 0, duration: 0.6 });
}
function resultJSON() {
  if (!lastResult) return '{}';
  const { _elapsed, demo, ...clean } = lastResult;
  return JSON.stringify(clean, null, 2);
}
$('#jsonBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([resultJSON()], { type: 'application/json' }));
  a.download = `argus_${lastResult?.job_id || 'result'}.json`; a.click();
});
$('#copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(resultJSON()); toast(t('copied')); } catch { toast('clipboard ✕'); } });

// =========================================================
//  API code typing
// =========================================================
const CODE = {
  curl: () => `<span class="c"># 1. upload</span>
<span class="k">curl</span> -X POST <span class="s">${apiBase()}/api/v1/analyze</span> \\
     -H <span class="s">"X-API-Key: &lt;key&gt;"</span> \\
     -F <span class="s">"file=@video_017.mov"</span>
<span class="c"># → {"job_id": "3f2a9c1e"}</span>

<span class="c"># 2. poll</span>
<span class="k">curl</span> <span class="s">${apiBase()}/api/v1/jobs/3f2a9c1e</span> \\
     -H <span class="s">"X-API-Key: &lt;key&gt;"</span>`,
  py: () => `<span class="k">import</span> requests, time

H = {<span class="s">"X-API-Key"</span>: <span class="s">"&lt;key&gt;"</span>}
URL = <span class="s">"${apiBase()}"</span>

job = requests.post(f<span class="s">"{URL}/api/v1/analyze"</span>, headers=H,
      files={<span class="s">"file"</span>: open(<span class="s">"video_017.mov"</span>, <span class="s">"rb"</span>)}).json()

<span class="k">while</span> <span class="n">True</span>:
    r = requests.get(f<span class="s">"{URL}/api/v1/jobs/{job['job_id']}"</span>, headers=H).json()
    <span class="k">if</span> r[<span class="s">"status"</span>] != <span class="s">"processing"</span>: <span class="k">break</span>
    time.sleep(<span class="n">2</span>)
print(r[<span class="s">"verdict"</span>], len(r[<span class="s">"violations"</span>]))`,
  js: () => `<span class="k">const</span> fd = <span class="k">new</span> FormData();
fd.append(<span class="s">'file'</span>, file);
<span class="k">const</span> { job_id } = <span class="k">await</span> fetch(<span class="s">'${apiBase()}/api/v1/analyze'</span>, {
  method: <span class="s">'POST'</span>, headers: { <span class="s">'X-API-Key'</span>: KEY }, body: fd,
}).then(r =&gt; r.json());

<span class="k">let</span> res;
<span class="k">do</span> {
  <span class="k">await</span> <span class="k">new</span> Promise(r =&gt; setTimeout(r, <span class="n">1500</span>));
  res = <span class="k">await</span> fetch(<span class="s">\`${apiBase()}/api/v1/jobs/\${job_id}\`</span>,
    { headers: { <span class="s">'X-API-Key'</span>: KEY } }).then(r =&gt; r.json());
} <span class="k">while</span> (res.status === <span class="s">'processing'</span>);`,
  json: () => `{
  <span class="k">"job_id"</span>: <span class="s">"3f2a9c1e"</span>,
  <span class="k">"status"</span>: <span class="s">"done"</span>,
  <span class="k">"verdict"</span>: <span class="s">"violation"</span>,
  <span class="k">"violations"</span>: [
    {
      <span class="k">"type"</span>: <span class="s">"Ценности без присмотра"</span>,
      <span class="k">"timecode_sec"</span>: <span class="n">44.2</span>,
      <span class="k">"description"</span>: <span class="s">"Что видно на видео и почему это нарушение"</span>,
      <span class="k">"evidence_frames"</span>: [
        { <span class="k">"timestamp_sec"</span>: <span class="n">44.2</span>, <span class="k">"image_base64"</span>: <span class="s">"/9j/4AAQ..."</span> }
      ]
    }
  ]
}`,
};
const apiBase = () => getSettings().url || 'https://team.example.kz';
let currentLang = 'curl', typeTween;
function renderCode(lang, animate = true) {
  currentLang = lang;
  const body = $('#codeBody');
  const html = CODE[lang]();
  typeTween?.kill();
  if (!animate || reduced) { body.innerHTML = html; return; }
  // type out char-by-char while preserving tags
  const tokens = html.match(/<[^>]+>|&[a-z#0-9]+;|[\s\S]/g);
  const o = { i: 0 };
  typeTween = gsap.to(o, {
    i: tokens.length, duration: Math.min(2.2, tokens.length / 260), ease: 'none',
    onUpdate: () => { body.innerHTML = tokens.slice(0, Math.floor(o.i)).join('') + '<span class="caret"></span>'; },
    onComplete: () => { body.innerHTML = html + '<span class="caret"></span>'; },
  });
}
$$('#codeTabs button[data-lang]').forEach((b) => b.addEventListener('click', () => {
  $$('#codeTabs button').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active');
  renderCode(b.dataset.lang);
}));
$('#codeCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#codeBody').textContent); toast(t('copied').replace('JSON', 'Code')); } catch {} });
ScrollTrigger.create({ trigger: '.code', start: 'top 80%', once: true, onEnter: () => renderCode('curl') });
$('#codeBody').innerHTML = '';

// =========================================================
//  Easter egg: konami → matrix mode
// =========================================================
{
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0;
  addEventListener('keydown', (e) => {
    i = e.key === seq[i] ? i + 1 : 0;
    if (i === seq.length) { i = 0; document.body.classList.toggle('matrix'); toast('◉ MATRIX MODE'); burst(innerWidth / 2, innerHeight / 2, 200, ['#00ff66']); }
  });
}

// idle eye: console log for devs
console.log('%c ARGUS %c all eyes open ', 'background:#c6ff3d;color:#000;font-weight:900;padding:4px 8px', 'background:#07070b;color:#c6ff3d;padding:4px 8px');

preload().then(() => ScrollTrigger.refresh());
