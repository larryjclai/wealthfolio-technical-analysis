import { describe, it, expect } from 'vitest';
import { sma } from '../src/indicators/sma';
import { ema } from '../src/indicators/ema';
import { bollingerBands } from '../src/indicators/bollinger';
import { rsi } from '../src/indicators/rsi';
import { calculatePivot } from '../src/indicators/pivot';

describe('Technical Indicators', () => {
  it('should calculate SMA correctly', () => {
    const data = [1, 2, 3, 4];
    const res = sma(data, 3);
    expect(res[0]).toBeNull();
    expect(res[1]).toBeNull();
    expect(res[2]).toBeCloseTo(2); // (1+2+3)/3
    expect(res[3]).toBeCloseTo(3); // (2+3+4)/3
  });

  it('should calculate EMA correctly', () => {
    const data = [1, 2, 3, 4];
    const res = ema(data, 3);
    expect(res[0]).toBeNull();
    expect(res[1]).toBeNull();
    expect(res[2]).toBeCloseTo(2); // Seed is SMA3
    // alpha = 2/(3+1) = 0.5
    // EMA4 = 4 * 0.5 + 2 * 0.5 = 3
    expect(res[3]).toBeCloseTo(3);
  });

  it('should calculate Bollinger Bands correctly', () => {
    const data = [1, 2, 3];
    const bb = bollingerBands(data, 3, 2);
    const mid = bb.middle[2] as number;
    expect(mid).toBeCloseTo(2); // SMA3
    
    // Variance = ((1-2)^2 + (2-2)^2 + (3-2)^2)/3 = 2/3
    // StdDev = sqrt(2/3) ~ 0.816496
    const stdDev = Math.sqrt(2/3);
    expect(bb.upper[2]).toBeCloseTo(2 + 2 * stdDev);
    expect(bb.lower[2]).toBeCloseTo(2 - 2 * stdDev);
  });

  it('should calculate RSI correctly', () => {
    // 15 strictly increasing closes
    const dataUp = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    const resUp = rsi(dataUp, 14);
    expect(resUp[14]).toBeCloseTo(100);

    // 15 strictly decreasing closes
    const dataDown = [15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
    const resDown = rsi(dataDown, 14);
    expect(resDown[14]).toBeCloseTo(0);
  });

  it('should calculate Pivot (Classic) correctly', () => {
    // H=110, L=90, C=100
    const res = calculatePivot(110, 90, 100, 'classic');
    expect(res.p).toBeCloseTo(100);
    expect(res.r1).toBeCloseTo(110);
    expect(res.r2).toBeCloseTo(120);
    expect(res.r3).toBeCloseTo(130);
    expect(res.s1).toBeCloseTo(90);
    expect(res.s2).toBeCloseTo(80);
    expect(res.s3).toBeCloseTo(70);
  });

  it('should calculate Pivot (Fibonacci) correctly', () => {
    const res = calculatePivot(110, 90, 100, 'fibonacci');
    // R1 = P + 0.382 * 20 = 100 + 7.64 = 107.64
    expect(res.r1).toBeCloseTo(107.64);
    expect(res.r2).toBeCloseTo(112.36);
    expect(res.r3).toBeCloseTo(120);
    expect(res.s1).toBeCloseTo(92.36);
    expect(res.s2).toBeCloseTo(87.64);
    expect(res.s3).toBeCloseTo(80);
  });
});
