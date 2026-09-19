import React from 'react';

export interface IndicatorSettings {
  showSma: boolean;
  showEma: boolean;
  showBb: boolean;
  showRsi: boolean;
  showLevels: boolean;
  showTrades: boolean;
  showCost: boolean;
}
export const chartColors = {
  sma: ['#60a5fa', '#facc15', '#f472b6', '#a3e635'],
  ema: ['#fbbf24', '#fb7185'],
  bb: '#94a3b8', rsi: '#c084fc', support: '#67e8f9', resistance: '#fdba74', stop: '#f87171',
  buy: '#34d399', sell: '#fb7185', cost: '#e4e4e7',
};
export const IndicatorControls: React.FC<{settings: IndicatorSettings; onChange: (settings: IndicatorSettings) => void}> = ({ settings, onChange }) => (
  <div className="flex flex-wrap gap-4 p-4 border border-zinc-800 rounded-xl bg-zinc-900 items-center text-sm">
    {([
      ['showSma', 'SMA（20 / 60 / 120 / 240）'], ['showEma', 'EMA（12 / 26）'],
      ['showBb', '布林通道（20, 2）'], ['showRsi', 'RSI（14）'], ['showLevels', '支撐／壓力'], ['showTrades', '我的買賣點'], ['showCost', '持倉成本'],
    ] as [keyof IndicatorSettings, string][]).map(([key, label]) => <label key={key} className="flex items-center gap-2 cursor-pointer text-zinc-300">
      <input type="checkbox" checked={settings[key]} onChange={() => onChange({ ...settings, [key]: !settings[key] })} className="accent-blue-500 w-4 h-4" />{label}
    </label>)}
  </div>
);

export function ChartLegend({ settings, hasStop, hasCost }: {settings: IndicatorSettings; hasStop: boolean; hasCost: boolean}) {
  const items: { label: string; color: string; dashed?: boolean; marker?: string }[] = [];
  if (settings.showSma) [20, 60, 120, 240].forEach((p, i) => items.push({ label: `SMA ${p}`, color: chartColors.sma[i] }));
  if (settings.showEma) [12, 26].forEach((p, i) => items.push({ label: `EMA ${p}`, color: chartColors.ema[i] }));
  if (settings.showBb) items.push({ label: '布林上／下軌', color: chartColors.bb, dashed: true }, { label: '布林中軌', color: chartColors.bb });
  if (settings.showLevels) items.push({ label: '20日區間支撐', color: chartColors.support, dashed: true }, { label: '20日區間壓力', color: chartColors.resistance, dashed: true });
  if (settings.showCost && hasCost) items.push({ label: '目前持倉平均成本', color: chartColors.cost, dashed: true });
  if (hasStop) items.push({ label: '移動停利提醒價', color: chartColors.stop, dashed: true });
  if (settings.showRsi) items.push({ label: 'RSI 14（下圖）', color: chartColors.rsi });
  if (settings.showTrades) items.push({ label: '實際買入', color: chartColors.buy, marker: '▲' }, { label: '實際賣出', color: chartColors.sell, marker: '▼' });
  return <div aria-label="圖表顏色圖例" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-300 p-4">
    {items.map(item => <span key={item.label} className="inline-flex items-center gap-2">
      {item.marker ? <span style={{ color: item.color }}>{item.marker}</span> : <span aria-hidden="true" style={{ borderTop: `2px ${item.dashed ? 'dashed' : 'solid'} ${item.color}`, width: 20 }} />}{item.label}
    </span>)}
    <span>K 線／成交量：綠漲、紅跌</span>
  </div>;
}
