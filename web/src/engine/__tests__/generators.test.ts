import { describe, it, expect } from 'vitest';
import { generate } from '../generators';
import type { RepeatTransferGenerator, InterestPaymentGenerator } from '../generators';
import type { World } from '../world';

const DAY_MS = 86_400_000;

// Jan 1 2024 is a Monday
const JAN_1_2024 = Date.UTC(2024, 0, 1);
const JAN_2_2024 = JAN_1_2024 + DAY_MS;
const JAN_7_2024 = JAN_1_2024 + 6 * DAY_MS; // Sunday
const JAN_8_2024 = JAN_1_2024 + 7 * DAY_MS; // Monday (same day of week as Jan 1)
const FEB_1_2024 = Date.UTC(2024, 1, 1);

function worldAt(day: number, accounts: { name: string; balance: number }[] = []): World {
  return {
    currentDay: day,
    accounts,
    eventGenerators: [],
    eventHistory: [],
  };
}

describe('RepeatTransferGenerator', () => {
  const dailyGen: RepeatTransferGenerator = {
    kind: 'repeat_transfer',
    name: 'daily-cost',
    startDay: JAN_1_2024,
    from: 'cash',
    to: 'world',
    amount: 10,
    frequency: 'daily',
  };

  const weeklyGen: RepeatTransferGenerator = {
    kind: 'repeat_transfer',
    name: 'weekly-cost',
    startDay: JAN_1_2024,
    from: 'cash',
    to: 'world',
    amount: 100,
    frequency: 'weekly',
  };

  const monthlyGen: RepeatTransferGenerator = {
    kind: 'repeat_transfer',
    name: 'monthly-salary',
    startDay: JAN_1_2024,
    from: 'world',
    to: 'cash',
    amount: 5000,
    frequency: 'first_of_month',
  };

  describe('daily frequency', () => {
    it('fires every day', () => {
      expect(generate(dailyGen, worldAt(JAN_1_2024))).toHaveLength(1);
      expect(generate(dailyGen, worldAt(JAN_2_2024))).toHaveLength(1);
      expect(generate(dailyGen, worldAt(JAN_7_2024))).toHaveLength(1);
    });

    it('produces correct transfer event', () => {
      const events = generate(dailyGen, worldAt(JAN_1_2024));
      expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 10 });
    });
  });

  describe('weekly frequency', () => {
    it('fires on the same day of week as startDay', () => {
      // Jan 1 2024 is Monday, Jan 8 is also Monday
      expect(generate(weeklyGen, worldAt(JAN_8_2024))).toHaveLength(1);
    });

    it('does not fire on a different day of week', () => {
      // Jan 7 is Sunday
      expect(generate(weeklyGen, worldAt(JAN_7_2024))).toHaveLength(0);
      // Jan 2 is Tuesday
      expect(generate(weeklyGen, worldAt(JAN_2_2024))).toHaveLength(0);
    });
  });

  describe('first_of_month frequency', () => {
    it('fires on the 1st of the month', () => {
      expect(generate(monthlyGen, worldAt(JAN_1_2024))).toHaveLength(1);
      expect(generate(monthlyGen, worldAt(FEB_1_2024))).toHaveLength(1);
    });

    it('does not fire on other days', () => {
      expect(generate(monthlyGen, worldAt(JAN_2_2024))).toHaveLength(0);
      expect(generate(monthlyGen, worldAt(JAN_7_2024))).toHaveLength(0);
    });
  });
});

describe('InterestPaymentGenerator', () => {
  const interestGen: InterestPaymentGenerator = {
    kind: 'interest_payment',
    name: 'mortgage-interest',
    startDay: JAN_1_2024,
    mortgageAccount: 'mortgage',
    interestSinkAccount: 'world',
    annualRatePercent: 6.0,
    frequency: 'first_of_month',
  };

  it('calculates monthly interest correctly', () => {
    // Balance is -240000 (mortgage is negative), 6% annual = 0.5% monthly
    // Interest = 240000 * 0.005 = 1200
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: -240000 },
      { name: 'world', balance: 0 },
    ]);
    const events = generate(interestGen, world);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'mortgage', to: 'world', amount: 1200 });
  });

  it('interest scales with remaining balance', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: -120000 },
      { name: 'world', balance: 0 },
    ]);
    const events = generate(interestGen, world);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'mortgage', to: 'world', amount: 600 });
  });

  it('does not fire on non-first-of-month days', () => {
    const world = worldAt(JAN_2_2024, [
      { name: 'mortgage', balance: -240000 },
      { name: 'world', balance: 0 },
    ]);
    expect(generate(interestGen, world)).toHaveLength(0);
  });

  it('calculates weekly interest correctly', () => {
    const weeklyGen: InterestPaymentGenerator = {
      ...interestGen,
      frequency: 'weekly',
    };
    // 6% annual / 52 weeks * 240000 = 276.92
    const world = worldAt(JAN_8_2024, [
      { name: 'mortgage', balance: -240000 },
      { name: 'world', balance: 0 },
    ]);
    const events = generate(weeklyGen, world);
    expect(events).toHaveLength(1);
    expect(events[0].kind === 'transfer' && events[0].amount).toBeCloseTo(276.92, 1);
  });
});
