// RU text lives in the HTML (data-i18n); EN overrides + JS strings live here.
const EN = {
  'hero.eyebrow': 'SECURITY REVIEW WORKSPACE', 'hero.title': 'Review recordings.<br><em>Stay in control.</em>', 'hero.side': 'Technology notices.<br>You make the decision.', 'hero.privacy': 'Local processing · No face recognition',
  'ws.eyebrow': 'OVERVIEW & REVIEW', 'ws.title': 'Workspace', 'ws.sub': 'Every event under your control', 'q.title': 'Recordings', 'q.subtitle': 'Your review queue', 'bar.help': 'Help', 'v.start': 'START WITH A RECORDING', 'v.choose': 'Choose video ＋',
  'step.1': 'Add a video', 'step.1sub': 'Cash-desk camera recording', 'step.2': 'Review events', 'step.2sub': 'Evidence, time and rule', 'step.3': 'Make a decision', 'step.3sub': 'Confirm or dismiss',

  'hero.sub': 'Upload a camera recording. ARGUS highlights moments to review, with timestamps and evidence frames. Check the details and make the decision.',
  'hero.u1': 'drop .mov into the workspace       → verdict, timecode, frames, rule',
  'hero.u2': 'confirm or dismiss every event     → daily CSV report',
  'hero.cta': 'Start a review',
  'bar.export': 'CSV report',
  'q.add': 'add videos', 'q.clear': 'clear history',
  'f.all': 'all', 'f.pending': 'to review', 'f.flagged': 'flagged', 'f.clean': 'clean',
  'v.drop': 'Add a camera recording', 'v.dropsub': 'Drop a video here or choose a file. Multiple recordings are processed in order.',
  'v.cancel': 'Stop waiting', 'v.retry': 'retry',
  'v.reattach': 'video is not in memory after reload — drop or pick the same file to replay',
  'v.disc': 'The result is a hint for human review, not a final legal or disciplinary conclusion.',
  'ft.local': '100% local · no face recognition',
  'st.sub': 'Connect a processing server. Without a server, the interface runs in demonstration mode.',
  'brand.sub': 'Cash-desk operations review', 'st.serverWebsite': 'Open the interface on the server ↗', 'st.url': 'Server address', 'st.key': 'API key', 'st.poll': 'Refresh interval, ms', 'st.save': 'Save', 'st.test': 'Test connection', 'close': 'Close', 'v.failed': 'Could not complete analysis', 'v.json': 'Download JSON', 'v.delete': 'Delete',
  'access.title': 'For the jury: enter your API key first', 'access.copy': 'Use the key from the team submission. The server address is prefilled. Real analysis requires a key.', 'access.key': 'API key from the submission', 'access.connect': 'Connect and verify', 'access.hint': 'The key is saved only in this browser. Enter it again on another device. Do not enter a bank password.', 'access.demo': 'View an interface demonstration only', 'result.guide': 'Each event includes a type, time in seconds, evidence frames and related Kazakhstan regulations.',
  'preview.title': 'FROM RECORDING TO DECISION', 'preview.tag': 'Three simple steps',
  'preview.1': 'A recording from your cash-desk camera', 'preview.2': 'A timestamp, frame and description', 'preview.3': 'The final decision is always yours', 'preview.note': 'Processing on your server',
  'v.wait': 'Analysis can take up to five minutes. Keep this tab open.', 'st.title': 'Server connection', 'help.title': 'Help and keyboard shortcuts',
  'help.copy': 'Add a recording, wait for the result and review each event. Decisions and notes are saved in this browser.'

};

const DYN = {
  ru: {
    accessRequired: "Для настоящего анализа нужен API-ключ из заявки команды. Вставьте ключ и проверьте связь. Без ключа загрузка на сервер не начнётся.", keyNeeded: "Введите API-ключ", typeLabel: "Тип события", evidenceLabel: "Кадры-доказательства", secondsUnit: "с", lawLabel: "Связанные нормы Республики Казахстан", lawRelevance: "Связь с событием:", lawEvidence: "Что нужно установить:", lawLimits: "Ограничения:", lawNotice: "Правовой контекст из каталога команды. Наличие события на видео само по себе не доказывает преступление или нарушение закона.",
    connectionAuth: "Сервер отвечает, но ключ доступа неверный или отсутствует. Используйте ключ именно этого сервера.", connectionEndpoint: "Сервер отвечает, но адрес проверки /api/v1/health не найден. Обновите backend и проверьте адрес.", connectionResponse: "По этому адресу получен неожиданный ответ. Проверьте, что указан адрес API, а не сайта на GitHub Pages.", connectionServer: "Сервер или туннель вернул ошибку. Проверьте запуск backend и Cloudflare.", connectionTimeout: "Сервер не ответил за 10 секунд. Проверьте интернет и работу туннеля.", connectionNetwork: "Браузер не смог обратиться к серверу. Проверьте адрес туннеля и доступ CORS для https://martianyernar.github.io.", connectionMissingModel: "Ollama отвечает, но qwen3.5:4b не установлена. Выполните ollama pull qwen3.5:4b на сервере.", connectionOllama: "Backend отвечает, но Ollama недоступна. Запустите Ollama на компьютере с моделью.",
    connecting: "Проверяем связь…", connectingText: "Проверяем доступность сервера и установленной модели.", demoTitle: "Демонстрация интерфейса", demoText: "Сервер анализа не подключён. Результаты в этом режиме учебные и не являются выводами модели.", configure: "Настроить сервер", offline: "Сервер недоступен", offlineTitle: "Проверьте подключение к серверу", offlineText: "Не удалось подтвердить готовность модели. Проверьте адрес, ключ и запуск Ollama на сервере.", readyTitle: "Можно начинать проверку", readyText: "Сервер отвечает, модель установлена. Записи обрабатываются по одной; результат проверяет сотрудник.", invalidUrl: "Введите полный адрес сервера: https://example.com, без ключа и параметров в адресе.", httpsRequired: "Для этого сайта нужен HTTPS-адрес сервера.", cancelled: "Ожидание остановлено. Уже принятый сервером анализ может продолжаться.", interrupted: "Проверка прервана перезагрузкой страницы. Выберите тот же файл и повторите.", noMatches: "По вашему запросу записей нет. Измените поиск или фильтр.",
    emptyQueue: 'Здесь появятся добавленные записи. Выберите видео, чтобы начать проверку.', cardChecked: 'Обработано сегодня', cardPending: 'Ожидают вашего решения', cardConfirmed: 'Подтверждено событий', liveMode: 'Сервер готов', demoMode: 'Демо · Настройки',
    bad: 'Требует внимания', ok: 'Без замечаний', pend: 'К ПРОВЕРКЕ', reviewed: 'ПРОВЕРЕНО', queued: 'в очереди', proc: 'анализ', fail: 'ошибка',
    verdictBad: 'Обнаружены признаки возможных нарушений', verdictGood: 'Нарушение не обнаружено',
    events: (n) => `${n} событ.`, confirm: 'Подтвердить нарушение', dismiss: 'Отклонить событие', note: 'комментарий проверяющего…',
    rule: 'НОРМА', noRule: 'Проверенное правовое основание для этого события не установлено.', confidence: 'уверенность',
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
    accessRequired: "Paste the API key from the team submission, then choose Connect and verify. Uploads cannot start without the key.", keyNeeded: "Enter the API key", typeLabel: "Event type", evidenceLabel: "Evidence frames", secondsUnit: "s", lawLabel: "Related Kazakhstan regulations", lawRelevance: "Relevance:", lawEvidence: "Evidence required:", lawLimits: "Limitations:", lawNotice: "Legal context comes from the team catalogue. A video event alone does not establish a crime or breach of law.",
    connectionAuth: "The server responds, but the API key is missing or incorrect. Use the key for this server.", connectionEndpoint: "The server responds, but /api/v1/health was not found. Update the backend and check the URL.", connectionResponse: "Unexpected response. Use the API server address, not the GitHub Pages website.", connectionServer: "The server or tunnel returned an error. Check the backend and Cloudflare.", connectionTimeout: "No response within 10 seconds. Check the internet connection and tunnel.", connectionNetwork: "The browser could not reach the API. Check the tunnel URL and CORS access for https://martianyernar.github.io.", connectionMissingModel: "Ollama responds, but qwen3.5:4b is missing. Run ollama pull qwen3.5:4b on the server.", connectionOllama: "The backend responds, but Ollama is unavailable. Start Ollama on the model computer.",
    connecting: "Checking connection…", connectingText: "Checking the server and installed model.", demoTitle: "Interface demonstration", demoText: "No processing server is connected. Results in this mode are illustrative, not model findings.", configure: "Server settings", offline: "Server unavailable", offlineTitle: "Check your server connection", offlineText: "Model readiness could not be confirmed. Check the address, API key and Ollama on the server.", readyTitle: "Ready to review", readyText: "The server responds and the model is installed. Recordings run one at a time; a person reviews the result.", invalidUrl: "Enter a complete server address such as https://example.com, without credentials or query parameters.", httpsRequired: "This website needs an HTTPS server address.", cancelled: "Stopped waiting. Analysis already accepted by the server may continue.", interrupted: "The page reloaded during analysis. Choose the same file and try again.", noMatches: "No recordings match. Change your search or filter.",
    emptyQueue: 'Your recordings will appear here. Add a video to begin.', cardChecked: 'Processed today', cardPending: 'Awaiting your decision', cardConfirmed: 'Confirmed events', liveMode: 'Server ready', demoMode: 'Demo · Settings',
    bad: 'VIOLATION', ok: 'CLEAN', pend: 'TO REVIEW', reviewed: 'REVIEWED', queued: 'queued', proc: 'analyzing', fail: 'failed',
    verdictBad: 'Signs of possible violations found', verdictGood: 'No violation detected',
    events: (n) => `${n} event${n === 1 ? '' : 's'}`, confirm: 'confirm', dismiss: 'dismiss', note: 'reviewer note…',
    rule: 'RULE', noRule: 'A verified legal basis has not been established for this event.', confidence: 'confidence',
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
try { lang = localStorage.getItem('argus.lang') === 'en' ? 'en' : 'ru'; } catch {}
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
