import { HostAdapter } from '../host/HostAdapter';
import { Bar, MarketDataProvider, HistoryRequest, HistoryResult, Instrument } from './types';

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function tradingDate(time: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time * 1000));
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseYahooHistory(data: any, request: HistoryRequest, now = Date.now()): HistoryResult {
  const result = data.chart?.result?.[0];
  if (data.chart?.error || !result?.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error('Yahoo Finance 回傳錯誤或無資料');
  }
  const timezone = result.meta?.exchangeTimezoneName || request.instrument.timezone;
  const today = tradingDate(now / 1000, timezone);
  const quote = result.indicators.quote[0];
  const from = Date.parse(request.from) / 1000;
  const to = Date.parse(request.to) / 1000;
  const byDate = new Map<string, Bar>();
  let rejected = 0;
  result.timestamp.forEach((time: number, i: number) => {
    if (!Number.isFinite(time) || time < from || time >= to) return;
    const open = quote.open?.[i], high = quote.high?.[i], low = quote.low?.[i], close = quote.close?.[i];
    // Yahoo may emit a no-trade placeholder on a holiday or before a session.
    // Only entirely empty OHLC with no volume is benign; partial data is still a warning.
    if ([open, high, low, close].every(value => value == null) && (quote.volume?.[i] == null || quote.volume[i] === 0)) return;
    if (![open, high, low, close].every(positive) || high < Math.max(open, close, low) || low > Math.min(open, close)) {
      rejected++; return;
    }
    const date = tradingDate(time, timezone);
    const end = result.meta?.currentTradingPeriod?.regular?.end;
    const completion = date < today ? 'closed' : date === today && Number.isFinite(end) && tradingDate(end, timezone) === today
      ? (now / 1000 >= end ? 'closed' : 'provisional') : 'unknown';
    const bar: Bar = { time, tradingDate: date, open, high, low, close,
      volume: Number.isFinite(quote.volume?.[i]) && quote.volume[i] >= 0 ? quote.volume[i] : null, completion };
    if (!byDate.has(date) || byDate.get(date)!.time <= time) byDate.set(date, bar);
  });
  const bars = [...byDate.values()].sort((a, b) => a.time - b.time);
  if (!bars.length) throw new Error('沒有有效的日 K 資料');
  const latest = bars[bars.length - 1];
  const yearStart = Date.parse(`${latest.tradingDate}T00:00:00Z`) - 364 * 86400000;
  const yearBars = bars.filter(b => Date.parse(`${b.tradingDate}T00:00:00Z`) > yearStart);
  const warnings = rejected ? [`已略過 ${rejected} 筆不完整或異常日 K；指標以有效資料計算。`] : [];
  if (latest.completion !== 'closed') warnings.push('最新日 K 尚未確認收盤，指標可能變動。');
  return { bars, meta: {
    provider: 'yahoo', providerSymbol: request.instrument.providerSymbol,
    currency: result.meta?.currency || request.instrument.currency, timezone,
    fetchedAt: new Date(now).toISOString(), latestTradingDate: latest.tradingDate,
    priceBasis: 'provider-ohlc', adjustmentDescription: 'Yahoo 原始 OHLC（含供應商拆股調整，非含息還原報酬）',
    delayMinutes: null, volumeUnit: 'shares', warnings,
    fiftyTwoWeekHigh: positive(result.meta?.fiftyTwoWeekHigh) ? result.meta.fiftyTwoWeekHigh : Math.max(...yearBars.map(b => b.high)),
    fiftyTwoWeekLow: positive(result.meta?.fiftyTwoWeekLow) ? result.meta.fiftyTwoWeekLow : Math.min(...yearBars.map(b => b.low)),
    splitDates: Object.values(result.events?.splits || {}).map((event: any) => event.date).filter(Number.isFinite),
  } };
}

export class YahooFinanceProvider implements MarketDataProvider {
  readonly id = 'wealthfolio-internal-yahoo';
  readonly capabilities = { intervals: ['1d'] as const, priceBases: ['provider-ohlc'] as const };
  constructor(private host: HostAdapter) {}
  async resolve(_input: { symbol: string; market?: string }): Promise<Instrument> {
    throw new Error('Use SymbolResolver before fetching history.');
  }
  async getHistory(request: HistoryRequest): Promise<HistoryResult> {
    if (request.interval !== '1d' || request.priceBasis !== 'provider-ohlc') throw new Error('不支援此資料週期或還原方式');
    const from = Math.floor(Date.parse(request.from) / 1000), to = Math.floor(Date.parse(request.to) / 1000);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error('無效的歷史資料日期範圍');
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(request.instrument.providerSymbol)}?interval=1d&period1=${from}&period2=${to}&events=splits`;
    const response = await this.host.ctx.api.network.request({ url, method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (response.status === 404) throw new Error(`查無 ${request.instrument.providerSymbol} 行情（404），請核對 Yahoo 代碼、上市／上櫃市場及支援範圍；這不是休市判定。`);
    if (response.status !== 200) throw new Error(`Yahoo Finance 請求失敗（${response.status}）`);
    return parseYahooHistory(JSON.parse(response.body), request);
  }
}
