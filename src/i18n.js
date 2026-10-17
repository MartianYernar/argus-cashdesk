// RU text lives in the HTML; EN overrides live here.
const EN = {
  'hero.cmd': './argus --help',
  'hero.sub': 'A hundred eyes on every cash desk. ARGUS watches cash-desk footage, finds signs of cash-discipline violations and shows the evidence frame, the timecode and the Kazakhstan rule — in seconds, not hours.',
  'hero.u1': 'verdict + timecode + frames + rule', 'hero.u2': 'what it can see', 'hero.u3': 'NBK regulatory base',
  'hero.f1': 'all models inside the perimeter', 'hero.f2': 'zero calls to external AI', 'hero.f3': 'face recognition disabled',
  'hero.cta': 'analyze video', 'hero.cta2': 'man argus',
  'how.sub': 'Four steps. Zero clouds. Every finding comes with a frame a human can check.',
  'how.s1p': 'Overhead cash-desk footage. The video never leaves the perimeter.',
  'how.s2p': 'Split into time-stamped frames.',
  'how.s3p': 'Local model: who is where, what is in hand, what is left unattended.',
  'how.s4p': 'Type, timecode, 1–3 frames, description and the clause of an RK act.',
  'an.sub': '.mov format, ~29 MB. The result is a hint for a reviewer, not a final verdict.',
  'an.drop': 'DROP .MOV HERE', 'an.or': 'or click to pick a file',
  'an.hint': '# DEMO: the result is generated in the browser to showcase the UI. Connect a backend: the DEMO button below or the `connect` command.',
  'an.cancel': 'cancel',
  'res.again': 'analyze another', 'res.json': 'save result.json', 'res.copy': 'yank json',
  'res.disc': '# ⚠ The result is a hint for human review, not a final legal or disciplinary conclusion.',
  'err.retry': 'retry',
  'ty.sub': 'Only what is visible on video. No conclusions about postings or reconciliations. No face recognition.',
  'ru.sub': 'Source → rule → observed fragment. Only acts of the Republic of Kazakhstan (NBK, adilet.zan.kz).',
  'ar.sub': 'Everything runs inside the bank perimeter. After the weights are loaded, no internet is needed.',
  'api.sub': 'Two steps: upload the video and fetch the result. Key goes in the X-API-Key header.',
  'api.e1': 'multipart field file (.mov) → job_id', 'api.e2': 'processing · done · failed + result', 'api.e3': 'no key → 401',
  'sh.sub': 'Yes, this is a real shell. Type help.',
  'ft.local': '100% local processing · no face recognition',
  'st.sub': 'Empty URL → DEMO. Server implementing the spec API → LIVE.', 'st.save': 'save', 'st.test': 'test',
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
