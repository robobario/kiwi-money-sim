import type { SimulationResult } from '../engine/simulation';
import { WORLD_ACCOUNT } from '../engine/simulation';
import type { Gesture } from '../engine/gestures';
import { ChartView } from './ChartView';
import { AddEventPanel } from './AddEventPanel';

interface SimulationPageProps {
  result: SimulationResult;
  mortgageName: string | undefined;
  addedEvents: Gesture[];
  onAddEvent: (gesture: Gesture) => void;
  onRemoveEvent: (index: number) => void;
  onRerun: () => void;
  onReset: () => void;
}

function formatDollar(value: number): string {
  return '$' + Math.round(value).toLocaleString();
}

export function SimulationPage({
  result,
  mortgageName,
  addedEvents,
  onAddEvent,
  onRemoveEvent,
  onRerun,
  onReset,
}: SimulationPageProps) {
  const finalBalances = result.finalWorld.accounts;
  const cashBalance = finalBalances.find(a => a.name === 'cash')?.balance ?? 0;
  const netWorth = finalBalances
    .filter(a => a.name !== WORLD_ACCOUNT)
    .reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="simulation-page">
      <div className="page-header">
        <h2>Simulation Results</h2>
        <button type="button" onClick={onReset} className="btn-secondary">Back to Setup</button>
      </div>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-label">Final Cash</span>
          <span className="stat-value">{formatDollar(cashBalance)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Final Net Worth</span>
          <span className="stat-value">{formatDollar(netWorth)}</span>
        </div>
        {mortgageName && (
          <div className="stat">
            <span className="stat-label">Mortgage Remaining</span>
            <span className="stat-value">
              {formatDollar(finalBalances.find(a => a.name === `${mortgageName}-mortgage`)?.balance ?? 0)}
            </span>
          </div>
        )}
      </div>

      <ChartView snapshots={result.snapshots} mortgageName={mortgageName} />

      <AddEventPanel
        addedEvents={addedEvents}
        onAddEvent={onAddEvent}
        onRemoveEvent={onRemoveEvent}
        onRerun={onRerun}
      />
    </div>
  );
}
