import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AddonEnableFunction } from '@wealthfolio/addon-sdk/types';
import TechnicalAnalysisPage from './pages/TechnicalAnalysisPage';
import HoldingsOverviewPage from './pages/HoldingsOverviewPage';
import './index.css';
import { HostAdapter } from './host/HostAdapter';
import { AlertHistory } from './components/AlertHistory';
import { TrailingStopStore } from './alerts/TrailingStopStore';
import { TrailingStopSummary } from './components/TrailingStopPanel';
import { Market } from './market-data/types';

const TechnicalAnalysisApp: React.FC<{host: HostAdapter; store: TrailingStopStore}> = ({ host, store }) => {
  const [currentView, setCurrentView] = useState<'overview' | 'chart'>('overview');
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; market: Market } | null>(null);
  const overviewScroll = useRef(0);
  const [stopState, setStopState] = useState(store.state);
  useEffect(() => store.subscribe(setStopState), [store]);
  useEffect(() => {
    let mounted = true;
    const scan = () => {
      if (document.visibilityState === 'hidden') return;
      void store.initialize().then(() => { if (mounted) return store.poll(); });
    };
    scan();
    window.addEventListener('focus', scan);
    document.addEventListener('visibilitychange', scan);
    return () => {
      mounted = false;
      store.cancelScan();
      window.removeEventListener('focus', scan);
      document.removeEventListener('visibilitychange', scan);
    };
  }, [store]);
  useLayoutEffect(() => {
    window.scrollTo(0, currentView === 'overview' ? overviewScroll.current : 0);
  }, [currentView]);
  const select = (symbol: string, market: string) => {
    if (currentView === 'overview') overviewScroll.current = window.scrollY;
    setSelectedStock({ symbol, market: market as Market });
    setCurrentView('chart');
  };
  const summary = <><TrailingStopSummary store={store} state={stopState} onSelect={select} /><AlertHistory events={stopState.events} droppedEvents={stopState.droppedEvents} /></>;
  // Keep the overview mounted so quotes, filters, sorting and table scroll survive chart navigation.
  return <>
    <div hidden={currentView !== 'overview'}>
      <HoldingsOverviewPage host={host} summary={summary} onNavigateToChart={select} />
    </div>
    {currentView === 'chart' && <TechnicalAnalysisPage
      host={host} stopStore={store} stopState={stopState} summary={summary}
      initialSymbol={selectedStock?.symbol} initialMarket={selectedStock?.market}
      onBack={() => setCurrentView('overview')}
    />}
  </>;
};

const enable: AddonEnableFunction = (ctx) => {
  const host = new HostAdapter(ctx);
  const store = new TrailingStopStore(host);
  const Route = () => {
    // Wealthfolio 3.8 hides its addon iframe at 0 × 0 on route exit.
    // Treat re-entry as a fresh UI session, without a polling timer or host DOM access.
    const [visible, setVisible] = useState(() => window.innerWidth > 0 && window.innerHeight > 0);
    useEffect(() => {
      const resize = () => setVisible(window.innerWidth > 0 && window.innerHeight > 0);
      window.addEventListener('resize', resize);
      resize();
      return () => window.removeEventListener('resize', resize);
    }, []);
    return visible ? <TechnicalAnalysisApp host={host} store={store} /> : null;
  };
  ctx.router.add({ id: 'tech-analysis', path: '/addons/tech-analysis', component: Route });
  ctx.onDisable(() => store.dispose());
};

export default enable;
