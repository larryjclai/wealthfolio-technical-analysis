import { describe, expect, it, vi } from 'vitest';
import { createTrailingStop, evaluateTrailingStop, stopPrice, parseRules, validatePercent } from '../src/alerts/trailing-stop';
import { TrailingStopStore } from '../src/alerts/TrailingStopStore';
import { HostAdapter } from '../src/host/HostAdapter';
import { bar, history, instrument } from './fixtures';

const initial = history([bar('2026-09-16', 100, 120, 90)], '2026-09-16T20:01:00Z');
const start = () => createTrailingStop(instrument, 'Test', 20, initial, undefined, '2026-09-16T20:02:00Z');
describe('Trailing stops', () => {
  it('starts at observed price, excluding pre-activation high', () => {
    const rule = evaluateTrailingStop(start(), initial);
    expect(rule.peak).toBe(100); expect(rule.triggeredAt).toBeUndefined();
  });
  it('accepts a new intraday high after activation', () => {
    const rule = evaluateTrailingStop(start(), history([bar('2026-09-16', 120, 130, 90)]));
    expect(rule.peak).toBe(130);
  });
  it('raises the peak and triggers at exactly 20% without rounding', () => {
    const rule = evaluateTrailingStop(start(), history([bar('2026-09-17', 110, 125, 105), bar('2026-09-18', 100, 115, 95)]));
    expect(rule.peak).toBe(125); expect(stopPrice(rule)).toBe(100);
    expect(rule.triggeredAt).toBe('2026-09-18'); expect(rule.triggeredPrice).toBe(100);
  });
  it('never lowers a peak and retains a missed close crossing after recovery', () => {
    const rule = evaluateTrailingStop(start(), history([bar('2026-09-17', 79, 100, 70), bar('2026-09-18', 110, 115, 100)]));
    expect(rule.triggeredAt).toBe('2026-09-17'); expect(rule.triggeredStop).toBe(80);
    expect(rule.peak).toBe(115);
    const recovered = evaluateTrailingStop({ ...rule, acknowledged: true }, history([bar('2026-09-19', 120)]));
    expect(recovered.triggeredAt).toBe('2026-09-17'); expect(recovered.acknowledged).toBe(true);
  });
  it('does not trigger from ambiguous intraday lows', () => {
    const rule = evaluateTrailingStop(start(), history([bar('2026-09-17', 99, 100, 60)]));
    expect(rule.triggeredAt).toBeUndefined();
  });
  it('supports a user-entered high and immediate alert', () => {
    const rule = createTrailingStop(instrument, 'Test', 20, initial, 125);
    expect(evaluateTrailingStop(rule, initial).triggeredAt).toBe('2026-09-16');
  });
  it('pauses on a split instead of sending a false drawdown alert', () => {
    const data = history([bar('2026-09-18', 50)]);
    data.meta.splitDates = [Date.parse('2026-09-18T13:30:00Z') / 1000];
    const rule = evaluateTrailingStop(start(), data);
    expect(rule.needsReview).toBeTruthy(); expect(rule.triggeredAt).toBeUndefined(); expect(rule.peak).toBe(100);
  });
  it('rejects wrong symbols and ignores stale responses', () => {
    const data = history([bar('2026-09-17', 70)], '2026-09-15T00:00:00Z');
    expect(evaluateTrailingStop(start(), data)).toEqual(start());
    data.meta.providerSymbol = 'OTHER'; expect(() => evaluateTrailingStop(start(), data)).toThrow();
  });
  it.each([0, -1, 100, Infinity, NaN])('rejects invalid percentage %s', percent => expect(() => validatePercent(percent)).toThrow());
  it('rejects a peak below the current price', () => expect(() => createTrailingStop(instrument, 'Test', 20, initial, 90)).toThrow());
  it('preserves settings across serialization; rejects corrupt or duplicate data', () => {
    expect(parseRules(JSON.stringify({ version: 1, rules: [start()] }))).toEqual([start()]);
    expect(parseRules(null)).toEqual([]);
    expect(() => parseRules('{')).toThrow();
    expect(() => parseRules(JSON.stringify({ version: 2, rules: [] }))).toThrow();
    expect(() => parseRules(JSON.stringify({ version: 1, rules: [start(), start()] }))).toThrow();
  });
});

function mockStore(raw: string | null = null) {
  let value = raw;
  const get = vi.fn(async () => value);
  const set = vi.fn(async (_key: string, next: string) => { value = next; });
  const warning = vi.fn();
  const host = { ctx: { api: { storage: { get, set }, toast: { warning } } } } as unknown as HostAdapter;
  return { store: new TrailingStopStore(host), host, set, warning };
}
describe('Durable alert settings', () => {
  it('serializes concurrent settings and survives reloading', async () => {
    const { store, host } = mockStore(); await store.initialize();
    await Promise.all([
      store.configure(instrument, 'Test', 20, initial),
      store.configure({ ...instrument, symbol: 'OTHER', providerSymbol: 'OTHER' }, 'Other', 15, { ...initial, meta: { ...initial.meta, providerSymbol: 'OTHER' } }),
    ]);
    expect(store.state.rules).toHaveLength(2);
    const restored = new TrailingStopStore(host); await restored.initialize(); expect(restored.state.rules).toEqual(store.state.rules);
  });
  it('persists a trigger and sends only one toast; acknowledgement survives', async () => {
    const { store, host, warning } = mockStore(); await store.initialize();
    await store.configure(instrument, 'Test', 20, initial, 125);
    await store.configure(instrument, 'Test', 20, initial);
    expect(warning).toHaveBeenCalledTimes(1);
    await store.acknowledge('TEST');
    const restored = new TrailingStopStore(host); await restored.initialize(); expect(restored.state.rules[0].acknowledged).toBe(true);
  });
  it('does not claim a save or send a toast when storage fails', async () => {
    const { store, set, warning } = mockStore(); await store.initialize();
    set.mockRejectedValueOnce(new Error('disk full'));
    await expect(store.configure(instrument, 'Test', 20, initial, 125)).rejects.toThrow('disk full');
    expect(store.state.rules).toHaveLength(0); expect(warning).not.toHaveBeenCalled(); expect(store.state.error).toContain('儲存失敗');
  });
  it('does not overwrite unreadable settings', async () => {
    const { store, set } = mockStore('broken'); await store.initialize();
    expect(store.state.ready).toBe(false);
    await expect(store.configure(instrument, 'Test', 20, initial)).rejects.toThrow(); expect(set).not.toHaveBeenCalled();
  });
  it('changing percentage preserves peak; explicit reset clears trigger', async () => {
    const { store } = mockStore(); await store.initialize();
    await store.configure(instrument, 'Test', 20, initial, 125);
    await store.configure(instrument, 'Test', 25, initial);
    expect(store.state.rules[0].peak).toBe(125); expect(store.state.rules[0].triggeredAt).toBeTruthy();
    await expect(store.configure(instrument, 'Test', 20, initial, 110)).rejects.toThrow();
    await store.configure(instrument, 'Test', 20, initial, undefined, true);
    expect(store.state.rules[0].peak).toBe(100); expect(store.state.rules[0].triggeredAt).toBeUndefined();
    await store.remove('TEST'); expect(store.state.rules).toHaveLength(0);
  });
});

describe('Scheduled quote checking', () => {
  it('updates durable peaks, deduplicates alerts across polls and reports quote errors', async () => {
    const { YahooFinanceProvider } = await import('../src/market-data/YahooFinanceProvider');
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory');
    try {
      const { store, warning } = mockStore();
      await store.initialize(); await store.configure(instrument, 'Test', 20, initial);
      const time = new Date(Date.now() + 1000).toISOString();
      quote.mockResolvedValue(history([bar('2026-09-17', 110, 125, 105), bar('2026-09-18', 100, 115, 95)], time));
      await store.poll(true); await store.poll(true);
      expect(store.state.rules[0].peak).toBe(125);
      expect(store.state.rules[0].triggeredAt).toBe('2026-09-18'); expect(warning).toHaveBeenCalledTimes(1);
      quote.mockRejectedValue(new Error('offline')); await store.poll(true);
      expect(store.state.failures.TEST).toContain('offline'); expect(store.state.rules[0].peak).toBe(125);
      quote.mockResolvedValue(history([bar('2026-09-18', 100, 115, 95)], time)); await store.poll(true);
      expect(store.state.failures.TEST).toBeUndefined();
    } finally { quote.mockRestore(); }
  });
  it('does not resurrect a removed rule when an in-flight quote finishes', async () => {
    const { YahooFinanceProvider } = await import('../src/market-data/YahooFinanceProvider');
    let resolve!: (value: ReturnType<typeof history>) => void;
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockImplementation(() => new Promise(done => { resolve = done; }));
    try {
      const { store } = mockStore(); await store.initialize(); await store.configure(instrument, 'Test', 20, initial);
      const polling = store.poll(true); await store.remove('TEST');
      resolve(history([bar('2026-09-18', 80)])); await polling;
      expect(store.state.rules).toHaveLength(0);
    } finally { quote.mockRestore(); }
  });
});
