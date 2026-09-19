import { Instrument, HistoryResult } from '../market-data/types';

export interface TrailingStop {
  instrument: Instrument;
  displayName: string;
  percent: number;
  peak: number;
  startedAt: string;
  startTradingDate: string;
  startSessionHigh: number;
  lastPrice: number;
  lastTradingDate: string;
  checkedAt: string;
  triggeredAt?: string;
  triggeredPrice?: number;
  triggeredStop?: number;
  triggeredPeak?: number;
  acknowledged?: boolean;
  needsReview?: string;
}
/** Daily alerts never use an unfinished or unknown-completion bar. */
export function closedHistory(history: HistoryResult): HistoryResult {
  const bars = history.bars.filter(bar => bar.completion === 'closed');
  return { ...history, bars, meta: { ...history.meta, latestTradingDate: bars.at(-1)?.tradingDate ?? null } };
}

export const stopPrice = (rule: TrailingStop) => rule.peak * (1 - rule.percent / 100);
export const drawdown = (rule: TrailingStop) => Math.max(0, (rule.peak - rule.lastPrice) / rule.peak * 100);
export function validatePercent(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) throw new Error('回落百分比必須大於 0 且小於 100');
}
export function createTrailingStop(instrument: Instrument, displayName: string, percent: number, history: HistoryResult, peak?: number, now = new Date().toISOString()): TrailingStop {
  validatePercent(percent);
  const latest = history.bars[history.bars.length - 1];
  if (!latest) throw new Error('請先載入有效報價');
  if (peak !== undefined && (!Number.isFinite(peak) || peak < latest.close)) throw new Error('起始高點須大於或等於最新價格');
  return {
    instrument, displayName, percent, peak: peak ?? latest.close, startedAt: now,
    startTradingDate: latest.tradingDate, startSessionHigh: latest.high,
    lastPrice: latest.close, lastTradingDate: latest.tradingDate, checkedAt: history.meta.fetchedAt,
  };
}

/** Compare closes in chronological order; daily lows cannot establish intraday event order. */
export function evaluateTrailingStop(rule: TrailingStop, history: HistoryResult): TrailingStop {
  if (history.meta.providerSymbol !== rule.instrument.providerSymbol) throw new Error('股票資料與追蹤設定不符');
  const latest = history.bars[history.bars.length - 1];
  if (!latest || latest.tradingDate < rule.lastTradingDate || history.meta.fetchedAt < rule.checkedAt) return rule;
  if (rule.needsReview) return rule;
  if (history.meta.splitDates?.some(time => time * 1000 > Date.parse(rule.startedAt))) {
    return { ...rule, needsReview: '追蹤期間發生拆股／併股，請確認價格後重新開始追蹤。' };
  }
  let next = { ...rule };
  for (const bar of history.bars) {
    if (bar.tradingDate < rule.lastTradingDate) continue;
    // A daily bar includes highs from before activation. Only accept a new session high
    // on activation day, or a price actually observed after activation.
    const high = bar.tradingDate === rule.startTradingDate && bar.high <= rule.startSessionHigh ? bar.close : bar.high;
    next.peak = Math.max(next.peak, high);
    const threshold = stopPrice(next);
    if (!next.triggeredAt && bar.close <= threshold) {
      next.triggeredAt = bar.tradingDate;
      next.triggeredPrice = bar.close;
      next.triggeredStop = threshold;
      next.triggeredPeak = next.peak;
      next.acknowledged = false;
    }
  }
  next.lastPrice = latest.close;
  next.lastTradingDate = latest.tradingDate;
  next.checkedAt = history.meta.fetchedAt;
  return next;
}

export function parseRules(raw: string | null): TrailingStop[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.rules)) throw new Error('移動停利設定格式不相容，原始資料已保留');
  const symbols = new Set<string>();
  for (const rule of data.rules) {
    validatePercent(rule.percent);
    if (!rule.instrument?.providerSymbol || !['TWSE', 'TPEX', 'US'].includes(rule.instrument.market)
      || !rule.instrument.timezone || !Number.isFinite(rule.peak) || rule.peak <= 0
      || !Number.isFinite(rule.lastPrice) || rule.lastPrice <= 0
      || !Number.isFinite(rule.startSessionHigh) || rule.startSessionHigh <= 0
      || !Number.isFinite(Date.parse(rule.startedAt)) || !Number.isFinite(Date.parse(rule.checkedAt))
      || !/^\d{4}-\d{2}-\d{2}$/.test(rule.startTradingDate) || !/^\d{4}-\d{2}-\d{2}$/.test(rule.lastTradingDate)
      || symbols.has(rule.instrument.providerSymbol)) throw new Error('移動停利設定損毀，原始資料已保留');
    symbols.add(rule.instrument.providerSymbol);
  }
  return data.rules;
}
