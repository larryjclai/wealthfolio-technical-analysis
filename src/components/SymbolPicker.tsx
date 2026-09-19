import React, { useEffect, useState } from 'react';
import { Market } from '../market-data/types';

interface Props {
  onSelect: (symbol: string, market: Market) => void;
  defaultSymbol?: string;
  defaultMarket?: Market;
}

export const SymbolPicker: React.FC<Props> = ({ onSelect, defaultSymbol = '2330', defaultMarket = 'TWSE' }) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [market, setMarket] = useState<Market>(defaultMarket);

  useEffect(() => { setSymbol(defaultSymbol); setMarket(defaultMarket); }, [defaultSymbol, defaultMarket]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSelect(symbol, market);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-center p-4 border border-zinc-800 rounded-xl bg-zinc-900 shadow-sm">
      <div className="relative">
        <select aria-label="市場"
          value={market}
          onChange={(e) => setMarket(e.target.value as Market)}
          className="appearance-none bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:bg-zinc-700/50 transition-colors"
        >
          <option value="TWSE">台股 (TWSE)</option>
          <option value="TPEX">上櫃 (TPEX)</option>
          <option value="US">美股 (US)</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
      <input
        type="text"
        aria-label="股票代碼"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="例如: 2330, GOOGL"
        className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-4 py-2 flex-grow min-w-0 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-zinc-400 transition-colors"
      />
      <button type="submit" className="bg-zinc-100 text-zinc-900 font-medium px-5 py-2 rounded-lg hover:bg-white active:bg-zinc-200 transition-colors shadow-sm">
        載入
      </button>
    </form>
  );
};
