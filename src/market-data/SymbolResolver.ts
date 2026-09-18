import { Instrument, Market } from './types';
import twStockData from './tw-stock-names.json';

interface TwStockInfo {
  name: string;
  market: 'TWSE' | 'TPEX';
}

const twStocks = twStockData as Record<string, TwStockInfo>;

export function getTaiwanStockInfo(symbol: string): TwStockInfo | undefined {
  const clean = symbol.trim().toUpperCase().replace(/\.(TW|TWO)$/, '');
  return twStocks[clean];
}

export class SymbolResolver {
  async resolve(input: { symbol: string; market?: Market }): Promise<Instrument> {
    const symbol = input.symbol.trim().toUpperCase();
    let market = input.market;

    if (!market) {
      const twInfo = getTaiwanStockInfo(symbol);
      if (twInfo) {
        market = twInfo.market;
      } else if (/^\d{4,6}$/.test(symbol)) {
        market = 'TWSE';
      } else {
        market = 'US';
      }
    }

    let providerSymbol = symbol;
    let exchange = '';
    let currency = '';
    let timezone = '';

    if (market === 'TWSE') {
      providerSymbol = `${symbol.replace(/\.TW$/, '')}.TW`;
      exchange = 'TWSE';
      currency = 'TWD';
      timezone = 'Asia/Taipei';
    } else if (market === 'TPEX') {
      providerSymbol = `${symbol.replace(/\.TWO$/, '')}.TWO`;
      exchange = 'TPEX';
      currency = 'TWD';
      timezone = 'Asia/Taipei';
    } else if (market === 'US') {
      providerSymbol = symbol;
      exchange = 'US';
      currency = 'USD';
      timezone = 'America/New_York';
    } else {
      throw new Error(`Unsupported market: ${market}`);
    }

    return {
      key: `${market}:${symbol}`,
      symbol,
      market,
      exchange,
      currency,
      timezone,
      providerSymbol,
    };
  }

  resolveFromHolding(holding: { instrument?: { symbol: string; currency: string; name?: string | null } | null; localCurrency: string }): {
    providerSymbol: string;
    currency: string;
    timezone: string;
    displayName: string;
    market: Market;
  } {
    const rawSymbol = holding.instrument?.symbol || '';
    const cleanSymbol = rawSymbol.trim().toUpperCase().replace(/\.(TW|TWO)$/, '');
    const currency = holding.instrument?.currency || holding.localCurrency;

    // Look up Traditional Chinese name and exact market (TWSE/TPEX)
    const twInfo = getTaiwanStockInfo(cleanSymbol);
    const displayName = twInfo?.name || holding.instrument?.name || cleanSymbol;

    let providerSymbol = rawSymbol;
    let timezone = 'UTC';
    let market: Market = 'US';

    if (currency === 'TWD' || twInfo || /^\d{4,6}$/.test(cleanSymbol)) {
      market = twInfo ? twInfo.market : 'TWSE';
      providerSymbol = market === 'TPEX' ? `${cleanSymbol}.TWO` : `${cleanSymbol}.TW`;
      currency === 'TWD' ? currency : 'TWD';
      timezone = 'Asia/Taipei';
    } else if (['USD', 'EUR', 'GBP'].includes(currency)) {
      providerSymbol = cleanSymbol;
      timezone = 'America/New_York';
    }

    return { providerSymbol, currency, timezone, displayName, market };
  }
}
