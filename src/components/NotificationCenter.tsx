import { useEffect, useRef, useState } from 'react';
import { StopState, TrailingStopStore } from '../alerts/TrailingStopStore';
import { AlertHistory } from './AlertHistory';
import { TrailingStopSummary } from './TrailingStopPanel';

export function NotificationBell({ state, onClick, expanded }: { state: StopState; onClick: () => void; expanded: boolean }) {
  const pending = state.rules.filter(rule => rule.triggeredAt && !rule.acknowledged).length;
  const needsAttention = !!state.error || Object.keys(state.failures).length > 0 || state.rules.some(rule => rule.needsReview);
  const label = `提醒中心${pending ? `，${pending} 筆待確認` : ''}${needsAttention ? '，有資料需要確認' : ''}`;
  return <button type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={expanded}
    onClick={onClick} className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
    {(pending > 0 || needsAttention) && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-semibold text-zinc-950">{pending ? pending > 99 ? '99+' : pending : '!'}</span>}
  </button>;
}

export function NotificationCenter({ open, onClose, store, state, onSelect }: {
  open: boolean; onClose: () => void; store: TrailingStopStore; state: StopState;
  onSelect: (symbol: string, market: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<'tracking' | 'history'>('tracking');
  useEffect(() => {
    const element = dialog.current!;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  const close = () => { dialog.current?.close(); onClose(); };
  return <dialog ref={dialog} className="notification-drawer" aria-labelledby="notification-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    } }}>
    <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800">
      <div><h2 id="notification-title" className="text-base font-semibold">提醒中心</h2><p className="text-xs text-zinc-400 mt-1">追蹤出場條件與檢視過去提醒</p></div>
      <button type="button" autoFocus aria-label="關閉提醒中心" onClick={close} className="size-11 shrink-0 rounded-full hover:bg-zinc-800 text-zinc-300 inline-flex items-center justify-center">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <div className="flex gap-1 px-5 py-3 border-b border-zinc-800" role="group" aria-label="提醒內容">
      {(['tracking', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={section === value}
        onClick={() => setSection(value)} className={`min-h-11 rounded-full px-4 text-sm ${section === value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`}>
        {value === 'tracking' ? `移動停利 · ${state.rules.length}` : `提醒歷史 · ${state.events.length}`}
      </button>)}
    </div>
    <div className="p-5 min-w-0">
      <div hidden={section !== 'tracking'}><TrailingStopSummary store={store} state={state} onSelect={(symbol, market) => { close(); onSelect(symbol, market); }} /></div>
      <div hidden={section !== 'history'}><AlertHistory events={state.events} droppedEvents={state.droppedEvents} /></div>
    </div>
  </dialog>;
}
