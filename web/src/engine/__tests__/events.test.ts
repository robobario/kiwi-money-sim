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

    it('throws on duplicate generator name', () => {
      const gen = {
        kind: 'repeat_transfer' as const,
        name: 'salary',
        startDay: Date.UTC(2024, 0, 1),
        from: 'world',
        to: 'cash',
        amount: 5000,
        frequency: 'first_of_month' as const,
      };
      const world: World = { ...emptyWorld(), eventGenerators: [gen] };
      expect(() =>
        applyEvent(world, { kind: 'register_generator', name: 'salary', generator: gen })
      ).toThrow('event generator named salary exists already');
    });
  });
});
