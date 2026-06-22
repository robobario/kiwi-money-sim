import { useState } from 'react';
import type { GlobalConfig } from '../types/form';
import type { Gesture, CreateExistingMortgageGesture, BuyHouseGesture } from '../engine/gestures';
import { AddEventForm } from './AddEventPanel';

interface SetupTabProps {
  config: GlobalConfig;
  onConfigChange: (config: GlobalConfig) => void;
  timeline: Gesture[];
  onAddEvent: (gesture: Gesture) => void;
  onRemoveEvent: (originalIndex: number) => void;
  startDay: Date;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function formatFreq(freq: string): string {
  switch (freq) {
    case 'daily': return '/day';
    case 'weekly': return '/week';
    case 'first_of_month': return '/month';
    case 'first_of_year': return '/year';
    default: return freq;
  }
}

function gestureLabel(g: Gesture): string {
  switch (g.kind) {
    case 'create_income':
      return `$${g.amount.toLocaleString()}${formatFreq(g.frequency)} ${g.name} (income${g.inflationLinked ? ', inflation-linked' : ''})`;
    case 'create_repeat_cost':
      return `$${g.amount.toLocaleString()}${formatFreq(g.frequency)} ${g.name} (cost${g.inflationLinked ? ', inflation-linked' : ''})`;
    case 'create_periodic_investment':
      return `$${g.periodAmount.toLocaleString()}${formatFreq(g.frequency)} → ${g.name} at ${g.annualGrowthPercent}% p.a.`;
    case 'create_existing_mortgage':
      return `Mortgage: $${g.principal.toLocaleString()} at ${g.annualRatePercent}% / ${g.termYears}yr, house $${g.assetValue.toLocaleString()}`;
    case 'buy_house':
      return `Buy ${g.name}: $${g.housePrice.toLocaleString()}, $${g.deposit.toLocaleString()} deposit, $${(g.housePrice - g.deposit).toLocaleString()} mortgage at ${g.annualRatePercent}% / ${g.termYears}yr`;
    case 'sell_house':
      return `Sell ${g.houseName}: ${g.salePriceOverride !== undefined ? `$${g.salePriceOverride.toLocaleString()} fixed` : 'market price'}, ${g.agentFeePercent}% agent, $${g.fixedCosts.toLocaleString()} legal`;
    default:
      return g.kind;
  }
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function SetupTab({ config, onConfigChange, timeline, onAddEvent, onRemoveEvent, startDay }: SetupTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const update = <K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const sortedEntries = timeline
    .map((gesture, originalIndex) => ({ gesture, originalIndex }))
    .sort((a, b) => a.gesture.day - b.gesture.day);

  const availableHouses = timeline
    .filter((g): g is CreateExistingMortgageGesture | BuyHouseGesture => g.kind === 'create_existing_mortgage' || g.kind === 'buy_house')
    .map(g => g.name);

  const endDate = new Date(startDay);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + config.simulationYears);

  const handleAdd = (gesture: Gesture) => {
    onAddEvent(gesture);
    setShowAddForm(false);
  };

  return (
    <div className="setup-tab">
      <div className="global-config">
        <label>
          Starting Cash ($)
          <input type="number" value={config.startingCash} onChange={e => update('startingCash', Number(e.target.value))} />
        </label>
        <label>
          Duration (years)
          <input type="number" min="1" value={config.simulationYears} onChange={e => update('simulationYears', Number(e.target.value))} />
        </label>
        <label>
          Annual Inflation (%)
          <input type="number" step="0.1" min="0" value={config.inflationRatePercent} onChange={e => update('inflationRatePercent', Number(e.target.value))} />
        </label>
      </div>

      <div className="timeline">
        <div className="timeline-marker">Start — {formatMonthYear(startDay)}</div>

        {sortedEntries.map(({ gesture, originalIndex }) => (
          <div key={originalIndex} className="timeline-entry">
            <span className="entry-date">{formatDate(gesture.day)}</span>
            <span className="entry-label">{gestureLabel(gesture)}</span>
            <button type="button" className="btn-remove" onClick={() => onRemoveEvent(originalIndex)}>×</button>
          </div>
        ))}

        {showAddForm ? (
          <AddEventForm onAdd={handleAdd} startDay={startDay} onCancel={() => setShowAddForm(false)} availableHouses={availableHouses} />
        ) : (
          <button type="button" className="btn-secondary timeline-add-btn" onClick={() => setShowAddForm(true)}>
            + Add Event
          </button>
        )}

        <div className="timeline-marker">End — {formatMonthYear(endDate)}</div>
      </div>
    </div>
  );
}
