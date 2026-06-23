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

  it('create_repeat_cost creates a spend account and registers a repeat_transfer generator', () => {
    const events = gestureEvents({
      kind: 'create_repeat_cost',
      day: JAN_1_2024,
      name: 'rent',
      frequency: 'first_of_month',
      amount: 2000,
      fromAccount: 'cash',
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: 'create_account', name: 'rent-spend', balance: 0, external: true });
    expect(events[1].kind).toBe('register_generator');
    if (events[1].kind === 'register_generator') {
      expect(events[1].generator.kind).toBe('repeat_transfer');
      if (events[1].generator.kind === 'repeat_transfer') {
        expect(events[1].generator.from).toBe('cash');
        expect(events[1].generator.to).toBe('rent-spend');
        expect(events[1].generator.amount).toBe(2000);
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

    it('creates house investment', () => {
      expect(events[1]).toEqual({ kind: 'create_investment', name: 'home-house', initialPrice: 1.0, initialUnits: 700000 });
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

describe('inflation-linked gestures', () => {
  it('create_inflation registers an inflation generator', () => {
    const events = gestureEvents({
      kind: 'create_inflation',
      day: JAN_1_2024,
      annualRatePercent: 3,
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('register_generator');
    if (events[0].kind === 'register_generator') {
      expect(events[0].generator.kind).toBe('inflation');
      if (events[0].generator.kind === 'inflation') {
        expect(events[0].generator.annualRatePercent).toBe(3);
      }
    }
  });

  it('create_repeat_cost with inflationLinked captures baseInflationIndex from world', () => {
    const world = {
      currentDay: JAN_1_2024,
      accounts: [],
      eventGenerators: [],
      eventHistory: [],
      investments: [],
      inflationIndex: 1.5,
    };
    const events = gestureEvents({
      kind: 'create_repeat_cost',
      day: JAN_1_2024,
      name: 'rent',
      frequency: 'first_of_month',
      amount: 1000,
      fromAccount: 'cash',
      inflationLinked: true,
    }, world);
    expect(events[1].kind).toBe('register_generator');
    if (events[1].kind === 'register_generator') {
      if (events[1].generator.kind === 'repeat_transfer') {
        expect(events[1].generator.inflationLinked).toBe(true);
        expect(events[1].generator.baseInflationIndex).toBe(1.5);
      }
    }
  });

  it('gestureEvents without world defaults baseInflationIndex to 1', () => {
    const events = gestureEvents({
      kind: 'create_income',
      day: JAN_1_2024,
      name: 'salary',
      frequency: 'first_of_month',
      amount: 5000,
      toAccount: 'cash',
      fromAccount: 'world',
      inflationLinked: true,
    });
    if (events[0].kind === 'register_generator') {
      if (events[0].generator.kind === 'repeat_transfer') {
        expect(events[0].generator.baseInflationIndex).toBe(1);
      }
    }
  });
});

describe('buy_house gesture', () => {
  const events = gestureEvents({
    kind: 'buy_house',
    day: JAN_1_2024,
    name: 'home',
    housePrice: 700000,
    deposit: 100000,
    annualRatePercent: 6.0,
    termYears: 25,
    paymentFromAccount: 'cash',
  });

  it('transfers deposit from cash to world', () => {
    expect(events[0]).toEqual({ kind: 'transfer', from: 'cash', to: 'world', amount: 100000 });
  });

  it('creates mortgage account at derived principal', () => {
    expect(events[1]).toEqual({ kind: 'create_account', name: 'home-mortgage', balance: -600000 });
  });

  it('creates house investment at full purchase price', () => {
    expect(events[2]).toEqual({ kind: 'create_investment', name: 'home-house', initialPrice: 1.0, initialUnits: 700000 });
  });

  it('registers interest and repayment generators', () => {
    expect(events[3]).toMatchObject({ kind: 'register_generator', name: 'home-mortgage-interest-deduction' });
    expect(events[4]).toMatchObject({ kind: 'register_generator', name: 'home-mortgage-repayment' });
  });

  it('calculates monthly payment on principal only', () => {
    if (events[4].kind === 'register_generator' && events[4].generator.kind === 'mortgage_repayment') {
      expect(events[4].generator.amount).toBeCloseTo(calculateMonthlyPayment(600000, 6.0, 25), 0);
    }
  });
});

describe('sell_house gesture', () => {
  const world = {
    currentDay: JAN_1_2024,
    accounts: [
      { name: 'cash', balance: 10000 },
      { name: 'home-mortgage', balance: -150000 },
    ],
    eventGenerators: [],
    eventHistory: [],
    investments: [
      { name: 'home-house', indexPrice: 1.05, unitsHeld: 700000 },
    ],
    inflationIndex: 1,
  };

  describe('with market price and partial mortgage payoff', () => {
    const events = gestureEvents({
      kind: 'sell_house',
      day: JAN_1_2024,
      houseName: 'home',
      agentFeePercent: 2,
      fixedCosts: 2000,
    }, world);

    it('creates proceeds account at market price', () => {
      expect(events[0]).toEqual({ kind: 'create_account', name: 'home-sale-proceeds', balance: 735000, external: true });
    });

    it('creates legal fee and agent fee accounts', () => {
      expect(events[1]).toEqual({ kind: 'create_account', name: 'home-sale-legal-fee', balance: 0, external: true });
      expect(events[2]).toEqual({ kind: 'create_account', name: 'home-sale-agent-fee', balance: 0, external: true });
    });

    it('transfers legal fee from proceeds', () => {
      const transfer = events.find(e => e.kind === 'transfer' && e.kind === 'transfer' && (e as { to: string }).to === 'home-sale-legal-fee');
      expect(transfer).toMatchObject({ kind: 'transfer', from: 'home-sale-proceeds', to: 'home-sale-legal-fee', amount: 2000 });
    });

    it('transfers agent fee (2% of 735000 = 14700) from proceeds', () => {
      const transfer = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'home-sale-agent-fee');
      expect(transfer).toMatchObject({ kind: 'transfer', from: 'home-sale-proceeds', to: 'home-sale-agent-fee', amount: 14700 });
    });

    it('pays off full mortgage from proceeds', () => {
      const transfer = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'home-mortgage');
      expect(transfer).toMatchObject({ kind: 'transfer', from: 'home-sale-proceeds', to: 'home-mortgage', amount: 150000 });
    });

    it('transfers remainder to cash', () => {
      // 735000 - 2000 - 14700 - 150000 = 568300
      const transfer = events.find(e => e.kind === 'transfer' && (e as { to: string }).to === 'cash');
      expect(transfer).toMatchObject({ kind: 'transfer', from: 'home-sale-proceeds', to: 'cash', amount: 568300 });
    });

    it('clears the house investment', () => {
      expect(events[events.length - 1]).toEqual({ kind: 'clear_investment', name: 'home-house' });
    });
  });

  it('uses salePriceOverride when provided', () => {
    const events = gestureEvents({
      kind: 'sell_house',
      day: JAN_1_2024,
      houseName: 'home',
      salePriceOverride: 800000,
      agentFeePercent: 0,
      fixedCosts: 0,
    }, world);
    expect(events[0]).toMatchObject({ kind: 'create_account', name: 'home-sale-proceeds', balance: 800000 });
  });

  it('funds shortfall from cash when sale is underwater', () => {
    const worldWithBigMortgage = {
      ...world,
      accounts: [
        { name: 'cash', balance: 50000 },
        { name: 'home-mortgage', balance: -600000 },
      ],
    };
    const events = gestureEvents({
      kind: 'sell_house',
      day: JAN_1_2024,
      houseName: 'home',
      salePriceOverride: 500000,
      agentFeePercent: 0,
      fixedCosts: 0,
    }, worldWithBigMortgage);
    // proceeds cover 500k, shortfall of 100k comes from cash
    const proceedsTransfer = events.find(e => e.kind === 'transfer' && (e as { from: string }).from === 'home-sale-proceeds' && (e as { to: string }).to === 'home-mortgage');
    expect(proceedsTransfer).toMatchObject({ amount: 500000 });
    const cashTransfer = events.find(e => e.kind === 'transfer' && (e as { from: string }).from === 'cash' && (e as { to: string }).to === 'home-mortgage');
    expect(cashTransfer).toMatchObject({ amount: 100000 });
  });
});

describe('start_drawdown gesture', () => {
  it('registers a drawdown generator named after the investment', () => {
    const events = gestureEvents({
      kind: 'start_drawdown',
      day: JAN_1_2024,
      investmentName: 'my-fund',
      mode: 'percent',
      annualPercent: 4,
      annualAmount: 0,
      inflationLinked: false,
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('register_generator');
    if (events[0].kind === 'register_generator') {
      expect(events[0].name).toBe('my-fund-drawdown');
      expect(events[0].generator.kind).toBe('drawdown');
    }
  });

  it('passes percent mode through to the generator', () => {
    const events = gestureEvents({
      kind: 'start_drawdown',
      day: JAN_1_2024,
      investmentName: 'my-fund',
      mode: 'percent',
      annualPercent: 4,
      annualAmount: 0,
      inflationLinked: false,
    });
    if (events[0].kind === 'register_generator' && events[0].generator.kind === 'drawdown') {
      expect(events[0].generator.mode).toBe('percent');
      expect(events[0].generator.annualPercent).toBe(4);
    }
  });

  it('passes fixed amount and inflation-linking through to the generator', () => {
    const world = {
      currentDay: JAN_1_2024,
      accounts: [],
      eventGenerators: [],
      eventHistory: [],
      investments: [],
      inflationIndex: 1.3,
    };
    const events = gestureEvents({
      kind: 'start_drawdown',
      day: JAN_1_2024,
      investmentName: 'my-fund',
      mode: 'fixed',
      annualPercent: 0,
      annualAmount: 12000,
      inflationLinked: true,
    }, world);
    if (events[0].kind === 'register_generator' && events[0].generator.kind === 'drawdown') {
      expect(events[0].generator.mode).toBe('fixed');
      expect(events[0].generator.annualAmount).toBe(12000);
      expect(events[0].generator.inflationLinked).toBe(true);
      expect(events[0].generator.baseInflationIndex).toBe(1.3);
    }
  });

  it('defaults baseInflationIndex to 1 when no world is provided', () => {
    const events = gestureEvents({
      kind: 'start_drawdown',
      day: JAN_1_2024,
      investmentName: 'my-fund',
      mode: 'fixed',
      annualPercent: 0,
      annualAmount: 12000,
      inflationLinked: true,
    });
    if (events[0].kind === 'register_generator' && events[0].generator.kind === 'drawdown') {
      expect(events[0].generator.baseInflationIndex).toBe(1);
    }
  });

  it('routes sell events to the cash account', () => {
    const events = gestureEvents({
      kind: 'start_drawdown',
      day: JAN_1_2024,
      investmentName: 'my-fund',
      mode: 'percent',
      annualPercent: 4,
      annualAmount: 0,
      inflationLinked: false,
    });
    if (events[0].kind === 'register_generator' && events[0].generator.kind === 'drawdown') {
      expect(events[0].generator.toAccount).toBe('cash');
    }
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
