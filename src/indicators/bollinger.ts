import { sma } from './sma';

export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function bollingerBands(data: number[], period: number, multiplier: number): BollingerBandsResult {
  const middle = sma(data, period);
  const upper: (number | null)[] = new Array(data.length).fill(null);
  const lower: (number | null)[] = new Array(data.length).fill(null);
  
  if (!Number.isInteger(period) || period < 1 || !Number.isFinite(multiplier) || multiplier < 0) return { upper, middle, lower };

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    
    // Population standard deviation (divide by N)
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    upper[i] = mean + multiplier * stdDev;
    lower[i] = mean - multiplier * stdDev;
  }
  
  return { upper, middle, lower };
}
