import { useState } from 'react';
import type { GlobalConfig } from './types/form';
import { DEFAULT_CONFIG, simulationYears } from './types/form';
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

function ageDay(startDay: Date, currentAge: number, targetAge: number): number {
  const d = new Date(startDay);
  d.setUTCFullYear(d.getUTCFullYear() + (targetAge - currentAge));
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function defaultTimeline(config: GlobalConfig, startDay: Date): Gesture[] {
  const day = truncateToDay(startDay);
  const person = config.persons[0];
  const retireDay = ageDay(startDay, person.currentAge, 65);
  return [
    {
      kind: 'start_job',
      day,
      personName: person.name,
      name: 'job',
      annualSalary: 72800,
      payFrequency: 'first_of_month',
      kiwiSaverEnabled: true,
      employeeKiwiSaverPercent: 3.5,
      employerKiwiSaverPercent: 3.5,
      kiwiSaverGrowthPercent: 7,
      inflationMatchedPayrise: true,
    },
    {
      kind: 'create_repeat_cost',
      day,
      name: 'living-costs',
      frequency: 'first_of_month',
      amount: 3000,
      fromAccount: CASH_ACCOUNT,
      inflationLinked: true,
    },
    {
      kind: 'start_drawdown',
      day: retireDay,
      investmentName: `${person.name}-job-kiwisaver`,
      mode: 'percent',
      annualPercent: 4,
      annualAmount: 0,
      inflationLinked: false,
    },
    {
      kind: 'retire',
      day: retireDay,
      personName: person.name,
    },
    {
      kind: 'start_superannuation',
      day: retireDay,
      personName: person.name,
      livingSituation: 'single_alone',
    },
  ];
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
  const [timeline, setTimeline] = useState<Gesture[]>(() => defaultTimeline(DEFAULT_CONFIG, new Date()));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const startDay = new Date();

  const handleTabClick = async (tab: 'setup' | 'results') => {
    setActiveTab(tab);
    if (tab === 'results') {
      const gestures = buildGestures(config, timeline, startDay);
      setResult(null);
      setProgress(0);
      const simResult = await runSimulation(startDay, gestures, simulationYears(config), 7, setProgress);
      setResult(simResult);
      setProgress(null);
    }
  };

  const mortgageNames = timeline
    .filter(g => g.kind === 'create_existing_mortgage' || g.kind === 'buy_house')
    .map(g => (g as { name: string }).name);

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
          onUpdateEvent={(i, g) => setTimeline(prev => prev.map((existing, idx) => idx === i ? g : existing))}
          onRemoveEvent={i => setTimeline(prev => prev.filter((_, idx) => idx !== i))}
          startDay={startDay}
        />
      )}
      {activeTab === 'results' && progress !== null && (
        <div className="progress-container">
          <p>Running simulation...</p>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-pct">{progress}%</p>
        </div>
      )}
      {activeTab === 'results' && progress === null && result && (
        <SimulationPage result={result} mortgageNames={mortgageNames} />
      )}
      {activeTab === 'results' && progress === null && !result && (
        <p className="empty-results">Switch to Setup, add some events, then come back to see results.</p>
      )}
    </div>
  );
}
