export type PivotType = 'classic' | 'fibonacci';

export interface PivotResult {
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export function calculatePivot(high: number, low: number, close: number, type: PivotType): PivotResult {
  const p = (high + low + close) / 3;
  const range = high - low;
  
  if (type === 'classic') {
    return {
      p,
      r1: 2 * p - low,
      r2: p + range,
      r3: high + 2 * (p - low),
      s1: 2 * p - high,
      s2: p - range,
      s3: low - 2 * (high - p)
    };
  } else {
    // fibonacci
    return {
      p,
      r1: p + 0.382 * range,
      r2: p + 0.618 * range,
      r3: p + 1.000 * range,
      s1: p - 0.382 * range,
      s2: p - 0.618 * range,
      s3: p - 1.000 * range
    };
  }
}
