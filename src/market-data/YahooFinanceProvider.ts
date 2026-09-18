import { HostAdapter } from '../host/HostAdapter';
import { MarketDataProvider, HistoryRequest, HistoryResult, Instrument } from './types';

export class YahooFinanceProvider implements MarketDataProvider {
  readonly id = 'wealthfolio-internal-yahoo';
  readonly capabilities = {
    intervals: ['1d'] as const,
    priceBases: ['provider-ohlc'] as const,
  };

  constructor(private host: HostAdapter) {}

  async resolve(_input: { symbol: string; market?: string }): Promise<Instrument> {
    throw new Error('SymbolResolver should be used for resolution before calling provider.');
  }

  async getHistory(request: HistoryRequest): Promise<HistoryResult> {
    const { instrument } = request;
    const symbol = instrument.providerSymbol;
    
    // Attempt to fetch from Yahoo Finance via host's brokered network
    let bars: any[] = [];
    let fiftyTwoWeekHigh: number | undefined;
    let fiftyTwoWeekLow: number | undefined;

    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;
      const response = await this.host.ctx.api.network.request({ 
        url, 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200) {
        const data = JSON.parse(response.body);
        const result = data.chart?.result?.[0];
        
        if (result && result.timestamp && result.indicators?.quote?.[0]) {
          fiftyTwoWeekHigh = result.meta?.fiftyTwoWeekHigh;
          fiftyTwoWeekLow = result.meta?.fiftyTwoWeekLow;

          const timestamps = result.timestamp;
          const quote = result.indicators.quote[0];
          
          for (let i = 0; i < timestamps.length; i++) {
            if (quote.close[i] !== null && quote.close[i] !== undefined) {
              const dateObj = new Date(timestamps[i] * 1000);
              bars.push({
                time: timestamps[i],
                tradingDate: dateObj.toISOString().split('T')[0],
                open: quote.open[i] || quote.close[i],
                high: quote.high[i] || quote.close[i],
                low: quote.low[i] || quote.close[i],
                close: quote.close[i],
                volume: quote.volume[i] || 0,
                completion: 'closed'
              });
            }
          }
        } else {
            throw new Error('Yahoo Finance API 回傳格式錯誤或無資料');
        }
      } else {
         throw new Error(`Yahoo Finance API 請求失敗 (狀態碼: ${response.status}): ${response.body}`);
      }
    } catch (e: any) {
      console.error('Failed to fetch from Yahoo Finance:', e);
      throw new Error(`網路請求失敗: ${e.message || String(e)}`);
    }

    return {
      bars,
      meta: {
        provider: 'yahoo',
        providerSymbol: instrument.providerSymbol,
        currency: instrument.currency || 'TWD',
        timezone: instrument.timezone || 'Asia/Taipei',
        fetchedAt: new Date().toISOString(),
        latestTradingDate: bars.length > 0 ? bars[bars.length - 1].tradingDate : null,
        priceBasis: 'provider-ohlc',
        adjustmentDescription: 'Unadjusted or host-adjusted',
        delayMinutes: 15,
        volumeUnit: 'shares',
        warnings: [],
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
      }
    };
  }

  async getBatchHistory(symbols: string[]): Promise<Map<string, HistoryResult>> {
    const results = new Map<string, HistoryResult>();
    for (const symbol of symbols) {
      try {
        const instrument = { providerSymbol: symbol, currency: '', timezone: '' } as Instrument;
        const result = await this.getHistory({
          instrument,
          interval: '1d',
          from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
          priceBasis: 'provider-ohlc'
        });
        results.set(symbol, result);
        // Small delay to avoid rate limiting
        if (symbols.indexOf(symbol) < symbols.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e) {
        console.error(`Failed to fetch history for ${symbol}:`, e);
      }
    }
    return results;
  }
}
