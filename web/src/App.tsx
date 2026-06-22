import { useState } from 'react';
import type { FormValues } from './types/form';
import type { Gesture } from './engine/gestures';
import type { SimulationResult } from './engine/simulation';
import { runSimulation, WORLD_ACCOUNT, CASH_ACCOUNT, INCOME_ACCOUNT } from './engine/simulation';
import { SetupForm } from './components/SetupForm';
import { SimulationPage } from './components/SimulationPage';
import './App.css';

function formToGestures(values: FormValues, startDay: Date): Gesture[] {
  const day = truncateToDay(startDay);
  const gestures: Gesture[] = [
    { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: values.startingCash },
    {
      kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
      amount: values.monthlySalary, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
      inflationLinked: values.salaryInflationLinked,
    },
  ];

  if (values.inflationRatePercent > 0) {
    gestures.push({ kind: 'create_inflation', day, annualRatePercent: values.inflationRatePercent });
  }

  for (const cost of values.recurringCosts) {
    if (cost.name && cost.amount > 0) {
      gestures.push({
        kind: 'create_repeat_cost', day, name: cost.name,
        frequency: cost.frequency, amount: cost.amount,
        fromAccount: CASH_ACCOUNT,
        inflationLinked: cost.inflationLinked,
      });
    }
  }

  if (values.hasMortgage) {
    gestures.push({
      kind: 'create_existing_mortgage', day, name: 'home',
      principal: values.mortgagePrincipal, assetValue: values.houseValue,
      annualRatePercent: values.interestRate, interestFrequency: 'first_of_month',
      termYears: values.termYears, paymentFromAccount: CASH_ACCOUNT,
      annualHousePriceGrowthPercent: values.housePriceGrowthPercent,
    });
  }

  for (const inv of values.investments) {
    if (inv.name && inv.periodAmount > 0) {
      gestures.push({
        kind: 'create_periodic_investment', day, name: inv.name,
        periodAmount: inv.periodAmount, frequency: inv.frequency,
        annualGrowthPercent: inv.annualGrowthPercent, fromAccount: CASH_ACCOUNT,
      });
    }
  }

  return gestures;
}

function truncateToDay(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export default function App() {
  const [phase, setPhase] = useState<'setup' | 'results'>('setup');
  const [formValues, setFormValues] = useState<FormValues | undefined>();
  const [baseGestures, setBaseGestures] = useState<Gesture[]>([]);
  const [addedEvents, setAddedEvents] = useState<Gesture[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulationYears, setSimulationYears] = useState(30);

  const startDay = new Date();

  const doSimulation = (gestures: Gesture[], years: number) => {
    const simResult = runSimulation(startDay, gestures, years);
    setResult(simResult);
  };

  const handleFormSubmit = (values: FormValues) => {
    setFormValues(values);
    setSimulationYears(values.simulationYears);
    const gestures = formToGestures(values, startDay);
    setBaseGestures(gestures);
    setAddedEvents([]);
    doSimulation(gestures, values.simulationYears);
    setPhase('results');
  };

  const handleAddEvent = (gesture: Gesture) => {
    setAddedEvents(prev => [...prev, gesture]);
  };

  const handleRemoveEvent = (index: number) => {
    setAddedEvents(prev => prev.filter((_, i) => i !== index));
  };

  const handleRerun = () => {
    doSimulation([...baseGestures, ...addedEvents], simulationYears);
  };

  const handleReset = () => {
    setPhase('setup');
    setResult(null);
    setAddedEvents([]);
  };

  const mortgageName = formValues?.hasMortgage ? 'home' : undefined;

  return (
    <div className="app">
      <h1>Finance Simulator</h1>
      {phase === 'setup' && (
        <SetupForm onSubmit={handleFormSubmit} initialValues={formValues} />
      )}
      {phase === 'results' && result && (
        <SimulationPage
          result={result}
          mortgageName={mortgageName}
          addedEvents={addedEvents}
          onAddEvent={handleAddEvent}
          onRemoveEvent={handleRemoveEvent}
          onRerun={handleRerun}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
