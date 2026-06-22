import { useState } from 'react';
import type { GlobalConfig } from './types/form';
import { DEFAULT_CONFIG } from './types/form';
import type { Gesture } from './engine/gestures';
import type { SimulationResult } from './engine/simulation';
import { runSimulation, WORLD_ACCOUNT, CASH_ACCOUNT, INCOME_ACCOUNT } from './engine/simulation';
import { SetupTab } from './components/SetupForm';
import { SimulationPage } from './components/SimulationPage';
import './App.css';

function truncateToDay(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function buildGestures(config: GlobalConfig, timeline: Gesture[], startDay: Date): Gesture[] {
  const day = truncateToDay(startDay);
  const base: Gesture[] = [
    { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: config.startingCash },
  ];
  if (config.inflationRatePercent > 0) {
    base.push({ kind: 'create_inflation', day, annualRatePercent: config.inflationRatePercent });
  }
  return [...base, ...timeline];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'setup' | 'results'>('setup');
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [timeline, setTimeline] = useState<Gesture[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const startDay = new Date();

  const handleTabClick = (tab: 'setup' | 'results') => {
    if (tab === 'results') {
      const gestures = buildGestures(config, timeline, startDay);
      setResult(runSimulation(startDay, gestures, config.simulationYears));
    }
    setActiveTab(tab);
  };

  const mortgageGesture = timeline.find(g => g.kind === 'create_existing_mortgage');
  const mortgageName = mortgageGesture?.kind === 'create_existing_mortgage' ? mortgageGesture.name : undefined;

  return (
    <div className="app">
      <h1>Finance Simulator</h1>
      <div className="tabs">
        <button
          className={`tab-btn${activeTab === 'setup' ? ' active' : ''}`}
          onClick={() => handleTabClick('setup')}
        >
          Setup
        </button>
        <button
          className={`tab-btn${activeTab === 'results' ? ' active' : ''}`}
          onClick={() => handleTabClick('results')}
        >
          Results
        </button>
      </div>

      {activeTab === 'setup' && (
        <SetupTab
          config={config}
          onConfigChange={setConfig}
          timeline={timeline}
          onAddEvent={g => setTimeline(prev => [...prev, g])}
          onRemoveEvent={i => setTimeline(prev => prev.filter((_, idx) => idx !== i))}
          startDay={startDay}
        />
      )}
      {activeTab === 'results' && result && (
        <SimulationPage result={result} mortgageName={mortgageName} />
      )}
      {activeTab === 'results' && !result && (
        <p className="empty-results">Switch to Setup, add some events, then come back to see results.</p>
      )}
    </div>
  );
}
