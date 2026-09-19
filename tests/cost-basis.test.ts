import { describe, expect, it } from 'vitest';
import type { Holding } from '@wealthfolio/addon-sdk';
import { holdingCost } from '../src/indicators/cost-basis';
import { instrument } from './fixtures';
function position(quantity: number, cost: number | null, accountId = 'a'): Holding {
  return {
    id: accountId, accountId, holdingType: 'security', quantity,
    instrument: { id: 'asset', symbol: 'TEST', currency: 'USD', name: 'TEST', quoteMode: 'MARKET' },
    localCurrency: 'USD', baseCurrency: 'TWD', marketValue: { local: 2000, base: 64000 },
    costBasis: cost === null ? null : { local: cost, base: cost * 32 }, asOfDate: '2026-09-18', weight: 1,
  };
}
describe('Remaining holding cost', () => {
  it('weights host remaining costs by shares across accounts, using local currency', () => {
    const result = holdingCost([position(10, 1000), position(30, 6000, 'b')], instrument);
    expect(result).toMatchObject({ averageCost: 175, totalCost: 7000, quantity: 40, accounts: 2, currency: 'USD' });
  });
  it('keeps the host cost for a partially sold position, without replaying old purchases', () => {
    expect(holdingCost([position(5, 700)], instrument).averageCost).toBe(140);
  });
  it('hides fully closed positions and ignores unrelated symbols and cash', () => {
    const cash = { ...position(10, 1000), holdingType: 'cash' as const };
    const other = { ...position(10, 1000), instrument: { ...position(1, 1).instrument!, symbol: 'OTHER' } };
    expect(holdingCost([position(0, 0), cash, other], instrument).averageCost).toBeNull();
  });
  it('does not calculate a biased average using only accounts with known costs', () => {
    expect(holdingCost([position(10, 1000), position(30, null, 'b')], instrument).averageCost).toBeNull();
  });
  it('does not silently combine currencies or long and short holdings', () => {
    expect(holdingCost([{ ...position(10, 1000), localCurrency: 'TWD' }], instrument).averageCost).toBeNull();
    expect(holdingCost([position(10, 1000), position(-5, -500)], instrument).averageCost).toBeNull();
  });
  it('supports zero cost and fractional shares, and retains snapshot dates', () => {
    expect(holdingCost([position(2.5, 0)], instrument).averageCost).toBe(0);
    const result = holdingCost([position(2.5, 250), { ...position(2.5, 500, 'b'), asOfDate: '2026-09-17' }], instrument);
    expect(result.averageCost).toBe(150); expect(result.asOfDates).toEqual(['2026-09-17', '2026-09-18']);
  });
  it.each([NaN, Infinity, -1])('rejects invalid book costs %s', cost => expect(holdingCost([position(1, cost)], instrument).averageCost).toBeNull());
  it('does not display a zero average when combined share counts overflow', () => {
    expect(holdingCost([position(Number.MAX_VALUE, 1), position(Number.MAX_VALUE, 1, 'b')], instrument).averageCost).toBeNull();
  });
});
