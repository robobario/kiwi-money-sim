import { useState } from 'react';
import type { Gesture } from '../engine/gestures';
import type { Frequency } from '../engine/events';
import { CASH_ACCOUNT, INCOME_ACCOUNT } from '../engine/simulation';

type EventType = 'income' | 'cost' | 'investment' | 'mortgage';

interface AddEventFormProps {
  onAdd: (gesture: Gesture) => void;
  onCancel: () => void;
  startDay: Date;
}

function truncateToDay(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function FrequencySelect({ value, onChange }: { value: Frequency; onChange: (v: Frequency) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as Frequency)}>
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="first_of_month">Monthly</option>
    </select>
  );
}

export function AddEventForm({ onAdd, onCancel, startDay }: AddEventFormProps) {
  const today = toDateString(startDay);
  const [eventType, setEventType] = useState<EventType>('income');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState<Frequency>('first_of_month');
  const [inflationLinked, setInflationLinked] = useState(false);
  const [annualGrowthPercent, setAnnualGrowthPercent] = useState(5);
  const [principal, setPrincipal] = useState(0);
  const [houseValue, setHouseValue] = useState(0);
  const [interestRate, setInterestRate] = useState(6.0);
  const [termYears, setTermYears] = useState(25);
  const [housePriceGrowth, setHousePriceGrowth] = useState(0);
  const [mortgageName, setMortgageName] = useState('home');

  const handleAdd = () => {
    const day = truncateToDay(new Date(startDate + 'T00:00:00Z'));
    if (eventType === 'income') {
      if (!name || amount <= 0) return;
      onAdd({ kind: 'create_income', day, name, frequency, amount, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT, inflationLinked });
    } else if (eventType === 'cost') {
      if (!name || amount <= 0) return;
      onAdd({ kind: 'create_repeat_cost', day, name, frequency, amount, fromAccount: CASH_ACCOUNT, inflationLinked });
    } else if (eventType === 'investment') {
      if (!name || amount <= 0) return;
      onAdd({ kind: 'create_periodic_investment', day, name, frequency, periodAmount: amount, annualGrowthPercent, fromAccount: CASH_ACCOUNT });
    } else {
      if (principal <= 0 || houseValue <= 0) return;
      onAdd({
        kind: 'create_existing_mortgage', day, name: mortgageName,
        principal, assetValue: houseValue, annualRatePercent: interestRate,
        interestFrequency: 'first_of_month', termYears, paymentFromAccount: CASH_ACCOUNT,
        annualHousePriceGrowthPercent: housePriceGrowth,
      });
    }
  };

  return (
    <div className="add-event-form">
      <div className="form-row">
        <Field label="Event type">
          <select value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
            <option value="income">Recurring Income</option>
            <option value="cost">Recurring Cost</option>
            <option value="investment">Periodic Investment</option>
            <option value="mortgage">Mortgage &amp; House</option>
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
      </div>

      {(eventType === 'income' || eventType === 'cost') && (
        <div className="form-row">
          <Field label="Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Amount ($)">
            <input type="number" min="0" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Frequency">
            <FrequencySelect value={frequency} onChange={setFrequency} />
          </Field>
          <Field label=" ">
            <label className="checkbox-label">
              <input type="checkbox" checked={inflationLinked} onChange={e => setInflationLinked(e.target.checked)} />
              Inflation-linked
            </label>
          </Field>
        </div>
      )}

      {eventType === 'investment' && (
        <div className="form-row">
          <Field label="Fund name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Amount per period ($)">
            <input type="number" min="0" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Frequency">
            <FrequencySelect value={frequency} onChange={setFrequency} />
          </Field>
          <Field label="Growth (% p.a.)">
            <input type="number" step="0.1" min="0" value={annualGrowthPercent} onChange={e => setAnnualGrowthPercent(Number(e.target.value))} />
          </Field>
        </div>
      )}

      {eventType === 'mortgage' && (
        <>
          <div className="form-row">
            <Field label="Name">
              <input type="text" value={mortgageName} onChange={e => setMortgageName(e.target.value)} />
            </Field>
            <Field label="Principal ($)">
              <input type="number" min="0" value={principal} onChange={e => setPrincipal(Number(e.target.value))} />
            </Field>
            <Field label="House value ($)">
              <input type="number" min="0" value={houseValue} onChange={e => setHouseValue(Number(e.target.value))} />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Interest rate (%)">
              <input type="number" step="0.1" min="0" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} />
            </Field>
            <Field label="Term (years)">
              <input type="number" min="1" value={termYears} onChange={e => setTermYears(Number(e.target.value))} />
            </Field>
            <Field label="House price growth (% p.a.)">
              <input type="number" step="0.1" min="0" value={housePriceGrowth} onChange={e => setHousePriceGrowth(Number(e.target.value))} />
            </Field>
          </div>
        </>
      )}

      <div className="form-row form-actions">
        <button type="button" className="btn-primary" onClick={handleAdd}>Add</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
