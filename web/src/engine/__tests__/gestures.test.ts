import { describe, it, expect } from 'vitest';
import { gestureEvents, calculateMonthlyPayment } from '../gestures';

const JAN_1_2024 = Date.UTC(2024, 0, 1);

describe('gestureEvents', () => {
  it('initialize_account produces a create_account event', () => {
    const events = gestureEvents({
      kind: 'initialize_account',
      day: JAN_1_2024,
      accountName: 'cash',
      balance: 500,
    });
    expect(events).toEqual([{ kind: 'create_account', name: 'cash', balance: 500 }]);
  });

  it('create_income registers a repeat_transfer generator', () => {
    const events = gestureEvents({
      kind: 'create_income',
      day: JAN_1_2024,
      name: 'salary',
      frequency: 'first_of_month',
      amount: 5000,
      toAccount: 'cash',
      fromAccount: 'world',
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('register_generator');
    if (events[0].kind === 'register_generator') {
      expect(events[0].generator.kind).toBe('repeat_transfer');
      if (events[0].generator.kind === 'repeat_transfer') {
        expect(events[0].generator.from).toBe('world');
        expect(events[0].generator.to).toBe('cash');
        expect(events[0].generator.amount).toBe(5000);
      }
    }
  });

  it('create_repeat_cost registers a repeat_transfer generator', () => {
    const events = gestureEvents({
      kind: 'create_repeat_cost',
      day: JAN_1_2024,
      name: 'rent',
      frequency: 'first_of_month',
      amount: 2000,
      fromAccount: 'cash',
      toAccount: 'world',
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('register_generator');
    if (events[0].kind === 'register_generator') {
      expect(events[0].generator.kind).toBe('repeat_transfer');
      if (events[0].generator.kind === 'repeat_transfer') {
        expect(events[0].generator.from).toBe('cash');
        expect(events[0].generator.to).toBe('world');
        expect(events[0].generator.amount).toBe(2000);
      }
    }
  });

  describe('create_existing_mortgage', () => {
    const events = gestureEvents({
      kind: 'create_existing_mortgage',
      day: JAN_1_2024,
      name: 'home',
      principal: 240000,
      assetValue: 700000,
      annualRatePercent: 6.0,
      interestFrequency: 'first_of_month',
      termYears: 22,
      paymentFromAccount: 'cash',
    });

    it('produces 4 events', () => {
      expect(events).toHaveLength(4);
    });

    it('creates mortgage account with negative principal', () => {
      expect(events[0]).toEqual({ kind: 'create_account', name: 'home-mortgage', balance: -240000 });
    });

    it('creates house asset account', () => {
      expect(events[1]).toEqual({ kind: 'create_account', name: 'home-house', balance: 700000 });
    });

    it('registers interest generator', () => {
      expect(events[2].kind).toBe('register_generator');
      if (events[2].kind === 'register_generator') {
        expect(events[2].generator.kind).toBe('interest_payment');
        expect(events[2].name).toBe('home-mortgage-interest-deduction');
      }
    });

    it('registers repayment generator with calculated payment', () => {
      expect(events[3].kind).toBe('register_generator');
      if (events[3].kind === 'register_generator') {
        expect(events[3].generator.kind).toBe('mortgage_repayment');
        if (events[3].generator.kind === 'mortgage_repayment') {
          expect(events[3].generator.paymentFromAccount).toBe('cash');
          expect(events[3].generator.mortgageAccount).toBe('home-mortgage');
          expect(events[3].generator.amount).toBeCloseTo(1639.38, 0);
        }
      }
    });
  });
});

describe('calculateMonthlyPayment', () => {
  it('calculates correctly for 240k at 6% over 22 years', () => {
    const payment = calculateMonthlyPayment(240000, 6.0, 22);
    expect(payment).toBeCloseTo(1639.38, 0);
  });

  it('calculates correctly for 200k at 5% over 30 years', () => {
    // Well-known: $200,000 at 5% for 30 years ≈ $1,073.64
    const payment = calculateMonthlyPayment(200000, 5.0, 30);
    expect(payment).toBeCloseTo(1073.64, 0);
  });

  it('calculates correctly for 100k at 3% over 15 years', () => {
    // Well-known: $100,000 at 3% for 15 years ≈ $690.58
    const payment = calculateMonthlyPayment(100000, 3.0, 15);
    expect(payment).toBeCloseTo(690.58, 0);
  });

  it('higher rate means higher payment', () => {
    const low = calculateMonthlyPayment(200000, 4.0, 30);
    const high = calculateMonthlyPayment(200000, 6.0, 30);
    expect(high).toBeGreaterThan(low);
  });

  it('shorter term means higher payment', () => {
    const long = calculateMonthlyPayment(200000, 5.0, 30);
    const short = calculateMonthlyPayment(200000, 5.0, 15);
    expect(short).toBeGreaterThan(long);
  });
});
