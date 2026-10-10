import { describe, expect, it } from 'vitest';
import { analyzeStock, AnalysisInput, filterBySignals, withTrailingStopObservations } from '../src/indicators/analysis';
import { parseSnapshot } from '../src/alerts/alert-history';
import type { StopState } from '../src/alerts/TrailingStopStore';
import { createTrailingStop } from '../src/alerts/trailing-stop';
import { bar, history, instrument } from './fixtures';

const bars = Array.from({ length: 246 }, (_, i) => bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), 100));
const input: AnalysisInput = { bars, symbol: 'TEST', providerSymbol: 'TEST', displayName: 'Test', market: 'US', quantity: 1, marketValue: 100, week52High: 200, week52Low: 50 };
const state: StopState = { ...parseSnapshot(null), ready: true, error: null, checking: false, lastAttemptAt: null, lastCompletedAt: null };
const rule = createTrailingStop(instrument, 'Test', 20, history(bars));
const candidate = () => {
  const analysis = analyzeStock(input);
  return { ...analysis, observation: { ...analysis.observation, kind: 'add' as const, label: '加碼觀察', reasons: ['中長期趨勢向上'] } };
};

describe('MA20 screening and observation integration', () => {
  it('distinguishes current MA20 position from a closed crossing', () => {
    const provisional = { ...bars[bars.length - 1], close: 110, high: 110, completion: 'provisional' as const };
    const analysis = analyzeStock({ ...input, bars: [...bars.slice(0, -1), provisional] });
    expect(analysis.signals.map(s => s.type)).toContain('above_sma20');
    expect(analysis.signals.map(s => s.type)).not.toContain('cross_above_sma20');
    expect(analysis.observation.tradingDate).toBe(bars[bars.length - 2].tradingDate);
  });
  it('supports any/all matching, leaves empty filters unfiltered, and handles contradictory conditions', () => {
    const above = analyzeStock({ ...input, bars: [...bars.slice(0, -1), { ...bars[bars.length - 1], close: 110, high: 110 }] });
    const below = analyzeStock({ ...input, symbol: 'OTHER', bars: [...bars.slice(0, -1), { ...bars[bars.length - 1], close: 90, low: 90 }] });
    const analyses = [above, below];
    expect(filterBySignals(analyses, [])).toBe(analyses);
    expect(filterBySignals(analyses, [], 'all')).toBe(analyses);
    expect(filterBySignals(analyses, ['above_sma20', 'below_sma20'])).toHaveLength(2);
    expect(filterBySignals(analyses, ['above_sma20', 'below_sma20'], 'all')).toHaveLength(0);
    expect(filterBySignals(analyses, ['above_sma20', 'above_sma240'], 'all')).toEqual([above]);
  });
  it.each([false, true])('keeps an existing stop trigger in reduce review, acknowledged=%s', acknowledged => {
    const original = candidate();
    const [result] = withTrailingStopObservations([original], { ...state, rules: [{ ...rule, triggeredAt: rule.lastTradingDate, acknowledged }] });
    expect(result.observation.kind).toBe('reduce');
    expect(result.observation.reasons[0]).toContain('移動停利');
    expect(result.observation.reasons[0]).toContain(acknowledged ? '尚未重新追蹤' : '待確認');
    expect(original.observation.kind).toBe('add');
  });
  it('matches stop rules by resolved provider symbol and market, not the display symbol', () => {
    const original = { ...candidate(), symbol: 'TEST DISPLAY' };
    const trigger = { ...rule, triggeredAt: rule.lastTradingDate };
    expect(withTrailingStopObservations([original], { ...state, rules: [trigger] })[0].observation.kind).toBe('reduce');
    const unrelated = { ...trigger, instrument: { ...instrument, providerSymbol: 'OTHER' } };
    expect(withTrailingStopObservations([original], { ...state, rules: [unrelated] })[0].observation.kind).toBe('add');
    const foreign = { ...trigger, instrument: { ...instrument, market: 'TWSE' as const } };
    expect(withTrailingStopObservations([original], { ...state, rules: [foreign] })[0].observation.kind).toBe('add');
  });
  it.each([
    { ready: false },
    { error: 'cannot save' },
    { failures: { TEST: 'offline' } },
    { rules: [{ ...rule, needsReview: '請核對拆股價格' }] },
    { rules: [{ ...rule, lastTradingDate: '2025-01-01' }] },
    { rules: [{ ...rule, lastTradingDate: '2026-01-01' }] },
  ])('blocks positive classifications when reminder checks are unavailable: %j', changes => {
    const [result] = withTrailingStopObservations([candidate()], { ...state, ...changes });
    expect(result.observation.kind).toBe('watch');
    expect(result.observation.reasons).toHaveLength(2);
  });
  it('retains technical risk findings when stop settings fail', () => {
    const original = candidate();
    const reduce = { ...original, observation: { ...original.observation, kind: 'reduce' as const, label: '減碼檢查', reasons: ['已跌破支撐'] } };
    const [result] = withTrailingStopObservations([reduce], { ...state, error: 'cannot load' });
    expect(result.observation.kind).toBe('reduce');
    expect(result.observation.reasons).toContain('已跌破支撐');
  });
  it('blocks add and hold when malformed candles were removed, while retaining reduce findings', () => {
    const rising = bars.map((b, i) => ({ ...b, open: 100 + i / 10, high: 100 + i / 10, low: 100 + i / 10, close: 100 + i / 10 }));
    const recovery = rising.map(b => ({ ...b }));
    recovery[recovery.length - 2] = { ...recovery[recovery.length - 2], open: 123, high: 123, low: 123, close: 123 };
    for (const data of [rising, recovery]) {
      expect(['add', 'hold']).toContain(analyzeStock({ ...input, bars: data }).observation.kind);
      const result = analyzeStock({ ...input, bars: data, rejectedBars: 1 });
      expect(result.observation.kind).toBe('watch');
      expect(result.observation.reasons.join(' ')).toContain('略過 1 筆異常日 K');
    }
    const falling = [...bars.slice(0, -1), { ...bars[bars.length - 1], open: 90, high: 90, low: 90, close: 90 }];
    expect(analyzeStock({ ...input, bars: falling, rejectedBars: 1 }).observation.kind).toBe('reduce');
    const provisional = { ...bar('2026-01-01', 1), completion: 'provisional' as const };
    expect(analyzeStock({ ...input, bars: [...rising, provisional], rejectedBars: 0 }).observation.kind).toBe('hold');
  });
});
