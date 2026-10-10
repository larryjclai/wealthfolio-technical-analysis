import { Bar } from '../market-data/types';
import { sma } from './sma';
import { supportResistance } from './support-resistance';

export interface Observation {
  kind: 'add' | 'hold' | 'reduce' | 'watch' | 'insufficient';
  label: string;
  reasons: string[];
  tradingDate: string | null;
  crossedAboveSma20: boolean;
  crossedBelowSma20: boolean;
}

const labels: Record<Observation['kind'], string> = {
  add: '加碼觀察', hold: '續抱觀察', reduce: '減碼檢查', watch: '待觀察', insufficient: '資料不足',
};
const level = (value: number) => value.toLocaleString('zh-TW', { maximumSignificantDigits: 6 });

/** Closed daily candles only; 5-session MA slopes, 3% maximum extension for add setups. */
export function analyzeObservation(bars: Bar[]): Observation {
  const closed = bars.filter(bar => bar.completion === 'closed');
  const latest = closed[closed.length - 1];
  const previous = closed[closed.length - 2];
  const closes = closed.map(bar => bar.close);
  const index = closes.length - 1;
  const ma20 = sma(closes, 20), ma60 = sma(closes, 60), ma240 = sma(closes, 240);
  const current20 = ma20[index] ?? null, previous20 = ma20[index - 1] ?? null;
  const current60 = ma60[index] ?? null, prior60 = ma60[index - 5] ?? null;
  const current240 = ma240[index] ?? null, prior240 = ma240[index - 5] ?? null;
  const crossedAboveSma20 = !!previous && current20 !== null && previous20 !== null
    && previous.close <= previous20 && latest.close > current20;
  const crossedBelowSma20 = !!previous && current20 !== null && previous20 !== null
    && previous.close >= previous20 && latest.close < current20;
  const result = (kind: Observation['kind'], reasons: string[]): Observation => ({
    kind, label: labels[kind], reasons, tradingDate: latest?.tradingDate ?? null,
    crossedAboveSma20, crossedBelowSma20,
  });
  if (!latest) return result('insufficient', ['沒有已確認收盤的日 K，尚無法判斷']);

  const price = `${latest.tradingDate} 收盤 ${level(latest.close)}`;
  const support = supportResistance(closed).support;
  const risks: string[] = [];
  if (support !== null && latest.close < support) {
    risks.push(`${price} 跌破前 20 個交易日區間低點 ${level(support)}（截至 ${previous.tradingDate}）`);
  }
  if (current60 !== null && prior60 !== null && latest.close < current60 && current60 < prior60) {
    risks.push(`${price} 低於 MA60 ${level(current60)}；MA60 低於 5 個交易日前（${closed[index - 5].tradingDate}）的 ${level(prior60)}`);
  }
  if (risks.length) return result('reduce', risks);

  if (current20 === null || current60 === null || prior60 === null || current240 === null || prior240 === null) {
    return result('insufficient', [`截至 ${latest.tradingDate} 有 ${closed.length} 筆已確認收盤日 K；中長期趨勢需要至少 245 筆`]);
  }
  const levels = `${price}；MA20 ${level(current20)}、MA60 ${level(current60)}、MA240 ${level(current240)}`;
  const direction = `與 5 個交易日前（${closed[index - 5].tradingDate}）比較：MA60 ${level(prior60)} → ${level(current60)}、MA240 ${level(prior240)} → ${level(current240)}`;
  const upward = latest.close > current60 && current60 > current240 && current60 > prior60 && current240 > prior240;
  if (!upward) return result('watch', [levels, `尚未同時符合收盤 > MA60 > MA240，且 MA60、MA240 上升；${direction}`]);

  const recovered = !!previous && previous20 !== null && previous.low <= previous20
    && latest.close > previous.close && latest.close > current20;
  const near20 = latest.close <= current20 * 1.03 + Number.EPSILON * latest.close * 8;
  const trend = [`${levels}；收盤 > MA60 > MA240`, `MA60、MA240 均上升；${direction}`];
  if (near20 && (crossedAboveSma20 || recovered)) {
    const setup = crossedAboveSma20
      ? `${latest.tradingDate} 收盤突破 MA20；${previous.tradingDate} 收盤 ${level(previous.close)} ≤ 當日 MA20 ${level(previous20!)}`
      : `${previous.tradingDate} 最低 ${level(previous.low)} 觸及當日 MA20 ${level(previous20!)}；${latest.tradingDate} 收盤回升並高於 MA20`;
    return result('add', [...trend, `${setup}，且距 MA20 不超過 3%`]);
  }
  if (latest.close > current20) {
    return result('hold', [...trend, near20 ? '收盤高於 MA20，尚無新的突破或回檔回升條件' : '收盤高於 MA20，但距 MA20 超過 3%，未列入加碼觀察']);
  }
  return result('watch', [...trend, '收盤尚未高於 MA20，等待已收盤的突破或回檔回升']);
}
