import { HostAdapter } from '../host/HostAdapter';
import { YahooFinanceProvider, tradingDate } from '../market-data/YahooFinanceProvider';
import { HistoryResult, Instrument } from '../market-data/types';
import { closedHistory, createTrailingStop, evaluateTrailingStop, TrailingStop, validatePercent } from './trailing-stop';
import { AlertEvent, AlertSnapshot, alertEvent, appendEvents, parseSnapshot } from './alert-history';

// Retain the original key: upgrade atomically, and make older versions fail closed.
const KEY = 'trailing-stops-v1';
export interface StopState extends AlertSnapshot {
  ready: boolean;
  error: string | null;
  checking: boolean;
  lastAttemptAt: string | null;
  lastCompletedAt: string | null;
}
export class TrailingStopStore {
  state: StopState = {
    ...parseSnapshot(null), ready: false, error: null, checking: false,
    lastAttemptAt: null, lastCompletedAt: null,
  };
  private listeners = new Set<(state: StopState) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private scanGeneration = 0;
  cancelScan() { this.scanGeneration++; }
  constructor(private host: HostAdapter) {}
  subscribe(listener: (state: StopState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private publish(update: Partial<StopState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...update };
    this.listeners.forEach(listener => listener(this.state));
  }
  dispose() { this.disposed = true; this.listeners.clear(); }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.queue.then(fn);
    this.queue = job.catch(() => {});
    return job;
  }
  async initialize() {
    return this.serial(async () => {
      if (this.state.ready || this.disposed) return;
      try {
        if (!this.host.ctx.api.storage) throw new Error('此 Wealthfolio 版本未提供設定儲存，請更新主程式');
        const snapshot = parseSnapshot(await this.host.ctx.api.storage.get(KEY));
        this.publish({ ...snapshot, ready: true, error: null });
      } catch (error) { this.publish({ error: String(error), ready: false }); }
    });
  }
  private snapshot(): AlertSnapshot {
    const { rules, events, droppedEvents, monitorEnabled, dailyScans, failures } = this.state;
    return { version: 2, rules, events, droppedEvents, monitorEnabled, dailyScans, failures };
  }
  private async commit(update: Partial<AlertSnapshot>, additions: AlertEvent[] = [], notifications: TrailingStop[] = []) {
    if (this.disposed) return;
    if (!this.state.ready) throw new Error('設定尚未載入，無法儲存');
    let snapshot: AlertSnapshot;
    try {
      snapshot = appendEvents({ ...this.snapshot(), ...update }, additions);
      await this.host.ctx.api.storage.set(KEY, JSON.stringify(snapshot));
    } catch (error) {
      this.publish({ error: `移動停利儲存失敗：${String(error)}` });
      throw error;
    }
    if (this.disposed) return;
    this.publish({ ...snapshot, error: null });
    notifications.forEach(rule => {
      try { this.host.ctx.api.toast.warning(`${rule.displayName} 已達回落 ${rule.percent}% 的移動停利條件，請檢視持倉。`); }
      catch { /* The persisted history and active alert remain available. */ }
    });
  }
  configure(instrument: Instrument, displayName: string, percent: number, history: HistoryResult, peak?: number, reset = false) {
    return this.serial(async () => {
      validatePercent(percent);
      history = closedHistory(history);
      if (!history.bars.length) throw new Error('尚無已收盤日 K，請收盤後再設定提醒');
      const old = this.state.rules.find(rule => rule.instrument.providerSymbol === instrument.providerSymbol);
      if (old?.needsReview && !reset) throw new Error('請確認拆股後價格並重新開始追蹤');
      if (old && peak !== undefined && (!Number.isFinite(peak) || peak < old.peak) && !reset) throw new Error('追蹤高點不能下調；如要更換基準，請重新開始追蹤');
      const rule = old && !reset ? { ...old, percent, peak: peak ?? old.peak } : createTrailingStop(instrument, displayName, percent, history, peak);
      const next = evaluateTrailingStop(rule, history);
      const events = [alertEvent(old ? reset ? 'reset' : 'updated' : 'enabled', next,
        old ? `原設定 ${old.percent}%，原高點 ${old.peak.toFixed(4)}` : undefined)];
      const newTrigger = next.triggeredAt && (!old?.triggeredAt || reset);
      if (newTrigger) events.push(alertEvent('triggered', next));
      if (next.needsReview && !old?.needsReview) events.push(alertEvent('review_required', next, next.needsReview));
      const failures = { ...this.state.failures };
      if (failures[instrument.providerSymbol]) events.push(alertEvent('fetch_recovered', next));
      delete failures[instrument.providerSymbol];
      await this.commit({ rules: [...this.state.rules.filter(r => r.instrument.providerSymbol !== instrument.providerSymbol), next], failures, dailyScans: { ...this.state.dailyScans, [instrument.providerSymbol]: tradingDate(Date.now() / 1000, instrument.timezone) } }, events, newTrigger ? [next] : []);
    });
  }
  remove(symbol: string) {
    return this.serial(async () => {
      const rule = this.state.rules.find(r => r.instrument.providerSymbol === symbol);
      if (!rule) return;
      const failures = { ...this.state.failures }; delete failures[symbol];
      const dailyScans = { ...this.state.dailyScans }; delete dailyScans[symbol];
      await this.commit({ rules: this.state.rules.filter(r => r !== rule), failures, dailyScans }, [alertEvent('disabled', rule)]);
    });
  }
  acknowledge(symbol: string) {
    return this.serial(async () => {
      const rule = this.state.rules.find(r => r.instrument.providerSymbol === symbol);
      if (!rule?.triggeredAt || rule.acknowledged) return;
      await this.commit({ rules: this.state.rules.map(r => r === rule ? { ...rule, acknowledged: true } : r) }, [alertEvent('acknowledged', rule)]);
    });
  }
  async poll(force = false) {
    if (!this.state.ready || this.state.checking || this.disposed) return;
    const generation = this.scanGeneration;
    this.publish({ checking: true, lastAttemptAt: new Date().toISOString() });
    try {
      const provider = new YahooFinanceProvider(this.host);
      for (const saved of [...this.state.rules]) {
        if (this.disposed || generation !== this.scanGeneration) break;
        if (saved.needsReview) continue;
        const scanDate = tradingDate(Date.now() / 1000, saved.instrument.timezone);
        if (!force && this.state.dailyScans[saved.instrument.providerSymbol] === scanDate) continue;
        let history: HistoryResult;
        try {
          history = await provider.getHistory({ instrument: saved.instrument, interval: '1d', priceBasis: 'provider-ohlc',
            from: new Date(Date.parse(`${saved.lastTradingDate}T00:00:00Z`) - 14 * 86400000).toISOString(), to: new Date().toISOString() });
        } catch (error) {
          await this.serial(async () => {
            if (this.disposed || generation !== this.scanGeneration || !this.state.rules.includes(saved)) return;
            const message = String(error).slice(0, 400);
            const events = this.state.failures[saved.instrument.providerSymbol] ? [] : [alertEvent('fetch_failed', saved, message)];
            await this.commit({ failures: { ...this.state.failures, [saved.instrument.providerSymbol]: message } }, events);
          });
          continue;
        }
        await this.serial(async () => {
          if (this.disposed || generation !== this.scanGeneration) return;
          const current = this.state.rules.find(r => r.instrument.providerSymbol === saved.instrument.providerSymbol);
          // Reject quotes from an older reset or settings revision.
          if (current !== saved) return;
          const next = evaluateTrailingStop(current, closedHistory(history));
          const newTrigger = next.triggeredAt && !current.triggeredAt;
          const events: AlertEvent[] = [];
          if (newTrigger) events.push(alertEvent('triggered', next));
          if (next.needsReview && !current.needsReview) events.push(alertEvent('review_required', next, next.needsReview));
          if (this.state.failures[saved.instrument.providerSymbol]) events.push(alertEvent('fetch_recovered', next));
          const failures = { ...this.state.failures }; delete failures[saved.instrument.providerSymbol];
          await this.commit({ rules: this.state.rules.map(r => r === current ? next : r), failures, dailyScans: { ...this.state.dailyScans, [saved.instrument.providerSymbol]: scanDate } }, events, newTrigger ? [next] : []);
        });
      }
      if (generation === this.scanGeneration) this.publish({ lastCompletedAt: new Date().toISOString() });
    } catch (error) {
      // commit already records storage failures. Leave previous durable state intact.
      this.publish({ error: this.state.error || `日 K 檢查失敗：${String(error)}` });
    } finally { this.publish({ checking: false }); }
  }
}
