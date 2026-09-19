import { Bar, HistoryResult, Instrument } from '../src/market-data/types';
export const instrument: Instrument = { key: 'US:TEST', symbol: 'TEST', market: 'US', exchange: 'US', currency: 'USD', timezone: 'America/New_York', providerSymbol: 'TEST' };
export function bar(date: string, close: number, high = close, low = close): Bar {
  return { time: Date.parse(`${date}T13:30:00Z`) / 1000, tradingDate: date, open: close, close, high, low, volume: 100, completion: 'closed' };
}
export function history(bars: Bar[], fetchedAt = '2026-09-19T00:00:00Z'): HistoryResult {
  return { bars, meta: { provider: 'yahoo', providerSymbol: 'TEST', currency: 'USD', timezone: 'America/New_York', fetchedAt, latestTradingDate: bars[bars.length - 1]?.tradingDate || null, priceBasis: 'provider-ohlc', adjustmentDescription: '', delayMinutes: null, volumeUnit: 'shares', warnings: [] } };
}
