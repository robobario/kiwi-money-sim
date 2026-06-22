import { describe, it, expect } from 'vitest';
import { generate } from '../generators';
import type { RepeatTransferGenerator, InterestPaymentGenerator, MortgageRepaymentGenerator, IndexAppreciationGenerator, PeriodicBuyInvestmentGenerator } from '../generators';
import type { World } from '../world';

const DAY_MS = 86_400_000;

// Jan 1 2024 is a Monday
const JAN_1_2024 = Date.UTC(2024, 0, 1);
const JAN_2_2024 = JAN_1_2024 + DAY_MS;
const JAN_7_2024 = JAN_1_2024 + 6 * DAY_MS; // Sunday
const JAN_8_2024 = JAN_1_2024 + 7 * DAY_MS; // Monday (same day of week as Jan 1)
const FEB_1_2024 = Date.UTC(2024, 1, 1);

function worldAt(day: number, accounts: { name: string; balance: number }[] = [], investments: { name: string; indexPrice: number; unitsHeld: number }[] = []): World {
  return {
    currentDay: day,
    accounts,
    eventGenerators: [],
    eventHistory: [],
    investments,
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

  it('does not fire when mortgage balance is zero', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: 0 },
      { name: 'world', balance: 0 },
    ]);
    expect(generate(interestGen, world)).toHaveLength(0);
  });

  it('does not fire when mortgage balance is positive', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: 100 },
      { name: 'world', balance: 0 },
    ]);
    expect(generate(interestGen, world)).toHaveLength(0);
  });
});

describe('MortgageRepaymentGenerator', () => {
  const repaymentGen: MortgageRepaymentGenerator = {
    kind: 'mortgage_repayment',
    name: 'home-repayment',
    startDay: JAN_1_2024,
    mortgageAccount: 'mortgage',
    paymentFromAccount: 'cash',
    amount: 1500,
    frequency: 'first_of_month',
  };

  it('transfers the full payment when balance is well below zero', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: -240000 },
      { name: 'cash', balance: 10000 },
    ]);
    const events = generate(repaymentGen, world);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'mortgage', amount: 1500 });
  });

  it('caps the final payment to the remaining principal', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: -500 },
      { name: 'cash', balance: 10000 },
    ]);
    const events = generate(repaymentGen, world);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'mortgage', amount: 500 });
  });

  it('does not fire when mortgage balance is zero', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: 0 },
      { name: 'cash', balance: 10000 },
    ]);
    expect(generate(repaymentGen, world)).toHaveLength(0);
  });

  it('does not fire when mortgage balance is positive', () => {
    const world = worldAt(FEB_1_2024, [
      { name: 'mortgage', balance: 50 },
      { name: 'cash', balance: 10000 },
    ]);
    expect(generate(repaymentGen, world)).toHaveLength(0);
  });

  it('does not fire on non-first-of-month days', () => {
    const world = worldAt(JAN_2_2024, [
      { name: 'mortgage', balance: -240000 },
      { name: 'cash', balance: 10000 },
    ]);
    expect(generate(repaymentGen, world)).toHaveLength(0);
  });
});

describe('IndexAppreciationGenerator', () => {
  const appreciationGen: IndexAppreciationGenerator = {
    kind: 'index_appreciation',
    name: 'fund-appreciation',
    investmentName: 'fund',
    annualGrowthPercent: 5,
  };

  it('fires every day and emits an update_index_price event', () => {
    const world = worldAt(JAN_1_2024, [], [{ name: 'fund', indexPrice: 1.0, unitsHeld: 0 }]);
    const events = generate(appreciationGen, world);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('update_index_price');
  });

  it('price after one day is correct for 5% annual growth', () => {
    const world = worldAt(JAN_1_2024, [], [{ name: 'fund', indexPrice: 1.0, unitsHeld: 0 }]);
    const events = generate(appreciationGen, world);
    const event = events[0];
    if (event.kind === 'update_index_price') {
      // (1.05)^(1/365) ≈ 1.0001337
      expect(event.newPrice).toBeCloseTo(1.0001337, 6);
    }
  });

  it('compounding over 365 days yields approximately 5% growth', () => {
    let price = 1.0;
    for (let i = 0; i < 365; i++) {
      const world = worldAt(JAN_1_2024, [], [{ name: 'fund', indexPrice: price, unitsHeld: 0 }]);
      const events = generate(appreciationGen, world);
      if (events[0].kind === 'update_index_price') price = events[0].newPrice;
    }
    expect(price).toBeCloseTo(1.05, 4);
  });
});

describe('PeriodicBuyInvestmentGenerator', () => {
  const buyGen: PeriodicBuyInvestmentGenerator = {
    kind: 'periodic_buy_investment',
    name: 'fund-buy',
    startDay: JAN_1_2024,
    investmentName: 'fund',
    cashAmount: 500,
    fromAccount: 'cash',
    frequency: 'first_of_month',
  };

  it('fires on the first of the month and emits buy_investment_units', () => {
    const world = worldAt(FEB_1_2024, [{ name: 'cash', balance: 1000 }], [{ name: 'fund', indexPrice: 1.0, unitsHeld: 0 }]);
    const events = generate(buyGen, world);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'buy_investment_units', investmentName: 'fund', cashAmount: 500, fromAccount: 'cash' });
  });

  it('does not fire on non-first-of-month days', () => {
    const world = worldAt(JAN_2_2024, [{ name: 'cash', balance: 1000 }], [{ name: 'fund', indexPrice: 1.0, unitsHeld: 0 }]);
    expect(generate(buyGen, world)).toHaveLength(0);
  });
});
