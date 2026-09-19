import { Instrument } from './types';
import { SymbolResolver } from './SymbolResolver';

export interface TradeRecord {
  id: string;
  side: 'BUY' | 'SELL';
  date: string;
  quantity: number;
  price: number;
  currency: string;
  account: string;
}
interface ActivityRow {
  id: string; activityType: string; status?: string; date: Date | string;
  quantity: string | null; unitPrice: string | null; currency: string;
  assetSymbol: string; accountName: string; needsReview: boolean; exchangeMic?: string;
}
export function stockTrades(activities: ActivityRow[], instrument: Instrument): TradeRecord[] {
  const resolver = new SymbolResolver();
  const unique = new Map<string, TradeRecord>();
  for (const activity of activities) {
    if (!['BUY', 'SELL'].includes(activity.activityType) || (activity.status && activity.status !== 'POSTED') || activity.needsReview) continue;
    let symbol: string;
    try {
      const raw = activity.exchangeMic === 'ROCO' && !activity.assetSymbol.endsWith('.TWO') ? `${activity.assetSymbol}.TWO` : activity.assetSymbol;
      symbol = resolver.resolveFromHolding({ instrument: { symbol: raw, currency: activity.currency }, localCurrency: activity.currency }).providerSymbol;
    } catch { continue; }
    if (symbol !== instrument.providerSymbol || activity.currency !== instrument.currency) continue;
    const quantity = Number(activity.quantity), price = Number(activity.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) continue;
    // Activity dates are accounting dates, not quote timestamps: preserve their recorded day.
    const date = (activity.date instanceof Date ? activity.date.toISOString() : activity.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) continue;
    unique.set(activity.id, { id: activity.id, side: activity.activityType as 'BUY' | 'SELL', date, quantity, price, currency: activity.currency, account: activity.accountName });
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}
