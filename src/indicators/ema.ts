export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  
  if (data.length < period || !Number.isInteger(period) || period < 1) return result;
  
  // The first EMA is exactly the SMA of the first 'period' data points
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  const firstSma = sum / period;
  result[period - 1] = firstSma;
  
  const alpha = 2 / (period + 1);
  let prevEma = firstSma;
  
  for (let i = period; i < data.length; i++) {
    const currentEma = alpha * data[i] + (1 - alpha) * prevEma;
    result[i] = currentEma;
    prevEma = currentEma;
  }
  
  return result;
}
