import React from 'react';
import { SignalType, StockAnalysis, getAllSignalTypes } from '../indicators/analysis';

interface Props {
  activeFilters: SignalType[];
  onToggle: (signal: SignalType) => void;
  analyses: StockAnalysis[];
}

export const ScreenerBar: React.FC<Props> = ({ activeFilters, onToggle, analyses }) => {
  const signalTypes = getAllSignalTypes();
  
  // Count how many stocks match each signal
  const counts = new Map<SignalType, number>();
  for (const st of signalTypes) {
    const count = analyses.filter(a => a.signals.some(s => s.type === st.type)).length;
    counts.set(st.type, count);
  }
  
  return (
    <div className="flex flex-wrap gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold self-center mr-2">篩選條件</span>
      {signalTypes.map((st) => {
        const isActive = activeFilters.includes(st.type);
        const count = counts.get(st.type) || 0;
        const colorClass = st.sentiment === 'bullish' 
          ? (isActive ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'text-green-400/60 border-zinc-700 hover:border-green-500/40')
          : (isActive ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'text-red-400/60 border-zinc-700 hover:border-red-500/40');
        
        return (
          <button
            key={st.type}
            onClick={() => onToggle(st.type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${colorClass}`}
          >
            {st.label}
            {count > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold ${
                isActive 
                  ? (st.sentiment === 'bullish' ? 'bg-green-500/30' : 'bg-red-500/30')
                  : 'bg-zinc-800'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      {activeFilters.length > 0 && (
        <button
          onClick={() => activeFilters.forEach(f => onToggle(f))}
          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors ml-auto"
        >
          清除篩選
        </button>
      )}
    </div>
  );
};
