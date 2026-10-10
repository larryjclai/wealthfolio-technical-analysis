import { useEffect, useState } from 'react';
import { SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@wealthfolio/ui';
import { StopState, TrailingStopStore } from '../alerts/TrailingStopStore';
import { AlertHistory } from './AlertHistory';
import { TrailingStopSummary } from './TrailingStopPanel';
import { MarketDataIssues, MarketDataNotice } from './MarketDataNotice';

export function NotificationIndicator({ state, marketData, onClick, expanded }: {
  state: StopState; marketData: MarketDataIssues; onClick: () => void; expanded: boolean;
}) {
  const pending = state.rules.filter(rule => rule.triggeredAt && !rule.acknowledged).length;
  const marketCount = marketData.failures.length + marketData.warnings.length;
  const needsAttention = Object.keys(state.failures).length > 0 || state.rules.some(rule => rule.needsReview);
  const severity = state.error || pending > 0 ? 'error' : needsAttention || marketCount > 0 ? 'warning' : 'info';
  const label = `提醒中心${pending ? `，${pending} 筆移動停利待確認` : ''}${state.error ? '，提醒設定發生錯誤' : ''}${needsAttention ? '，有資料需要確認' : ''}${marketCount ? `，行情注意事項：${marketData.failures.length} 檔暫無行情，${marketData.warnings.length} 筆資料提示` : ''}`;
  return <SheetTrigger asChild><button type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={expanded}
    onClick={onClick} className="health-status-trigger" data-severity={severity}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 4.1 2.1 18.3A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.7L13.7 4.1a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" />
    </svg>
  </button></SheetTrigger>;
}

export function NotificationCenter({ open, onClose, store, state, marketData, onSelect }: {
  open: boolean; onClose: () => void; store: TrailingStopStore; state: StopState; marketData: MarketDataIssues;
  onSelect: (symbol: string, market: string) => void;
}) {
  const [section, setSection] = useState<'market' | 'tracking' | 'history' | null>(null);
  useEffect(() => { if (!open) setSection(null); }, [open]);
  const marketCount = marketData.failures.length + marketData.warnings.length;
  const trackingNeedsAttention = state.error || Object.keys(state.failures).length > 0 || state.rules.some(rule => rule.needsReview || (rule.triggeredAt && !rule.acknowledged));
  const currentSection = section ?? (trackingNeedsAttention || !marketCount ? 'tracking' : 'market');
  return <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-[640px] p-0 overflow-y-auto overscroll-contain" style={{ paddingTop: 0 }}>
    <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-800">
      <SheetHeader><SheetTitle className="text-base">提醒中心</SheetTitle><SheetDescription className="text-xs">檢視行情注意事項、追蹤出場條件與過去提醒</SheetDescription></SheetHeader>
      <SheetClose asChild><button type="button" aria-label="關閉提醒中心" className="size-11 shrink-0 rounded-full hover:bg-zinc-800 text-zinc-300 inline-flex items-center justify-center">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button></SheetClose>
    </header>
    <div className="flex flex-wrap gap-1 px-5 py-3 border-b border-zinc-800" role="group" aria-label="提醒內容">
      {(['market', 'tracking', 'history'] as const).map(value => <button key={value} type="button" aria-pressed={currentSection === value}
        onClick={() => setSection(value)} className={`min-h-11 rounded-full px-4 text-sm ${currentSection === value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`}>
        {value === 'market' ? `行情注意事項 · ${marketCount}` : value === 'tracking' ? `移動停利 · ${state.rules.length}` : `提醒歷史 · ${state.events.length}`}
      </button>)}
    </div>
    <div className="p-5 min-w-0">
      <div hidden={currentSection !== 'market'}><MarketDataNotice {...marketData} /></div>
      <div hidden={currentSection !== 'tracking'}><TrailingStopSummary store={store} state={state} onSelect={(symbol, market) => { onClose(); onSelect(symbol, market); }} /></div>
      <div hidden={currentSection !== 'history'}><AlertHistory events={state.events} droppedEvents={state.droppedEvents} /></div>
    </div>
  </SheetContent>;
}
