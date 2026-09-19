import { describe, expect, it, vi } from 'vitest';
import { alertEvent, appendEvents, MAX_HISTORY, parseSnapshot } from '../src/alerts/alert-history';
import { createTrailingStop, evaluateTrailingStop } from '../src/alerts/trailing-stop';
import { TrailingStopStore } from '../src/alerts/TrailingStopStore';
import { YahooFinanceProvider } from '../src/market-data/YahooFinanceProvider';
import type { HostAdapter } from '../src/host/HostAdapter';
import { bar, history, instrument } from './fixtures';
const initial = history([bar('2026-09-16', 100)], '2026-09-16T20:01:00Z');
const rule = () => createTrailingStop(instrument, 'Test', 20, initial, undefined, '2026-09-16T20:02:00Z');
function setup(raw: string | null = null) {
  let data = raw;
  const get = vi.fn(async () => data), set = vi.fn(async (_key: string, value: string) => { data = value; });
  const host = { ctx: { api: { storage: { get, set }, toast: { warning: vi.fn() } } } } as unknown as HostAdapter;
  return { host, store: new TrailingStopStore(host), set, read: () => parseSnapshot(data) };
}
describe('Persistent event history', () => {
  it('migrates version 1 current alerts without inventing missing history', () => {
    const triggered = evaluateTrailingStop(rule(), history([bar('2026-09-18', 79)]));
    const snapshot = parseSnapshot(JSON.stringify({ version: 1, rules: [triggered] }));
    expect(snapshot.events).toHaveLength(1); expect(snapshot.events[0]).toMatchObject({ type: 'imported_trigger', price: 79, threshold: 80 });
    expect(snapshot.monitorEnabled).toBe(false);
  });
  it('retains past events when resetting or removing a rule and restores them', async () => {
    const { store, host } = setup(); await store.initialize();
    await store.configure(instrument, 'Test', 20, initial, 125);
    await store.acknowledge('TEST'); await store.acknowledge('TEST');
    await store.configure(instrument, 'Test', 25, initial);
    await store.configure(instrument, 'Test', 20, initial, undefined, true); await store.remove('TEST');
    expect(store.state.rules).toHaveLength(0);
    expect(store.state.events.map(e => e.type)).toEqual(['enabled', 'triggered', 'acknowledged', 'updated', 'reset', 'disabled']);
    const restored = new TrailingStopStore(host); await restored.initialize(); expect(restored.state.events).toEqual(store.state.events);
  });
  it('does not publish an event or a changed rule if their atomic save fails', async () => {
    const { store, set, read } = setup(); await store.initialize();
    await store.configure(instrument, 'Test', 20, initial);
    set.mockRejectedValueOnce(new Error('full'));
    await expect(store.configure(instrument, 'Test', 20, initial, 125)).rejects.toThrow('full');
    expect(store.state.events.map(e => e.type)).toEqual(['enabled']); expect(read().rules[0].peak).toBe(100);
  });
  it('stores failure/recovery transitions rather than every repeated failed poll', async () => {
    const quote = vi.spyOn(YahooFinanceProvider.prototype, 'getHistory');
    try {
      const { store } = setup(); await store.initialize(); await store.configure(instrument, 'Test', 20, initial);
      quote.mockRejectedValue(new Error('offline')); await store.poll(true); await store.poll(true);
      quote.mockResolvedValue(history([bar('2026-09-18', 100)])); await store.poll(true); await store.poll(true);
      expect(store.state.events.map(e => e.type)).toEqual(['enabled', 'fetch_failed', 'fetch_recovered']);
    } finally { quote.mockRestore(); }
  });
  it('snapshots the high at the first trigger, not a later recovery high', () => {
    const evaluated = evaluateTrailingStop(rule(), history([bar('2026-09-17', 79), bar('2026-09-18', 150)]));
    expect(evaluated.peak).toBe(150);
    expect(alertEvent('triggered', evaluated)).toMatchObject({ peak: 100, price: 79, threshold: 80, tradingDate: '2026-09-17' });
  });
  it('bounds retention and exposes the number of dropped records', () => {
    const additions = Array.from({length: MAX_HISTORY + 5}, () => alertEvent('enabled', rule()));
    const result = appendEvents(parseSnapshot(null), additions);
    expect(result.events).toHaveLength(MAX_HISTORY); expect(result.droppedEvents).toBe(5); expect(result.events[0].id).toBe(additions[5].id);
  });
  it('bounds UTF-8 storage size and keeps the newest events', () => {
    const additions = Array.from({length: MAX_HISTORY}, () => alertEvent('enabled', rule(), '測'.repeat(400)));
    const result = appendEvents(parseSnapshot(null), additions);
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(220000);
    expect(result.droppedEvents).toBeGreaterThan(0); expect(result.events[result.events.length - 1].id).toBe(additions[additions.length - 1].id);
  });
  it('rejects corrupted history without losing existing data', async () => {
    const raw = JSON.stringify({ ...parseSnapshot(null), events: [{ id: 'x', type: 'unknown' }] });
    const { store, set } = setup(raw); await store.initialize();
    expect(store.state.ready).toBe(false); expect(set).not.toHaveBeenCalled();
  });
  it('does not restore transient runtime flags from saved data', () => {
    const snapshot = parseSnapshot(JSON.stringify({ ...parseSnapshot(null), checking: true, runtimeActive: true }));
    expect(snapshot).not.toHaveProperty('checking'); expect(snapshot).not.toHaveProperty('runtimeActive');
  });
});
