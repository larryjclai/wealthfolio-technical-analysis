import { describe, expect, it } from 'vitest';
import { Bar } from '../src/market-data/types';
import { analyzeObservation } from '../src/indicators/observation';
import { sma } from '../src/indicators/sma';
import { bar } from './fixtures';

const bars = (closes: number[]): Bar[] => closes.map((close, i) =>
  bar(new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), close));
const rising = (length = 245) => bars(Array.from({ length }, (_, i) => 100 + i / 10));
const last20 = (data: Bar[]) => sma(data.map(b => b.close), 20)[data.length - 1]!;

describe('Closed-day observation lists', () => {
  it('requires 245 closed bars for positive classifications, with no fake trend on flat prices', () => {
    expect(analyzeObservation(rising(244)).kind).toBe('insufficient');
    expect(analyzeObservation(rising()).kind).toBe('hold');
    expect(analyzeObservation(bars(Array(245).fill(100))).kind).toBe('watch');
    expect(analyzeObservation([])).toMatchObject({ kind: 'insufficient', tradingDate: null, crossedAboveSma20: false, crossedBelowSma20: false });
  });

  it('ignores provisional and unknown candles for trends, setups and latest assessment date', () => {
    const data = rising();
    const before = analyzeObservation(data);
    const pending = { ...bar('2025-09-04', 1), completion: 'provisional' as const };
    const unknown = { ...bar('2025-09-05', 1000), completion: 'unknown' as const };
    expect(analyzeObservation([...data, pending, unknown])).toEqual(before);
    expect(analyzeObservation([pending, unknown])).toMatchObject({ kind: 'insufficient', tradingDate: null });
  });

  it('distinguishes a new MA20 crossing from already being above it', () => {
    const data = bars([...Array(20).fill(100), 101]);
    expect(analyzeObservation(data).crossedAboveSma20).toBe(true);
    expect(analyzeObservation([...data, bar('2025-01-22', 102)]).crossedAboveSma20).toBe(false);
    const below = bars([...Array(20).fill(100), 99]);
    expect(analyzeObservation(below).crossedBelowSma20).toBe(true);
    expect(analyzeObservation(bars(Array(21).fill(100)))).toMatchObject({ crossedAboveSma20: false, crossedBelowSma20: false });
  });

  it('compares each close to its own MA20, including equality only on the prior side', () => {
    const data = bars([...Array(19).fill(100), 120, 101.04]);
    expect(last20(data)).toBeCloseTo(101.052);
    expect(analyzeObservation(data).crossedBelowSma20).toBe(true);
    const equalCurrent = bars([...Array(19).fill(100), 119, 101]);
    expect(last20(equalCurrent)).toBe(101);
    expect(analyzeObservation(equalCurrent)).toMatchObject({ crossedAboveSma20: false, crossedBelowSma20: false });
  });

  it('adds a modest new crossing only when the medium and long trends both rise', () => {
    const data = rising();
    data[data.length - 2] = { ...data[data.length - 2], open: 123, close: 123, high: 123, low: 123 };
    const observation = analyzeObservation(data);
    expect(observation.kind).toBe('add');
    expect(observation.crossedAboveSma20).toBe(true);
    expect(observation.reasons.join(' ')).toContain(data[data.length - 1].tradingDate);
    expect(analyzeObservation(bars([...Array(180).fill(200), ...Array(64).fill(100), 101])).kind).toBe('watch');
  });

  it('adds a recovery after the previous low touches MA20 even without a new crossing', () => {
    const data = rising();
    const previous = data[data.length - 2];
    previous.low = last20(data.slice(0, -1));
    const observation = analyzeObservation(data);
    expect(observation).toMatchObject({ kind: 'add', crossedAboveSma20: false });
    expect(observation.reasons.join(' ')).toContain('觸及');
    previous.low += 0.001;
    expect(analyzeObservation(data).kind).toBe('hold');
  });

  it('requires a higher recovery close and caps both add setups at 3% over MA20', () => {
    const data = rising();
    data[data.length - 2].low = last20(data.slice(0, -1));
    data[data.length - 1] = { ...data[data.length - 1], open: 124.3, close: 124.3, high: 124.3, low: 124.3 };
    expect(analyzeObservation(data).kind).toBe('hold');

    const boundary = bars([...Array(225).fill(80), ...Array(18).fill(100), 97, 103]);
    expect(last20(boundary)).toBe(100);
    const setLatest = (close: number) => { boundary[boundary.length - 1] = { ...boundary[boundary.length - 1], open: close, close, high: close, low: close }; };
    expect(analyzeObservation(boundary).kind).toBe('add');
    setLatest(103.001);
    expect(analyzeObservation(boundary).kind).toBe('hold');

    const decimalBoundary = rising();
    decimalBoundary[decimalBoundary.length - 2] = { ...decimalBoundary[decimalBoundary.length - 2], open: 123, close: 123, high: 123, low: 123 };
    const sum19 = decimalBoundary.slice(-20, -1).reduce((sum, b) => sum + b.close, 0);
    const closeAt3Pct = 1.03 * sum19 / (20 - 1.03);
    decimalBoundary[decimalBoundary.length - 1] = { ...decimalBoundary[decimalBoundary.length - 1], open: closeAt3Pct, close: closeAt3Pct, high: closeAt3Pct, low: closeAt3Pct };
    expect(analyzeObservation(decimalBoundary).kind).toBe('add');
  });

  it('reduces on a close below the previous 20-day low, even with short history, never equality', () => {
    const data = bars([...Array(20).fill(100), 99]);
    expect(analyzeObservation(data).kind).toBe('reduce');
    expect(analyzeObservation(data).reasons.join(' ')).toContain('區間低點 100');
    expect(analyzeObservation(bars(Array(21).fill(100))).kind).toBe('insufficient');
    expect(analyzeObservation(bars([...Array(19).fill(100), 99])).kind).toBe('insufficient');
  });

  it('reduces below a falling MA60 and gives risk priority over a MA20 recovery', () => {
    const data = bars(Array.from({ length: 65 }, (_, i) => 200 - i));
    data.forEach(b => { b.low = 1; });
    expect(analyzeObservation(data).kind).toBe('reduce');
    expect(analyzeObservation(data).reasons.join(' ')).toContain('MA60');
    expect(analyzeObservation(data.slice(0, 64)).kind).toBe('insufficient');

    const recovery = bars([...Array(180).fill(100), ...Array(50).fill(200), ...Array(14).fill(120), 150]);
    recovery.forEach(b => { b.low = 1; });
    expect(analyzeObservation(recovery)).toMatchObject({ kind: 'reduce', crossedAboveSma20: true });
  });

  it('does not mutate the supplied candles', () => {
    const data = rising();
    const before = structuredClone(data);
    analyzeObservation(data);
    expect(data).toEqual(before);
  });
});
