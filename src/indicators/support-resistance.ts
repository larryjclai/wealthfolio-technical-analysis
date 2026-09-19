import { Bar } from '../market-data/types';
import { calculatePivot, PivotType } from './pivot';

/** Levels for the latest trading session: exclude its own high/low. */
export function supportResistance(bars: Bar[], type: PivotType = 'classic', period = 20) {
  const prior = bars.slice(0, -1).filter(b => b.completion === 'closed');
  const previous = prior[prior.length - 1];
  const window = prior.slice(-period);
  return {
    pivot: previous ? calculatePivot(previous.high, previous.low, previous.close, type) : null,
    baseDate: previous?.tradingDate || '',
    support: window.length === period ? Math.min(...window.map(b => b.low)) : null,
    resistance: window.length === period ? Math.max(...window.map(b => b.high)) : null,
  };
}
