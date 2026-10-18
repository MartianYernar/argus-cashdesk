// =========================================================
//  CONTENT CONFIG — edit freely.
//  The ML teammate: put the real violation classes and the
//  verified clauses (пункты) here. `clauseVerified: false`
//  shows a DRAFT badge on the site until someone checks it.
// =========================================================

export const RULES = [
  {
    id: 'nbrk-231',
    title: { ru: 'Правила осуществления кассовых операций', en: 'Rules on cash operations' },
    meta: { ru: 'Постановление Правления НБРК от 29.11.2019 № 231', en: 'NBK Board Resolution No. 231 of 29 November 2019' },
    clause: { ru: 'Применимость зависит от события', en: 'Applicability depends on the event' },
    clauseVerified: false,
    url: 'https://adilet.zan.kz/rus/docs/V1900019680',
  },
  {
    id: 'nbrk-14',
    title: { ru: 'Требования к помещениям банков', en: 'Requirements for bank premises' },
    meta: { ru: 'Постановление Правления НБРК от 24.02.2020 № 14', en: 'NBK Board Resolution No. 14 of 24 February 2020' },
    clause: { ru: 'Применимость зависит от события', en: 'Applicability depends on the event' },
    clauseVerified: false,
    url: 'https://adilet.zan.kz/rus/docs/V2000020075',
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
