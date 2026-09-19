import { useEffect, useState } from 'react';
import { TrailingStopStore, StopState } from '../alerts/TrailingStopStore';
import { drawdown, stopPrice } from '../alerts/trailing-stop';
import { HistoryResult, Instrument } from '../market-data/types';

export function TrailingStopPanel({ store, state, instrument, displayName, refreshHistory }: {
  store: TrailingStopStore; state: StopState; instrument: Instrument; displayName: string; refreshHistory: () => Promise<HistoryResult>;
}) {
  const rule = state.rules.find(r => r.instrument.providerSymbol === instrument.providerSymbol);
  const [percent, setPercent] = useState(String(rule?.percent ?? 20));
  useEffect(() => setPercent(String(rule?.percent ?? 20)), [rule?.percent]);
  const [peak, setPeak] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const action = async (fn: () => Promise<void>, success: string) => {
    setBusy(true); setMessage('');
    try { await fn(); setMessage(success); } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  };
  const save = (reset = false) => action(async () => {
    const freshHistory = await refreshHistory();
    await store.configure(instrument, displayName, Number(percent), freshHistory, peak.trim() ? Number(peak) : undefined, reset);
  }, reset ? '已重新開始追蹤' : '設定已儲存');
  return <section className="mb-6 p-4 border border-zinc-800 rounded-xl bg-zinc-900" aria-label="移動停利設定">
    <h2 className="font-medium mb-2">移動停利提醒</h2>
    <p className="text-sm text-zinc-400 mb-4">高點只會上移。從最近已收盤日 K 收盤價開始，往後以已收盤日 K 的最高價更新高點、收盤價判斷回落；不使用未收盤價格或盤中最低價觸發。</p>
    {rule && <p className="text-sm tabular-nums mb-4">追蹤高點 {rule.peak.toFixed(2)} · 提醒價 {stopPrice(rule).toFixed(2)} · 回落 {drawdown(rule).toFixed(2)}% · {rule.needsReview ? '需重新確認' : rule.triggeredAt ? '已觸發' : '追蹤中'}</p>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="text-sm text-zinc-300">從高點回落（%）<input type="number" min="0.01" max="99.99" step="0.01" required value={percent} onChange={e => setPercent(e.target.value)} className="block mt-1 w-36 rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-100" /></label>
      <label className="text-sm text-zinc-300">手動起始高點（選填）<input type="number" min="0.000001" step="any" value={peak} onChange={e => setPeak(e.target.value)} placeholder={rule ? '留空沿用高點' : '留空使用最近收盤價'} className="block mt-1 w-52 rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-100 placeholder:text-zinc-400" /></label>
      <button disabled={busy || !state.ready} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '儲存中…' : rule ? '更新設定' : '啟用提醒'}</button>
      {rule && <>
        <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm disabled:opacity-50">重新開始追蹤</button>
        <button type="button" disabled={busy} onClick={() => void action(() => store.remove(instrument.providerSymbol), '已停用提醒')} className="px-3 py-2 text-sm text-zinc-300 disabled:opacity-50">停用</button>
      </>}
    </form>
    <p className="text-xs text-zinc-400 mt-3">重新開始會重設本次觸發狀態，歷史仍保留；以手動高點或最近收盤價為新基準，提醒不代表交易一定獲利。</p>
    {message && <p role="status" className="text-sm mt-3">{message}</p>}
  </section>;
}

export function TrailingStopSummary({ store, state, onSelect }: { store: TrailingStopStore; state: StopState; onSelect: (symbol: string, market: string) => void }) {
  const [actionError, setActionError] = useState('');
  const acknowledge = async (symbol: string) => {
    try { await store.acknowledge(symbol); setActionError(''); } catch (error) { setActionError(String(error)); }
  };
  return <section className="mb-6 p-4 border border-zinc-800 rounded-xl bg-zinc-900" aria-label="移動停利追蹤清單">
    <h2 className="font-medium mb-2">移動停利 · {state.rules.length} 檔</h2>
    <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
      <span role="status">{!state.ready ? '等待設定載入' : state.checking ? '正在檢查已收盤日 K…' : '每日收盤檢查'}</span>
      <button disabled={!state.ready || state.checking || !state.rules.length} onClick={() => void store.poll(true)} className="px-3 py-1.5 border border-zinc-600 rounded-lg disabled:opacity-50">立即檢查日 K</button>
    </div>
    <p className="text-sm text-zinc-400">每日首次開啟或回到套件時，依各股票市場日期掃描一次最近已收盤日 K。休市沿用上一交易日，不重複提醒；不在背景定時檢查。若今天已掃描，收盤後可按「立即檢查日 K」。</p>
    <p className="text-xs text-zinc-400 mt-2">本次開啟最近檢查：{state.lastCompletedAt ? new Date(state.lastCompletedAt).toLocaleString() : '尚未完成'}</p>
    {(state.error || actionError) && <p role="alert" className="mt-3 text-red-400">{state.error || actionError}</p>}
    {!state.ready && !state.error && <p role="status" className="mt-3 text-zinc-400">正在載入提醒設定…</p>}
    {state.error && !state.ready && <button className="mt-2 underline" onClick={() => void store.initialize().then(() => store.poll())}>重試載入設定</button>}
    {state.rules.length > 0 && <ul className="divide-y divide-zinc-800 mt-3">
      {state.rules.map(rule => <li key={rule.instrument.providerSymbol} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <button className="font-medium text-blue-400 hover:underline" onClick={() => onSelect(rule.instrument.symbol, rule.instrument.market)}>{rule.displayName} ({rule.instrument.providerSymbol})</button>
          <p className="text-zinc-300 tabular-nums mt-1">高點 {rule.peak.toFixed(2)} · 回落 {drawdown(rule).toFixed(2)}% / {rule.percent}% · 提醒價 {stopPrice(rule).toFixed(2)}</p>
          <p className="text-xs text-zinc-400 mt-1">收盤日 {rule.lastTradingDate} · 擷取 {new Date(rule.checkedAt).toLocaleString()}</p>
          {rule.triggeredAt && <p className="text-amber-300 mt-1">{rule.acknowledged ? '已確認提醒' : '已達出場提醒條件'}：{rule.triggeredAt} 價格 {rule.triggeredPrice?.toFixed(2)} ≤ 當時提醒價 {rule.triggeredStop?.toFixed(2)}</p>}
          {rule.needsReview && <p role="alert" className="text-amber-300 mt-1">{rule.needsReview}</p>}
          {state.failures[rule.instrument.providerSymbol] && <p role="alert" className="text-red-400 mt-1">更新失敗，保留上次結果：{state.failures[rule.instrument.providerSymbol]}</p>}
        </div>
        {rule.triggeredAt && !rule.acknowledged && <button className="border border-zinc-600 rounded-lg px-3 py-2" onClick={() => void acknowledge(rule.instrument.providerSymbol)}>確認提醒</button>}
      </li>)}
    </ul>}
  </section>;
}
