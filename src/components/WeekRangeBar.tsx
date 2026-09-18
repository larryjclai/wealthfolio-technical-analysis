import React from 'react';

interface Props {
  low: number | null;
  high: number | null;
  current: number;
}

export const WeekRangeBar: React.FC<Props> = ({ low, high, current }) => {
  if (low === null || high === null || high === low) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }
  
  const position = Math.max(0, Math.min(1, (current - low) / (high - low)));
  const pct = Math.round(position * 100);
  
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-[10px] text-zinc-500 w-12 text-right tabular-nums">{low.toFixed(0)}</span>
      <div className="flex-1 relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {/* Gradient fill */}
        <div 
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ 
            width: `${pct}%`,
            background: position < 0.3 ? '#ef4444' : position > 0.7 ? '#22c55e' : '#a1a1aa'
          }}
        />
        {/* Current position marker */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-zinc-600 shadow-sm"
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 w-12 tabular-nums">{high.toFixed(0)}</span>
    </div>
  );
};
