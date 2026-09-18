export type Market = 'TWSE' | 'TPEX' | 'US';
export type Interval = '1d' | '5m';
export type PriceBasis = 'provider-ohlc' | 'adjusted-ohlc';

export interface Instrument {
  key: string;                 // e.g., TWSE:2330
  symbol: string;              // e.g., 2330
  market: Market;
  exchange: string;
  currency: string;
  timezone: string;            // IANA timezone
  providerSymbol: string;      // Yahoo format, e.g., 2330.TW
}

export interface Bar {
  time: number;                // UTC epoch seconds
  tradingDate: string;         // Local YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  completion: 'closed' | 'provisional' | 'unknown';
}

export interface HistoryRequest {
  instrument: Instrument;
  interval: Interval;
  from: string;                // UTC ISO timestamp (inclusive)
  to: string;                  // UTC ISO timestamp (exclusive)
  priceBasis: PriceBasis;
}

export interface HistoryResult {
  bars: Bar[];
  meta: {
    provider: string;
    providerSymbol: string;
    currency: string;
    timezone: string;
    fetchedAt: string;
    latestTradingDate: string | null;
    priceBasis: PriceBasis;
    adjustmentDescription: string;
    delayMinutes: number | null;
    volumeUnit: 'shares' | 'unknown';
    warnings: string[];
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };
}

export interface MarketDataProvider {
  readonly id: string;
  readonly capabilities: {
    intervals: readonly Interval[];
    priceBases: readonly PriceBasis[];
  };
  resolve(input: { symbol: string; market?: Market }): Promise<Instrument>;
  getHistory(request: HistoryRequest): Promise<HistoryResult>;
}
