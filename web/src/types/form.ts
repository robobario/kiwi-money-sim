import type { Frequency } from '../engine/events';

export interface RecurringCostEntry {
  readonly name: string;
  readonly amount: number;
  readonly frequency: Frequency;
  readonly inflationLinked: boolean;
}

export interface InvestmentEntry {
  readonly name: string;
  readonly periodAmount: number;
  readonly frequency: Frequency;
  readonly annualGrowthPercent: number;
}

export interface FormValues {
  readonly startingCash: number;
  readonly monthlySalary: number;
  readonly salaryInflationLinked: boolean;
  readonly inflationRatePercent: number;
  readonly recurringCosts: readonly RecurringCostEntry[];
  readonly investments: readonly InvestmentEntry[];
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
  salaryInflationLinked: false,
  inflationRatePercent: 0,
  recurringCosts: [{ name: 'living-costs', amount: 250, frequency: 'weekly', inflationLinked: false }],
  investments: [{ name: 'Index Fund', periodAmount: 500, frequency: 'first_of_month', annualGrowthPercent: 5 }],
  hasMortgage: false,
  mortgagePrincipal: 240000,
  houseValue: 700000,
  interestRate: 6.0,
  termYears: 22,
  simulationYears: 30,
};
