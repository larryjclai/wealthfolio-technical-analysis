export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  
  if (data.length < period || !Number.isInteger(period) || period < 1) return result;
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result[period - 1] = sum / period;
  
  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }
  
  return result;
}
