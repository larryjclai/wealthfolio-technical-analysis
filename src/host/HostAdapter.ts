import { AddonContext } from '@wealthfolio/addon-sdk/types';

export class HostAdapter {
  constructor(public readonly ctx: AddonContext) {}

  /**
   * Get all holdings across all active, non-archived accounts.
   * Filters to security-type holdings only (excludes cash).
   */
  async getAllHoldings() {
    const accounts = await this.ctx.api.accounts.getAll();
    const activeAccounts = accounts.filter(a => a.isActive && !a.isArchived);
    const holdingsArrays = await Promise.all(
      activeAccounts.map(a => this.ctx.api.portfolio.getHoldings(a.id))
    );
    return holdingsArrays.flat().filter(h => h.holdingType === 'security');
  }
}
