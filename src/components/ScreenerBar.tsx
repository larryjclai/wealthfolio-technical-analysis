import React from 'react';
import { SignalType, StockAnalysis, getAllSignalTypes } from '../indicators/analysis';

interface Props {
  activeFilters: SignalType[];
  onToggle: (signal: SignalType) => void;
  analyses: StockAnalysis[];
  matchMode: 'any' | 'all';
  onMatchModeChange: (mode: 'any' | 'all') => void;
  onClear: () => void;
}

export const ScreenerBar: React.FC<Props> = ({ activeFilters, onToggle, analyses, matchMode, onMatchModeChange, onClear }) => {
  const signalTypes = getAllSignalTypes();
  
  // Count how many stocks match each signal
  const counts = new Map<SignalType, number>();
  for (const st of signalTypes) {
    const count = analyses.filter(a => a.signals.some(s => s.type === st.type)).length;
    counts.set(st.type, count);
  }
  
  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <span className="text-sm text-zinc-200 font-medium">技術條件</span>
        <label className="flex items-center gap-2 text-xs text-zinc-300">多選方式
          <select value={matchMode} onChange={event => onMatchModeChange(event.target.value === 'all' ? 'all' : 'any')}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-zinc-100">
            <option value="any">符合任一項</option><option value="all">全部符合</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
      {signalTypes.map((st) => {
        const isActive = activeFilters.includes(st.type);
        const count = counts.get(st.type) || 0;
        const colorClass = st.sentiment === 'bullish' 
          ? (isActive ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'text-green-400 border-zinc-700 hover:border-green-500/40')
          : (isActive ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'text-red-400 border-zinc-700 hover:border-red-500/40');
        
        return (
          <button
            key={st.type}
            title={st.type === 'near_52w_low' ? '位於 52 週高低區間底部 15%，不代表已創新低' : st.type === 'near_52w_high' ? '位於 52 週高低區間頂部 15%，不代表已創新高' : undefined}
            aria-pressed={isActive}
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
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors ml-auto"
        >
          清除篩選
        </button>
      )}
      </div>
      <p className="mt-3 text-xs text-zinc-400 leading-relaxed">MA5 為可選短線條件，未勾選就不限制；不改變觀察分類。均線位置採最新行情；突破／跌破 MA20 與 MA5／MA20 交叉採最近兩筆已收盤日 K。每個數字是該條件單獨符合的檔數。</p>
    </div>
  );
};
