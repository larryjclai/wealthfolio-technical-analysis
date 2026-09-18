import React, { useState } from 'react';
import { AddonEnableFunction } from '@wealthfolio/addon-sdk/types';
import TechnicalAnalysisPage from './pages/TechnicalAnalysisPage';
import HoldingsOverviewPage from './pages/HoldingsOverviewPage';
import './index.css';
import { HostAdapter } from './host/HostAdapter';
import { Market } from './market-data/types';

let hostAdapter: HostAdapter | undefined;

const TechnicalAnalysisApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'overview' | 'chart'>('overview');
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; market: Market } | null>(null);

  if (!hostAdapter) return null;

  if (currentView === 'chart') {
    return (
      <TechnicalAnalysisPage
        host={hostAdapter}
        initialSymbol={selectedStock?.symbol}
        initialMarket={selectedStock?.market}
        onBack={() => setCurrentView('overview')}
      />
    );
  }

  return (
    <HoldingsOverviewPage
      host={hostAdapter}
      onNavigateToChart={(symbol, market) => {
        setSelectedStock({ symbol, market: market as Market });
        setCurrentView('chart');
      }}
    />
  );
};

const enable: AddonEnableFunction = (ctx) => {
  hostAdapter = new HostAdapter(ctx);

  // Register main route
  ctx.router.add({
    id: 'tech-analysis',
    path: '/addons/tech-analysis',
    component: TechnicalAnalysisApp,
  });

  ctx.onDisable(() => {
    hostAdapter = undefined;
  });
};

export default enable;
