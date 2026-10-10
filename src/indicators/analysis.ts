import { sma } from './sma';
import { bollingerBands } from './bollinger';
import { rsi } from './rsi';
import { PivotResult } from './pivot';
import { Bar } from '../market-data/types';
import { supportResistance } from './support-resistance';
import { analyzeObservation, Observation } from './observation';
import type { StopState } from '../alerts/TrailingStopStore';

/** Latest values of all computed indicators for one stock */
export interface StockAnalysis {
  symbol: string;
  providerSymbol: string;
  displayName: string;
  market: string;
  currentPrice: number;
  latestTradingDate: string;
  provisional: boolean;
  support: number | null;
  resistance: number | null;
  previousClose: number;
  dayChange: number;
  dayChangePct: number;
  quantity: number;
  marketValue: number;

  // Moving Averages (latest value)
  sma20: number | null;
  sma60: number | null;
  sma120: number | null;
  sma240: number | null;

  // Position relative to MAs
  aboveSma20: boolean | null;
  aboveSma60: boolean | null;
  aboveSma120: boolean | null;
  aboveSma240: boolean | null;

  // Distance from MAs (percentage)
  distSma20Pct: number | null;
  distSma60Pct: number | null;
  distSma120Pct: number | null;
  distSma240Pct: number | null;

  // RSI
  rsi14: number | null;

  // Bollinger Bands
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbPosition: number | null; // 0-1 where 0=lower band, 1=upper band

  // Pivot Points
  pivot: PivotResult | null;

  // 52-week range
  week52High: number | null;
  week52Low: number | null;
  week52Position: number | null; // 0-1 where 0=52w low, 1=52w high

  // Triggered conditions
  signals: Signal[];
  observation: Observation;
}

export type SignalType = 
  | 'above_sma5'
  | 'below_sma5'
  | 'sma5_cross_above_sma20'
  | 'sma5_cross_below_sma20'
  | 'above_sma20'
  | 'below_sma20'
  | 'cross_above_sma20'
  | 'cross_below_sma20'
  | 'below_sma60'
  | 'below_sma240'
  | 'above_sma240'
  | 'rsi_overbought'
  | 'rsi_oversold'
  | 'near_52w_low'
  | 'near_52w_high'
  | 'touch_bb_lower'
  | 'touch_bb_upper';

export interface Signal {
  type: SignalType;
  label: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

const SIGNAL_DEFINITIONS: Record<SignalType, { label: string; sentiment: Signal['sentiment'] }> = {
  above_sma5: { label: '高於 MA5', sentiment: 'bullish' },
  below_sma5: { label: '低於 MA5', sentiment: 'bearish' },
  sma5_cross_above_sma20: { label: 'MA5 上穿 MA20', sentiment: 'bullish' },
  sma5_cross_below_sma20: { label: 'MA5 下穿 MA20', sentiment: 'bearish' },
  above_sma20: { label: '高於 MA20', sentiment: 'bullish' },
  below_sma20: { label: '低於 MA20', sentiment: 'bearish' },
  cross_above_sma20: { label: '收盤突破 MA20', sentiment: 'bullish' },
  cross_below_sma20: { label: '收盤跌破 MA20', sentiment: 'bearish' },
  below_sma60: { label: '低於季線', sentiment: 'bearish' },
  below_sma240: { label: '低於年線', sentiment: 'bearish' },
  above_sma240: { label: '高於年線', sentiment: 'bullish' },
  rsi_overbought: { label: 'RSI 超買', sentiment: 'bearish' },
  rsi_oversold: { label: 'RSI 超賣', sentiment: 'bullish' },
  near_52w_low: { label: '近52週低', sentiment: 'bearish' },
  near_52w_high: { label: '近52週高', sentiment: 'bullish' },
  touch_bb_lower: { label: '觸及BB下軌', sentiment: 'bullish' },
  touch_bb_upper: { label: '觸及BB上軌', sentiment: 'bearish' },
};

/** Get the last non-null value from an indicator array */
function lastValue(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) return arr[i];
  }
  return null;
}

export interface AnalysisInput {
  bars: Bar[];
  rejectedBars?: number;
  symbol: string;
  providerSymbol?: string;
  displayName: string;
  market: string;
  quantity: number;
  marketValue: number;
  week52High: number | null;
  week52Low: number | null;
}

/**
 * Compute all technical indicators for a single stock.
 */
export function analyzeStock(input: AnalysisInput): StockAnalysis {
  const closes = input.bars.map(bar => bar.close);
  
  if (closes.length === 0) {
    throw new Error('沒有有效價格，無法分析');
  }

  const currentPrice = closes[closes.length - 1];
  const previousClose = closes.length > 1 ? closes[closes.length - 2] : currentPrice;
  const dayChange = currentPrice - previousClose;
  const dayChangePct = previousClose !== 0 ? (dayChange / previousClose) * 100 : 0;

  // Moving Averages
  const sma5Val = lastValue(sma(closes, 5));
  const sma20Val = lastValue(sma(closes, 20));
  const sma60Val = lastValue(sma(closes, 60));
  const sma120Val = lastValue(sma(closes, 120));
  const sma240Val = lastValue(sma(closes, 240));

  const distPct = (price: number, maVal: number | null) => 
    maVal !== null && maVal !== 0 ? ((price - maVal) / maVal) * 100 : null;

  // RSI
  const rsi14Val = lastValue(rsi(closes, 14));

  // Bollinger Bands
  const bb = bollingerBands(closes, 20, 2);
  const bbUpperVal = lastValue(bb.upper);
  const bbLowerVal = lastValue(bb.lower);
  const bbMiddleVal = lastValue(bb.middle);
  const bbPositionVal = (bbUpperVal !== null && bbLowerVal !== null && bbUpperVal !== bbLowerVal)
    ? (currentPrice - bbLowerVal) / (bbUpperVal - bbLowerVal)
    : null;

  const levels = supportResistance(input.bars);
  const pivotResult = levels.pivot;

  // 52-week range position
  const w52High = input.week52High;
  const w52Low = input.week52Low;
  const w52Position = (w52High !== null && w52Low !== null && w52High !== w52Low)
    ? (currentPrice - w52Low) / (w52High - w52Low)
    : null;

  // Evaluate signals
  const signals: Signal[] = [];
  let observation = analyzeObservation(input.bars);
  if ((input.rejectedBars ?? 0) > 0) {
    const positive = observation.kind === 'add' || observation.kind === 'hold';
    observation = { ...observation, kind: positive ? 'watch' : observation.kind, label: positive ? '待觀察' : observation.label,
      reasons: [...observation.reasons, `行情已略過 ${input.rejectedBars} 筆異常日 K，請先核對資料完整性`] };
  }

  if (sma5Val !== null && currentPrice > sma5Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.above_sma5, type: 'above_sma5' });
  }
  if (sma5Val !== null && currentPrice < sma5Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.below_sma5, type: 'below_sma5' });
  }
  const closedCloses = input.bars.filter(bar => bar.completion === 'closed').map(bar => bar.close);
  if (closedCloses.length >= 21) {
    const ma5 = sma(closedCloses, 5), ma20 = sma(closedCloses, 20);
    const latest = closedCloses.length - 1;
    const prior5 = ma5[latest - 1]!, prior20 = ma20[latest - 1]!;
    if (prior5 <= prior20 && ma5[latest]! > ma20[latest]!) {
      signals.push({ ...SIGNAL_DEFINITIONS.sma5_cross_above_sma20, type: 'sma5_cross_above_sma20' });
    }
    if (prior5 >= prior20 && ma5[latest]! < ma20[latest]!) {
      signals.push({ ...SIGNAL_DEFINITIONS.sma5_cross_below_sma20, type: 'sma5_cross_below_sma20' });
    }
  }
  if (sma20Val !== null && currentPrice > sma20Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.above_sma20, type: 'above_sma20' });
  }
  if (sma20Val !== null && currentPrice < sma20Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.below_sma20, type: 'below_sma20' });
  }
  if (observation.crossedAboveSma20) {
    signals.push({ ...SIGNAL_DEFINITIONS.cross_above_sma20, type: 'cross_above_sma20' });
  }
  if (observation.crossedBelowSma20) {
    signals.push({ ...SIGNAL_DEFINITIONS.cross_below_sma20, type: 'cross_below_sma20' });
  }
  
  if (sma60Val !== null && currentPrice < sma60Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.below_sma60, type: 'below_sma60' });
  }
  if (sma240Val !== null && currentPrice < sma240Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.below_sma240, type: 'below_sma240' });
  }
  if (sma240Val !== null && currentPrice > sma240Val) {
    signals.push({ ...SIGNAL_DEFINITIONS.above_sma240, type: 'above_sma240' });
  }
  if (rsi14Val !== null && rsi14Val > 70) {
    signals.push({ ...SIGNAL_DEFINITIONS.rsi_overbought, type: 'rsi_overbought' });
  }
  if (rsi14Val !== null && rsi14Val < 30) {
    signals.push({ ...SIGNAL_DEFINITIONS.rsi_oversold, type: 'rsi_oversold' });
  }
  if (w52Low !== null && w52High !== null && w52High !== w52Low) {
    const range = w52High - w52Low;
    if (currentPrice - w52Low < range * 0.15) {
      signals.push({ ...SIGNAL_DEFINITIONS.near_52w_low, type: 'near_52w_low' });
    }
    if (w52High - currentPrice < range * 0.15) {
      signals.push({ ...SIGNAL_DEFINITIONS.near_52w_high, type: 'near_52w_high' });
    }
  }
  if (bbLowerVal !== null && currentPrice <= bbLowerVal) {
    signals.push({ ...SIGNAL_DEFINITIONS.touch_bb_lower, type: 'touch_bb_lower' });
  }
  if (bbUpperVal !== null && currentPrice >= bbUpperVal) {
    signals.push({ ...SIGNAL_DEFINITIONS.touch_bb_upper, type: 'touch_bb_upper' });
  }

  return {
    symbol: input.symbol,
    providerSymbol: input.providerSymbol ?? input.symbol,
    displayName: input.displayName,
    market: input.market,
    currentPrice,
    latestTradingDate: input.bars[input.bars.length - 1]?.tradingDate || '',
    provisional: input.bars[input.bars.length - 1]?.completion !== 'closed',
    support: levels.support,
    resistance: levels.resistance,
    previousClose,
    dayChange,
    dayChangePct,
    quantity: input.quantity,
    marketValue: input.marketValue,
    sma20: sma20Val,
    sma60: sma60Val,
    sma120: sma120Val,
    sma240: sma240Val,
    aboveSma20: sma20Val !== null ? currentPrice > sma20Val : null,
    aboveSma60: sma60Val !== null ? currentPrice > sma60Val : null,
    aboveSma120: sma120Val !== null ? currentPrice > sma120Val : null,
    aboveSma240: sma240Val !== null ? currentPrice > sma240Val : null,
    distSma20Pct: distPct(currentPrice, sma20Val),
    distSma60Pct: distPct(currentPrice, sma60Val),
    distSma120Pct: distPct(currentPrice, sma120Val),
    distSma240Pct: distPct(currentPrice, sma240Val),
    rsi14: rsi14Val,
    bbUpper: bbUpperVal,
    bbMiddle: bbMiddleVal,
    bbLower: bbLowerVal,
    bbPosition: bbPositionVal,
    pivot: pivotResult,
    week52High: w52High,
    week52Low: w52Low,
    week52Position: w52Position,
    signals,
    observation,
  };
}

/** Get all available signal types with their labels for the screener UI */
export function getAllSignalTypes(): { type: SignalType; label: string; sentiment: Signal['sentiment'] }[] {
  return Object.entries(SIGNAL_DEFINITIONS).map(([type, def]) => ({
    type: type as SignalType,
    ...def,
  }));
}

/** Filter analyses by active signal types */
export function filterBySignals(analyses: StockAnalysis[], activeSignals: SignalType[], match: 'any' | 'all' = 'any'): StockAnalysis[] {
  if (activeSignals.length === 0) return analyses;
  return analyses.filter(a => {
    const matches = (sig: SignalType) => a.signals.some(s => s.type === sig);
    return match === 'all' ? activeSignals.every(matches) : activeSignals.some(matches);
  });
}

/** Saved stop triggers remain a risk condition after acknowledgment. */
export function withTrailingStopObservations(analyses: StockAnalysis[], state: StopState): StockAnalysis[] {
  return analyses.map(analysis => {
    const rule = state.rules.find(r => r.instrument.providerSymbol === analysis.providerSymbol && r.instrument.market === analysis.market);
    const notices: string[] = [];
    if (state.error) notices.push('提醒設定載入／儲存錯誤，請先檢查提醒中心');
    else if (!state.ready) notices.push('提醒設定尚未載入，暫不列入加碼或續抱觀察');
    if (rule?.needsReview) notices.push(rule.needsReview);
    if (state.failures[analysis.providerSymbol]) notices.push('停利行情更新失敗，請重試檢查');
    if (rule && analysis.observation.tradingDate && rule.lastTradingDate !== analysis.observation.tradingDate) {
      notices.push(rule.lastTradingDate < analysis.observation.tradingDate
        ? `停利追蹤仍停在 ${rule.lastTradingDate}，請立即檢查日 K`
        : `停利追蹤已更新至 ${rule.lastTradingDate}，請重新整理總覽行情`);
    }
    if (rule?.triggeredAt) {
      return { ...analysis, observation: { ...analysis.observation, kind: 'reduce' as const, label: '減碼檢查',
        reasons: [`${rule.triggeredAt} 已達移動停利條件${rule.acknowledged ? '（已確認，尚未重新追蹤）' : '（待確認）'}`, ...notices] } };
    }
    if (!notices.length) return analysis;
    const blocked = analysis.observation.kind === 'add' || analysis.observation.kind === 'hold';
    return { ...analysis, observation: { ...analysis.observation,
      kind: blocked ? 'watch' as const : analysis.observation.kind,
      label: blocked ? '待觀察' : analysis.observation.label,
      reasons: [...notices, ...analysis.observation.reasons] } };
  });
}
