import { describe, it, expect } from 'vitest';
import { applyEvent } from '../events';
import type { World } from '../world';

function emptyWorld(): World {
  return {
    currentDay: Date.UTC(2024, 0, 1),
    accounts: [],
    eventGenerators: [],
    eventHistory: [],
    investments: [],
    inflationIndex: 1,
  };
}

function worldWithAccounts(): World {
  return {
    ...emptyWorld(),
    accounts: [
      { name: 'checking', balance: 1000 },
      { name: 'savings', balance: 5000 },
      { name: 'other', balance: 200 },
    ],
  };
}

describe('applyEvent', () => {
  describe('transfer', () => {
    it('deducts from source and adds to target', () => {
      const world = worldWithAccounts();
      const result = applyEvent(world, { kind: 'transfer', from: 'checking', to: 'savings', amount: 300 });
      expect(result.accounts.find(a => a.name === 'checking')!.balance).toBe(700);
      expect(result.accounts.find(a => a.name === 'savings')!.balance).toBe(5300);
    });

    it('preserves other accounts', () => {
      const world = worldWithAccounts();
      const result = applyEvent(world, { kind: 'transfer', from: 'checking', to: 'savings', amount: 100 });
      expect(result.accounts.find(a => a.name === 'other')!.balance).toBe(200);
    });

    it('allows negative balances', () => {
      const world = worldWithAccounts();
      const result = applyEvent(world, { kind: 'transfer', from: 'checking', to: 'savings', amount: 2000 });
      expect(result.accounts.find(a => a.name === 'checking')!.balance).toBe(-1000);
    });

    it('does not mutate the original world', () => {
      const world = worldWithAccounts();
      applyEvent(world, { kind: 'transfer', from: 'checking', to: 'savings', amount: 100 });
      expect(world.accounts.find(a => a.name === 'checking')!.balance).toBe(1000);
    });
  });

  describe('create_account', () => {
    it('adds a new account', () => {
      const world = emptyWorld();
      const result = applyEvent(world, { kind: 'create_account', name: 'cash', balance: 500 });
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0]).toEqual({ name: 'cash', balance: 500, external: false });
    });

    it('throws on duplicate account name', () => {
      const world = worldWithAccounts();
      expect(() =>
        applyEvent(world, { kind: 'create_account', name: 'checking', balance: 0 })
      ).toThrow('account named checking exists already');
    });
  });

  describe('register_generator', () => {
    it('adds a new generator', () => {
      const world = emptyWorld();
      const gen = {
        kind: 'repeat_transfer' as const,
        name: 'salary',
        startDay: Date.UTC(2024, 0, 1),
        from: 'world',
        to: 'cash',
        amount: 5000,
        frequency: 'first_of_month' as const,
      };
      const result = applyEvent(world, { kind: 'register_generator', name: 'salary', generator: gen });
      expect(result.eventGenerators).toHaveLength(1);
      expect(result.eventGenerators[0].name).toBe('salary');
    });

    it('replaces existing generator with same name (upsert)', () => {
      const original = {
        kind: 'repeat_transfer' as const,
        name: 'salary',
        startDay: Date.UTC(2024, 0, 1),
        from: 'world',
        to: 'cash',
        amount: 5000,
        frequency: 'first_of_month' as const,
      };
      const replacement = { ...original, amount: 6000 };
      const world: World = { ...emptyWorld(), eventGenerators: [original] };
      const result = applyEvent(world, { kind: 'register_generator', name: 'salary', generator: replacement });
      expect(result.eventGenerators).toHaveLength(1);
      if (result.eventGenerators[0].kind === 'repeat_transfer') {
        expect(result.eventGenerators[0].amount).toBe(6000);
      }
    });
  });

  describe('clear_investment', () => {
    it('sets unitsHeld to 0', () => {
      const world: World = {
        ...emptyWorld(),
        investments: [
          { name: 'home-house', indexPrice: 1.05, unitsHeld: 700000 },
          { name: 'other', indexPrice: 1.0, unitsHeld: 100 },
        ],
      };
      const result = applyEvent(world, { kind: 'clear_investment', name: 'home-house' });
      expect(result.investments.find(i => i.name === 'home-house')?.unitsHeld).toBe(0);
      expect(result.investments.find(i => i.name === 'other')?.unitsHeld).toBe(100);
    });
  });

  describe('sell_investment_units', () => {
    const world: World = {
      ...emptyWorld(),
      investments: [
        { name: 'fund', indexPrice: 2.0, unitsHeld: 100 },
        { name: 'other', indexPrice: 1.0, unitsHeld: 200 },
      ],
      accounts: [{ name: 'cash', balance: 0, external: false }],
    };

    it('removes the correct number of units and credits cash', () => {
      // $50 at price 2.0 = 25 units removed
      const result = applyEvent(world, { kind: 'sell_investment_units', investmentName: 'fund', cashAmount: 50, toAccount: 'cash' });
      expect(result.investments.find(i => i.name === 'fund')?.unitsHeld).toBeCloseTo(75, 5);
      expect(result.accounts.find(a => a.name === 'cash')?.balance).toBe(50);
    });

    it('does not reduce units below zero', () => {
      const tinyWorld: World = {
        ...emptyWorld(),
        investments: [{ name: 'fund', indexPrice: 2.0, unitsHeld: 10 }],
        accounts: [{ name: 'cash', balance: 0, external: false }],
      };
      // $100 would require 50 units but only 10 exist
      const result = applyEvent(tinyWorld, { kind: 'sell_investment_units', investmentName: 'fund', cashAmount: 100, toAccount: 'cash' });
      expect(result.investments.find(i => i.name === 'fund')?.unitsHeld).toBe(0);
    });

    it('does not affect other investments', () => {
      const result = applyEvent(world, { kind: 'sell_investment_units', investmentName: 'fund', cashAmount: 50, toAccount: 'cash' });
      expect(result.investments.find(i => i.name === 'other')?.unitsHeld).toBe(200);
    });
  });
});
