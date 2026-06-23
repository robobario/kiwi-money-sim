import { describe, it, expect } from 'vitest';
import { generate } from '../generators';
import type { RepeatTransferGenerator, InterestPaymentGenerator, MortgageRepaymentGenerator, IndexAppreciationGenerator, PeriodicBuyInvestmentGenerator, InflationGenerator, NZSalaryGenerator } from '../generators';
import type { World } from '../world';

const DAY_MS = 86_400_000;

// Jan 1 2024 is a Monday
const JAN_1_2024 = Date.UTC(2024, 0, 1);
const JAN_2_2024 = JAN_1_2024 + DAY_MS;
const JAN_7_2024 = JAN_1_2024 + 6 * DAY_MS; // Sunday
const JAN_8_2024 = JAN_1_2024 + 7 * DAY_MS; // Monday (same day of week as Jan 1)
const FEB_1_2024 = Date.UTC(2024, 1, 1);

function worldAt(day: number, accounts: { name: string; balance: number }[] = [], investments: { name: string; indexPrice: number; unitsHeld: number }[] = [], inflationIndex = 1): World {
  return {
    currentDay: day,
    accounts,
    eventGenerators: [],
    eventHistory: [],
    investments,
    inflationIndex,
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

describe('InflationGenerator', () => {
  const inflationGen: InflationGenerator = {
    kind: 'inflation',
    name: 'inflation-3pct',
    annualRatePercent: 3,
  };

  it('fires every day and emits an update_inflation_index event', () => {
    const world = worldAt(JAN_1_2024);
    const events = generate(inflationGen, world);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('update_inflation_index');
  });

  it('computes correct daily multiplier for 3% annual', () => {
    const world = worldAt(JAN_1_2024, [], [], 1.0);
    const events = generate(inflationGen, world);
    const event = events[0];
    if (event.kind === 'update_inflation_index') {
      // (1.03)^(1/365) ≈ 1.0000810
      expect(event.newIndex).toBeCloseTo(1.0000810, 6);
    }
  });

  it('compounding over 365 days yields approximately 3% growth', () => {
    let index = 1.0;
    for (let i = 0; i < 365; i++) {
      const world = worldAt(JAN_1_2024, [], [], index);
      const events = generate(inflationGen, world);
      if (events[0].kind === 'update_inflation_index') index = events[0].newIndex;
    }
    expect(index).toBeCloseTo(1.03, 4);
  });
});

describe('RepeatTransferGenerator with inflation', () => {
  const inflationLinkedGen: RepeatTransferGenerator = {
    kind: 'repeat_transfer',
    name: 'linked-cost',
    startDay: JAN_1_2024,
    from: 'cash',
    to: 'world',
    amount: 1000,
    frequency: 'first_of_month',
    inflationLinked: true,
    baseInflationIndex: 1.0,
  };

  it('amount is unscaled when inflationIndex equals base', () => {
    const world = worldAt(FEB_1_2024, [], [], 1.0);
    const events = generate(inflationLinkedGen, world);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 1000 });
  });

  it('amount scales proportionally with inflationIndex', () => {
    // inflationIndex is 1.2 vs base 1.0 → amount should be 1200
    const world = worldAt(FEB_1_2024, [], [], 1.2);
    const events = generate(inflationLinkedGen, world);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 1200 });
  });

  it('amount scales relative to a non-1 base index', () => {
    const gen: RepeatTransferGenerator = { ...inflationLinkedGen, baseInflationIndex: 1.2 };
    // inflationIndex 1.44 / base 1.2 = 1.2× → amount 1200
    const world = worldAt(FEB_1_2024, [], [], 1.44);
    const events = generate(gen, world);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 1200 });
  });

  it('non-linked generator ignores inflationIndex', () => {
    const staticGen: RepeatTransferGenerator = { ...inflationLinkedGen, inflationLinked: false };
    const world = worldAt(FEB_1_2024, [], [], 2.0);
    const events = generate(staticGen, world);
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 1000 });
  });
});

describe('NZSalaryGenerator', () => {
  const salaryGen: NZSalaryGenerator = {
    kind: 'nz_salary',
    name: 'job-salary',
    startDay: JAN_1_2024,
    frequency: 'first_of_month',
    annualSalary: 60000,
    fromAccount: 'income',
    cashAccount: 'cash',
    taxAccount: 'job-tax-spend',
    accAccount: 'job-acc-levy-spend',
    employeeKiwiSaverPercent: 3,
    employerKiwiSaverPercent: 3,
  };

  const accounts = [
    { name: 'income', balance: 0 },
    { name: 'cash', balance: 0 },
    { name: 'job-tax-spend', balance: 0 },
    { name: 'job-acc-levy-spend', balance: 0 },
  ];

  it('does not fire on a non-pay day', () => {
    const world = worldAt(JAN_2_2024, accounts);
    expect(generate(salaryGen, world)).toHaveLength(0);
  });

  it('fires on the first of the month', () => {
    const world = worldAt(FEB_1_2024, accounts);
    const events = generate(salaryGen, world);
    expect(events.length).toBeGreaterThan(0);
  });

  it('emits correct transfer amounts for $60k annual, monthly, no KiwiSaver', () => {
    const gen: NZSalaryGenerator = { ...salaryGen, kiwiSaverInvestmentName: undefined, employeeKiwiSaverPercent: 0, employerKiwiSaverPercent: 0 };
    const world = worldAt(FEB_1_2024, accounts);
    const events = generate(gen, world);
    // gross = 60000/12 = 5000
    // tax on 60000: 14000*0.105 + 34000*0.175 + 12000*0.30 = 1470+5950+3600 = 11020 → /12 = 918.33
    // ACC on 60000: 60000*0.0175 = 1050 → /12 = 87.50
    // net = 5000 - 918.33 - 87.50 = 3994.17
    const cashTransfer = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'cash');
    const taxTransfer  = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'job-tax-spend');
    const accTransfer  = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'job-acc-levy-spend');
    expect(cashTransfer).toMatchObject({ amount: expect.closeTo(3994.17, 0) });
    expect(taxTransfer).toMatchObject({ amount: expect.closeTo(918.33, 0) });
    expect(accTransfer).toMatchObject({ amount: expect.closeTo(87.50, 1) });
    expect(events).toHaveLength(3);
  });

  it('emits kiwisaver buy events when investment name is set', () => {
    const gen: NZSalaryGenerator = { ...salaryGen, kiwiSaverInvestmentName: 'job-kiwisaver' };
    const world = worldAt(FEB_1_2024, [...accounts, { name: 'job-kiwisaver', balance: 0 }],
      [{ name: 'job-kiwisaver', indexPrice: 1.0, unitsHeld: 0 }]);
    const events = generate(gen, world);
    const ksEvents = events.filter(e => e.kind === 'buy_investment_units');
    expect(ksEvents).toHaveLength(2);
  });

  it('scales salary by inflation index when inflationLinked', () => {
    const gen: NZSalaryGenerator = {
      ...salaryGen,
      kiwiSaverInvestmentName: undefined, employeeKiwiSaverPercent: 0, employerKiwiSaverPercent: 0,
      inflationLinked: true, baseInflationIndex: 1,
    };
    // At inflationIndex 1.5, effective salary = 60000 * 1.5 = 90000
    const world = { ...worldAt(FEB_1_2024, accounts), inflationIndex: 1.5 };
    const baseEvents = generate({ ...gen, inflationLinked: false }, worldAt(FEB_1_2024, accounts));
    const scaledEvents = generate(gen, world);
    const baseNet = (baseEvents.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'cash') as { amount: number })?.amount ?? 0;
    const scaledNet = (scaledEvents.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'cash') as { amount: number })?.amount ?? 0;
    expect(scaledNet).toBeGreaterThan(baseNet);
  });

  it('fires fortnightly every 14 days from start', () => {
    const gen: NZSalaryGenerator = { ...salaryGen, frequency: 'fortnightly' };
    const day14 = JAN_1_2024 + 14 * DAY_MS;
    const day13 = JAN_1_2024 + 13 * DAY_MS;
    expect(generate(gen, worldAt(day14, accounts))).toHaveLength(3);
    expect(generate(gen, worldAt(day13, accounts))).toHaveLength(0);
  });
});
