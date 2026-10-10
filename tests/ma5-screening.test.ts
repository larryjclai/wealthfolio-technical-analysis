import { describe, expect, it } from 'vitest';
import { analyzeStock, AnalysisInput, filterBySignals } from '../src/indicators/analysis';
import { bar } from './fixtures';

const input: AnalysisInput = { bars: [], symbol: 'TEST', displayName: 'TEST', market: 'US', quantity: 1, marketValue: 100, week52High: null, week52Low: null };
const analyze = (closes: number[]) => analyzeStock({ ...input, bars: closes.map((close, i) => bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), close)) });
const types = (closes: number[]) => analyze(closes).signals.map(signal => signal.type);

describe('Optional MA5 screening', () => {
  it('requires five prices for position and excludes equality', () => {
    expect(types([100, 100, 100, 101])).not.toContain('above_sma5');
    expect(types([100, 100, 100, 100, 101])).toContain('above_sma5');
    expect(types([100, 100, 100, 100, 99])).toContain('below_sma5');
    expect(types(Array(5).fill(100))).not.toContain('above_sma5');
    expect(types(Array(5).fill(100))).not.toContain('below_sma5');
  });
  it('identifies fresh crosses in both directions, including prior equality', () => {
    const flat = Array(20).fill(100);
    expect(types([...flat, 101])).toContain('sma5_cross_above_sma20');
    expect(types([...flat, 99])).toContain('sma5_cross_below_sma20');
    expect(types([...flat, 101, 102])).not.toContain('sma5_cross_above_sma20');
    expect(types([...flat, 99, 98])).not.toContain('sma5_cross_below_sma20');
  });
  it('requires 21 closed bars and a strict crossing on the latest day', () => {
    expect(types([...Array(19).fill(100), 101])).not.toContain('sma5_cross_above_sma20');
    expect(types([...Array(19).fill(100), 101, 99])).not.toContain('sma5_cross_below_sma20');
    expect(types([...Array(19).fill(100), 99, 101])).not.toContain('sma5_cross_above_sma20');
  });
  it('keeps position current while ignoring provisional and unknown prices for crosses', () => {
    const closed = analyze([...Array(20).fill(100), 101]);
    const closedBars = [...Array(20).fill(100), 101].map((close, i) => bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), close));
    const live = analyzeStock({ ...input, bars: [...closedBars,
      { ...bar('2025-01-22', 1000), completion: 'provisional' },
      { ...bar('2025-01-23', 1), completion: 'unknown' }] });
    expect(live.signals.map(s => s.type)).toContain('below_sma5');
    expect(live.signals.map(s => s.type)).toContain('sma5_cross_above_sma20');
    expect(live.signals.map(s => s.type)).not.toContain('sma5_cross_below_sma20');
    expect(live.observation).toEqual(closed.observation);
  });
  it('does not create a cross from an unclosed candle', () => {
    const data = Array.from({ length: 20 }, (_, i) => bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), 100));
    const result = analyzeStock({ ...input, bars: [...data, { ...bar('2025-01-21', 101), completion: 'provisional' }] });
    expect(result.signals.map(s => s.type)).toContain('above_sma5');
    expect(result.signals.map(s => s.type)).not.toContain('sma5_cross_above_sma20');
  });
  it('supports any/all matching without restricting an unselected list or changing observation classes', () => {
    const up = analyze([...Array(20).fill(100), 101]);
    const down = analyze([...Array(20).fill(100), 99]);
    const analyses = [up, down];
    expect(filterBySignals(analyses, [])).toBe(analyses);
    expect(filterBySignals(analyses, ['above_sma5', 'below_sma5'])).toEqual(analyses);
    expect(filterBySignals(analyses, ['above_sma5', 'below_sma5'], 'all')).toEqual([]);
    expect(filterBySignals(analyses, ['above_sma5', 'sma5_cross_above_sma20'], 'all')).toEqual([up]);
    expect(up.observation.kind).toBe('insufficient');
    expect(down.observation.kind).toBe('reduce');
  });
});
