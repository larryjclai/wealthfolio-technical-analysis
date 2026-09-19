import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AddonContext } from '@wealthfolio/addon-sdk/types';
import enable from '../src/addon';
const timestamps: number[] = [];
for (let i = 460; i > 0; i--) {
  const date = new Date(Date.now() - i * 86400000);
  date.setUTCHours(13, 30, 0, 0);
  if (![0, 6].includes(date.getUTCDay())) timestamps.push(date.getTime() / 1000);
}
const closes = timestamps.map((_, i) => 100 + i * .25 + 10 * Math.sin(i / 12));
const quote = { open: closes.map(c => c - 1), high: closes.map(c => c + 3), low: closes.map(c => c - 3), close: [...closes], volume: closes.map((_, i) => 1000000 + i * 4000) };
const activities = [20, 80, 210, 250, 250].map((idx, i) => ({ id: String(i), activityType: i < 3 ? 'BUY' : 'SELL', status: 'POSTED', date: new Date(timestamps[idx] * 1000).toISOString(), quantity: String(i + 1), unitPrice: String(closes[idx]), currency: 'USD', assetSymbol: 'AMD', accountName: '測試帳戶', needsReview: false }));
const values = new Map<string, string>();
let Route: React.ComponentType = () => null;
let disabled = () => {};
let updateRequests = (_count: number) => {};
let showToast = (_message: string) => {};
let requests = 0;
const ctx = {
  router: { add: ({ component }: { component: React.ComponentType }) => { Route = component; } },
  onDisable: (callback: () => void) => { disabled = callback; },
  api: {
    accounts: { getAll: async () => [{ id: 'demo-a', isActive: true }, { id: 'demo-b', isActive: true }] },
    portfolio: { getHoldings: async (accountId: string) => [{ id: accountId, accountId, holdingType: 'security', instrument: { symbol: 'AMD', name: 'AMD', currency: 'USD', quoteMode: 'MARKET' }, quantity: accountId === 'demo-a' ? 10 : 30, costBasis: { local: accountId === 'demo-a' ? 1000 : 6000, base: 0 }, asOfDate: '2026-09-18', localCurrency: 'USD', marketValue: { local: 2000, base: 2000 } }] },
    activities: { getAll: async () => activities },
    storage: { get: async (key: string) => values.get(key) ?? null, set: async (key: string, value: string) => { values.set(key, value); } },
    toast: { warning: (message: string) => showToast(message) },
    network: { request: async () => {
      updateRequests(++requests);
      return { status: 200, body: JSON.stringify({ chart: { result: [{ timestamp: timestamps, meta: { currency: 'USD', exchangeTimezoneName: 'America/New_York' }, indicators: { quote: [quote] } }] } }) };
    } },
  },
};
enable(ctx as unknown as AddonContext);
function PreviewHost() {
  const [visible, setVisible] = useState(true);
  const [count, setCount] = useState(requests);
  const [toast, setToast] = useState('');
  const [stopped, setStopped] = useState(false);
  const [dropped, setDropped] = useState(false);
  updateRequests = setCount; showToast = setToast;
  return <>
    <nav className="p-3 text-sm text-white bg-blue-950 flex flex-wrap gap-3 items-center" aria-label="模擬主程式">
      <button className="border border-blue-300 px-3 py-1 rounded" disabled={stopped} onClick={() => setVisible(v => !v)}>{visible ? '切到其他主程式頁面' : '返回套件'}</button>
      <button className="border border-blue-300 px-3 py-1 rounded" onClick={() => {
        const last = quote.close.length - 1; quote.close[last] = closes[last] * 0.7; quote.low[last] = quote.close[last]; setDropped(true);
      }}>{dropped ? '已模擬跌價 30%' : '模擬跌價 30%'}</button>
      <button className="border border-blue-300 px-3 py-1 rounded" disabled={stopped} onClick={() => { disabled(); setVisible(false); setStopped(true); }}>停用套件</button>
      <span>行情請求次數：{count}</span>
    </nav>
    {toast && <p role="alert" className="p-3 bg-amber-950 text-amber-200">{toast}</p>}
    {visible ? <Route /> : <div className="p-8 text-zinc-100"><h1>{stopped ? '套件已停用' : '主程式的其他頁面（模擬）'}</h1><p>分析頁已卸載。離開時不做背景檢查；回到套件重新載入總覽，同一天不重複自動掃描提醒。</p></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<PreviewHost />);
