import type { Holding } from '@wealthfolio/addon-sdk';
import { Instrument } from '../market-data/types';
import { SymbolResolver } from '../market-data/SymbolResolver';

export interface HoldingCost {
  averageCost: number | null;
  totalCost: number | null;
  quantity: number;
  accounts: number;
  currency: string;
  asOfDates: string[];
  reason: string | null;
}

/** Use the host's remaining book cost; do not recompute historical lots or FX. */
export function holdingCost(holdings: Holding[], instrument: Instrument): HoldingCost {
  const resolver = new SymbolResolver();
  const positions = holdings.filter(holding => {
    if (holding.holdingType !== 'security' || holding.quantity === 0) return false;
    try { return resolver.resolveFromHolding(holding).providerSymbol === instrument.providerSymbol; }
    catch { return false; }
  });
  const result: HoldingCost = {
    averageCost: null, totalCost: null, quantity: 0, accounts: new Set(positions.map(p => p.accountId)).size,
    currency: instrument.currency, asOfDates: [...new Set(positions.map(p => p.asOfDate).filter(Boolean))].sort(), reason: null,
  };
  if (!positions.length) return { ...result, reason: '目前沒有此股票的有效持倉，成本線不顯示。' };
  if (positions.some(p => !Number.isFinite(p.quantity) || p.quantity < 0)) {
    return { ...result, reason: '包含空頭或無效股數，目前不合併計算成本線。' };
  }
  result.quantity = positions.reduce((sum, p) => sum + p.quantity, 0);
  if (!Number.isFinite(result.quantity)) return { ...result, quantity: 0, reason: '股數總和超出可計算範圍，成本線不顯示。' };
  if (positions.some(p => p.localCurrency !== instrument.currency)) {
    return { ...result, reason: '持倉成本幣別與行情不同，未換匯合併，成本線不顯示。' };
  }
  if (positions.some(p => typeof p.costBasis?.local !== 'number' || !Number.isFinite(p.costBasis.local) || p.costBasis.local < 0)) {
    return { ...result, reason: '部分帳戶缺少有效成本，請先在 Wealthfolio 補齊；不使用部分帳戶推算。' };
  }
  const totalCost = positions.reduce((sum, p) => sum + p.costBasis!.local, 0);
  const averageCost = totalCost / result.quantity;
  if (!Number.isFinite(totalCost) || !Number.isFinite(averageCost)) return { ...result, reason: '成本數值超出可計算範圍。' };
  return { ...result, totalCost, averageCost };
}
