import React, { useEffect, useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@wealthfolio/ui';
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
      <Select value={market} onValueChange={value => setMarket(value as Market)}>
        <SelectTrigger aria-label="市場" className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="TWSE">台股 (TWSE)</SelectItem>
          <SelectItem value="TPEX">上櫃 (TPEX)</SelectItem>
          <SelectItem value="US">美股 (US)</SelectItem>
        </SelectContent>
      </Select>
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
