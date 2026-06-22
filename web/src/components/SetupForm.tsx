import { useState } from 'react';
import type { FormValues, RecurringCostEntry, InvestmentEntry } from '../types/form';
import { DEFAULT_FORM_VALUES } from '../types/form';
import type { Frequency } from '../engine/events';

interface SetupFormProps {
  onSubmit: (values: FormValues) => void;
  initialValues?: FormValues;
}

export function SetupForm({ onSubmit, initialValues }: SetupFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues ?? DEFAULT_FORM_VALUES);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const updateCost = (index: number, field: keyof RecurringCostEntry, value: string | number | boolean) => {
    const updated = values.recurringCosts.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    update('recurringCosts', updated);
  };

  const addCost = () => {
    update('recurringCosts', [...values.recurringCosts, { name: '', amount: 0, frequency: 'monthly' as Frequency, inflationLinked: false }]);
  };

  const removeCost = (index: number) => {
    update('recurringCosts', values.recurringCosts.filter((_, i) => i !== index));
  };

  const updateInvestment = (index: number, field: keyof InvestmentEntry, value: string | number) => {
    const updated = values.investments.map((inv, i) =>
      i === index ? { ...inv, [field]: value } : inv
    );
    update('investments', updated);
  };

  const addInvestment = () => {
    update('investments', [...values.investments, { name: '', periodAmount: 500, frequency: 'first_of_month' as Frequency, annualGrowthPercent: 5 }]);
  };

  const removeInvestment = (index: number) => {
    update('investments', values.investments.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const inflationActive = values.inflationRatePercent > 0;

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      <h2>Setup</h2>

      <div className="form-section">
        <label>
          Starting Cash ($)
          <input type="number" value={values.startingCash} onChange={e => update('startingCash', Number(e.target.value))} />
        </label>

        <label>
          Monthly Salary After Tax ($)
          <input type="number" value={values.monthlySalary} onChange={e => update('monthlySalary', Number(e.target.value))} />
        </label>
      </div>

      <div className="form-section">
        <h3>Recurring Costs</h3>
        {values.recurringCosts.map((cost, i) => (
          <div key={i} className="cost-row">
            <input
              type="text"
              placeholder="Name"
              value={cost.name}
              onChange={e => updateCost(i, 'name', e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount"
              value={cost.amount}
              onChange={e => updateCost(i, 'amount', Number(e.target.value))}
            />
            <select
              value={cost.frequency}
              onChange={e => updateCost(i, 'frequency', e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="first_of_month">Monthly</option>
            </select>
            {inflationActive && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cost.inflationLinked}
                  onChange={e => updateCost(i, 'inflationLinked', e.target.checked)}
                />
                Inflation-linked
              </label>
            )}
            <button type="button" onClick={() => removeCost(i)} className="btn-remove">x</button>
          </div>
        ))}
        <button type="button" onClick={addCost} className="btn-secondary">+ Add Cost</button>
      </div>

      <div className="form-section">
        <h3>Investments</h3>
        {values.investments.map((inv, i) => (
          <div key={i} className="cost-row">
            <input
              type="text"
              placeholder="Name"
              value={inv.name}
              onChange={e => updateInvestment(i, 'name', e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount per period"
              value={inv.periodAmount}
              onChange={e => updateInvestment(i, 'periodAmount', Number(e.target.value))}
            />
            <select
              value={inv.frequency}
              onChange={e => updateInvestment(i, 'frequency', e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="first_of_month">Monthly</option>
            </select>
            <input
              type="number"
              placeholder="Growth % p.a."
              step="0.1"
              value={inv.annualGrowthPercent}
              onChange={e => updateInvestment(i, 'annualGrowthPercent', Number(e.target.value))}
            />
            <button type="button" onClick={() => removeInvestment(i)} className="btn-remove">x</button>
          </div>
        ))}
        <button type="button" onClick={addInvestment} className="btn-secondary">+ Add Investment</button>
      </div>

      <div className="form-section">
        <h3>Inflation</h3>
        <label>
          Annual Inflation Rate (%)
          <input
            type="number"
            step="0.1"
            min="0"
            value={values.inflationRatePercent}
            onChange={e => update('inflationRatePercent', Number(e.target.value))}
          />
        </label>
        {inflationActive && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={values.salaryInflationLinked}
              onChange={e => update('salaryInflationLinked', e.target.checked)}
            />
            Salary grows with inflation
          </label>
        )}
      </div>

      <div className="form-section">
        <label className="checkbox-label">
          <input type="checkbox" checked={values.hasMortgage} onChange={e => update('hasMortgage', e.target.checked)} />
          I have a mortgage
        </label>

        {values.hasMortgage && (
          <div className="mortgage-fields">
            <label>
              Principal Remaining ($)
              <input type="number" value={values.mortgagePrincipal} onChange={e => update('mortgagePrincipal', Number(e.target.value))} />
            </label>
            <label>
              House Value ($)
              <input type="number" value={values.houseValue} onChange={e => update('houseValue', Number(e.target.value))} />
            </label>
            <label>
              Interest Rate (% p.a.)
              <input type="number" step="0.1" value={values.interestRate} onChange={e => update('interestRate', Number(e.target.value))} />
            </label>
            <label>
              Remaining Term (years)
              <input type="number" value={values.termYears} onChange={e => update('termYears', Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>

      <div className="form-section">
        <label>
          Simulation Duration (years)
          <input type="number" value={values.simulationYears} onChange={e => update('simulationYears', Number(e.target.value))} />
        </label>
      </div>

      <button type="submit" className="btn-primary">Run Simulation</button>
    </form>
  );
}
