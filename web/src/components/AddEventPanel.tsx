import { useState } from 'react';
import type { Gesture, SuperannuationLivingSituation } from '../engine/gestures';
import type { Frequency } from '../engine/events';
import { CASH_ACCOUNT, INCOME_ACCOUNT } from '../engine/simulation';
import type { Person } from '../types/form';

type EventType = 'start_job' | 'income' | 'cost' | 'investment' | 'buy_house' | 'mortgage' | 'sell_house' | 'superannuation';

interface FormState {
  eventType: EventType;
  personName: string;
  name: string;
  startDate: string;
  amount: number;
  frequency: Frequency;
  inflationLinked: boolean;
  annualGrowthPercent: number;
  principal: number;
  houseValue: number;
  interestRate: number;
  termYears: number;
  housePriceGrowth: number;
  mortgageName: string;
  jobName: string;
  annualSalary: number;
  payFrequency: 'weekly' | 'fortnightly' | 'first_of_month';
  inflationMatchedPayrise: boolean;
  kiwiSaverEnabled: boolean;
  employeeKiwiSaverPercent: number;
  employerKiwiSaverPercent: number;
  kiwiSaverGrowthPercent: number;
  deposit: number;
  selectedHouse: string;
  useMarketPrice: boolean;
  salePrice: number;
  agentFeePercent: number;
  fixedCosts: number;
  livingSituation: SuperannuationLivingSituation;
}

function stateFromGesture(g: Gesture | undefined, today: string, defaultPersonName: string): FormState {
  const defaults: FormState = {
    eventType: 'start_job',
    personName: defaultPersonName,
    name: '',
    startDate: today,
    amount: 0,
    frequency: 'first_of_month',
    inflationLinked: false,
    annualGrowthPercent: 5,
    principal: 0,
    houseValue: 0,
    interestRate: 6.0,
    termYears: 25,
    housePriceGrowth: 0,
    mortgageName: 'home',
    jobName: 'job',
    annualSalary: 72800,
    payFrequency: 'first_of_month',
    inflationMatchedPayrise: true,
    kiwiSaverEnabled: true,
    employeeKiwiSaverPercent: 3.5,
    employerKiwiSaverPercent: 3.5,
    kiwiSaverGrowthPercent: 5,
    deposit: 0,
    selectedHouse: '',
    useMarketPrice: true,
    salePrice: 0,
    agentFeePercent: 2.5,
    fixedCosts: 2000,
    livingSituation: 'single_alone',
  };
  if (!g) return defaults;

  const startDate = new Date(g.day).toISOString().slice(0, 10);

  switch (g.kind) {
    case 'start_job':
      return { ...defaults, eventType: 'start_job', startDate, personName: g.personName, jobName: g.name, annualSalary: g.annualSalary,
        payFrequency: g.payFrequency, inflationMatchedPayrise: g.inflationMatchedPayrise,
        kiwiSaverEnabled: g.kiwiSaverEnabled, employeeKiwiSaverPercent: g.employeeKiwiSaverPercent,
        employerKiwiSaverPercent: g.employerKiwiSaverPercent, kiwiSaverGrowthPercent: g.kiwiSaverGrowthPercent };
    case 'create_income':
      return { ...defaults, eventType: 'income', startDate, name: g.name, amount: g.amount,
        frequency: g.frequency, inflationLinked: !!g.inflationLinked };
    case 'create_repeat_cost':
      return { ...defaults, eventType: 'cost', startDate, name: g.name, amount: g.amount,
        frequency: g.frequency, inflationLinked: !!g.inflationLinked };
    case 'create_periodic_investment':
      return { ...defaults, eventType: 'investment', startDate, name: g.name, amount: g.periodAmount,
        frequency: g.frequency, annualGrowthPercent: g.annualGrowthPercent };
    case 'buy_house':
      return { ...defaults, eventType: 'buy_house', startDate, mortgageName: g.name,
        houseValue: g.housePrice, deposit: g.deposit, interestRate: g.annualRatePercent,
        termYears: g.termYears, housePriceGrowth: g.annualHousePriceGrowthPercent ?? 0 };
    case 'create_existing_mortgage':
      return { ...defaults, eventType: 'mortgage', startDate, mortgageName: g.name,
        principal: g.principal, houseValue: g.assetValue, interestRate: g.annualRatePercent,
        termYears: g.termYears, housePriceGrowth: g.annualHousePriceGrowthPercent ?? 0 };
    case 'sell_house':
      return { ...defaults, eventType: 'sell_house', startDate, selectedHouse: g.houseName,
        useMarketPrice: g.salePriceOverride === undefined, salePrice: g.salePriceOverride ?? 0,
        agentFeePercent: g.agentFeePercent, fixedCosts: g.fixedCosts };
    case 'start_superannuation':
      return { ...defaults, eventType: 'superannuation', startDate, personName: g.personName, livingSituation: g.livingSituation };
    default:
      return { ...defaults, startDate };
  }
}

interface AddEventFormProps {
  onAdd: (gesture: Gesture) => void;
  onUpdate?: (gesture: Gesture) => void;
  onCancel: () => void;
  startDay: Date;
  availableHouses: string[];
  initialGesture?: Gesture;
  persons: Person[];
  existingSuperCount: number;
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
      <option value="first_of_year">Yearly</option>
    </select>
  );
}

export function AddEventForm({ onAdd, onUpdate, onCancel, startDay, availableHouses, initialGesture, persons, existingSuperCount }: AddEventFormProps) {
  const today = toDateString(startDay);
  const defaultPersonName = persons[0]?.name ?? '';
  const init = stateFromGesture(initialGesture, today, defaultPersonName);

  const superDateForPerson = (pName: string) => {
    const age = persons.find(p => p.name === pName)?.currentAge ?? 0;
    const d = new Date(startDay);
    d.setUTCFullYear(d.getUTCFullYear() + Math.max(0, 65 - age));
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const [eventType, setEventType] = useState<EventType>(init.eventType);
  const [personName, setPersonName] = useState(init.personName);
  const [name, setName] = useState(init.name);
  const [startDate, setStartDate] = useState(init.startDate);
  const [amount, setAmount] = useState(init.amount);
  const [frequency, setFrequency] = useState<Frequency>(init.frequency);
  const [inflationLinked, setInflationLinked] = useState(init.inflationLinked);
  const [annualGrowthPercent, setAnnualGrowthPercent] = useState(init.annualGrowthPercent);
  const [principal, setPrincipal] = useState(init.principal);
  const [houseValue, setHouseValue] = useState(init.houseValue);
  const [interestRate, setInterestRate] = useState(init.interestRate);
  const [termYears, setTermYears] = useState(init.termYears);
  const [housePriceGrowth, setHousePriceGrowth] = useState(init.housePriceGrowth);
  const [mortgageName, setMortgageName] = useState(init.mortgageName);
  const [jobName, setJobName] = useState(init.jobName);
  const [annualSalary, setAnnualSalary] = useState(init.annualSalary);
  const [payFrequency, setPayFrequency] = useState<'weekly' | 'fortnightly' | 'first_of_month'>(init.payFrequency);
  const [inflationMatchedPayrise, setInflationMatchedPayrise] = useState(init.inflationMatchedPayrise);
  const [kiwiSaverEnabled, setKiwiSaverEnabled] = useState(init.kiwiSaverEnabled);
  const [employeeKiwiSaverPercent, setEmployeeKiwiSaverPercent] = useState(init.employeeKiwiSaverPercent);
  const [employerKiwiSaverPercent, setEmployerKiwiSaverPercent] = useState(init.employerKiwiSaverPercent);
  const [kiwiSaverGrowthPercent, setKiwiSaverGrowthPercent] = useState(init.kiwiSaverGrowthPercent);
  const [deposit, setDeposit] = useState(init.deposit);
  const [selectedHouse, setSelectedHouse] = useState(init.selectedHouse);
  const [useMarketPrice, setUseMarketPrice] = useState(init.useMarketPrice);
  const [salePrice, setSalePrice] = useState(init.salePrice);
  const [agentFeePercent, setAgentFeePercent] = useState(init.agentFeePercent);
  const [fixedCosts, setFixedCosts] = useState(init.fixedCosts);
  const [livingSituation, setLivingSituation] = useState<SuperannuationLivingSituation>(init.livingSituation);

  const isEditing = onUpdate !== undefined;

  const handlePersonChange = (pName: string) => {
    setPersonName(pName);
    if (eventType === 'superannuation' && !initialGesture) {
      setStartDate(superDateForPerson(pName));
    }
  };

  const handleEventTypeChange = (newType: EventType) => {
    setEventType(newType);
    if (newType === 'superannuation' && !initialGesture) {
      setStartDate(superDateForPerson(personName));
    }
  };

  const handleSubmit = () => {
    const day = truncateToDay(new Date(startDate + 'T00:00:00Z'));
    let gesture: Gesture | null = null;

    if (eventType === 'start_job') {
      if (!jobName || annualSalary <= 0) return;
      gesture = {
        kind: 'start_job', day, personName, name: jobName, annualSalary, payFrequency,
        kiwiSaverEnabled, employeeKiwiSaverPercent, employerKiwiSaverPercent, kiwiSaverGrowthPercent,
        inflationMatchedPayrise,
      };
    } else if (eventType === 'income') {
      if (!name || amount <= 0) return;
      gesture = { kind: 'create_income', day, name, frequency, amount, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT, inflationLinked };
    } else if (eventType === 'cost') {
      if (!name || amount <= 0) return;
      gesture = { kind: 'create_repeat_cost', day, name, frequency, amount, fromAccount: CASH_ACCOUNT, inflationLinked };
    } else if (eventType === 'investment') {
      if (!name || amount <= 0) return;
      gesture = { kind: 'create_periodic_investment', day, name, frequency, periodAmount: amount, annualGrowthPercent, fromAccount: CASH_ACCOUNT };
    } else if (eventType === 'buy_house') {
      if (houseValue <= 0 || deposit < 0 || deposit >= houseValue) return;
      gesture = {
        kind: 'buy_house', day, name: mortgageName,
        housePrice: houseValue, deposit, annualRatePercent: interestRate,
        termYears, paymentFromAccount: CASH_ACCOUNT,
        annualHousePriceGrowthPercent: housePriceGrowth,
      };
    } else if (eventType === 'mortgage') {
      if (principal <= 0 || houseValue <= 0) return;
      gesture = {
        kind: 'create_existing_mortgage', day, name: mortgageName,
        principal, assetValue: houseValue, annualRatePercent: interestRate,
        interestFrequency: 'first_of_month', termYears, paymentFromAccount: CASH_ACCOUNT,
        annualHousePriceGrowthPercent: housePriceGrowth,
      };
    } else if (eventType === 'superannuation') {
      const derivedSituation: SuperannuationLivingSituation =
        persons.length === 1 ? livingSituation
        : existingSuperCount === 0 ? 'couple_one'
        : 'couple_both_each';
      gesture = { kind: 'start_superannuation', day, personName, livingSituation: derivedSituation };
    } else {
      const house = selectedHouse || availableHouses[0];
      if (!house) return;
      gesture = {
        kind: 'sell_house', day, houseName: house,
        salePriceOverride: useMarketPrice ? undefined : salePrice,
        agentFeePercent, fixedCosts,
      };
    }

    if (gesture) {
      if (isEditing) onUpdate!(gesture);
      else onAdd(gesture);
    }
  };

  return (
    <div className="add-event-form">
      <div className="form-row">
        <Field label="Event type">
          <select value={eventType} onChange={e => handleEventTypeChange(e.target.value as EventType)}>
            <option value="start_job">Start Job</option>
            <option value="superannuation">Start NZ Super</option>
            <option value="income">Recurring Income</option>
            <option value="cost">Recurring Cost</option>
            <option value="investment">Periodic Investment</option>
            <option value="buy_house">Buy House</option>
            <option value="mortgage">Existing Mortgage &amp; House</option>
            <option value="sell_house">Sell House</option>
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
      </div>

      {(eventType === 'start_job' || eventType === 'superannuation') && persons.length > 1 && (
        <div className="form-row">
          <Field label="Person">
            <select value={personName} onChange={e => handlePersonChange(e.target.value)}>
              {persons.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      )}

      {eventType === 'start_job' && (
        <>
          <div className="form-row">
            <Field label="Job name">
              <input type="text" value={jobName} onChange={e => setJobName(e.target.value)} />
            </Field>
            <Field label="Annual pre-tax salary ($)">
              <input type="number" min="0" value={annualSalary} onChange={e => setAnnualSalary(Number(e.target.value))} />
            </Field>
            <Field label="Pay frequency">
              <select value={payFrequency} onChange={e => setPayFrequency(e.target.value as typeof payFrequency)}>
                <option value="first_of_month">Monthly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label=" ">
              <label className="checkbox-label">
                <input type="checkbox" checked={inflationMatchedPayrise} onChange={e => setInflationMatchedPayrise(e.target.checked)} />
                Yearly inflation-match payrise
              </label>
            </Field>
            <Field label=" ">
              <label className="checkbox-label">
                <input type="checkbox" checked={kiwiSaverEnabled} onChange={e => setKiwiSaverEnabled(e.target.checked)} />
                KiwiSaver
              </label>
            </Field>
            {kiwiSaverEnabled && (
              <>
                <Field label="Employee (%)">
                  <input type="number" step="0.5" min="0" max="10" value={employeeKiwiSaverPercent} onChange={e => setEmployeeKiwiSaverPercent(Number(e.target.value))} />
                </Field>
                <Field label="Employer (%)">
                  <input type="number" step="0.5" min="0" value={employerKiwiSaverPercent} onChange={e => setEmployerKiwiSaverPercent(Number(e.target.value))} />
                </Field>
                <Field label="Growth (% p.a.)">
                  <input type="number" step="0.1" min="0" value={kiwiSaverGrowthPercent} onChange={e => setKiwiSaverGrowthPercent(Number(e.target.value))} />
                </Field>
              </>
            )}
          </div>
        </>
      )}

      {eventType === 'superannuation' && (
        <div className="form-row">
          {persons.length === 1 ? (
            <Field label="Living situation">
              <select value={livingSituation} onChange={e => setLivingSituation(e.target.value as SuperannuationLivingSituation)}>
                <option value="single_alone">Single (living alone) — $555.15/wk</option>
                <option value="single_sharing">Single (sharing accommodation) — $512.45/wk</option>
              </select>
            </Field>
          ) : existingSuperCount === 0 ? (
            <span className="super-rate-info">First to qualify — $812.08/wk (partner not yet eligible)</span>
          ) : (
            <span className="super-rate-info">Both qualifying — $427.04/wk each</span>
          )}
        </div>
      )}

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

      {eventType === 'buy_house' && (
        <>
          <div className="form-row">
            <Field label="Name">
              <input type="text" value={mortgageName} onChange={e => setMortgageName(e.target.value)} />
            </Field>
            <Field label="Purchase price ($)">
              <input type="number" min="0" value={houseValue} onChange={e => setHouseValue(Number(e.target.value))} />
            </Field>
            <Field label="Deposit ($)">
              <input type="number" min="0" value={deposit} onChange={e => setDeposit(Number(e.target.value))} />
            </Field>
            <Field label="Mortgage">
              <span style={{ padding: '0.4rem 0', fontSize: '0.9rem' }}>
                ${Math.max(0, houseValue - deposit).toLocaleString()}
              </span>
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

      {eventType === 'sell_house' && (
        availableHouses.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No houses available — add a Mortgage &amp; House event first.</p>
        ) : (
          <>
            <div className="form-row">
              <Field label="House">
                <select value={selectedHouse || availableHouses[0]} onChange={e => setSelectedHouse(e.target.value)}>
                  {availableHouses.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label=" ">
                <label className="checkbox-label">
                  <input type="checkbox" checked={useMarketPrice} onChange={e => setUseMarketPrice(e.target.checked)} />
                  Use market price
                </label>
              </Field>
              {!useMarketPrice && (
                <Field label="Sale price ($)">
                  <input type="number" min="0" value={salePrice} onChange={e => setSalePrice(Number(e.target.value))} />
                </Field>
              )}
            </div>
            <div className="form-row">
              <Field label="Agent fee (%)">
                <input type="number" step="0.1" min="0" value={agentFeePercent} onChange={e => setAgentFeePercent(Number(e.target.value))} />
              </Field>
              <Field label="Legal costs ($)">
                <input type="number" min="0" value={fixedCosts} onChange={e => setFixedCosts(Number(e.target.value))} />
              </Field>
            </div>
          </>
        )
      )}

      <div className="form-row form-actions">
        <button type="button" className="btn-primary" onClick={handleSubmit}>{isEditing ? 'Save' : 'Add'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
