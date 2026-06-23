import { useState } from 'react';
import type { GlobalConfig, Person } from '../types/form';
import { simulationYears } from '../types/form';
import type { Gesture, CreateExistingMortgageGesture, BuyHouseGesture, StartJobGesture, StartDrawdownGesture, CreatePeriodicInvestmentGesture } from '../engine/gestures';
import { AddEventForm } from './AddEventPanel';

interface SetupTabProps {
  config: GlobalConfig;
  onConfigChange: (config: GlobalConfig) => void;
  timeline: Gesture[];
  onAddEvent: (gesture: Gesture) => void;
  onUpdateEvent: (index: number, gesture: Gesture) => void;
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
    case 'fortnightly': return '/fortnight';
    case 'first_of_month': return '/month';
    case 'first_of_year': return '/year';
    default: return freq;
  }
}

function gestureLabel(g: Gesture): string {
  switch (g.kind) {
    case 'start_job': {
      const freq = ({ first_of_month: 'monthly', fortnightly: 'fortnightly', weekly: 'weekly' } as const)[g.payFrequency];
      const ks = g.kiwiSaverEnabled ? `, KiwiSaver ${g.employeeKiwiSaverPercent}%+${g.employerKiwiSaverPercent}%` : '';
      const inf = g.inflationMatchedPayrise ? ', inflation-matched' : '';
      return `[${g.personName}] ${g.name}: $${g.annualSalary.toLocaleString()} gross p.a. (${freq}${ks}${inf})`;
    }
    case 'create_income':
      return `$${g.amount.toLocaleString()}${formatFreq(g.frequency)} ${g.name} (income${g.inflationLinked ? ', inflation-linked' : ''})`;
    case 'create_repeat_cost':
      return `$${g.amount.toLocaleString()}${formatFreq(g.frequency)} ${g.name} (cost${g.inflationLinked ? ', inflation-linked' : ''})`;
    case 'create_periodic_investment': {
      const parts: string[] = [];
      if (g.initialAmount && g.initialAmount > 0) parts.push(`$${g.initialAmount.toLocaleString()} initial`);
      if (g.periodAmount > 0) parts.push(`$${g.periodAmount.toLocaleString()}${formatFreq(g.frequency)}`);
      return `${parts.join(' + ')} → ${g.name} at ${g.annualGrowthPercent}% p.a.`;
    }
    case 'create_existing_mortgage':
      return `Mortgage: $${g.principal.toLocaleString()} at ${g.annualRatePercent}% / ${g.termYears}yr, house $${g.assetValue.toLocaleString()}`;
    case 'buy_house':
      return `Buy ${g.name}: $${g.housePrice.toLocaleString()}, $${g.deposit.toLocaleString()} deposit, $${(g.housePrice - g.deposit).toLocaleString()} mortgage at ${g.annualRatePercent}% / ${g.termYears}yr`;
    case 'sell_house':
      return `Sell ${g.houseName}: ${g.salePriceOverride !== undefined ? `$${g.salePriceOverride.toLocaleString()} fixed` : 'market price'}, ${g.agentFeePercent}% agent, $${g.fixedCosts.toLocaleString()} legal`;
    case 'start_drawdown': {
      const target = g.mode === 'percent'
        ? `${g.annualPercent}% p.a.`
        : `$${g.annualAmount.toLocaleString()} p.a.${g.inflationLinked ? ' (inflation-linked)' : ''}`;
      return `Drawdown ${target} from ${g.investmentName}`;
    }
    case 'end_job':
      return `[${g.personName}] End job: ${g.jobName}`;
    case 'retire':
      return `[${g.personName}] Retire`;
    case 'change_recurring_buy':
      return g.newPeriodAmount === 0
        ? `Stop recurring buy: ${g.investmentName}`
        : `Change recurring buy: ${g.investmentName} → $${g.newPeriodAmount.toLocaleString()}/period`;
    case 'cash_gift':
      return `Cash gift: $${g.amount.toLocaleString()}`;
    case 'start_superannuation': {
      const situationLabels: Record<string, string> = {
        single_alone:   'Single (living alone)',
        single_sharing: 'Single (sharing)',
        couple:         'Couple',
      };
      return `[${g.personName}] NZ Super: ${situationLabels[g.livingSituation] ?? g.livingSituation}`;
    }
    default:
      return g.kind;
  }
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function SetupTab({ config, onConfigChange, timeline, onAddEvent, onUpdateEvent, onRemoveEvent, startDay }: SetupTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const update = <K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const updatePerson = (index: number, patch: Partial<Person>) => {
    const persons = config.persons.map((p, i) => i === index ? { ...p, ...patch } : p);
    onConfigChange({ ...config, persons });
  };

  const addPerson = () => {
    onConfigChange({ ...config, persons: [...config.persons, { name: '', currentAge: 30 }] });
  };

  const removePerson = (index: number) => {
    if (config.persons.length <= 1) return;
    onConfigChange({ ...config, persons: config.persons.filter((_, i) => i !== index) });
  };

  const sortedEntries = timeline
    .map((gesture, originalIndex) => ({ gesture, originalIndex }))
    .sort((a, b) => a.gesture.day - b.gesture.day);

  const availableHouses = timeline
    .filter((g): g is CreateExistingMortgageGesture | BuyHouseGesture => g.kind === 'create_existing_mortgage' || g.kind === 'buy_house')
    .map(g => g.name);

  const availableJobs = timeline
    .filter((g): g is StartJobGesture => g.kind === 'start_job')
    .map(g => ({ personName: g.personName, jobName: g.name }));

  const kiwiSaverInvestments = timeline
    .filter((g): g is StartJobGesture => g.kind === 'start_job' && g.kiwiSaverEnabled)
    .map(g => `${g.personName}-${g.name}-kiwisaver`);
  const periodicInvestments = (timeline.filter(g => g.kind === 'create_periodic_investment') as CreatePeriodicInvestmentGesture[])
    .map(g => g.name);
  const drawdownTargets = (timeline.filter(g => g.kind === 'start_drawdown') as StartDrawdownGesture[])
    .map(g => g.investmentName);
  const availableInvestments = [...new Set([...kiwiSaverInvestments, ...periodicInvestments, ...drawdownTargets])];


  const endDate = new Date(startDay);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + simulationYears(config));

  const handleAdd = (gesture: Gesture) => {
    onAddEvent(gesture);
    setShowAddForm(false);
  };

  const handleEdit = (originalIndex: number) => {
    setShowAddForm(false);
    setEditingIndex(originalIndex);
  };

  return (
    <div className="setup-tab">
      <div className="global-config">
        <label>
          Starting Cash ($)
          <input type="number" value={config.startingCash} onChange={e => update('startingCash', Number(e.target.value))} />
        </label>
        <label>
          Simulate to age
          <input type="number" min="1" max="120" value={config.targetAge} onChange={e => update('targetAge', Number(e.target.value))} />
        </label>
        <label>
          Annual Inflation (%)
          <input type="number" step="0.1" min="0" value={config.inflationRatePercent} onChange={e => update('inflationRatePercent', Number(e.target.value))} />
        </label>
      </div>

      <div className="household-section">
        <h3 className="household-heading">Household</h3>
        {config.persons.map((person, i) => (
          <div key={i} className="person-row">
            <input
              type="text"
              placeholder="Name"
              value={person.name}
              onChange={e => updatePerson(i, { name: e.target.value })}
            />
            <label className="person-age-label">
              Age
              <input
                type="number"
                min="1"
                max="120"
                value={person.currentAge}
                onChange={e => updatePerson(i, { currentAge: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              className="btn-remove"
              onClick={() => removePerson(i)}
              disabled={config.persons.length <= 1}
            >×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addPerson}>+ Add person</button>
      </div>

      <div className="timeline">
        <div className="timeline-marker">Start — {formatMonthYear(startDay)}</div>

        {sortedEntries.map(({ gesture, originalIndex }) =>
          editingIndex === originalIndex ? (
            <AddEventForm
              key={`edit-${originalIndex}`}
              onAdd={() => {}}
              onUpdate={(updated) => { onUpdateEvent(originalIndex, updated); setEditingIndex(null); }}
              onCancel={() => setEditingIndex(null)}
              startDay={startDay}
              availableHouses={availableHouses}
              availableJobs={availableJobs}
              availableInvestments={availableInvestments}
              initialGesture={gesture}
              persons={config.persons}
            />
          ) : (
            <div key={originalIndex} className="timeline-entry">
              <span className="entry-date">{formatDate(gesture.day)}</span>
              <span className="entry-label">{gestureLabel(gesture)}</span>
              <button type="button" className="btn-edit" onClick={() => handleEdit(originalIndex)}>Edit</button>
              <button type="button" className="btn-remove" onClick={() => onRemoveEvent(originalIndex)}>×</button>
            </div>
          )
        )}

        {showAddForm ? (
          <AddEventForm onAdd={handleAdd} startDay={startDay} onCancel={() => setShowAddForm(false)} availableHouses={availableHouses} availableJobs={availableJobs} availableInvestments={availableInvestments} persons={config.persons} />
        ) : editingIndex === null ? (
          <button type="button" className="btn-secondary timeline-add-btn" onClick={() => setShowAddForm(true)}>
            + Add Event
          </button>
        ) : null}

        <div className="timeline-marker">End — {formatMonthYear(endDate)}</div>
      </div>
    </div>
  );
}
