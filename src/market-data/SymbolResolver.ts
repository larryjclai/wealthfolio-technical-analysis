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
    let market = symbol.endsWith('.TWO') ? 'TPEX' as const : symbol.endsWith('.TW') ? 'TWSE' as const : input.market;

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
      providerSymbol = `${symbol.replace(/\.(TW|TWO)$/, '')}.TW`;
      exchange = 'TWSE';
      currency = 'TWD';
      timezone = 'Asia/Taipei';
    } else if (market === 'TPEX') {
      providerSymbol = `${symbol.replace(/\.(TW|TWO)$/, '')}.TWO`;
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
      symbol: symbol.replace(/\.(TW|TWO)$/, ''),
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
    const rawSymbol = (holding.instrument?.symbol || '').trim().toUpperCase();
    if (!rawSymbol) throw new Error('持倉缺少股票代碼');
    const cleanSymbol = rawSymbol.trim().toUpperCase().replace(/\.(TW|TWO)$/, '');
    let currency = holding.instrument?.currency || holding.localCurrency;

    // Look up Traditional Chinese name and exact market (TWSE/TPEX)
    const twInfo = getTaiwanStockInfo(cleanSymbol);
    const displayName = twInfo?.name || holding.instrument?.name || cleanSymbol;

    let providerSymbol = rawSymbol;
    let timezone = 'UTC';
    let market: Market = 'US';

    if (currency === 'TWD' || twInfo || /\.(TW|TWO)$/.test(rawSymbol) || /^\d{4,6}$/.test(cleanSymbol)) {
      market = rawSymbol.endsWith('.TWO') ? 'TPEX' : rawSymbol.endsWith('.TW') ? 'TWSE' : twInfo?.market || 'TWSE';
      providerSymbol = market === 'TPEX' ? `${cleanSymbol}.TWO` : `${cleanSymbol}.TW`;
      currency = 'TWD';
      timezone = 'Asia/Taipei';
    } else if (currency === 'USD') {
      providerSymbol = cleanSymbol;
      timezone = 'America/New_York';
    } else {
      throw new Error(`尚未支援 ${rawSymbol} 的市場（${currency}）`);
    }

    return { providerSymbol, currency, timezone, displayName, market };
  }
}
