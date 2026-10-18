import { LEGAL_CATALOG } from './legal.js';
import './style.css';
import { reduced } from './effects.js';
import { initI18n, toggleLang, onLang, t, pick } from './i18n.js';
import { RULES, ruleById, typeByName } from './data.js';
import { analyze, getSettings, saveSettings, isLive, checkConnection } from './api.js';
import { putJob, deleteJob, clearJobs, allJobs } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const hhmm = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const isVideo = (f) => /\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(f.name);

// =========================================================
//  state
// =========================================================
let jobs = [];           // newest first
let selId = null;
let filter = 'all';
let search = '';
let focusIdx = 0;        // focused event in result view
let running = false;

const job = (id) => jobs.find((j) => j.id === id);
const sel = () => job(selId);
const events = (j) => j?.result?.violations || [];
function review(j) {
  if (j.status === 'queued') return 'queued';
  if (j.status === 'proc') return 'proc';
  if (j.status === 'failed') return 'fail';
  if (j.result?.verdict !== 'violation') return 'ok';
  const ev = events(j);
  return ev.every((_, i) => j.decisions?.[i]) ? 'reviewed' : 'pend';
}

// =========================================================
//  boot + landing
// =========================================================
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.endsWith('.trycloudflare.com')) {
  await new Promise(resolve => { const script = document.createElement('script'); script.src = '/api/local-config.js'; script.onload = script.onerror = resolve; document.head.append(script); });
}
initI18n();
$('.lang-on').textContent = document.documentElement.lang.toUpperCase(); $('.lang-off').textContent = document.documentElement.lang === 'ru' ? 'EN' : 'RU';
$('#sources').innerHTML = RULES.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(pick(r.meta).split('·')[0].trim())}</a>`).join(' · ');

$('#enterBtn').addEventListener('click', (e) => { e.preventDefault(); toApp(); });
function toApp() { $('#app').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }

// =========================================================
//  queue + runner
// =========================================================
function addFiles(list) {
  const files = [...list].filter(isVideo);
  if (!files.length) { toast(t('badFile')); return; }
  const now = Date.now();
  files.forEach((file, k) => {
    const j = { id: `${now.toString(36)}${k}${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, createdAt: now + k, status: 'queued', progress: 0, decisions: {}, notes: {}, file, url: URL.createObjectURL(file), logs: [] };
    jobs.unshift(j);
    putJob(j);
  });
  if (!sel() || sel().status === 'done') select([...jobs].reverse().find((j) => j.status === 'queued')?.id);
  toast(t('added', files.length));
  renderAll();
  run();
}

async function run() {
  if (running) return;
  running = true;
  let j;
  while ((j = [...jobs].reverse().find((x) => x.status === 'queued'))) {
    j.status = 'proc'; j.progress = 0; j.phase = 'upload'; j.logs = [];
    j.abort = new AbortController();
    renderAll();
    const t0 = performance.now();
    try {
      const res = await analyze(j.file, {
        signal: j.abort.signal,
        onPhase: (p) => { j.phase = p; if (j.id === selId) setPhase(p); },
        onProgress: (p) => { j.progress = p; if (j.id === selId) setProgress(p); updateItem(j); },
        onLog: (m, c) => { j.logs.push([new Date().toLocaleTimeString('ru-RU', { hour12: false }), m, c]); if (j.id === selId) logLine(j.logs.at(-1)); },
        onFrame: () => {},
      });
      j.result = res; j.status = 'done'; j.elapsed = (performance.now() - t0) / 1000; j.doneAt = Date.now();
    } catch (err) {
      if (err.name === 'AbortError') { j.status = 'failed'; j.error = t('cancelled'); }
      else { j.status = 'failed'; j.error = err.message || String(err); }
    }
    delete j.abort;
    putJob(j);
    if (j.id === selId) { focusIdx = 0; renderViewer(true); }
    renderList(); renderStats();
  }
  running = false;
  if (jobs.length && jobs.every(x => x.status === 'done') && !jobs.some((x) => review(x) === 'pend')) toast(t('allDone'));
}

// =========================================================
//  list
// =========================================================
const ST = {
  queued: () => [t('queued'), 's-queued'], proc: () => [t('proc'), 's-proc'], fail: () => [t('fail'), 's-fail'],
  ok: () => [t('ok'), 's-ok'], pend: () => [t('pend'), 's-pend'], reviewed: () => [t('reviewed'), 's-bad'],
};
function visible() {
  return jobs.filter((j) => {
    const r = review(j);
    if (search && !j.name.toLowerCase().includes(search)) return false;
    if (filter === 'pending') return r === 'pend';
    if (filter === 'flagged') return j.result?.verdict === 'violation';
    if (filter === 'clean') return r === 'ok';
    return true;
  });
}
function itemHTML(j) {
  const r = review(j);
  const [label, cls] = ST[r]();
  const n = events(j).length;
  const meta = [hhmm(j.createdAt), `${(j.size / 1e6).toFixed(1)} MB`];
  if (j.status === 'done' && n) meta.push(t('events', n));
  if (j.status === 'done' && j.elapsed) meta.push(`${j.elapsed.toFixed(1)}s`);
  return `<span class="qitem__name">${esc(j.name)}</span><span class="qitem__st ${cls}">${r === 'proc' ? (j.progress == null ? '…' : `${Math.round(j.progress)}%`) : label}</span>
    <span class="qitem__meta">${meta.join(' · ')}</span>${r === 'proc' || r === 'queued' ? `<span class="qitem__bar"><i style="width:${j.progress == null ? 40 : j.progress}%"></i></span>` : ''}`;
}
function renderList() {
  const ul = $('#qList');
  const vs = visible();
  ul.innerHTML = vs.length ? vs.map((j) => `<li tabindex="0" role="button" aria-pressed="${j.id === selId}" class="qitem${j.id === selId ? ' is-sel' : ''}" data-id="${j.id}">${itemHTML(j)}</li>`).join('') : `<li class="qempty">${t(search || filter !== 'all' ? 'noMatches' : 'emptyQueue')}</li>`;
}
function updateItem(j) { const li = $(`.qitem[data-id="${j.id}"]`); if (li) li.innerHTML = itemHTML(j); }
$('#qList').addEventListener('click', (e) => { const li = e.target.closest('.qitem'); if (li) select(li.dataset.id); });
$('#qList').addEventListener('keydown', (e) => {
  const item = e.target.closest('.qitem');
  if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); select(item.dataset.id); }
});
$('#qFilters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; $$('#qFilters button').forEach((x) => x.classList.toggle('is-on', x === b)); renderList(); });
$('#qSearch').addEventListener('input', (e) => { search = e.target.value.trim().toLowerCase(); renderList(); });
$('#clearBtn').addEventListener('click', async () => {
  if (!confirm(t('clearAsk'))) return;
  jobs.filter(j => j.status !== 'proc' && j.status !== 'queued').forEach(j => j.url && URL.revokeObjectURL(j.url));
  jobs = jobs.filter((j) => j.status === 'proc' || j.status === 'queued');
  await clearJobs(); jobs.forEach(putJob);
  selId = null; renderAll();
});

function select(id) {
  if (!id) return;
  selId = id; focusIdx = 0;
  renderList(); renderViewer(false);
  $(`.qitem[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}
function step(dir) {
  const vs = visible(); if (!vs.length) return;
  const i = vs.findIndex((j) => j.id === selId);
  select(vs[Math.max(0, Math.min(vs.length - 1, i < 0 ? 0 : i + dir))].id);
}
function nextPending() {
  const p = [...jobs].reverse().find((j) => review(j) === 'pend' && j.id !== selId) || jobs.find((j) => review(j) === 'pend');
  if (p) select(p.id);
}

// =========================================================
//  stats
// =========================================================
function renderStats() {
  const today = dayKey(Date.now());
  const tj = jobs.filter((j) => dayKey(j.createdAt) === today);
  const a = {
    checked: tj.filter((j) => j.status === 'done').length,
    flagged: tj.filter((j) => j.result?.verdict === 'violation').length,
    pending: jobs.filter((j) => review(j) === 'pend').length,
    confirmed: tj.reduce((s, j) => s + Object.values(j.decisions || {}).filter((d) => d === 'confirmed').length, 0),
    queue: jobs.filter((j) => j.status === 'queued' || j.status === 'proc').length,
  };
  $('#dayStats').innerHTML = `<span class="dim">${today}</span>
    <span><b>${a.checked}</b>${t('stChecked')}</span>
    <span class="st--flag"><b>${a.flagged}</b>${t('stFlagged')}</span>
    <span class="st--pend"><b>${a.pending}</b>${t('stPending')}</span>
    <span class="st--ok"><b>${a.confirmed}</b>${t('stConfirmed')}</span>
    ${a.queue ? `<span><b>${a.queue}</b>${t('stQueue')}</span>` : ''}`;
  $('#dayStatsCards').innerHTML = [
    [a.checked, t('cardChecked'), 'checked'], [a.pending, t('cardPending'), 'pending'],
    [a.confirmed, t('cardConfirmed'), 'confirmed']
  ].map(([n, label, cls]) => `<div class="stat-card ${cls}"><span>${label}</span><b>${n.toString().padStart(2, '0')}</b></div>`).join('');
  $('#heroToday').textContent = t('today', a);
}

// =========================================================
//  viewer
// =========================================================
function showV(name) { $$('.vstate').forEach((v) => v.classList.toggle('is-active', v.dataset.v === name)); }
function renderViewer(justFinished) {
  const j = sel();
  if (!j) { showV('empty'); return; }
  if (j.status === 'queued' || j.status === 'proc') {
    showV('proc');
    $('#pName').textContent = j.name;
    $('#pMeta').textContent = `${(j.size / 1e6).toFixed(1)} MB · ${j.status === 'queued' ? t('queued') : t('proc')}`;
    const v = $('#procVideo');
    if (j.url && v.src !== j.url) { v.src = j.url; v.play().catch(() => {}); }
    setProgress(j.progress); setPhase(j.phase || 'upload');
    $('#log').innerHTML = ''; (j.logs || []).forEach(logLine);
    return;
  }
  if (j.status === 'failed') {
    showV('error'); $('#eName').textContent = j.name; $('#errMsg').textContent = j.error || '—';
    return;
  }
  showV('result');
  renderResult(j, justFinished);
}

const PHASES = ['upload', 'queue', 'frames', 'detect', 'rules'];
function setPhase(ph) {
  const idx = PHASES.indexOf(ph);
  $$('#phases li').forEach((li, i) => {
    li.classList.toggle('is-done', i < idx); li.classList.toggle('is-active', i === idx);
    li.querySelector('.u').textContent = i < idx ? '✓' : i === idx ? '●' : '○';
  });
}
function setProgress(p) { const waiting = p == null; $('#procPct').textContent = waiting ? '…' : Math.round(p); $('#procUnit').hidden = waiting; $('#procBar').classList.toggle('is-indeterminate', waiting); $('#procBar').style.width = waiting ? '40%' : `${Math.max(0, Math.min(100, p))}%`; }
function logLine([time, msg, cls]) { const el = $('#log'); el.insertAdjacentHTML('beforeend', `<span class="${cls || ''}">[${time}] ${esc(msg)}</span>\n`); el.scrollTop = el.scrollHeight; }
$('#cancelBtn').addEventListener('click', () => { const j = sel(); if (j?.status === 'proc') j.abort?.abort(); else if (j?.status === 'queued') { j.status = 'failed'; j.error = t('cancelled'); putJob(j); renderAll(); } });
$('#retryBtn').addEventListener('click', () => {
  const j = sel(); if (!j) return;
  if (!j.file) { $('#reattachInput').click(); return; }
  j.status = 'queued'; j.error = null; j.progress = 0; putJob(j); renderAll(); run();
});

function normalize(v) {
  const ty = typeByName(v.type);
  const context = LEGAL_CATALOG.events.find(e => e.type === v.type);
  const source = context?.sources?.[0];
  const act = source && LEGAL_CATALOG.sources.find(s => s.id === source.act);
  const mappedRule = source ? { document: act?.title_ru || source.act, clause: source.clause, url: source.url } : null;
  return { ...v, legal_context: context, _ty: ty, _rule: mappedRule || v.rule || (v.rule_id && ruleById(v.rule_id)) || (ty && ruleById(ty.rule)) || null };
}
function ruleHTML(r) {
  if (!r) return `<span class="lbl">§ ${t('rule')}:</span> ${t('noRule')}`;
  const title = r.document || pick(r.title);
  const clause = r.clause && typeof r.clause === 'object' ? pick(r.clause) : r.clause;
  const meta = r.meta ? pick(r.meta) : '';
  return `<span class="lbl">§ ${t('rule')}:</span> <b>${esc(title)}</b>${meta ? ` — ${esc(meta)}` : ''}${clause ? `, ${esc(clause)}` : ''}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">adilet ↗</a>` : ''}`;
}

function renderResult(j, justFinished) {
  const res = j.result;
  const vs = events(j).map(normalize);
  const bad = res.verdict === 'violation';
  const r = review(j);
  const vEl = $('#verdict');
  vEl.className = 'verdict ' + (bad ? (r === 'pend' ? 'verdict--bad' : 'verdict--bad') : 'verdict--ok');
  vEl.textContent = bad ? t('bad') : t('ok');
  $('#rName').textContent = j.name;
  $('#rMeta').textContent = [bad ? t('events', vs.length) : t('verdictGood'), j.elapsed ? `${j.elapsed.toFixed(1)}s` : '', res.demo ? t('demoTag') : '', bad && r === 'pend' ? `· ${t('pend')}` : bad ? `· ${t('reviewed')}` : ''].filter(Boolean).join(' · ');


  // player
  const screen = $('#screen'), video = $('#resVideo');
  screen.classList.toggle('no-video', !j.url);
  if (j.url) { if (video.src !== j.url) video.src = j.url; } else { video.removeAttribute('src'); video.load(); }
  const drawMarks = () => {
    const d = isFinite(video.duration) && video.duration ? video.duration : Math.max(10, ...vs.map((v) => v.timecode_sec)) * 1.15;
    $('#tlEnd').textContent = fmt(d).slice(0, 5);
    $('#tlMarks').innerHTML = vs.map((v, i) => `<div class="mark ${j.decisions[i] ? 'is-' + j.decisions[i] : ''}" style="left:${Math.min(100, (v.timecode_sec / d) * 100)}%" data-i="${i}" title="${esc(v.type)} @ ${v.timecode_sec}s">${i + 1}</div>`).join('');
  };
  video.onloadedmetadata = drawMarks; drawMarks();
  video.ontimeupdate = () => { $('#tlPlayed').style.width = `${(video.currentTime / (video.duration || 1)) * 100}%`; };

  // events
  const box = $('#events');
  if (!vs.length) {
    box.innerHTML = `<div class="clean"><strong>✓ ${t('verdictGood')}</strong><p>${esc(t('cleanText'))}</p></div>`;
    return;
  }
  box.innerHTML = vs.map((v, i) => {
    const frames = (v.evidence_frames || []).slice(0, 3);
    const d = j.decisions[i];
    const conf = typeof v.confidence === 'number' ? v.confidence : null;
    return `<article class="ev ${d ? 'is-' + d : ''} ${i === focusIdx ? 'is-focus' : ''}" data-i="${i}">
      <div class="ev__frames n${frames.length || 1}">${frames.map((f) => `<div class="frame" data-src="data:image/jpeg;base64,${f.image_base64}" data-cap="#${i + 1} ${esc(v.type)} · ${fmt(f.timestamp_sec)}"><img loading="lazy" src="data:image/jpeg;base64,${f.image_base64}" alt="evidence ${f.timestamp_sec}s"/><span>${fmt(f.timestamp_sec)}</span></div>`).join('')}</div>
      <div>
        <div class="ev__top"><span class="ev__n">#${i + 1}</span><span class="ev__type">${esc(v._ty ? pick(v._ty.name) : v.type)}</span><button class="ev__tc" data-seek="${v.timecode_sec}">▶ ${fmt(v.timecode_sec)}</button></div>
        <p class="ev__desc">${esc(v.description)}</p>
        <div class="ev__rule">${ruleHTML(v._rule)}${v.legal_context ? `<p>${esc(v.legal_context.relevance_ru || '')}</p><p>${esc(v.legal_context.limitations_ru || '')}</p><p>Основание для проверки сотрудником; автоматический юридический вывод не формируется.</p>` : ''}</div>
        ${conf != null ? `<div class="ev__conf">${t('confidence')} <i><span style="width:${conf * 100}%"></span></i> ${(conf * 100).toFixed(0)}%</div>` : ''}
        <div class="ev__act">
          <button class="tbtn ${d === 'confirmed' ? 'is-on' : ''}" data-dec="confirmed"><span>✓</span> ${t('confirm')}</button>
          <button class="tbtn tbtn--forte ${d === 'dismissed' ? 'is-on' : ''}" data-dec="dismissed"><span>×</span> ${t('dismiss')}</button>
          <input class="ev__note" data-note placeholder="${esc(t('note'))}" value="${esc(j.notes[i] || '')}" />
        </div>
      </div>
    </article>`;
  }).join('');
}

$('#events').addEventListener('click', (e) => {
  const ev = e.target.closest('.ev'); if (!ev) return;
  const i = +ev.dataset.i;
  const seekB = e.target.closest('[data-seek]');
  const decB = e.target.closest('[data-dec]');
  const fr = e.target.closest('.frame');
  if (seekB) { focusEvent(i, true); return; }
  if (decB) { decide(i, decB.dataset.dec); return; }
  if (fr) { $('#lightboxImg').src = fr.dataset.src; $('#lightboxCap').textContent = fr.dataset.cap; $('#lightbox').classList.add('is-open'); return; }
  if (!e.target.closest('input')) focusEvent(i, false);
});
$('#events').addEventListener('input', (e) => { if (!e.target.matches('[data-note]')) return; const j = sel(); j.notes[+e.target.closest('.ev').dataset.i] = e.target.value; clearTimeout(j._nt); j._nt = setTimeout(() => putJob(j), 400); });
$('#tlMarks').addEventListener('click', (e) => { const m = e.target.closest('.mark'); if (m) focusEvent(+m.dataset.i, true); });
$('#tlTrack').addEventListener('click', (e) => { const v = $('#resVideo'); const r = e.currentTarget.getBoundingClientRect(); if (v.duration) v.currentTime = ((e.clientX - r.left) / r.width) * v.duration; });

function focusEvent(i, seek) {
  const j = sel(); const vs = events(j); if (!vs[i]) return;
  focusIdx = i;
  $$('.ev').forEach((el) => el.classList.toggle('is-focus', +el.dataset.i === i));
  const el = $(`.ev[data-i="${i}"]`);
  if (seek) {
    const v = $('#resVideo');
    if (j.url) { v.currentTime = vs[i].timecode_sec; v.pause(); }
    $('#screen').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function decide(i, d) {
  const j = sel(); if (!j || !events(j)[i]) return;
  j.decisions[i] = j.decisions[i] === d ? undefined : d;
  if (!j.decisions[i]) delete j.decisions[i];
  putJob(j);
  const n = events(j).length;
  renderResult(j, false); renderList(); renderStats();
  // auto-advance: next undecided event, else next pending video
  const next = [...Array(n).keys()].find((k) => k > i && !j.decisions[k]) ?? [...Array(n).keys()].find((k) => !j.decisions[k]);
  if (next != null) focusEvent(next, true);
  else if (review(j) === 'reviewed') setTimeout(nextPending, 350);
}

$('#jsonBtn').addEventListener('click', saveJSON);
$('#delBtn').addEventListener('click', delSel);
function saveJSON() {
  const j = sel(); if (!j?.result) return;
  const { demo, ...res } = j.result;
  download(`argus_${j.name.replace(/\.\w+$/, '')}_${res.job_id}.json`, JSON.stringify({ ...res, review: { decisions: j.decisions, notes: j.notes } }, null, 2), 'application/json');
}
function delSel() {
  const j = sel(); if (!j) return;
  j.abort?.abort();
  if (j.url) URL.revokeObjectURL(j.url);
  const vs = visible(); const i = vs.findIndex((x) => x.id === j.id);
  jobs = jobs.filter((x) => x.id !== j.id); deleteJob(j.id);
  selId = (vs[i + 1] || vs[i - 1])?.id || null;
  renderAll();
}

// re-attach a video after reload
function reattach(file) {
  const j = sel(); if (!j || !file) return;
  if (file.name !== j.name) { toast(t('wrongFile')); return; }
  if (j.url) URL.revokeObjectURL(j.url);
  j.file = file; j.url = URL.createObjectURL(file);
  if (j.status === 'failed') { j.status = 'queued'; j.error = null; putJob(j); run(); }
  renderViewer(false);
}
$('#reattachInput').addEventListener('change', (e) => { reattach(e.target.files[0]); e.target.value = ''; });

// =========================================================
//  report
// =========================================================
function exportCSV() {
  const today = dayKey(Date.now());
  const tj = jobs.filter((j) => dayKey(j.createdAt) === today && j.status === 'done').reverse();
  if (!tj.length) { toast(t('noExport')); return; }
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'time', 'file', 'job_id', 'verdict', 'event', 'type', 'timecode_sec', 'decision', 'note', 'rule', 'confidence']];
  tj.forEach((j) => {
    const vs = events(j).map(normalize);
    if (!vs.length) rows.push([today, hhmm(j.createdAt), j.name, j.result.job_id, j.result.verdict, '', '', '', 'n/a', '', '', '']);
    vs.forEach((v, i) => rows.push([today, hhmm(j.createdAt), j.name, j.result.job_id, j.result.verdict, i + 1, v.type, v.timecode_sec, j.decisions[i] || 'pending', j.notes[i] || '', v._rule ? (v._rule.document || pick(v._rule.meta) || '') : '', v.confidence ?? '']));
  });
  download(`argus_report_${today}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv');
}
$('#exportBtn').addEventListener('click', exportCSV);
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

// =========================================================
//  inputs: file picker, drag & drop
// =========================================================
$('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
$('#bigDrop').addEventListener('click', () => $('#fileInput').click());
['bigDrop', 'drop'].forEach((id) => document.getElementById(id).addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); }
}));
{
  const veil = $('#dropVeil'); let depth = 0;
  addEventListener('dragenter', (e) => { if (!e.dataTransfer?.types?.includes('Files')) return; e.preventDefault(); depth++; veil.classList.add('is-on'); });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; veil.classList.remove('is-on'); } });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0; veil.classList.remove('is-on');
    const files = e.dataTransfer?.files; if (!files?.length) return;
    const j = sel();
    if (j && !j.url && files.length === 1 && files[0].name === j.name) { reattach(files[0]); return; }
    addFiles(files);
    if ($('#app').getBoundingClientRect().top > 10) toApp();
  });
}

// =========================================================
//  settings, help, misc
// =========================================================
const drawer = $('#drawer'), help = $('#helpModal');
function connectionMessage(result) {
  const key = { auth: 'connectionAuth', endpoint: 'connectionEndpoint', response: 'connectionResponse', server: 'connectionServer', timeout: 'connectionTimeout', network: 'connectionNetwork', model_not_installed: 'connectionMissingModel', ollama_unavailable: 'connectionOllama', no_server: 'demoText' }[result.reason] || 'offlineText';
  return t(key);
}
let modeVersion = 0;
async function refreshMode() {
  const version = ++modeVersion, live = isLive(), pill = $('#modePill'), notice = $('#connectionNotice');
  pill.classList.remove('is-live'); notice.className = 'connection-notice';
  $('#modeLabel').textContent = live ? t('connecting') : t('demoMode');
  pill.title = live ? getSettings().url : t('demoTitle');
  $('#connectionTitle').textContent = live ? t('connecting') : t('demoTitle');
  $('#connectionText').textContent = live ? t('connectingText') : t('demoText');
  $('#connectionSettings').firstChild.textContent = t('configure') + ' ';
  if (!live) return;
  const result = await checkConnection(), ok = result.ready;
  if (version !== modeVersion) return;
  pill.classList.toggle('is-live', ok); notice.classList.toggle('is-ready', ok);
  $('#modeLabel').textContent = ok ? t('liveMode') : t('offline');
  $('#connectionTitle').textContent = ok ? t('readyTitle') : t('offlineTitle');
  $('#connectionText').textContent = ok ? t('readyText') : connectionMessage(result);
}
let lastFocus;
function openModal(modal) {
  lastFocus = document.activeElement; modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
  (modal.querySelector('input') || modal.querySelector('button'))?.focus();
}
function closeModal(modal) {
  modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal'); lastFocus?.focus();
}
function updateServerWebsite() {
  const link = $('#serverWebsite');
  try {
    const url = new URL(getSettings().url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (location.protocol === 'https:' && url.protocol !== 'https:')) throw new Error();
    link.href = url.href; link.hidden = false;
  } catch { link.removeAttribute('href'); link.hidden = true; }
}
function openSettings() {
  const s = getSettings(); $('#apiUrl').value = s.url; $('#apiKey').value = s.key; $('#apiPoll').value = s.poll; $('#settingsStatus').textContent = '';
  updateServerWebsite(); openModal(drawer);
}
refreshMode();
$('#modePill').addEventListener('click', openSettings);
$('#connectionSettings').addEventListener('click', openSettings);
const saveForm = () => {
  const url = $('#apiUrl').value.trim().replace(/\/+$/, '');
  if (url) {
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error(); }
    catch { $('#settingsStatus').textContent = t('invalidUrl'); $('#apiUrl').focus(); return false; }
    if (location.protocol === 'https:' && url.startsWith('http:')) { $('#settingsStatus').textContent = t('httpsRequired'); return false; }
  }
  saveSettings({ url, key: $('#apiKey').value.trim(), poll: Math.max(500, Math.min(10000, Number($('#apiPoll').value) || 1500)) }); updateServerWebsite(); refreshMode(); return true;
};
$('#saveSettings').addEventListener('click', () => { if (!saveForm()) return; toast(t('saved')); closeModal(drawer); });
$('#testSettings').addEventListener('click', async () => {
  if (!saveForm()) return;
  const st = $('#settingsStatus'), button = $('#testSettings'); button.disabled = true; st.className = 'status'; st.textContent = t('connecting');
  try { const result = await checkConnection(); st.textContent = result.ready ? t('testOk') : connectionMessage(result); st.classList.add(result.ready ? 'ok' : 'bad'); }
  finally { button.disabled = false; }
});
$('#helpBtn').addEventListener('click', () => openModal(help));
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal'))));
addEventListener('keydown', e => {
  const modal = $('.modal.is-open'); if (!modal || e.key !== 'Tab') return;
  const fields = [...modal.querySelectorAll('button,input,a[href]')].filter(el => !el.disabled && el.getClientRects().length);
  if (e.shiftKey && document.activeElement === fields[0]) { e.preventDefault(); fields.at(-1).focus(); }
  else if (!e.shiftKey && document.activeElement === fields.at(-1)) { e.preventDefault(); fields[0].focus(); }
});
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('is-open'));
$('#langToggle').addEventListener('click', toggleLang);
onLang((lang) => {
  refreshMode();
  $('.lang-on').textContent = lang.toUpperCase(); $('.lang-off').textContent = lang === 'ru' ? 'EN' : 'RU';
  $('#keysHint').innerHTML = t('keys'); $('#keysFull').innerHTML = t('keys');
  renderAll();
});

let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 1800); }

// =========================================================
//  keyboard
// =========================================================
addEventListener('keydown', (e) => {
  if (document.body.classList.contains('is-booting')) return;
  if (e.key === 'Escape') { $$('.modal.is-open').forEach(closeModal); $('#lightbox').classList.remove('is-open'); return; }
  if (e.target.closest('input, textarea, button, a, label, [role=button]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('.modal.is-open')) return;
  const inApp = $('#app').getBoundingClientRect().top < innerHeight / 2;
  if (!inApp) { if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); toApp(); } return; }
  const j = sel(); const v = $('#resVideo'); const res = j?.status === 'done';
  const k = e.key;
  const act = {
    u: () => $('#fileInput').click(), U: () => $('#fileInput').click(),
    j: () => step(1), k: () => step(-1), ArrowDown: () => step(1), ArrowUp: () => step(-1), n: nextPending,
    '/': () => $('#qSearch').focus(), '?': () => openModal(help),
    e: exportCSV, s: () => res && saveJSON(), Delete: delSel,
    ' ': () => res && j.url && (v.paused ? v.play() : v.pause()),
    ArrowRight: () => res && (v.currentTime += 2), ArrowLeft: () => res && (v.currentTime -= 2),
    c: () => res && decide(focusIdx, 'confirmed'), x: () => res && decide(focusIdx, 'dismissed'),
    ']': () => res && focusEvent(Math.min(events(j).length - 1, focusIdx + 1), true), '[': () => res && focusEvent(Math.max(0, focusIdx - 1), true),
  }[k] || (/^[1-9]$/.test(k) && res ? () => focusEvent(+k - 1, true) : null);
  if (act) { e.preventDefault(); act(); }
});

// =========================================================
//  init
// =========================================================
function renderAll() { renderList(); renderViewer(false); renderStats(); }

(async () => {
  const stored = await allJobs();
  jobs = stored.map((j) => (j.status === 'proc' || j.status === 'queued' ? { ...j, status: 'failed', error: t('interrupted') } : j))
    .sort((a, b) => b.createdAt - a.createdAt);
  jobs.forEach((j) => { j.decisions ||= {}; j.notes ||= {}; });
  selId = jobs.find((j) => review(j) === 'pend')?.id || jobs[0]?.id || null;
  $('#keysHint').innerHTML = t('keys'); $('#keysFull').innerHTML = t('keys');
  renderAll();

})();
