import type { Event, Frequency } from './events';
import { roundCents } from './money';

export interface InitializeAccountGesture {
  readonly kind: 'initialize_account';
  readonly day: number;
  readonly accountName: string;
  readonly balance: number;
}

export interface CreateIncomeGesture {
  readonly kind: 'create_income';
  readonly day: number;
  readonly name: string;
  readonly frequency: Frequency;
  readonly amount: number;
  readonly toAccount: string;
  readonly fromAccount: string;
}

export interface CreateRepeatCostGesture {
  readonly kind: 'create_repeat_cost';
  readonly day: number;
  readonly name: string;
  readonly frequency: Frequency;
  readonly amount: number;
  readonly fromAccount: string;
  readonly toAccount: string;
}

export interface CreateExistingMortgageGesture {
  readonly kind: 'create_existing_mortgage';
  readonly day: number;
  readonly name: string;
  readonly principal: number;
  readonly assetValue: number;
  readonly annualRatePercent: number;
  readonly interestFrequency: Frequency;
  readonly termYears: number;
  readonly paymentFromAccount: string;
}

export interface CreatePeriodicInvestmentGesture {
  readonly kind: 'create_periodic_investment';
  readonly day: number;
  readonly name: string;
  readonly periodAmount: number;
  readonly frequency: Frequency;
  readonly annualGrowthPercent: number;
  readonly fromAccount: string;
}

export type Gesture =
  | InitializeAccountGesture
  | CreateIncomeGesture
  | CreateRepeatCostGesture
  | CreateExistingMortgageGesture
  | CreatePeriodicInvestmentGesture;

export function gestureEvents(gesture: Gesture): Event[] {
  switch (gesture.kind) {
    case 'initialize_account':
      return [{ kind: 'create_account', name: gesture.accountName, balance: gesture.balance }];

    case 'create_income':
      return [{
        kind: 'register_generator',
        name: gesture.name,
        generator: {
          kind: 'repeat_transfer',
          name: gesture.name,
          startDay: gesture.day,
          from: gesture.fromAccount,
          to: gesture.toAccount,
          amount: gesture.amount,
          frequency: gesture.frequency,
        },
      }];

    case 'create_repeat_cost':
      return [{
        kind: 'register_generator',
        name: gesture.name,
        generator: {
          kind: 'repeat_transfer',
          name: gesture.name,
          startDay: gesture.day,
          from: gesture.fromAccount,
          to: gesture.toAccount,
          amount: gesture.amount,
          frequency: gesture.frequency,
        },
      }];

    case 'create_periodic_investment':
      return [
        { kind: 'create_investment', name: gesture.name, initialPrice: 1.0 },
        {
          kind: 'register_generator',
          name: `${gesture.name}-appreciation`,
          generator: {
            kind: 'index_appreciation',
            name: `${gesture.name}-appreciation`,
            investmentName: gesture.name,
            annualGrowthPercent: gesture.annualGrowthPercent,
          },
        },
        {
          kind: 'register_generator',
          name: `${gesture.name}-buy`,
          generator: {
            kind: 'periodic_buy_investment',
            name: `${gesture.name}-buy`,
            startDay: gesture.day,
            investmentName: gesture.name,
            cashAmount: gesture.periodAmount,
            fromAccount: gesture.fromAccount,
            frequency: gesture.frequency,
          },
        },
      ];

    case 'create_existing_mortgage': {
      const mortgageAccount = `${gesture.name}-mortgage`;
      const payment = calculateMonthlyPayment(gesture.principal, gesture.annualRatePercent, gesture.termYears);
      return [
        { kind: 'create_account', name: mortgageAccount, balance: -gesture.principal },
        { kind: 'create_account', name: `${gesture.name}-house`, balance: gesture.assetValue },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-interest-deduction`,
          generator: {
            kind: 'interest_payment',
            name: `${mortgageAccount}-interest-deduction`,
            startDay: gesture.day,
            mortgageAccount,
            interestSinkAccount: 'world',
            annualRatePercent: gesture.annualRatePercent,
            frequency: gesture.interestFrequency,
          },
        },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-repayment`,
          generator: {
            kind: 'mortgage_repayment',
            name: `${mortgageAccount}-repayment`,
            startDay: gesture.day,
            mortgageAccount,
            paymentFromAccount: gesture.paymentFromAccount,
            amount: payment,
            frequency: gesture.interestFrequency,
          },
        },
      ];
    }
  }
}

export function calculateMonthlyPayment(principal: number, annualRatePercent: number, years: number): number {
  const monthlyRate = annualRatePercent / 100 / 12;
  const numberOfPayments = years * 12;
  const commonFactor = Math.pow(1 + monthlyRate, numberOfPayments);
  const numerator = monthlyRate * commonFactor;
  const denominator = commonFactor - 1;
  return roundCents(principal * numerator / denominator);
}
