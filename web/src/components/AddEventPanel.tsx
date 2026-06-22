import { useState } from 'react';
import type { Gesture } from '../engine/gestures';
import type { Frequency } from '../engine/events';
import { CASH_ACCOUNT, WORLD_ACCOUNT } from '../engine/simulation';

interface AddEventPanelProps {
  addedEvents: Gesture[];
  onAddEvent: (gesture: Gesture) => void;
  onRemoveEvent: (index: number) => void;
  onRerun: () => void;
}

type EventType = 'income' | 'cost' | 'investment';

function truncateToDay(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function gestureLabel(g: Gesture): string {
  switch (g.kind) {
    case 'create_income':
      return `Income: $${g.amount} ${g.frequency} "${g.name}"`;
    case 'create_repeat_cost':
      return `Cost: $${g.amount} ${g.frequency} "${g.name}"`;
    case 'create_periodic_investment':
      return `Investment: $${g.periodAmount} ${g.frequency} into "${g.name}" at ${g.annualGrowthPercent}% p.a.`;
    default:
      return g.kind;
  }
}

export function AddEventPanel({ addedEvents, onAddEvent, onRemoveEvent, onRerun }: AddEventPanelProps) {
  const [eventType, setEventType] = useState<EventType>('cost');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState<Frequency>('first_of_month');
  const [annualGrowthPercent, setAnnualGrowthPercent] = useState(5);
  const [startDate, setStartDate] = useState('');

  const handleAdd = () => {
    if (!name || !startDate || amount <= 0) return;
    const day = truncateToDay(new Date(startDate + 'T00:00:00Z'));

    if (eventType === 'income') {
      onAddEvent({
        kind: 'create_income',
        day,
        name,
        frequency,
        amount,
        toAccount: CASH_ACCOUNT,
        fromAccount: WORLD_ACCOUNT,
      });
    } else if (eventType === 'cost') {
      onAddEvent({
        kind: 'create_repeat_cost',
        day,
        name,
        frequency,
        amount,
        fromAccount: CASH_ACCOUNT,
        toAccount: WORLD_ACCOUNT,
      });
    } else {
      onAddEvent({
        kind: 'create_periodic_investment',
        day,
        name,
        frequency,
        periodAmount: amount,
        annualGrowthPercent,
        fromAccount: CASH_ACCOUNT,
      });
    }

    setName('');
    setAmount(0);
    setStartDate('');
  };

  return (
    <div className="add-event-panel">
      <h3>Add Future Event</h3>
      <div className="event-form">
        <select value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
          <option value="income">Recurring Income</option>
          <option value="cost">Recurring Cost</option>
          <option value="investment">Investment</option>
        </select>
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="first_of_month">Monthly</option>
        </select>
        {eventType === 'investment' && (
          <input
            type="number"
            placeholder="Growth % p.a."
            step="0.1"
            value={annualGrowthPercent}
            onChange={e => setAnnualGrowthPercent(Number(e.target.value))}
          />
        )}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <button type="button" onClick={handleAdd} className="btn-secondary">Add</button>
      </div>

      {addedEvents.length > 0 && (
        <div className="event-list">
          <h4>Added Events</h4>
          <ul>
            {addedEvents.map((g, i) => (
              <li key={i}>
                <span>{gestureLabel(g)} starting {formatDate(g.day)}</span>
                <button type="button" onClick={() => onRemoveEvent(i)} className="btn-remove">x</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onRerun} className="btn-primary">Re-run Simulation</button>
    </div>
  );
}
