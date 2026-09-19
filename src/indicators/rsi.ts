export function rsi(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  
  if (data.length <= period || !Number.isInteger(period) || period < 1) return result;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  result[period] = calculateRsiValue(avgGain, avgLoss);
  
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;
    
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    
    result[i] = calculateRsiValue(avgGain, avgLoss);
  }
  
  return result;
}

function calculateRsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    if (avgGain === 0) return 50; // Both zero
    return 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
