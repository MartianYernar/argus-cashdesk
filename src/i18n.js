// RU text lives in the HTML (data-i18n); EN overrides + JS strings live here.
const EN = {
  'hero.eyebrow': 'SECURITY REVIEW WORKSPACE', 'hero.title': 'Attention to detail.<br><em>Peace of mind at work.</em>', 'hero.side': 'Technology notices.<br>You make the decision.', 'hero.privacy': 'Local processing · No face recognition',
  'ws.eyebrow': 'OVERVIEW & REVIEW', 'ws.title': 'Workspace', 'ws.sub': 'Every event under your control', 'q.title': 'Recordings', 'q.subtitle': 'Your review queue', 'bar.help': 'Help', 'v.start': 'START WITH A RECORDING', 'v.choose': 'Choose video ＋',
  'step.1': 'Add a video', 'step.1sub': 'Cash-desk camera recording', 'step.2': 'Review events', 'step.2sub': 'Evidence, time and rule', 'step.3': 'Make a decision', 'step.3sub': 'Confirm or dismiss',

  'hero.sub': 'A hundred eyes on every cash desk. ARGUS reviews cash-desk footage, finds signs of cash-discipline violations and shows the evidence frame, the timecode and the Kazakhstan rule — in seconds, not hours.',
  'hero.u1': 'drop .mov into the workspace       → verdict, timecode, frames, rule',
  'hero.u2': 'confirm or dismiss every event     → daily CSV report',
  'hero.cta': 'open workspace',
  'bar.export': 'CSV report',
  'q.add': 'add videos', 'q.clear': 'clear history',
  'f.all': 'all', 'f.pending': 'to review', 'f.flagged': 'flagged', 'f.clean': 'clean',
  'v.drop': 'DROP .MOV FILES', 'v.dropsub': 'several at once is fine — they will queue up',
  'v.cancel': 'cancel', 'v.retry': 'retry',
  'v.reattach': 'video is not in memory after reload — drop or pick the same file to replay',
  'v.disc': '# The result is a hint for human review, not a final legal or disciplinary conclusion.',
  'ft.local': '100% local · no face recognition',
  'st.sub': 'Empty URL → DEMO. Server implementing the spec API → LIVE.',
};

const DYN = {
  ru: {
    emptyQueue: 'Здесь появятся добавленные записи. Выберите видео, чтобы начать проверку.', cardChecked: 'Обработано сегодня', cardPending: 'Ожидают вашего решения', cardConfirmed: 'Подтверждено событий', liveMode: 'Сервер подключён', demoMode: 'Демо · Настройки',
    bad: 'Требует внимания', ok: 'Без замечаний', pend: 'К ПРОВЕРКЕ', reviewed: 'ПРОВЕРЕНО', queued: 'в очереди', proc: 'анализ', fail: 'ошибка',
    verdictBad: 'Обнаружены признаки возможных нарушений', verdictGood: 'Нарушение не обнаружено',
    events: (n) => `${n} событ.`, confirm: 'Подтвердить нарушение', dismiss: 'Отклонить событие', note: 'комментарий проверяющего…',
    rule: 'НОРМА', noRule: 'источник не указан моделью', confidence: 'уверенность',
    cleanText: 'Модель не нашла событий, требующих внимания.',
    today: (a) => `${a.checked} проверено · ${a.flagged} с нарушением · ${a.pending} ждут проверки`,
    stChecked: 'проверено', stFlagged: 'нарушения', stPending: 'к проверке', stConfirmed: 'подтверждено', stQueue: 'в очереди',
    copied: 'скопировано ✓', saved: 'настройки сохранены ✓', badFile: 'нужен видеофайл (.mov)', added: (n) => `в очередь: ${n}`,
    testOk: 'сервер отвечает ✓', testBad: 'нет ответа от сервера', demoTag: 'DEMO', clearAsk: 'Удалить всю историю проверок?',
    noExport: 'нет проверок за сегодня', allDone: 'очередь разобрана ✓', wrongFile: 'другой файл — имя не совпадает',
    keys: `<b>U</b>        добавить видео           <b>J / K</b>    след. / пред. видео
<b>N</b>        следующее к проверке     <b>/</b>        поиск
<b>Space</b>    пауза / воспроизведение  <b>← →</b>      ±2 сек
<b>1–9</b>      перейти к событию        <b>[ ]</b>      пред. / след. событие
<b>C</b>        подтвердить событие      <b>X</b>        отклонить событие
<b>E</b>        отчёт за день (CSV)      <b>S</b>        JSON результата
<b>Del</b>      удалить из истории       <b>?</b>        эта справка`,
  },
  en: {
    emptyQueue: 'Your recordings will appear here. Add a video to begin.', cardChecked: 'Processed today', cardPending: 'Awaiting your decision', cardConfirmed: 'Confirmed events', liveMode: 'Server connected', demoMode: 'Demo · Settings',
    bad: 'VIOLATION', ok: 'CLEAN', pend: 'TO REVIEW', reviewed: 'REVIEWED', queued: 'queued', proc: 'analyzing', fail: 'failed',
    verdictBad: 'Signs of possible violations found', verdictGood: 'No violation detected',
    events: (n) => `${n} event${n === 1 ? '' : 's'}`, confirm: 'confirm', dismiss: 'dismiss', note: 'reviewer note…',
    rule: 'RULE', noRule: 'no source returned by the model', confidence: 'confidence',
    cleanText: 'The model found no events that need attention.',
    today: (a) => `${a.checked} checked · ${a.flagged} flagged · ${a.pending} pending review`,
    stChecked: 'checked', stFlagged: 'flagged', stPending: 'to review', stConfirmed: 'confirmed', stQueue: 'queued',
    copied: 'copied ✓', saved: 'settings saved ✓', badFile: 'a video file (.mov) is required', added: (n) => `queued: ${n}`,
    testOk: 'server responds ✓', testBad: 'no response from server', demoTag: 'DEMO', clearAsk: 'Delete the whole review history?',
    noExport: 'no reviews today', allDone: 'queue cleared ✓', wrongFile: 'different file — name does not match',
    keys: `<b>U</b>        add videos               <b>J / K</b>    next / prev video
<b>N</b>        next to review           <b>/</b>        search
<b>Space</b>    play / pause             <b>← →</b>      ±2 sec
<b>1–9</b>      jump to event            <b>[ ]</b>      prev / next event
<b>C</b>        confirm event            <b>X</b>        dismiss event
<b>E</b>        daily report (CSV)       <b>S</b>        result JSON
<b>Del</b>      delete from history      <b>?</b>        this help`,
  },
};

let lang = 'ru';
try { lang = localStorage.getItem('argus.lang') || 'ru'; } catch {}
const RU = {};
const listeners = [];

export const getLang = () => lang;
export const t = (key, ...args) => { const v = DYN[lang][key]; return typeof v === 'function' ? v(...args) : v; };
export const pick = (obj) => (obj && typeof obj === 'object' ? obj[lang] ?? obj.ru : obj);
export const onLang = (fn) => listeners.push(fn);

export function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { RU[el.dataset.i18n] = el.innerHTML; });
  apply();
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
