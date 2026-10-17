import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initCursor, initScramble, initSparks, initRain, initRadar, scramble, typeText, burst, reduced } from './effects.js';
import { initI18n, toggleLang, onLang, getLang, t, pick } from './i18n.js';
import { RULES, TYPES, ruleById, typeByName } from './data.js';
import { analyze, getSettings, saveSettings, isLive, ping } from './api.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bar = (v, max, w) => { const n = Math.round((v / max) * w); return '█'.repeat(n) + '░'.repeat(Math.max(0, w - n)); };

initI18n();
renderTypes();
renderRules();

// ---------------- smooth scroll ----------------
const lenis = new Lenis({ lerp: 0.1 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
const go = (id) => { lenis.start(); lenis.scrollTo(id === '#top' ? 0 : id, { offset: -20, duration: 1.2 }); };
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const id = a.getAttribute('href'); if (id.length < 2) return; e.preventDefault(); go(id); }));

initCursor(); initScramble(); initSparks(); initRain();
const radar = initRadar();

// ---------------- boot ----------------
const BOOT = [
  ['> argus boot sequence v1.0', ''],
  ['> mounting local weights ........ ok', ''],
  ['  > cloud endpoints ............... BLOCKED', 'bad'],
  ['> opencv / ffmpeg ............... ok', ''],
  ['  > face recognition .............. DISABLED', 'bad'],
  ['> rule base: НБРК · adilet ...... loaded', ''],
  ['> camera CAM-01 top view ........ online', ''],
  ['> forte theme ................... applied', 'bad'],
  ['> all eyes open.', ''],
];
function boot() {
  return new Promise((resolve) => {
    const log = $('#bootLog'), barEl = $('#bootBar'), pct = $('#bootPct');
    let i = 0, done = false;
    const W = Math.max(10, Math.min(40, Math.floor((innerWidth - 120) / 10)));
    const finish = () => {
      if (done) return; done = true;
      removeEventListener('keydown', finish); removeEventListener('pointerdown', finish);
      barEl.textContent = `[${'█'.repeat(W)}]`; pct.textContent = '100%';
      gsap.timeline({ onComplete: resolve })
        .to('#boot', { duration: 0.08, opacity: 0, repeat: 3, yoyo: true, ease: 'steps(1)' })
        .to('#boot', { scaleY: 0.004, duration: 0.25, ease: 'power4.in' })
        .to('#boot', { scaleX: 0, duration: 0.2, ease: 'power4.in' })
        .set('#boot', { display: 'none' });
    };
    addEventListener('keydown', finish); addEventListener('pointerdown', finish);
    const step = () => {
      if (done) return;
      if (i < BOOT.length) {
        const [txt, cls] = BOOT[i];
        log.insertAdjacentHTML('beforeend', `<span class="${cls}">${esc(txt)}</span>\n`);
        i++;
        const p = Math.round((i / BOOT.length) * 100);
        barEl.textContent = `[${bar(p, 100, W)}]`; pct.textContent = `${p}%`;
        setTimeout(step, reduced ? 0 : 120 + Math.random() * 180);
      } else setTimeout(finish, 350);
    };
    step();
  });
}

// ---------------- hero ----------------
async function heroIn() {
  const log = $('#heroLog');
  const lines = [
    ['Last login: ' + new Date().toUTCString().slice(0, 25) + ' on ttys001', 'dim'],
    ['> argus boot sequence v1.0', ''],
    ['> mounting local weights ........ ok', ''],
    ['  > cloud endpoints ............... BLOCKED', 'bad'],
    ['> opencv / ffmpeg ............... ok', ''],
    ['  > face recognition .............. DISABLED', 'bad'],
    ['> rule base: НБРК · adilet ...... loaded', ''],
  ];
  gsap.from('.win--hero', { scaleY: 0, transformOrigin: 'top', duration: 0.4, ease: 'steps(6)' });
  gsap.from('.radar', { opacity: 0, scale: 0.6, duration: 0.6, ease: 'steps(8)', delay: 0.2 });
  for (const [l, c] of lines) { log.insertAdjacentHTML('beforeend', `<span class="${c}">${esc(l)}</span>\n`); await sleep(reduced ? 0 : 70); }
  // ascii banner: reveal line by line with glitch
  const ascii = $('#ascii');
  gsap.from(ascii, { clipPath: 'inset(0 100% 0 0)', duration: 0.9, ease: 'steps(24)' });
  await sleep(500);
  await typeText($('.hero .typed'), $('.hero .typed').textContent);
  gsap.from('.hero__help > *, .hero__tag, .hero__cta > *', { opacity: 0, x: -20, duration: 0.3, stagger: 0.08, ease: 'steps(4)' });
}
// colour random banner cells raspberry, glitch periodically
{
  const ascii = $('#ascii');
  const raw = ascii.textContent;
  setInterval(() => {
    if (reduced) return;
    const chars = [...raw];
    const out = chars.map((ch) => (ch === '█' && Math.random() < 0.035 ? '<span class="fc">█</span>' : ch === '<' ? '&lt;' : ch)).join('');
    ascii.innerHTML = out;
    if (Math.random() < 0.3) { gsap.fromTo(ascii, { x: -4, skewX: 8 }, { x: 0, skewX: 0, duration: 0.15, ease: 'steps(3)' }); }
  }, 900);
}

// hero ticker: fake detections stream
{
  const tk = $('#ticker');
  const ev = ['person.enter zone=client', 'hand.move → tray', 'cash.detected count≈?', 'cashier.present', 'drawer.state=closed', 'collector.bag seen', 'tray.empty', 'safe.state=closed'];
  const rows = [];
  setInterval(() => {
    const bad = Math.random() < 0.12;
    const tm = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    rows.push(bad ? `<span class="hl">${tm}  ALERT  cash_unattended Δt=${(3 + Math.random() * 9).toFixed(1)}s</span>` : `${tm}  ok     ${ev[(Math.random() * ev.length) | 0]} conf=${(0.6 + Math.random() * 0.39).toFixed(2)}`);
    if (rows.length > 6) rows.shift();
    tk.innerHTML = rows.join('\n');
  }, 700);
}

// tmux clock + active tab
{
  const clock = $('#clock');
  setInterval(() => (clock.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false })), 1000);
  $$('.tmux__tabs a').forEach((a) => {
    ScrollTrigger.create({ trigger: a.getAttribute('href'), start: 'top 55%', end: 'bottom 55%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
}

// ---------------- scroll-triggered terminal output ----------------
function onView(el, fn, start = 'top 82%') { ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn }); }

$$('.sec .typed[data-type]').forEach((el) => {
  const txt = el.textContent; el.textContent = '';
  onView(el, () => typeText(el, txt, 22));
});
$$('.sec .win').forEach((w) => gsap.from(w, { scaleY: 0.02, opacity: 0, transformOrigin: 'top', duration: 0.45, ease: 'steps(7)', scrollTrigger: { trigger: w, start: 'top 88%' } }));
$$('.sec__title').forEach((h) => onView(h, () => { scramble(h, h.dataset.text, 0.9); h.classList.add('is-glitching'); setTimeout(() => h.classList.remove('is-glitching'), 500); }, 'top 90%'));
$$('.sec__num').forEach((n) => gsap.from(n, { opacity: 0, x: -30, duration: 0.4, ease: 'steps(5)', scrollTrigger: { trigger: n, start: 'top 90%' } }));

// random glitch on section titles
setInterval(() => { const hs = $$('.sec__title'); const h = hs[(Math.random() * hs.length) | 0]; h.classList.add('is-glitching'); setTimeout(() => h.classList.remove('is-glitching'), 250); }, 2600);

// stats: ascii bars fill + counters
onView('#statsOut', async () => {
  await sleep(900);
  $$('.stat').forEach((st, i) => {
    const b = st.querySelector('.bar');
    const v = +b.dataset.bar, max = +b.dataset.max;
    const W = () => Math.max(8, Math.floor(b.clientWidth / 8.6));
    const o = { v: 0 };
    gsap.to(o, { v, duration: 1.4, delay: i * 0.12, ease: 'power2.out', onUpdate() { b.textContent = bar(o.v, max, W()); st.querySelector('b').textContent = Math.round(o.v); } });
    if (!v) b.textContent = bar(0, max, W());
  });
});

// pipeline: steps light up in a loop + log
onView('#pipe', async () => {
  const nodes = $$('.pipe__node'), wires = $$('.pipe__wire'), log = $('#pipeLog');
  const msgs = [
    ['[upload]  POST /api/v1/analyze  file=X-17.mov  7.7MB', '→ job_id=3f2a9c1e  status=processing'],
    ['[frames]  ffmpeg -i X-17.mov -vf fps=5  →  612 frames', '→ timestamps aligned · 0.2s step'],
    ['[detect]  vision.model(local) batch=32  device=cuda:0', '→ events: cashier_absent@6.8s, cash_visible@7.0s'],
    ['[verdict] rules.match(НБРК № 231)  → violation @ 7.0s', '→ evidence_frames=3  · done in 41.2s'],
  ];
  await sleep(1000);
  let i = 0;
  const loop = async () => {
    nodes.forEach((n, k) => n.classList.toggle('is-on', k <= i));
    wires.forEach((w, k) => w.classList.toggle('is-on', k < i));
    const [a, b] = msgs[i];
    log.innerHTML = msgs.slice(0, i).map(([x, y]) => `<span class="ok">${esc(x)}</span>\n${esc(y)}`).join('\n') + (i ? '\n' : '');
    const span = document.createElement('span'); span.className = 'ok'; log.appendChild(span);
    await typeText(span, a, 8); log.append('\n' + b);
    i = (i + 1) % nodes.length;
    setTimeout(loop, i === 0 ? 2600 : 1300);
  };
  loop();
});

// classes + rules rows
function revealRows() {
  gsap.from('.trow:not(.trow--head)', { opacity: 0, x: -30, duration: 0.3, ease: 'steps(4)', stagger: 0.09, scrollTrigger: { trigger: '#typesGrid', start: 'top 80%' } });
  gsap.from('.rule', { opacity: 0, x: -30, duration: 0.3, ease: 'steps(4)', stagger: 0.12, scrollTrigger: { trigger: '#rulesList', start: 'top 85%' } });
}
revealRows();
gsap.from('#arch', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'steps(14)', scrollTrigger: { trigger: '#arch', start: 'top 80%' } });
gsap.from('.pkgs span', { opacity: 0, y: 10, duration: 0.2, ease: 'steps(2)', stagger: 0.06, scrollTrigger: { trigger: '.pkgs', start: 'top 92%' } });
gsap.from('.footer__ascii', { clipPath: 'inset(0 100% 0 0)', duration: 1, ease: 'steps(25)', scrollTrigger: { trigger: '.footer', start: 'top 85%' } });

// ---------------- language ----------------
$('#langToggle').addEventListener('click', toggleLang);
onLang((lang) => {
  $('.lang-on').textContent = lang.toUpperCase();
  $('.lang-off').textContent = lang === 'ru' ? 'EN' : 'RU';
  renderTypes(); renderRules();
  if (lastResult) renderResult(lastResult, false);
  renderCode(currentLang, false);
  ScrollTrigger.refresh();
});

// ---------------- render classes / rules ----------------
function renderTypes() {
  $('#typesGrid').innerHTML = `<div class="trow trow--head"><span>CODE</span><span>ICO</span><span>CLASS</span><span>DESCRIPTION · CUES</span></div>` + TYPES.map((ty) => `
    <div class="trow">
      <span class="trow__code">${ty.code}</span>
      <span>${ty.icon}</span>
      <span class="trow__name">${esc(pick(ty.name))}</span>
      <div class="trow__desc">${esc(pick(ty.desc))}<div class="trow__cues">${ty.cues.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>
    </div>`).join('');
}
function renderRules() {
  $('#rulesList').innerHTML = RULES.map((r, i) => `
    <a class="rule" href="${esc(r.url)}" target="_blank" rel="noopener" data-cursor="open">
      <div>
        <div class="rule__path">./adilet.zan.kz/${esc(r.url.split('/').pop())}:<b>${i + 1}</b>:</div>
        <div class="rule__title">${esc(pick(r.title))}${r.clauseVerified ? '' : '<span class="badge-draft">DRAFT</span>'}</div>
        <div class="rule__meta">${esc(pick(r.meta))} · ${esc(pick(r.clause))}</div>
      </div>
      <span class="rule__go">[open ↗]</span>
    </a>`).join('');
}

// ---------------- settings ----------------
const drawer = $('#drawer');
function refreshMode() {
  const live = isLive();
  $('#modePill').classList.toggle('is-live', live);
  $('#modeLabel').textContent = live ? 'LIVE' : 'DEMO';
  const cm = $('#consoleMode');
  cm.textContent = live ? 'LIVE · ' + getSettings().url.replace(/^https?:\/\//, '') : 'DEMO';
  cm.classList.toggle('is-live', live);
}
refreshMode();
function openSettings() {
  const s = getSettings();
  $('#apiUrl').value = s.url; $('#apiKey').value = s.key; $('#apiPoll').value = s.poll;
  $('#settingsStatus').textContent = '';
  drawer.classList.add('is-open');
  setTimeout(() => $('#apiUrl').focus(), 300);
}
$('#modePill').addEventListener('click', openSettings);
$$('[data-close]', drawer).forEach((b) => b.addEventListener('click', () => drawer.classList.remove('is-open')));
$('#saveSettings').addEventListener('click', () => {
  saveSettings({ url: $('#apiUrl').value.trim(), key: $('#apiKey').value.trim(), poll: $('#apiPoll').value });
  refreshMode(); toast(t('saved')); drawer.classList.remove('is-open');
  const r = $('#modePill').getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 40);
});
$('#testSettings').addEventListener('click', async () => {
  saveSettings({ url: $('#apiUrl').value.trim(), key: $('#apiKey').value.trim(), poll: $('#apiPoll').value });
  refreshMode();
  const st = $('#settingsStatus'); st.className = 'drawer__status'; st.textContent = '$ ping …';
  const ok = await ping();
  st.textContent = ok ? `$ ping → ${t('testOk')}` : `$ ping → ${t('testBad')}`; st.classList.add(ok ? 'ok' : 'bad');
});

// ---------------- toast / lightbox ----------------
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2000); }
const lb = $('#lightbox');
lb.addEventListener('click', () => lb.classList.remove('is-open'));

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
    opacity: 0, duration: 0.15, ease: 'steps(3)',
    onComplete() {
      cur.classList.remove('is-active'); gsap.set(cur, { clearProps: 'all' });
      next.classList.add('is-active');
      gsap.fromTo(next, { opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: 0.5, ease: 'steps(10)', clearProps: 'clipPath' });
      ScrollTrigger.refresh();
    },
  });
}

['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) start(f, e.clientX, e.clientY); });
input.addEventListener('change', () => { const f = input.files[0]; if (f) { const r = drop.getBoundingClientRect(); start(f, r.left + r.width / 2, r.top + r.height / 2); } input.value = ''; });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); if (!e.target.closest('#drop') && $('[data-stage="idle"].is-active')) { const f = e.dataTransfer.files[0]; if (f) { go('#analyze'); start(f, e.clientX, e.clientY); } } });

function log(msg, cls = '') {
  const el = $('#log');
  const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
  el.insertAdjacentHTML('beforeend', `<span class="${cls}">[${time}] ${esc(msg)}</span>\n`);
  el.scrollTop = el.scrollHeight;
}
function setProgress(p) {
  p = Math.max(0, Math.min(100, p));
  $('#procPct').textContent = Math.round(p);
  $('#procBar').textContent = `[${bar(p, 100, 30)}]`;
}
const PHASES = ['upload', 'queue', 'frames', 'detect', 'rules'];
function setPhase(ph) {
  const idx = ph === 'done' ? PHASES.length : PHASES.indexOf(ph);
  $$('#phases li').forEach((li, i) => {
    li.classList.toggle('is-done', i < idx); li.classList.toggle('is-active', i === idx);
    li.querySelector('.u').textContent = i < idx ? '[  OK  ]' : i === idx ? '[ .... ]' : '[      ]';
  });
  scramble($('#procStatus'), ph.toUpperCase(), 0.4);
}
// spinner on active unit
setInterval(() => { const u = $('#phases li.is-active .u'); if (u) { const f = ['[*     ]', '[ *    ]', '[  *   ]', '[   *  ]', '[    * ]', '[     *]', '[    * ]', '[   *  ]', '[  *   ]', '[ *    ]']; u._i = ((u._i || 0) + 1) % f.length; u.textContent = f[u._i]; } }, 90);

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
    b.innerHTML = `<span>${labels[(Math.random() * labels.length) | 0]} ${(0.6 + Math.random() * 0.39).toFixed(2)}</span>`;
    wrap.appendChild(b);
  }, 650);
}

async function start(file, x, y) {
  if (!/video|quicktime/.test(file.type) && !/\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(file.name)) { toast(t('badFile')); consoleEl.classList.add('shake'); setTimeout(() => consoleEl.classList.remove('shake'), 500); return; }
  burst(x, y, 50);
  currentFile = file;
  if (fileURL) URL.revokeObjectURL(fileURL);
  fileURL = URL.createObjectURL(file);
  $('#procVideo').src = fileURL; $('#procVideo').play().catch(() => {});
  $('#procFile').textContent = file.name; $('#procSize').textContent = `${(file.size / 1e6).toFixed(1)} MB`;
  $('#consoleTitle').textContent = `argus analyze ./${file.name}`;
  $('#log').innerHTML = ''; $('#filmstrip').innerHTML = '';
  setProgress(0); setPhase('upload');
  consoleEl.classList.remove('is-alarm', 'is-ok');
  setStage('proc'); fakeBoxes(true);
  const t0 = performance.now();
  abortCtl = new AbortController();
  try {
    const res = await analyze(file, {
      signal: abortCtl.signal, onPhase: setPhase, onProgress: setProgress, onLog: log,
      onFrame: (c) => { const strip = $('#filmstrip'); strip.appendChild(c); if (strip.children.length > 14) strip.firstElementChild.remove(); },
    });
    res._elapsed = (performance.now() - t0) / 1000;
    fakeBoxes(false);
    lastResult = res;
    setPhase('done');
    setStage('result');
    setTimeout(() => renderResult(res, true), 250);
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
function reset() { lastResult = null; consoleEl.classList.remove('is-alarm', 'is-ok'); radar.alarm(0); setStage('idle'); }
$('#againBtn').addEventListener('click', reset);

function normalizeViolation(v) {
  const ty = typeByName(v.type);
  const rule = v.rule || (v.rule_id && ruleById(v.rule_id)) || (ty && ruleById(ty.rule)) || null;
  return { ...v, _ty: ty, _rule: rule };
}
function ruleHTML(r) {
  if (!r) return `<span class="lbl">§ ${t('rule')}:</span> ${t('noRule')}`;
  const title = r.document || pick(r.title);
  const clause = r.clause && typeof r.clause === 'object' ? pick(r.clause) : r.clause;
  const meta = r.meta ? pick(r.meta) : '';
  return `<span class="lbl">§ ${t('rule')}:</span> ${esc(title)}${meta ? ` — ${esc(meta)}` : ''}${clause ? `, ${esc(clause)}` : ''}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">[adilet ↗]</a>` : ''}`;
}

const ICON_BAD = `  ██╗
  ██║
  ██║
  ╚═╝
  ██╗
  ╚═╝`;
const ICON_OK = `       ██╗
      ██╔╝
 ██╗ ██╔╝
 ╚████╔╝
  ╚═══╝ `;

function renderResult(res, animate) {
  const bad = res.verdict === 'violation';
  const vs = (res.violations || []).map(normalizeViolation);
  const vEl = $('#verdict');
  vEl.classList.toggle('is-bad', bad); vEl.classList.toggle('is-good', !bad);
  $('#verdictIcon').textContent = bad ? ICON_BAD : ICON_OK;
  $('#verdictKicker').textContent = `$ echo $VERDICT → ${res.verdict}${res.demo ? '  # ' + t('demoTag') : ''}`;
  $('#verdictTitle').textContent = bad ? t('verdictBad') : t('verdictGood');
  $('#verdictSub').textContent = bad ? t('subBad', vs.length) : t('subGood');
  $('#jobId').textContent = res.job_id || '—';
  $('#jobTime').textContent = res._elapsed ? `${res._elapsed.toFixed(1)}s` : '—';
  $('#jobCount').textContent = vs.length;
  consoleEl.classList.toggle('is-alarm', bad); consoleEl.classList.toggle('is-ok', !bad);

  const video = $('#resVideo');
  if (fileURL && video.src !== fileURL) video.src = fileURL;
  const marks = $('#tlMarks');
  const drawMarks = () => {
    const d = isFinite(video.duration) && video.duration ? video.duration : Math.max(...vs.map((v) => v.timecode_sec), 1) * 1.2;
    $('#tlEnd').textContent = fmt(d).slice(0, 5);
    marks.innerHTML = vs.map((v, i) => `<div class="mark" style="left:${Math.min(100, (v.timecode_sec / d) * 100)}%; animation-delay:${0.2 + i * 0.15}s" data-t="${v.timecode_sec}" title="${esc(v.type)} @ ${v.timecode_sec}s">#${i + 1}</div>`).join('');
    $$('.mark', marks).forEach((m) => m.addEventListener('click', () => seek(+m.dataset.t)));
  };
  video.onloadedmetadata = drawMarks; drawMarks();
  video.ontimeupdate = () => { $('#tlPlayed').style.width = `${(video.currentTime / (video.duration || 1)) * 100}%`; };
  $('.timeline__track').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); video.currentTime = ((e.clientX - r.left) / r.width) * (video.duration || 0); };

  const list = $('#violations');
  if (!vs.length) {
    list.innerHTML = `<div class="clean"><pre>$ argus analyze --strict
→ 0 events flagged
→ ${esc(t('cleanText'))}
→ exit 0</pre></div>`;
  } else {
    list.innerHTML = vs.map((v, i) => {
      const frames = (v.evidence_frames || []).slice(0, 3);
      const conf = typeof v.confidence === 'number' ? v.confidence : null;
      return `
      <article class="vcard">
        <span class="vcard__id">event[${i}]</span>
        <div class="vcard__frames n${frames.length || 1}">
          ${frames.map((f) => `<div class="frame" data-src="data:image/jpeg;base64,${f.image_base64}" data-cap="${esc(v.type)} · ${fmt(f.timestamp_sec)}"><img loading="lazy" src="data:image/jpeg;base64,${f.image_base64}" alt="evidence ${f.timestamp_sec}s"/><span>t=${fmt(f.timestamp_sec)}</span></div>`).join('')}
        </div>
        <div>
          <h4 class="vcard__type">! ${esc(v._ty ? pick(v._ty.name) : v.type)}</h4>
          <button class="vcard__tc" data-t="${v.timecode_sec}" data-cursor="seek">▶ t=${v.timecode_sec}s · ${fmt(v.timecode_sec)}</button>
          <p class="vcard__desc">${esc(v.description)}</p>
          <div class="vcard__rule">${ruleHTML(v._rule)}</div>
          ${conf != null ? `<pre class="vcard__conf">${t('confidence')} [<b>${bar(conf, 1, 24)}</b>] ${(conf * 100).toFixed(0)}%</pre>` : ''}
        </div>
      </article>`;
    }).join('');
    $$('.vcard__tc', list).forEach((b) => b.addEventListener('click', () => seek(+b.dataset.t)));
    $$('.frame', list).forEach((f) => f.addEventListener('click', () => { $('#lightboxImg').src = f.dataset.src; $('#lightboxCap').textContent = f.dataset.cap; lb.classList.add('is-open'); }));
  }
  if (!animate) return;

  const r = vEl.getBoundingClientRect();
  scramble($('#verdictTitle'), $('#verdictTitle').textContent, 1);
  gsap.from(vEl, { clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'steps(12)' });
  gsap.from('.player, .vcard, .clean, .result__actions > *', { opacity: 0, y: 16, duration: 0.3, ease: 'steps(4)', stagger: 0.12, delay: 0.3 });
  lenis.scrollTo('#console', { offset: -20, duration: 1 });
  if (bad) {
    consoleEl.classList.add('shake'); setTimeout(() => consoleEl.classList.remove('shake'), 550);
    burst(r.left + 80, r.top + r.height / 2, 90, ['#ff2e7e', '#d4145a', '#ffffff']);
    gsap.fromTo('#playerFlash', { opacity: 0.55 }, { opacity: 0, duration: 0.5, repeat: 2, ease: 'steps(3)' });
    radar.alarm(1); setTimeout(() => radar.alarm(0), 4000);
    document.body.animate([{ filter: 'hue-rotate(0)' }, { filter: 'hue-rotate(90deg) saturate(2)' }, { filter: 'hue-rotate(0)' }], { duration: 300, iterations: 2 });
  } else {
    for (let i = 0; i < 4; i++) setTimeout(() => burst(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 40), i * 150);
  }
}
function seek(tSec) {
  const v = $('#resVideo');
  v.currentTime = tSec; v.pause();
  lenis.scrollTo('.player', { offset: -20, duration: 0.8 });
  gsap.fromTo('#playerFlash', { opacity: 0.45 }, { opacity: 0, duration: 0.5, ease: 'steps(3)' });
}
function resultJSON() {
  if (!lastResult) return '{}';
  const { _elapsed, demo, ...clean } = lastResult;
  return JSON.stringify(clean, null, 2);
}
function saveJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([resultJSON()], { type: 'application/json' }));
  a.download = `argus_${lastResult?.job_id || 'result'}.json`; a.click();
}
async function yank() { try { await navigator.clipboard.writeText(resultJSON()); toast(t('copied')); } catch { toast('clipboard ✕'); } }
$('#jsonBtn').addEventListener('click', saveJSON);
$('#copyBtn').addEventListener('click', yank);

// =========================================================
//  API code typing
// =========================================================
const apiBase = () => getSettings().url || 'https://team.example.kz';
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
let currentLang = 'curl', typeTween;
function renderCode(lang, animate = true) {
  currentLang = lang;
  const body = $('#codeBody');
  const html = CODE[lang]();
  typeTween?.kill();
  if (!animate || reduced) { body.innerHTML = html; return; }
  const tokens = html.match(/<[^>]+>|&[a-z#0-9]+;|[\s\S]/g);
  const o = { i: 0 };
  typeTween = gsap.to(o, {
    i: tokens.length, duration: Math.min(2, tokens.length / 280), ease: 'none',
    onUpdate: () => { body.innerHTML = tokens.slice(0, Math.floor(o.i)).join('') + '<span class="caret"></span>'; },
    onComplete: () => { body.innerHTML = html + '<span class="caret"></span>'; },
  });
}
$$('#codeTabs button[data-lang]').forEach((b) => b.addEventListener('click', () => {
  $$('#codeTabs button').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active');
  renderCode(b.dataset.lang);
}));
$('#codeCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#codeBody').textContent); toast('yanked ✓'); } catch {} });
onView('.code', () => renderCode('curl'));

// =========================================================
//  FAKE SHELL
// =========================================================
const sh = { out: $('#shellOut'), in: $('#shellIn'), hist: [], hi: 0 };
function print(html) { sh.out.insertAdjacentHTML('beforeend', html + '\n'); const b = sh.out.parentElement; b.scrollTop = b.scrollHeight; }
const COMMANDS = {
  help: () => `<span class="ok">ARGUS shell — available commands</span>
  <span class="hl">help</span>              this message
  <span class="hl">analyze</span>           open file picker and run analysis
  <span class="hl">classes</span>           list violation classes
  <span class="hl">rules</span>             list regulatory sources
  <span class="hl">stats</span>             dataset stats
  <span class="hl">connect</span> [url] [key] set backend (no args → open config)
  <span class="hl">status</span>            DEMO / LIVE
  <span class="hl">goto</span> &lt;section&gt;    pipeline | analyze | classes | rules | api
  <span class="hl">lang</span>              toggle RU / EN
  <span class="hl">theme</span> &lt;name&gt;      phosphor | amber | forte
  <span class="hl">json</span>              print last result
  <span class="hl">whoami</span> · <span class="hl">date</span> · <span class="hl">clear</span> · <span class="hl">matrix</span> · <span class="hl">sudo</span> …`,
  analyze: () => { go('#analyze'); setTimeout(() => input.click(), 900); return '→ opening file picker…'; },
  classes: () => TYPES.map((x) => `<span class="err">${x.code}</span>  ${esc(pick(x.name))}`).join('\n'),
  rules: () => RULES.map((r) => `<span class="ok">§</span> ${esc(pick(r.title))}\n  ${esc(pick(r.meta))}\n  <span class="hl">${esc(r.url)}</span>`).join('\n'),
  stats: () => `videos       ${bar(43, 43, 20)} 43\n<span class="err">violation    ${bar(22, 43, 20)} 22</span>\nno_violation ${bar(21, 43, 20)} 21`,
  connect: (a) => {
    if (!a[0]) { openSettings(); return '→ opening ~/.argusrc'; }
    saveSettings({ url: a[0], key: a[1] ?? getSettings().key, poll: getSettings().poll }); refreshMode();
    return `<span class="ok">✓ backend set → ${esc(a[0])}</span>`;
  },
  status: () => (isLive() ? `<span class="ok">LIVE</span> → ${esc(getSettings().url)}` : '<span class="err">DEMO</span> → browser-side simulation'),
  goto: (a) => { const m = { pipeline: '#pipeline', analyze: '#analyze', classes: '#types', rules: '#rules', api: '#api', top: '#top' }; if (!m[a[0]]) return '<span class="err">usage: goto pipeline|analyze|classes|rules|api</span>'; go(m[a[0]]); return `→ ${a[0]}`; },
  lang: () => { toggleLang(); return `→ ${getLang()}`; },
  theme: (a) => { document.body.classList.remove('amber', 'forte'); if (a[0] === 'amber' || a[0] === 'forte') document.body.classList.add(a[0]); return `→ theme ${a[0] || 'phosphor'}`; },
  json: () => (lastResult ? esc(resultJSON().slice(0, 1500)) + (resultJSON().length > 1500 ? '\n…' : '') : '<span class="err">no result yet — run analyze</span>'),
  whoami: () => 'forte@argus — reviewer, cash discipline unit',
  date: () => new Date().toString(),
  clear: () => { sh.out.innerHTML = ''; return null; },
  matrix: () => { document.body.classList.toggle('forte'); burst(innerWidth / 2, innerHeight / 2, 160, ['#ff2e7e', '#c6ff3d']); return '<span class="ok">wake up, reviewer…</span>'; },
  sudo: () => '<span class="err">forte is not in the sudoers file. This incident will be reported.</span>',
  ls: () => 'pipeline/  analyze/  classes/  rules/  api/  README.md  .argusrc',
  cat: (a) => (a[0] === 'README.md' ? 'ARGUS — see github.com/MartianYernar/argus-cashdesk' : `<span class="err">cat: ${esc(a[0] || '')}: No such file</span>`),
  exit: () => { go('#top'); return 'logout'; },
  'rm': () => '<span class="err">nice try.</span>',
};
COMMANDS.man = COMMANDS.help; COMMANDS['?'] = COMMANDS.help; COMMANDS.cls = COMMANDS.clear;
function runCmd(line) {
  const raw = line.trim();
  print(`<span class="ps1">forte@argus</span>:<span class="ps2">~</span>$ ${esc(raw)}`);
  if (!raw) return;
  sh.hist.push(raw); sh.hi = sh.hist.length;
  const [cmd, ...args] = raw.split(/\s+/);
  const fn = COMMANDS[cmd.toLowerCase()];
  const out = fn ? fn(args) : `<span class="err">argus: command not found: ${esc(cmd)}</span> — try <span class="hl">help</span>`;
  if (out != null) print(out);
}
sh.in.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { runCmd(sh.in.value); sh.in.value = ''; }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (sh.hi > 0) sh.in.value = sh.hist[--sh.hi]; }
  else if (e.key === 'ArrowDown') { e.preventDefault(); sh.in.value = sh.hi < sh.hist.length - 1 ? sh.hist[++sh.hi] : ((sh.hi = sh.hist.length), ''); }
  else if (e.key === 'Tab') { e.preventDefault(); const m = Object.keys(COMMANDS).filter((k) => k.startsWith(sh.in.value)); if (m.length === 1) sh.in.value = m[0] + ' '; else if (m.length) print(m.join('  ')); }
  e.stopPropagation();
});
$('#shellWin').addEventListener('click', () => sh.in.focus({ preventScroll: true }));
onView('#shellWin', async () => {
  print('<span class="dim">ARGUS shell 1.0 · type <span class="hl">help</span> · ↑↓ history · tab completion</span>');
  await sleep(400);
  const demo = 'help';
  sh.in.value = '';
  for (const ch of demo) { sh.in.value += ch; await sleep(90); }
  await sleep(250); runCmd(sh.in.value); sh.in.value = '';
});

// =========================================================
//  global keyboard
// =========================================================
addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;
  if (e.key === 'Escape') { lb.classList.remove('is-open'); drawer.classList.remove('is-open'); return; }
  if (drawer.classList.contains('is-open')) return;
  const tab = $(`.tmux__tabs a[data-key="${e.key}"]`);
  if (tab) { go(tab.getAttribute('href')); return; }
  if (e.key === '/' || e.key === ':') { e.preventDefault(); go('#shell'); setTimeout(() => sh.in.focus({ preventScroll: true }), 900); }
  if (e.key === 'Enter' && $('[data-stage="idle"].is-active') && !document.body.classList.contains('is-booting')) { go('#analyze'); }
  if (lastResult && $('[data-stage="result"].is-active')) {
    if (e.key === 'r') reset();
    if (e.key === 's') saveJSON();
    if (e.key === 'y') yank();
  }
});

console.log('%c ARGUS %c all eyes open · type / for shell ', 'background:#d4145a;color:#fff;font-weight:900;padding:4px 8px', 'background:#060708;color:#c6ff3d;padding:4px 8px');

boot().then(() => {
  document.body.classList.remove('is-booting');
  lenis.start();
  heroIn();
  ScrollTrigger.refresh();
});
