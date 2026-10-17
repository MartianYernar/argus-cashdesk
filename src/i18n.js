// RU text lives in the HTML; EN overrides live here.
const EN = {
  'nav.how': 'How it works', 'nav.analyze': 'Analyze', 'nav.types': 'Violations', 'nav.rules': 'Rules', 'nav.api': 'API',
  'hero.eyebrow': 'AI service · fully local · zero cloud',
  'hero.t1': 'A hundred eyes', 'hero.t2': 'on every', 'hero.t3': 'cash desk.',
  'hero.sub': 'ARGUS watches cash-desk footage, finds signs of cash-discipline violations and shows the evidence frame, the timecode and the rule — in seconds, not hours.',
  'hero.cta': 'Upload video', 'hero.cta2': 'How it works', 'hero.scroll': 'Scroll',
  'stats.videos': 'videos in the training set', 'stats.viol': 'clips with a violation', 'stats.min': 'min',
  'stats.limit': 'limit to process one video', 'stats.cloud': 'calls to cloud AI',
  'how.eyebrow': 'Pipeline', 'how.title': 'From file to verdict',
  'how.sub': 'Four steps. Zero clouds. Every finding comes with a frame a human can check.',
  'how.s1t': 'Upload .mov', 'how.s1p': 'Drop footage from the overhead camera. The video never leaves the perimeter — it is processed on the team server.',
  'how.s2t': 'Frame slicing', 'how.s2p': 'The video is split into time-stamped frames. Every frame is potential evidence.',
  'how.s3t': 'Event detection', 'how.s3p': 'A local model looks for visible actions: who is where, what is in hand, what is left unattended.',
  'how.s4t': 'Verdict + rule', 'how.s4p': 'Type, timecode, 1–3 evidence frames, a description and a link to the clause of a Kazakhstan regulation.',
  'how.end': 'Done.<br/>Review.', 'how.go': 'To analyzer',
  'an.eyebrow': 'Analyzer', 'an.title': 'Feed the eye a video',
  'an.sub': '.mov format, ~29 MB. The result is a hint for a reviewer, not a final verdict.',
  'an.drop': 'Drop a .mov here', 'an.or': 'or click to pick a file',
  'an.hint': 'In DEMO mode the result is generated in the browser to showcase the UI. Connect a backend in ⚙ settings.',
  'an.cancel': 'Cancel',
  'ph.upload': 'Uploading file', 'ph.queue': 'Queued', 'ph.frames': 'Extracting frames', 'ph.detect': 'Detecting events', 'ph.rules': 'Matching rules',
  'res.time': 'time', 'res.count': 'events', 'res.again': 'Check another', 'res.json': 'Download JSON', 'res.copy': 'Copy JSON',
  'res.disc': '⚠ The result is a hint for human review, not a final legal or disciplinary conclusion.',
  'err.retry': 'Try again',
  'ty.eyebrow': 'Event classes', 'ty.title': 'What ARGUS sees',
  'ty.sub': 'Only what is visible on video. No conclusions about postings, reconciliations or data outside the frame. No face recognition.',
  'ru.eyebrow': 'Regulatory base', 'ru.title': 'Every flag has a source',
  'ru.sub': 'Source → rule → observed fragment. Only acts of the Republic of Kazakhstan (NBK, adilet.zan.kz).',
  'ru.c1': 'RK regulation', 'ru.c2': 'Clause / section', 'ru.c3': 'Frame + timecode',
  'ar.eyebrow': 'Architecture', 'ar.title': 'Inside the bank perimeter',
  'api.title': 'For jury and machines', 'api.sub': 'Two steps: upload the video and fetch the result. Key goes in the X-API-Key header.',
  'api.e1': 'multipart field <b>file</b> (.mov) → <b>job_id</b>', 'api.e2': '<b>processing</b> · <b>done</b> · <b>failed</b> + result',
  'ft.eyebrow': 'Ready to see everything?', 'ft.local': '100% local processing · no face recognition', 'ft.top': 'Back to top ↑',
  'st.eyebrow': 'Connection', 'st.title': 'Model backend',
  'st.sub': 'Leave URL empty for DEMO mode. Point it to a server implementing the spec API for LIVE mode.',
  'st.poll': 'Poll interval, ms', 'st.save': 'Save', 'st.test': 'Test connection',
};

// strings used from JS
const DYN = {
  ru: {
    verdictBad: 'Обнаружены признаки возможных нарушений', verdictGood: 'Нарушение не обнаружено',
    subBad: (n) => `Найдено событий: ${n}. Проверьте кадры-доказательства ниже.`,
    subGood: 'Визуально наблюдаемых признаков нарушений не выявлено.',
    cleanTitle: 'Чисто', cleanText: 'Модель не нашла событий, требующих внимания.',
    rule: 'НОРМА', confidence: 'уверенность', noRule: 'Источник не указан моделью',
    copied: 'JSON скопирован ✓', saved: 'Настройки сохранены ✓', badFile: 'Нужен видеофайл (.mov)',
    testOk: 'Сервер отвечает ✓', testBad: 'Нет ответа от сервера', demoTag: 'DEMO · сгенерировано в браузере',
    jumpTo: 'Перейти к', liveMode: 'LIVE', demoMode: 'DEMO',
  },
  en: {
    verdictBad: 'Signs of possible violations found', verdictGood: 'No violation detected',
    subBad: (n) => `Events found: ${n}. Review the evidence frames below.`,
    subGood: 'No visually observable signs of violations.',
    cleanTitle: 'Clean', cleanText: 'The model found no events that need attention.',
    rule: 'RULE', confidence: 'confidence', noRule: 'No source returned by the model',
    copied: 'JSON copied ✓', saved: 'Settings saved ✓', badFile: 'A video file (.mov) is required',
    testOk: 'Server responds ✓', testBad: 'No response from server', demoTag: 'DEMO · generated in browser',
    jumpTo: 'Jump to', liveMode: 'LIVE', demoMode: 'DEMO',
  },
};

let lang = 'ru';
try { lang = localStorage.getItem('argus.lang') || 'ru'; } catch {}
const RU = {};
const listeners = [];

export const getLang = () => lang;
export const t = (key, ...args) => {
  const v = DYN[lang][key];
  return typeof v === 'function' ? v(...args) : v;
};
export const pick = (obj) => (obj && typeof obj === 'object' ? obj[lang] ?? obj.ru : obj);
export const onLang = (fn) => listeners.push(fn);

export function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { RU[el.dataset.i18n] = el.innerHTML; });
  if (lang !== 'ru') apply();
}

function apply() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    const v = lang === 'ru' ? RU[k] : EN[k] ?? RU[k];
    if (v != null) el.innerHTML = v;
  });
  listeners.forEach((fn) => fn(lang));
}

export function toggleLang() {
  lang = lang === 'ru' ? 'en' : 'ru';
  try { localStorage.setItem('argus.lang', lang); } catch {}
  apply();
}
