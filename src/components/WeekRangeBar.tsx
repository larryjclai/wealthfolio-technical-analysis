import React from 'react';

interface Props { low: number | null; high: number | null; current: number; }
const price = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
export const WeekRangeBar: React.FC<Props> = ({ low, high, current }) => {
  if (low === null || high === null || ![low, high, current].every(Number.isFinite) || high <= low) {
    return <span className="text-zinc-400 text-xs">—</span>;
  }
  const position = Math.max(0, Math.min(1, (current - low) / (high - low)));
  const pct = Math.round(position * 100);
  const label = `52 週最低 ${price(low)}，最高 ${price(high)}，目前 ${price(current)}${current < low ? '，低於區間' : current > high ? '，高於區間' : `，位於區間 ${pct}%`}`;
  return <div className="week-range" role="img" aria-label={label} title={label}>
    <div className="week-range-track">
      <div className="h-full rounded-full bg-zinc-500" style={{ width: `${pct}%` }} />
      <span className="week-range-marker" style={{ left: `clamp(4px, ${pct}%, calc(100% - 4px))` }} />
    </div>
    <div className="mt-1.5 flex justify-between gap-3 text-[11px] leading-4 text-zinc-400 tabular-nums">
      <span>{price(low)}</span><span>{price(high)}</span>
    </div>
  </div>;
};
