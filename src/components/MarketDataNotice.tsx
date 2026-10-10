export interface MarketDataIssues {
  failures: string[];
  warnings: string[];
}

export function MarketDataNotice({ failures, warnings }: MarketDataIssues) {
  if (!failures.length && !warnings.length) return <p className="text-sm text-zinc-400">目前沒有行情注意事項。</p>;
  return <section aria-label="行情注意事項">
    {failures.length > 0 && <div>
      <h3 className="text-sm text-amber-300">{failures.length} 檔暫無可用行情</h3>
      <p className="text-xs text-zinc-400 mt-2">請核對股票代碼與市場；若是網路問題，關閉提醒中心後按「重新整理」重試。</p>
      <ul className="divide-y divide-zinc-800 mt-3 text-sm text-zinc-300">{failures.map((failure, i) => <li className="py-3 break-words" key={i}>{failure}</li>)}</ul>
    </div>}
    {warnings.length > 0 && <div className="mt-3">
      <h3 className="text-sm text-zinc-200">資料提示 · {warnings.length} 筆</h3>
      <ul className="divide-y divide-zinc-800 mt-2 text-sm text-zinc-300">{warnings.map((warning, i) => <li className="py-3 break-words" key={i}>{warning}</li>)}</ul>
    </div>}
  </section>;
}
