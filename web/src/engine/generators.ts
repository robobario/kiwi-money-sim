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

export type EventGenerator = RepeatTransferGenerator | InterestPaymentGenerator;

export function generate(gen: EventGenerator, world: World): Event[] {
  switch (gen.kind) {
    case 'repeat_transfer': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      return [{ kind: 'transfer', from: gen.from, to: gen.to, amount: gen.amount }];
    }
    case 'interest_payment': {
      if (!shouldFire(gen.frequency, world.currentDay, gen.startDay)) return [];
      const paymentsPerYear = paymentsPerYearFor(gen.frequency);
      const periodicRate = gen.annualRatePercent / 100 / paymentsPerYear;
      const account = world.accounts.find(a => a.name === gen.mortgageAccount)!;
      const interest = roundCents(-account.balance * periodicRate);
      return [{ kind: 'transfer', from: gen.mortgageAccount, to: gen.interestSinkAccount, amount: interest }];
    }
  }
}

function paymentsPerYearFor(frequency: Frequency): number {
  switch (frequency) {
    case 'daily': return 365;
    case 'weekly': return 52;
    case 'first_of_month': return 12;
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
  }
}
