// =========================================================
//  CONTENT CONFIG — edit freely.
//  The ML teammate: put the real violation classes and the
//  verified clauses (пункты) here. `clauseVerified: false`
//  shows a DRAFT badge on the site until someone checks it.
// =========================================================

export const RULES = [
  {
    id: 'nbrk-231',
    title: {
      ru: 'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей',
      en: 'Rules on cash operations and cash-in-transit of banknotes, coins and valuables',
    },
    meta: {
      ru: 'Постановление Правления НБРК от 29.11.2019 № 231 · рег. V1900019680',
      en: 'NBK Board Resolution of 29.11.2019 No. 231 · reg. V1900019680',
    },
    clause: { ru: 'пункт — уточнить', en: 'clause — to verify' },
    clauseVerified: false,
    url: 'https://adilet.zan.kz/rus/docs/V1900019680',
  },
  {
    id: 'law-banks',
    title: {
      ru: 'Закон РК «О банках и банковской деятельности в Республике Казахстан»',
      en: 'Law of RK “On Banks and Banking Activity in the Republic of Kazakhstan”',
    },
    meta: { ru: 'от 31.08.1995 № 2444', en: 'of 31.08.1995 No. 2444' },
    clause: { ru: 'статья — уточнить', en: 'article — to verify' },
    clauseVerified: false,
    url: 'https://adilet.zan.kz/rus/docs/Z950002444_',
  },
];

// Example classes so the UI has something to render.
// Replace with the classes the model actually outputs.
export const TYPES = [
  {
    code: 'V-01', icon: '💸', rule: 'nbrk-231',
    name: { ru: 'Ценности без присмотра', en: 'Valuables left unattended' },
    desc: { ru: 'Наличные или ценности остаются открытыми на рабочем месте, когда кассира нет в кадре.', en: 'Cash or valuables stay exposed at the desk while the cashier is out of frame.' },
    cues: ['cash_visible', 'cashier_absent', 'Δt > N s'],
  },
  {
    code: 'V-02', icon: '🚪', rule: 'nbrk-231',
    name: { ru: 'Посторонний в кассовой зоне', en: 'Unauthorized person in cash zone' },
    desc: { ru: 'В зоне, закрытой для клиентов, появляется человек, не являющийся кассиром или инкассатором.', en: 'Someone other than the cashier or cash-in-transit staff enters the restricted area.' },
    cues: ['zone_polygon', 'person_count', 'role'],
  },
  {
    code: 'V-03', icon: '🙈', rule: 'nbrk-231',
    name: { ru: 'Пересчёт вне обзора камеры', en: 'Counting outside camera view' },
    desc: { ru: 'Пересчёт или передача наличных происходит вне зоны видимости камеры или закрыт телом.', en: 'Counting or handover happens out of view or is blocked by the body.' },
    cues: ['hands_occluded', 'cash_track_lost'],
  },
  {
    code: 'V-04', icon: '🤝', rule: 'nbrk-231',
    name: { ru: 'Передача ценностей мимо процедуры', en: 'Handover bypassing procedure' },
    desc: { ru: 'Наличные передаются напрямую из рук в руки, минуя лоток или зону приёма.', en: 'Cash goes hand-to-hand, skipping the tray or the reception area.' },
    cues: ['hand_to_hand', 'tray_unused'],
  },
  {
    code: 'V-05', icon: '🗄️', rule: 'nbrk-231',
    name: { ru: 'Открытое хранилище', en: 'Open safe / cash box' },
    desc: { ru: 'Сейф или кассовый ящик остаётся открытым без контроля продолжительное время.', en: 'The safe or cash drawer stays open and unattended for a long time.' },
    cues: ['safe_state=open', 'no_operator'],
  },
  {
    code: 'V-06', icon: '📱', rule: 'nbrk-231',
    name: { ru: 'Посторонние предметы', en: 'Foreign objects at the desk' },
    desc: { ru: 'Личные вещи или устройства на рабочем месте рядом с наличными.', en: 'Personal items or devices next to the cash on the desk.' },
    cues: ['phone', 'bag', 'near_cash'],
  },
];

export const ruleById = (id) => RULES.find((r) => r.id === id);
export const typeByName = (name) =>
  TYPES.find((t) => t.name.ru === name || t.name.en === name || t.code === name);
