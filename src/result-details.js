import { LEGAL_CATALOG } from './legal.js';

export function secondsLabel(value, unit = 'с') {
  return `${Number(value).toFixed(1)} ${unit}`;
}
export function legalDetails(event) {
  const context = LEGAL_CATALOG.events.find(item => item.type === event.type);
  if (!context) return { context: null, sources: [] };
  const sources = (context.sources || []).map(ref => {
    const act = LEGAL_CATALOG.sources.find(source => source.id === ref.act);
    return { document: act?.title_ru || ref.act, clause: ref.clause, url: ref.url };
  });
  return { context, sources };
}
export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
