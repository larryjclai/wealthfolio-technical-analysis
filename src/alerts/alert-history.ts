import { parseRules, stopPrice, TrailingStop } from './trailing-stop';

export const eventLabels = {
  enabled: '啟用追蹤', updated: '修改設定', reset: '重新追蹤', disabled: '停用追蹤',
  triggered: '達到提醒條件', acknowledged: '確認提醒', review_required: '暫停：需核對價格',
  fetch_failed: '行情更新失敗', fetch_recovered: '行情更新恢復',
  monitor_enabled: '恢復背景監控（舊版）', monitor_disabled: '暫停背景監控（舊版）',
  imported_trigger: '匯入舊版觸發紀錄',
} as const;
export type AlertEventType = keyof typeof eventLabels;
export interface AlertEvent {
  id: string;
  type: AlertEventType;
  recordedAt: string;
  symbol?: string;
  displayName?: string;
  currency?: string;
  tradingDate?: string;
  quoteFetchedAt?: string;
  percent?: number;
  peak?: number;
  price?: number;
  threshold?: number;
  detail?: string;
}
export interface AlertSnapshot {
  version: 2;
  rules: TrailingStop[];
  events: AlertEvent[];
  droppedEvents: number;
  monitorEnabled: boolean; // Legacy field, retained for saved-data compatibility only.
  dailyScans: Record<string, string>;
  failures: Record<string, string>;
}
export const MAX_HISTORY = 300;
const MAX_BYTES = 220_000; // Leave headroom below the host's ~250 KB per-key limit.
export function alertEvent(type: AlertEventType, rule?: TrailingStop, detail?: string): AlertEvent {
  return {
    id: crypto.randomUUID(), type, recordedAt: new Date().toISOString(), detail: detail?.slice(0, 400),
    ...(rule && {
      symbol: rule.instrument.providerSymbol, displayName: rule.displayName, currency: rule.instrument.currency,
      tradingDate: rule.lastTradingDate, quoteFetchedAt: rule.checkedAt,
      percent: rule.percent, peak: rule.peak, price: rule.lastPrice, threshold: stopPrice(rule),
      ...((type === 'triggered' || type === 'imported_trigger') && {
        tradingDate: rule.triggeredAt, price: rule.triggeredPrice, threshold: rule.triggeredStop, peak: rule.triggeredPeak,
      }),
    }),
  };
}
export function parseSnapshot(raw: string | null): AlertSnapshot {
  const empty: AlertSnapshot = { version: 2, rules: [], events: [], droppedEvents: 0, monitorEnabled: false, dailyScans: {}, failures: {} };
  if (raw === null) return empty;
  const value = JSON.parse(raw);
  if (value.version === 1) {
    const rules = parseRules(raw);
    return { ...empty, rules, events: rules.filter(r => r.triggeredAt).map(r => alertEvent('imported_trigger', r, '舊版只保留最近一次觸發；記錄時間為匯入時間。')) };
  }
  if (value.version !== 2 || !Array.isArray(value.events) || typeof value.monitorEnabled !== 'boolean'
    || !Number.isSafeInteger(value.droppedEvents) || value.droppedEvents < 0
    || !value.failures || typeof value.failures !== 'object' || Array.isArray(value.failures)
    || Object.values(value.failures).some(v => typeof v !== 'string')) throw new Error('提醒歷史格式不相容，原始資料已保留');
  if (value.dailyScans !== undefined && (!value.dailyScans || typeof value.dailyScans !== 'object' || Array.isArray(value.dailyScans)
    || Object.values(value.dailyScans).some(date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)))) throw new Error('每日掃描紀錄損毀，原始資料已保留');
  const ids = new Set<string>();
  for (const event of value.events) {
    if (!event || typeof event.id !== 'string' || ids.has(event.id) || !Object.prototype.hasOwnProperty.call(eventLabels, event.type)
      || typeof event.recordedAt !== 'string' || !Number.isFinite(Date.parse(event.recordedAt))
      || ['percent', 'peak', 'price', 'threshold'].some(key => event[key] !== undefined && !Number.isFinite(event[key]))
      || ['symbol', 'displayName', 'currency', 'tradingDate', 'quoteFetchedAt', 'detail'].some(key => event[key] !== undefined && typeof event[key] !== 'string')) {
      throw new Error('提醒歷史資料損毀，原始資料已保留');
    }
    ids.add(event.id);
  }
  return {
    version: 2, rules: parseRules(JSON.stringify({ version: 1, rules: value.rules })),
    events: value.events, droppedEvents: value.droppedEvents,
    monitorEnabled: false, dailyScans: value.dailyScans ?? {}, failures: value.failures,
  };
}
export function appendEvents(snapshot: AlertSnapshot, additions: AlertEvent[]): AlertSnapshot {
  const events = [...snapshot.events, ...additions];
  let droppedEvents = snapshot.droppedEvents;
  const limit = Math.max(0, events.length - MAX_HISTORY);
  events.splice(0, limit); droppedEvents += limit;
  const result = { ...snapshot, events, droppedEvents };
  while (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BYTES) {
    if (!events.length) throw new Error('提醒設定超過儲存容量，請先減少追蹤股票');
    events.shift(); result.droppedEvents++;
  }
  return result;
}
