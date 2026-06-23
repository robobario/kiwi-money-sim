import { describe, it, expect } from 'vitest';
import { runSimulation, WORLD_ACCOUNT, CASH_ACCOUNT, INCOME_ACCOUNT } from '../simulation';
import type { Gesture } from '../gestures';

const JAN_1_2024 = new Date(Date.UTC(2024, 0, 1));

function basicGestures(startDay: Date): Gesture[] {
  const day = startDay.getTime();
  return [
    { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
    { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 0 },
  ];
}

describe('runSimulation', () => {
  it('captures initial snapshot', async () => {
    const result = await runSimulation(JAN_1_2024, basicGestures(JAN_1_2024), 1, 365);
    expect(result.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(result.snapshots[0].day).toBe(JAN_1_2024.getTime());
  });

  it('captures snapshots at the specified interval', async () => {
    const result = await runSimulation(JAN_1_2024, basicGestures(JAN_1_2024), 1, 30);
    // 365 days / 30 = ~12 interval snapshots + 1 initial + 1 final remainder
    expect(result.snapshots.length).toBeGreaterThanOrEqual(12);
  });

  it('always captures a final snapshot', async () => {
    const result = await runSimulation(JAN_1_2024, basicGestures(JAN_1_2024), 1, 100);
    const last = result.snapshots[result.snapshots.length - 1];
    expect(last.day).toBe(result.finalWorld.currentDay);
  });

  it('income-only scenario accumulates cash', async () => {
    const day = JAN_1_2024.getTime();
    const gestures: Gesture[] = [
      ...basicGestures(JAN_1_2024),
      {
        kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
        amount: 5000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
      },
    ];
    const result = await runSimulation(JAN_1_2024, gestures, 1);
    const cash = result.finalWorld.accounts.find(a => a.name === CASH_ACCOUNT)!.balance;
    // 12 months of $5000 (Jan 1 is the start day, gestures fire on it,
    // but the generator fires on subsequent 1sts, so ~11-12 payments depending on end date)
    expect(cash).toBeGreaterThanOrEqual(55000);
    expect(cash).toBeLessThanOrEqual(60000);
  });

  it('costs reduce cash balance', async () => {
    const day = JAN_1_2024.getTime();
    const gestures: Gesture[] = [
      ...basicGestures(JAN_1_2024),
      {
        kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
        amount: 5000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
      },
      {
        kind: 'create_repeat_cost', day, name: 'rent', frequency: 'first_of_month',
        amount: 2000, fromAccount: CASH_ACCOUNT,
      },
    ];
    const result = await runSimulation(JAN_1_2024, gestures, 1);
    const cash = result.finalWorld.accounts.find(a => a.name === CASH_ACCOUNT)!.balance;
    // Net monthly: 5000 - 2000 = 3000, ~12 months
    expect(cash).toBeGreaterThanOrEqual(33000);
    expect(cash).toBeLessThanOrEqual(36000);
  });

  it('gestures only fire on their specified day', async () => {
    const day = JAN_1_2024.getTime();
    const futureDay = Date.UTC(2024, 6, 1); // Jul 1 2024
    const gestures: Gesture[] = [
      ...basicGestures(JAN_1_2024),
      {
        kind: 'create_income', day: futureDay, name: 'future-salary', frequency: 'first_of_month',
        amount: 10000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
      },
    ];
    // Run for 6 months (Jan-Jun) — gesture shouldn't fire yet
    const sixMonths = new Date(Date.UTC(2024, 6, 1));
    const durationYears = (sixMonths.getTime() - JAN_1_2024.getTime()) / (365.25 * 86_400_000);
    const result = await runSimulation(JAN_1_2024, gestures, Math.ceil(durationYears));
    const cash = result.finalWorld.accounts.find(a => a.name === CASH_ACCOUNT)!.balance;
    // The future salary generator is registered on Jul 1. From Jul 1 to Jan 1 2025
    // is 6 first-of-months (Aug, Sep, Oct, Nov, Dec, Jan), so cash should be ~60000
    // But it should NOT have fired in Jan-Jun
    expect(cash).toBeGreaterThan(0);
    expect(cash).toBeLessThanOrEqual(70000);
  });

  describe('full scenario matching Java main()', () => {
    it('produces expected balances after 1 year', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 0 },
        {
          kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
          amount: 17000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
        },
        {
          kind: 'create_repeat_cost', day, name: 'living-costs', frequency: 'weekly',
          amount: 1000, fromAccount: CASH_ACCOUNT,
        },
        {
          kind: 'create_repeat_cost', day, name: 'annual-costs', frequency: 'first_of_month',
          amount: 2040, fromAccount: CASH_ACCOUNT,
        },
        {
          kind: 'create_existing_mortgage', day, name: 'mortgage',
          principal: 240000, assetValue: 700000, annualRatePercent: 6.0,
          interestFrequency: 'first_of_month', termYears: 22, paymentFromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 1);
      const accounts = result.finalWorld.accounts;

      const cash = accounts.find(a => a.name === CASH_ACCOUNT)!.balance;
      const mortgage = accounts.find(a => a.name === 'mortgage-mortgage')!.balance;
      const houseInv = result.finalWorld.investments.find(i => i.name === 'mortgage-house')!;

      // House value is static (no appreciation configured)
      expect(houseInv.unitsHeld * houseInv.indexPrice).toBeCloseTo(700000, 0);

      // Mortgage should have decreased (less negative) due to payments exceeding interest
      expect(mortgage).toBeGreaterThan(-240000);
      expect(mortgage).toBeLessThan(0);

      // Cash should be positive: income > costs + mortgage payments
      // Monthly: 17000 income - 2040 costs - ~4333 weekly costs - ~1732 mortgage = ~8895
      expect(cash).toBeGreaterThan(0);
    });

    it('mortgage balance reaches zero by end of term', async () => {
      const day = JAN_1_2024.getTime();
      const termYears = 22;
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        {
          kind: 'create_existing_mortgage', day, name: 'home',
          principal: 240000, assetValue: 700000, annualRatePercent: 6.0,
          interestFrequency: 'first_of_month', termYears, paymentFromAccount: CASH_ACCOUNT,
        },
      ];

      // Run one extra year: rounding on each payment can leave a small residual that
      // clears in 1-2 extra months, after which both generators stop firing permanently.
      const result = await runSimulation(JAN_1_2024, gestures, termYears + 1);
      const mortgage = result.finalWorld.accounts.find(a => a.name === 'home-mortgage')!.balance;
      expect(mortgage).toBeCloseTo(0, 2);
    });

    it('mortgage balance decreases over time', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 0 },
        {
          kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
          amount: 17000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
        },
        {
          kind: 'create_existing_mortgage', day, name: 'home',
          principal: 240000, assetValue: 700000, annualRatePercent: 6.0,
          interestFrequency: 'first_of_month', termYears: 22, paymentFromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 5);
      const snapshots = result.snapshots;
      const firstMortgage = snapshots[0].balances['home-mortgage'] ?? 0;
      const lastMortgage = snapshots[snapshots.length - 1].balances['home-mortgage'] ?? 0;

      // Mortgage should be less negative over time (balance increasing toward 0)
      expect(lastMortgage).toBeGreaterThan(firstMortgage);
    });
  });

  describe('inflation scenario', () => {
    it('inflation-linked cost grows in nominal terms over time', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        { kind: 'create_inflation', day, annualRatePercent: 3 },
        {
          kind: 'create_repeat_cost', day, name: 'linked-cost', frequency: 'first_of_month',
          amount: 1000, fromAccount: CASH_ACCOUNT, inflationLinked: true,
        },
        {
          kind: 'create_repeat_cost', day, name: 'static-cost', frequency: 'first_of_month',
          amount: 1000, fromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 10);
      const linked = result.finalWorld.accounts.find(a => a.name === 'linked-cost-spend')!.balance;
      const staticAcc = result.finalWorld.accounts.find(a => a.name === 'static-cost-spend')!.balance;

      // Inflation-linked cumulative spend must exceed static spend over 10 years at 3% inflation
      expect(linked).toBeGreaterThan(staticAcc);
      // After ~10 years at 3%, the index is ~1.34, so linked total should be ~34% higher
      expect(linked / staticAcc).toBeCloseTo(1.16, 0);
    });

    it('inflation-linked salary grows with inflation', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: INCOME_ACCOUNT, balance: 0, external: true },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 0 },
        { kind: 'create_inflation', day, annualRatePercent: 3 },
        {
          kind: 'create_income', day, name: 'salary', frequency: 'first_of_month',
          amount: 5000, toAccount: CASH_ACCOUNT, fromAccount: INCOME_ACCOUNT,
          inflationLinked: true,
        },
        {
          kind: 'create_repeat_cost', day, name: 'costs', frequency: 'first_of_month',
          amount: 5000, fromAccount: CASH_ACCOUNT,
        },
      ];

      // With salary linked and costs static, cash should be positive after 10 years
      const result = await runSimulation(JAN_1_2024, gestures, 10);
      const cash = result.finalWorld.accounts.find(a => a.name === CASH_ACCOUNT)!.balance;
      expect(cash).toBeGreaterThan(0);
    });
  });

  describe('house price appreciation', () => {
    it('house value grows at the configured rate', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        {
          kind: 'create_existing_mortgage', day, name: 'home',
          principal: 240000, assetValue: 700000, annualRatePercent: 6.0,
          interestFrequency: 'first_of_month', termYears: 22, paymentFromAccount: CASH_ACCOUNT,
          annualHousePriceGrowthPercent: 3,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 10);
      const house = result.finalWorld.investments.find(i => i.name === 'home-house')!;
      // After 10 years at 3%: 700000 × 1.03^10 ≈ 940,462
      expect(house.unitsHeld * house.indexPrice).toBeGreaterThan(900_000);
      expect(house.unitsHeld * house.indexPrice).toBeLessThan(1_000_000);
    });

    it('house value stays constant with zero growth rate', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        {
          kind: 'create_existing_mortgage', day, name: 'home',
          principal: 240000, assetValue: 700000, annualRatePercent: 6.0,
          interestFrequency: 'first_of_month', termYears: 22, paymentFromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 10);
      const house = result.finalWorld.investments.find(i => i.name === 'home-house')!;
      expect(house.unitsHeld * house.indexPrice).toBeCloseTo(700000, 0);
    });
  });

  describe('investment scenario', () => {
    it('investment value grows over time with appreciation', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        {
          kind: 'create_periodic_investment', day, name: 'fund',
          periodAmount: 500, frequency: 'first_of_month',
          annualGrowthPercent: 5, fromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 10);
      const fund = result.finalWorld.investments.find(i => i.name === 'fund')!;

      expect(fund).toBeDefined();
      expect(fund.unitsHeld).toBeGreaterThan(0);
      // After 10 years of $500/month, total invested = $60,000. With 5% growth, value should exceed that.
      expect(fund.unitsHeld * fund.indexPrice).toBeGreaterThan(60_000);
    });

    it('investment value is included in snapshots', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 1_000_000 },
        {
          kind: 'create_periodic_investment', day, name: 'fund',
          periodAmount: 500, frequency: 'first_of_month',
          annualGrowthPercent: 5, fromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 1);
      const lastSnapshot = result.snapshots[result.snapshots.length - 1];
      expect(lastSnapshot.investmentValues['fund']).toBeGreaterThan(0);
    });

    it('index price appreciates at the specified annual rate', async () => {
      const day = JAN_1_2024.getTime();
      const gestures: Gesture[] = [
        { kind: 'initialize_account', day, accountName: WORLD_ACCOUNT, balance: 0 },
        { kind: 'initialize_account', day, accountName: CASH_ACCOUNT, balance: 0 },
        {
          kind: 'create_periodic_investment', day, name: 'fund',
          periodAmount: 0, frequency: 'first_of_month',
          annualGrowthPercent: 5, fromAccount: CASH_ACCOUNT,
        },
      ];

      const result = await runSimulation(JAN_1_2024, gestures, 1);
      const fund = result.finalWorld.investments.find(i => i.name === 'fund')!;
      // After 1 year at 5% annual growth, index should be close to 1.05
      expect(fund.indexPrice).toBeCloseTo(1.05, 2);
    });
  });
});
