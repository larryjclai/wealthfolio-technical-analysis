import { useRef } from 'react';

/** Keep recoverable quote failures accessible without displacing the holdings table. */
export function MarketDataNotice({ failures, warnings }: { failures: string[]; warnings: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (!failures.length && !warnings.length) return null;
  const label = `行情注意事項：${failures.length} 檔暫無行情，${warnings.length} 筆資料提示`;
  return <>
    <button type="button" aria-label={label} title={label} aria-haspopup="dialog"
      onClick={() => dialog.current?.showModal()}
      className="health-status-trigger" data-severity="warning">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 4.1 2.1 18.3A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.7L13.7 4.1a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" />
      </svg>
    </button>
    <dialog ref={dialog} className="market-data-notice" aria-labelledby="market-data-notice-title"
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
      }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="market-data-notice-title" className="text-base font-semibold">行情注意事項</h2>
        <button type="button" autoFocus aria-label="關閉行情注意事項" onClick={() => dialog.current?.close()} className="size-11 shrink-0 inline-flex items-center justify-center rounded-full hover:bg-zinc-800">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {failures.length > 0 && <section>
        <h3 className="text-sm text-amber-300">{failures.length} 檔暫無可用行情</h3>
        <p className="text-xs text-zinc-400 mt-2">請核對股票代碼與市場；若是網路問題，關閉此視窗後按「重新整理」重試。</p>
        <ul className="divide-y divide-zinc-800 mt-3 text-sm text-zinc-300">{failures.map((failure, i) => <li className="py-3 break-words" key={i}>{failure}</li>)}</ul>
      </section>}
      {warnings.length > 0 && <section className="mt-3">
        <h3 className="text-sm text-zinc-200">資料提示 · {warnings.length} 筆</h3>
        <ul className="divide-y divide-zinc-800 mt-2 text-sm text-zinc-300">{warnings.map((warning, i) => <li className="py-3 break-words" key={i}>{warning}</li>)}</ul>
      </section>}
    </dialog>
  </>;
}
