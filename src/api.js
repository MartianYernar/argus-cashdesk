// =========================================================
//  API client. Implements the jury contract from the case:
//    POST /api/v1/analyze   (multipart "file")  -> { job_id }
//    GET  /api/v1/jobs/{id}                     -> { status, verdict, violations[] }
//  If no API URL is configured, runs a browser-side DEMO.
// =========================================================
import { TYPES } from './data.js';

const KEY = 'argus.settings';
const ENV_URL = import.meta.env.VITE_API_URL || '';
const ENV_KEY = import.meta.env.VITE_API_KEY || '';

export function getSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  const localUrl = window.ARGUS_LOCAL ? location.origin : '';
  const url = (s.url ?? (localUrl || ENV_URL)).replace(/\/+$/, '');
  const useLocalKey = localUrl && url === localUrl;
  return {
    url,
    key: (useLocalKey ? window.ARGUS_LOCAL?.key : undefined) ?? s.key ?? ENV_KEY,
    poll: Math.max(500, Math.min(10000, Number(s.poll) || 1500)),
  };
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export const isLive = () => !!getSettings().url;

export async function checkConnection() {
  const { url, key } = getSettings();
  if (!url) return { ready: false, reason: 'no_server' };
  try {
    const r = await fetch(`${url}/api/v1/health`, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(10000) });
    if (r.status === 401 || r.status === 403) return { ready: false, reason: 'auth' };
    if (r.status === 404) return { ready: false, reason: 'endpoint' };
    if (!r.ok) return { ready: false, reason: 'server', status: r.status };
    let data;
    try { data = await r.json(); } catch { return { ready: false, reason: 'response' }; }
    return { ready: data.ready === true, reason: data.ready === true ? null : data.reason || 'model' };
  } catch (error) {
    return { ready: false, reason: error.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}
export const ping = async () => (await checkConnection()).ready;

/**
 * analyze(file, { onPhase(phase), onProgress(pct), onLog(msg, cls), onFrame(canvas), signal })
 * resolves with the job result object (spec format).
 */
export function analyze(file, hooks) {
  return isLive() ? analyzeLive(file, hooks) : analyzeDemo(file, hooks);
}

// ---------------- LIVE ----------------
async function analyzeLive(file, { onPhase, onProgress, onLog, signal }) {
  const { url, key, poll } = getSettings();
  onPhase('upload');
  onLog(`POST ${url}/api/v1/analyze`, 'c');
  const jobId = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${url}/api/v1/analyze`);
    xhr.setRequestHeader('X-API-Key', key);
    xhr.timeout = 300000;
    xhr.ontimeout = () => reject(new Error('Загрузка превысила время ожидания. Проверьте соединение.'));
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 35);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).job_id); } catch { reject(new Error('Bad JSON from /analyze')); }
      } else reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    };
    xhr.onerror = () => reject(new Error('Network error (CORS / HTTPS / server down?)'));
    signal?.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')); });
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
  onLog(`job_id = ${jobId}`, 'c');
  onPhase('queue');

  const started = Date.now();
  onPhase('detect');
  onProgress(null);
  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (Date.now() - started > 300000) throw new Error('Превышено время ожидания проверки (5 минут).');
    await sleep(Math.max(500, Math.min(10000, Number(poll) || 1500)));
    const r = await fetch(`${url}/api/v1/jobs/${encodeURIComponent(jobId)}`, { headers: { 'X-API-Key': key }, signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} on /jobs`);
    const data = await r.json();
    const elapsed = (Date.now() - started) / 1000;
    onLog(`GET /jobs/${jobId} → ${data.status} (${elapsed.toFixed(1)}s)`);
    if (!['processing', 'done', 'failed'].includes(data.status)) throw new Error('Неожиданный ответ сервера.');
    if (data.status === 'done' && (!Array.isArray(data.violations) || !['violation', 'no_violation'].includes(data.verdict) || Boolean(data.violations.length) !== (data.verdict === 'violation'))) throw new Error('Сервер вернул неполный результат.');
    if (data.status === 'done') { onProgress(100); return { ...data, job_id: data.job_id || jobId }; }
    if (data.status === 'failed') throw new Error(data.error || 'Проверка не завершена: ошибка модели или превышено время анализа. Попробуйте снова.');
    // The frozen detector reports no milestones; do not invent a percentage.
    onProgress(typeof data.progress === 'number' ? 35 + data.progress * 0.64 : null);
  }
}

// ---------------- DEMO ----------------
async function analyzeDemo(file, { onPhase, onProgress, onLog, onFrame, signal }) {
  const check = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  video.src = URL.createObjectURL(file);
  const duration = await new Promise((res) => {
    video.onloadedmetadata = () => res(isFinite(video.duration) ? video.duration : 30);
    video.onerror = () => res(30);
    setTimeout(() => res(video.duration || 30), 4000);
  });

  onPhase('upload'); onLog(`[demo] reading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)`);
  for (let p = 0; p <= 30; p += 3) { check(); onProgress(p); await sleep(60); }
  onPhase('queue'); onLog('[demo] job queued · worker-0 (local)', 'c');
  await sleep(500); check();

  onPhase('frames');
  const nThumbs = 10;
  for (let i = 0; i < nThumbs; i++) {
    check();
    const ts = (duration * (i + 0.5)) / nThumbs;
    const c = await grab(video, ts, 180);
    if (c) onFrame(c, ts);
    onLog(`frame @ ${ts.toFixed(2)}s  → tensor[3,640,640]`);
    onProgress(30 + (i / nThumbs) * 30);
  }

  onPhase('detect');
  const seed = hash(file.name + file.size);
  const rnd = mulberry(seed);
  const n = rnd() < 0.35 ? 0 : 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < 12; i++) {
    check();
    const cls = ['cashier', 'client', 'cash', 'hand', 'tray', 'safe'][Math.floor(rnd() * 6)];
    onLog(`detect ${cls.padEnd(8)} conf=${(0.6 + rnd() * 0.4).toFixed(2)}`, i % 5 === 4 ? 'w' : '');
    onProgress(60 + i * 2.2);
    await sleep(140);
  }

  onPhase('rules');
  const violations = [];
  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rnd() * TYPES.length)];
    const tc = +(duration * (0.15 + rnd() * 0.7)).toFixed(1);
    const frames = [];
    for (const dt of [-0.6, 0, 0.6]) {
      const ts = Math.max(0, Math.min(duration - 0.05, tc + dt));
      const c = await grab(video, ts, 640);
      if (c) frames.push({ timestamp_sec: +ts.toFixed(2), image_base64: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
    }
    onLog(`⚠ ${type.code} @ ${tc}s → ${type.rule}`, 'e');
    violations.push({
      type: type.name.ru,
      timecode_sec: tc,
      description: `[DEMO] ${type.desc.ru}`,
      evidence_frames: frames,
      rule_id: type.rule,
      confidence: +(0.7 + rnd() * 0.28).toFixed(2),
    });
  }
  violations.sort((a, b) => a.timecode_sec - b.timecode_sec);
  onProgress(100);
  await sleep(300);
  URL.revokeObjectURL(video.src);
  return {
    job_id: seed.toString(16).slice(0, 8),
    status: 'done',
    verdict: violations.length ? 'violation' : 'no_violation',
    violations,
    demo: true,
  };
}

function grab(video, ts, w) {
  return new Promise((res) => {
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      video.removeEventListener('seeked', done);
      if (!video.videoWidth) return res(null);
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round((w * video.videoHeight) / video.videoWidth);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      res(c);
    };
    video.addEventListener('seeked', done);
    setTimeout(done, 1500);
    try { video.currentTime = ts; } catch { res(null); }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
