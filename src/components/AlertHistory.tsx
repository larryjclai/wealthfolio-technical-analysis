import { useMemo, useState } from 'react';
import { AlertEvent, AlertEventType, eventLabels, MAX_HISTORY } from '../alerts/alert-history';

const number = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
export function AlertHistory({ events, droppedEvents }: { events: AlertEvent[]; droppedEvents: number }) {
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const symbols = useMemo(() => [...new Set(events.flatMap(event => event.symbol ? [event.symbol] : []))].sort(), [events]);
  const filtered = useMemo(() => [...events].reverse().filter(event => (!symbol || event.symbol === symbol) && (!type || event.type === type)), [events, symbol, type]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20);
  return <section aria-label="提醒歷史">
    <h3 className="font-medium mb-3">提醒歷史 · {events.length} 筆</h3>
    <div>
      <p className="text-sm text-zinc-400 mb-3">保留最近 {MAX_HISTORY} 筆內、符合儲存容量的事件。確認、重設或停用股票不會刪除其歷史；記錄時間為偵測／操作時間，行情日為價格所屬日期。行情失敗時沿用上次有效價格快照。</p>
      {droppedEvents > 0 && <p className="text-sm text-amber-300 mb-3">已有 {droppedEvents} 筆較早事件超過保留範圍。</p>}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="text-sm text-zinc-300">股票 <select className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2" value={symbol} onChange={e => { setSymbol(e.target.value); setPage(0); }}><option value="">全部股票與設定事件</option>{symbols.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm text-zinc-300">事件 <select className="ml-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2" value={type} onChange={e => { setType(e.target.value); setPage(0); }}><option value="">全部事件</option>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {filtered.length === 0 ? <p className="text-sm text-zinc-400 py-4">{events.length ? '沒有符合篩選條件的事件。' : '尚無提醒歷史。啟用股票追蹤後，設定與提醒事件會記錄於此。'}</p> : <>
        <ol className="divide-y divide-zinc-800">
          {visible.map(event => <li key={event.id} className="py-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0 break-words">
                <div>{event.symbol ? `${event.displayName || event.symbol} (${event.symbol})` : '背景監控（舊版）'}</div>
                <div className={event.type === 'triggered' || event.type === 'fetch_failed' ? 'text-amber-300' : 'text-zinc-300'}>{eventLabels[event.type as AlertEventType]}</div>
              </div>
              <div className="text-xs text-zinc-400 tabular-nums">
                <time dateTime={event.recordedAt}>{new Date(event.recordedAt).toLocaleString()}</time>
                {event.tradingDate && <div>行情 {event.tradingDate}</div>}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 mt-3 text-xs tabular-nums">
              <div className="min-w-0"><dt className="text-zinc-400">價格快照</dt><dd className="mt-1 break-words">{number(event.price)} {event.currency}</dd></div>
              <div className="min-w-0"><dt className="text-zinc-400">高點快照</dt><dd className="mt-1 break-words">{number(event.peak)}</dd></div>
              <div className="min-w-0"><dt className="text-zinc-400">提醒價{event.percent !== undefined ? `（${event.percent}%）` : ''}</dt><dd className="mt-1 break-words">{number(event.threshold)}</dd></div>
            </dl>
            {event.detail && <p className="mt-3 text-xs text-zinc-400 break-words">{event.detail}</p>}
          </li>)}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 px-3 py-1.5 border border-zinc-700 rounded-lg disabled:opacity-50">上一頁</button>
          <span>{currentPage + 1} / {totalPages} 頁 · {filtered.length} 筆</span>
          <button disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)} className="min-h-11 px-3 py-1.5 border border-zinc-700 rounded-lg disabled:opacity-50">下一頁</button>
        </div>
      </>}
    </div>
  </section>;
}
