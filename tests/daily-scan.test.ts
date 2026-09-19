import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrailingStopStore } from '../src/alerts/TrailingStopStore';
import { YahooFinanceProvider } from '../src/market-data/YahooFinanceProvider';
import { createTrailingStop } from '../src/alerts/trailing-stop';
import { parseSnapshot } from '../src/alerts/alert-history';
import type { HostAdapter } from '../src/host/HostAdapter';
import { bar, history, instrument } from './fixtures';

const initial = history([bar('2026-09-16', 100)], '2026-09-16T20:01:00Z');
function setup() {
  let raw = JSON.stringify({ version: 1, rules: [createTrailingStop(instrument, 'Test', 20, initial, undefined, '2026-09-16T20:02:00Z')] });
  const host = { ctx: { api: { storage: { get: vi.fn(async () => raw), set: vi.fn(async (_key: string, value: string) => { raw = value; }) }, toast: { warning: vi.fn() } } } } as unknown as HostAdapter;
  return { store: new TrailingStopStore(host), host, read: () => parseSnapshot(raw) };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('Daily closed-candle scan', () => {
  it('scans once per market date, persists that choice across restart, and schedules no timers', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-09-19T10:00:00Z');
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockResolvedValue(history([bar('2026-09-18', 100)]));
    const { store, host, read } = setup(); await store.initialize(); await store.poll(); await store.poll();
    expect(quote).toHaveBeenCalledTimes(1); expect(read().dailyScans.TEST).toBe('2026-09-19');
    const restored = new TrailingStopStore(host); await restored.initialize(); await restored.poll(); expect(quote).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(86_400_000); expect(quote).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    await restored.poll(); expect(quote).toHaveBeenCalledTimes(2);
  });
  it('uses market timezone, not UTC midnight, and allows an explicit same-day scan', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-09-18T23:00:00Z');
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockResolvedValue(history([bar('2026-09-18', 100)]));
    const { store } = setup(); await store.initialize(); await store.poll();
    vi.setSystemTime('2026-09-19T01:00:00Z'); await store.poll(); expect(quote).toHaveBeenCalledTimes(1);
    await store.poll(true); expect(quote).toHaveBeenCalledTimes(2);
  });
  it('ignores provisional and unknown bars, then triggers from a confirmed close', async () => {
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockResolvedValue(history([
      bar('2026-09-17', 100), { ...bar('2026-09-18', 60, 200), completion: 'provisional' },
      { ...bar('2026-09-19', 60, 300), completion: 'unknown' },
    ]));
    const { store, host } = setup(); await store.initialize(); await store.poll();
    expect(store.state.rules[0]).toMatchObject({ peak: 100, lastPrice: 100, lastTradingDate: '2026-09-17' });
    expect(host.ctx.api.toast.warning).not.toHaveBeenCalled();
    quote.mockResolvedValue(history([bar('2026-09-18', 79)])); await store.poll(true);
    expect(store.state.rules[0].triggeredPrice).toBe(79); expect(host.ctx.api.toast.warning).toHaveBeenCalledTimes(1);
    await store.poll(true); expect(host.ctx.api.toast.warning).toHaveBeenCalledTimes(1);
  });
  it('uses the last closed price when enabling during a session', async () => {
    const { store } = setup(); await store.initialize(); await store.remove('TEST');
    await store.configure(instrument, 'Test', 20, history([bar('2026-09-17', 100), { ...bar('2026-09-18', 70, 140), completion: 'provisional' }]));
    expect(store.state.rules[0]).toMatchObject({ peak: 100, lastPrice: 100, startTradingDate: '2026-09-17' });
  });
  it('treats an unchanged holiday close as success without a new event', async () => {
    vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockResolvedValue(initial);
    const { store } = setup(); await store.initialize(); await store.poll();
    expect(store.state.failures).toEqual({}); expect(store.state.events).toHaveLength(0);
    expect(store.state.rules[0].lastTradingDate).toBe('2026-09-16');
  });
  it('does not mark a failed request as scanned and permits retry', async () => {
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockRejectedValue(new Error('offline'));
    const { store, read } = setup(); await store.initialize(); await store.poll();
    expect(read().dailyScans.TEST).toBeUndefined();
    quote.mockResolvedValue(initial); await store.poll(); expect(quote).toHaveBeenCalledTimes(2);
    expect(store.state.events.map(event => event.type)).toEqual(['fetch_failed', 'fetch_recovered']);
  });
  it('does not overlap requests or continue after leaving the addon', async () => {
    let finish!: (value: ReturnType<typeof history>) => void;
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { store, host } = setup(); await store.initialize();
    const pending = store.poll(); await store.poll(); expect(quote).toHaveBeenCalledTimes(1);
    store.cancelScan(); finish(history([bar('2026-09-18', 60)])); await pending;
    expect(host.ctx.api.storage.set).not.toHaveBeenCalled(); expect(host.ctx.api.toast.warning).not.toHaveBeenCalled();
    expect(store.state.checking).toBe(false);
  });
  it('ignores in-flight responses after disabling the addon', async () => {
    let finish!: (value: ReturnType<typeof history>) => void;
    vi.spyOn(YahooFinanceProvider.prototype, 'getHistory').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { store, host } = setup(); await store.initialize(); const pending = store.poll(); store.dispose();
    finish(history([bar('2026-09-18', 60)])); await pending;
    expect(host.ctx.api.storage.set).not.toHaveBeenCalled(); expect(host.ctx.api.toast.warning).not.toHaveBeenCalled();
  });
  it('keeps old events and settings while ignoring the retired background switch', () => {
    const raw = { ...parseSnapshot(null), monitorEnabled: true };
    const migrated = parseSnapshot(JSON.stringify(raw));
    expect(migrated.monitorEnabled).toBe(false); expect(migrated.events).toEqual(raw.events);
  });
});
