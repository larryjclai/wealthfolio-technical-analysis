import { describe, expect, it, vi } from 'vitest';
import { parseYahooHistory, YahooFinanceProvider, tradingDate } from '../src/market-data/YahooFinanceProvider';
import { SymbolResolver } from '../src/market-data/SymbolResolver';
import { HistoryRequest } from '../src/market-data/types';
import { HostAdapter } from '../src/host/HostAdapter';
import { stockTrades } from '../src/market-data/trades';
import { instrument } from './fixtures';
const now = Date.parse('2026-09-18T15:00:00Z');
const request: HistoryRequest = { instrument, from: '2026-09-16T00:00:00Z', to: '2026-09-19T00:00:00Z', interval: '1d', priceBasis: 'provider-ohlc' };
function payload() { return { chart: { result: [{ timestamp: ['2026-09-17', '2026-09-18'].map(date => Date.parse(`${date}T13:30:00Z`) / 1000), meta: { exchangeTimezoneName: 'America/New_York', currency: 'USD', currentTradingPeriod: { regular: { end: Date.parse('2026-09-18T20:00:00Z') / 1000 } } }, indicators: { quote: [{ open: [100, 105], high: [110, 115], low: [90, 95], close: [105, 110], volume: [100, null] }] } }] } }; }
describe('Yahoo data quality', () => {
  it('marks live daily candles provisional and preserves unknown volume', () => {
    const result = parseYahooHistory(payload(), request, now);
    expect(result.bars.map(b => b.completion)).toEqual(['closed', 'provisional']);
    expect(result.bars[1].volume).toBeNull(); expect(result.meta.delayMinutes).toBeNull();
  });
  it('marks latest candle closed after regular session end', () => expect(parseYahooHistory(payload(), request, now + 6 * 3600000).bars[1].completion).toBe('closed'));
  it('uses exchange timezone for local trading dates', () => expect(tradingDate(Date.parse('2026-09-17T20:00:00Z') / 1000, 'Asia/Taipei')).toBe('2026-09-18'));
  it('drops invalid OHLC rather than substituting a fake close for the high', () => {
    const data = payload(); (data.chart.result[0].indicators.quote[0].high as unknown[])[1] = null;
    const result = parseYahooHistory(data, request, now); expect(result.bars).toHaveLength(1); expect(result.meta.warnings[0]).toContain('略過');
  });
  it('silently skips a fully empty no-trade placeholder, including a weekday holiday', () => {
    const data = payload(); const quote = data.chart.result[0].indicators.quote[0];
    for (const field of ['open', 'high', 'low', 'close'] as const) (quote[field] as unknown[])[1] = null;
    quote.volume[1] = 0;
    const result = parseYahooHistory(data, request, now);
    expect(result.bars).toHaveLength(1); expect(result.meta.warnings).toEqual([]);
    quote.volume[1] = 10;
    expect(parseYahooHistory(data, request, now).meta.warnings[0]).toContain('異常');
  });
  it('uses the prior close on a weekend without a stale-price error', () => {
    const result = parseYahooHistory(payload(), request, Date.parse('2026-09-19T15:00:00Z'));
    expect(result.meta.latestTradingDate).toBe('2026-09-18'); expect(result.meta.warnings).toEqual([]);
  });
  it('does not silently label a missing symbol as a holiday', async () => {
    const network = vi.fn(async () => ({ status: 404, body: '{}' }));
    const provider = new YahooFinanceProvider({ ctx: { api: { network: { request: network } } } } as unknown as HostAdapter);
    await expect(provider.getHistory(request)).rejects.toThrow('核對 Yahoo 代碼');
  });
  it('rejects empty results', () => { const data = payload(); data.chart.result[0].timestamp = []; expect(() => parseYahooHistory(data, request, now)).toThrow(); });
  it('sorts, deduplicates dates and respects requested range', () => {
    const data = payload(); data.chart.result[0].timestamp.reverse();
    expect(parseYahooHistory(data, request, now).bars.map(b => b.tradingDate)).toEqual(['2026-09-17', '2026-09-18']);
    data.chart.result[0].timestamp[1] = data.chart.result[0].timestamp[0];
    expect(parseYahooHistory(data, request, now).bars).toHaveLength(1);
    expect(parseYahooHistory(payload(), { ...request, from: '2026-09-18T00:00:00Z' }, now).bars).toHaveLength(1);
  });
  it('honors request range and encodes symbols in the URL', async () => {
    const network = vi.fn(async (_request: { url: string }) => ({ status: 200, body: JSON.stringify(payload()) }));
    const provider = new YahooFinanceProvider({ ctx: { api: { network: { request: network } } } } as unknown as HostAdapter);
    await provider.getHistory({ ...request, instrument: { ...instrument, providerSymbol: '^TEST' } });
    const url = network.mock.calls[0][0].url;
    expect(url).toContain('%5ETEST'); expect(url).toContain('period1='); expect(url).not.toContain('range=2y');
    await expect(provider.getHistory({ ...request, interval: '5m' })).rejects.toThrow();
  });
});
describe('Symbols and recorded trades', () => {
  it('preserves explicit OTC suffix and normalizes currency', async () => {
    const resolver = new SymbolResolver();
    expect((await resolver.resolve({ symbol: '9999.TWO' })).providerSymbol).toBe('9999.TWO');
    expect(resolver.resolveFromHolding({ instrument: { symbol: '2330.TW', currency: 'USD' }, localCurrency: 'USD' }).currency).toBe('TWD');
    expect(() => resolver.resolveFromHolding({ instrument: { symbol: 'TEST', currency: 'EUR' }, localCurrency: 'EUR' })).toThrow();
  });
  it('includes valid posted trades, keeps accounting date and excludes pending/other symbols', () => {
    const row = { id: '1', activityType: 'BUY', status: 'POSTED', date: '2026-09-17T00:00:00Z', quantity: '2.5', unitPrice: '101.25', currency: 'USD', assetSymbol: 'TEST', accountName: 'Broker', needsReview: false };
    const result = stockTrades([row, row, { ...row, id: '2', activityType: 'SELL' }, { ...row, id: '3', status: 'PENDING' }, { ...row, id: '4', assetSymbol: 'OTHER' }, { ...row, id: '5', needsReview: true }, { ...row, id: '6', unitPrice: null }], instrument);
    expect(result).toHaveLength(2); expect(result[0]).toMatchObject({ date: '2026-09-17', price: 101.25, quantity: 2.5 }); expect(result[1].side).toBe('SELL');
  });
});
