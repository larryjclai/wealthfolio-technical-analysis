import { describe, expect, it } from 'vitest';
import { analyzeStock, AnalysisInput, filterBySignals } from '../src/indicators/analysis';
import { supportResistance } from '../src/indicators/support-resistance';
import { rsi } from '../src/indicators/rsi';
import { sma } from '../src/indicators/sma';
import { ema } from '../src/indicators/ema';
import { bollingerBands } from '../src/indicators/bollinger';
import { bar } from './fixtures';
const bars = Array.from({ length: 21 }, (_, i) => bar(`2026-08-${String(i + 1).padStart(2, '0')}`, 100, 110, 90));
const input: AnalysisInput = { bars, symbol: 'TEST', displayName: 'TEST', market: 'US', quantity: 2, marketValue: 200, week52High: 200, week52Low: 90 };
describe('Analysis and support/resistance', () => {
  it('excludes latest candle from both range levels and pivots', () => {
    const last = { ...bars[20], close: 250, high: 300, low: 1, completion: 'provisional' as const };
    const levels = supportResistance([...bars.slice(0, 20), last]);
    expect(levels.support).toBe(90); expect(levels.resistance).toBe(110); expect(levels.pivot?.p).toBe(100); expect(levels.baseDate).toBe('2026-08-20');
  });
  it('requires a full 20-day range and a prior completed candle', () => {
    expect(supportResistance(bars.slice(0, 20)).support).toBeNull();
    expect(supportResistance(bars.slice(0, 1)).pivot).toBeNull();
  });
  it('uses documented 15% 52-week range screening', () => expect(analyzeStock(input).signals.map(s => s.type)).toContain('near_52w_low'));
  it('returns null for insufficient MA data and no fake zero-price analysis', () => {
    expect(analyzeStock(input).sma60).toBeNull();
    expect(() => analyzeStock({ ...input, bars: [] })).toThrow();
  });
  it('defines MA signals as position rather than a new crossing event', () => {
    const data = Array.from({length: 240}, () => 100); data[239] = 99;
    const analysis = analyzeStock({ ...input, bars: data.map((close, i) => bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), close)) });
    expect(analysis.signals.find(s => s.type === 'below_sma240')?.label).toBe('低於年線');
    expect(filterBySignals([analysis], ['rsi_oversold', 'below_sma240'])).toHaveLength(1);
  });
  it('uses Wilder RSI smoothing for mixed gains and losses', () => {
    const result = rsi([100, 102, 101, 104, 102, 105], 3);
    expect(result[3]).toBeCloseTo(83.333333);
    expect(result[4]).toBeCloseTo(55.555555);
    expect(result[5]).toBeCloseTo(74.6031746);
    expect(rsi(Array(15).fill(100), 14)[14]).toBe(50);
  });
  it.each([0, -1, 1.5, NaN])('rejects invalid periods safely %s', period => {
    expect(sma([1, 2, 3], period)).toEqual([null, null, null]);
    expect(ema([1, 2, 3], period)).toEqual([null, null, null]);
    expect(rsi([1, 2, 3], period)).toEqual([null, null, null]);
    expect(bollingerBands([1, 2, 3], period, 2).upper).toEqual([null, null, null]);
  });
});
