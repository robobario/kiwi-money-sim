import type { Frequency } from '../engine/events';

export interface RecurringCostEntry {
  readonly name: string;
  readonly amount: number;
  readonly frequency: Frequency;
}

export interface FormValues {
  readonly startingCash: number;
  readonly monthlySalary: number;
  readonly recurringCosts: readonly RecurringCostEntry[];
  readonly hasMortgage: boolean;
  readonly mortgagePrincipal: number;
  readonly houseValue: number;
  readonly interestRate: number;
  readonly termYears: number;
  readonly simulationYears: number;
}

export const DEFAULT_FORM_VALUES: FormValues = {
  startingCash: 0,
  monthlySalary: 5000,
  recurringCosts: [{ name: 'living-costs', amount: 250, frequency: 'weekly' }],
  hasMortgage: false,
  mortgagePrincipal: 240000,
  houseValue: 700000,
  interestRate: 6.0,
  termYears: 22,
  simulationYears: 30,
};
