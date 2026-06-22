import type { Event, Frequency } from './events';
import type { World } from './world';
import { roundCents } from './money';

export interface RepeatTransferGenerator {
  readonly kind: 'repeat_transfer';
  readonly name: string;
  readonly startDay: number;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly frequency: Frequency;
  readonly inflationLinked?: boolean;
  readonly baseInflationIndex?: number;
}

export interface InterestPaymentGenerator {
  readonly kind: 'interest_payment';
  readonly name: string;
  readonly startDay: number;
  readonly mortgageAccount: string;
  readonly interestSinkAccount: string;
  readonly annualRatePercent: number;
  readonly frequency: Frequency;
}

export interface MortgageRepaymentGenerator {
  readonly kind: 'mortgage_repayment';
  readonly name: string;
  readonly startDay: number;
  readonly mortgageAccount: string;
  readonly paymentFromAccount: string;
  readonly amount: number;
  readonly frequency: Frequency;
}

export interface IndexAppreciationGenerator {
  readonly kind: 'index_appreciation';
  readonly name: string;
  readonly investmentName: string;
  readonly annualGrowthPercent: number;
}

export interface PeriodicBuyInvestmentGenerator {
  readonly kind: 'periodic_buy_investment';
  readonly name: string;
  readonly startDay: number;
  readonly investmentName: string;
  readonly cashAmount: number;
  readonly fromAccount: string;
  readonly frequency: Frequency;
}

export interface InflationGenerator {
  readonly kind: 'inflation';
  readonly name: string;
  readonly annualRatePercent: number;
}

export type EventGenerator =
  | RepeatTransferGenerator
  | InterestPaymentGenerator
  | MortgageRepaymentGenerator
  | IndexAppreciationGenerator
  | PeriodicBuyInvestmentGenerator
  | InflationGenerator;

export function generate(gen: EventGenerator, world: World): Event[] {
  switch (gen.kind) {
    case 'repeat_transfer': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      const amount = gen.inflationLinked
        ? roundCents(gen.amount * world.inflationIndex / (gen.baseInflationIndex ?? 1))
        : gen.amount;
      return [{ kind: 'transfer', from: gen.from, to: gen.to, amount }];
    }
    case 'interest_payment': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      const account = world.accounts.find(a => a.name === gen.mortgageAccount)!;
      if (account.balance >= 0) return [];
      const paymentsPerYear = paymentsPerYearFor(gen.frequency);
      const periodicRate = gen.annualRatePercent / 100 / paymentsPerYear;
      const interest = roundCents(-account.balance * periodicRate);
      return [{ kind: 'transfer', from: gen.mortgageAccount, to: gen.interestSinkAccount, amount: interest }];
    }
    case 'mortgage_repayment': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      const account = world.accounts.find(a => a.name === gen.mortgageAccount)!;
      if (account.balance >= 0) return [];
      const payment = roundCents(Math.min(gen.amount, -account.balance));
      return [{ kind: 'transfer', from: gen.paymentFromAccount, to: gen.mortgageAccount, amount: payment }];
    }
    case 'index_appreciation': {
      const investment = world.investments.find(i => i.name === gen.investmentName)!;
      const dailyMultiplier = Math.pow(1 + gen.annualGrowthPercent / 100, 1 / 365);
      const newPrice = investment.indexPrice * dailyMultiplier;
      return [{ kind: 'update_index_price', investmentName: gen.investmentName, newPrice }];
    }
    case 'periodic_buy_investment': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      return [{ kind: 'buy_investment_units', investmentName: gen.investmentName, cashAmount: gen.cashAmount, fromAccount: gen.fromAccount }];
    }
    case 'inflation': {
      const dailyMultiplier = Math.pow(1 + gen.annualRatePercent / 100, 1 / 365);
      return [{ kind: 'update_inflation_index', newIndex: world.inflationIndex * dailyMultiplier }];
    }
  }
}

function paymentsPerYearFor(frequency: Frequency): number {
  switch (frequency) {
    case 'daily': return 365;
    case 'weekly': return 52;
    case 'first_of_month': return 12;
    case 'first_of_year': return 1;
  }
}

function shouldFire(frequency: Frequency, currentDay: number, startDay: number): boolean {
  const current = new Date(currentDay);
  switch (frequency) {
    case 'daily':
      return true;
    case 'weekly': {
      const start = new Date(startDay);
      return current.getUTCDay() === start.getUTCDay();
    }
    case 'first_of_month':
      return current.getUTCDate() === 1;
    case 'first_of_year':
      return current.getUTCDate() === 1 && current.getUTCMonth() === 0;
  }
}
