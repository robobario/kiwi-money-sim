import { describe, it, expect } from 'vitest';
import { createWorld, advanceDay, applyEvents } from '../world';
import type { World } from '../world';

const DAY_MS = 86_400_000;
const JAN_1_2024 = new Date(Date.UTC(2024, 0, 1));

describe('createWorld', () => {
  it('initializes an empty world', () => {
    const world = createWorld(JAN_1_2024);
    expect(world.accounts.size).toBe(0);
    expect(world.eventGenerators.size).toBe(0);
    expect(world.investments.size).toBe(0);
  });

  it('truncates time to midnight UTC', () => {
    const midday = new Date(Date.UTC(2024, 0, 1, 13, 45, 30));
    const world = createWorld(midday);
    expect(world.currentDay).toBe(Date.UTC(2024, 0, 1));
  });
});

describe('advanceDay', () => {
  it('increments the day by exactly one', () => {
    const world = createWorld(JAN_1_2024);
    const next = advanceDay(world);
    expect(next.currentDay).toBe(world.currentDay + DAY_MS);
  });

  it('fires registered generators on the new day', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: new Map([
        ['cash',  { name: 'cash',  balance: 1000 }],
        ['world', { name: 'world', balance: 0    }],
      ]),
      eventGenerators: new Map([['daily-cost', {
        kind: 'repeat_transfer',
        name: 'daily-cost',
        startDay: Date.UTC(2024, 0, 1),
        from: 'cash',
        to: 'world',
        amount: 50,
        frequency: 'daily',
      }]]),
      investments: new Map(),
      inflationIndex: 1,
    };
    const next = advanceDay(world);
    expect(next.accounts.get('cash')!.balance).toBe(950);
    expect(next.accounts.get('world')!.balance).toBe(50);
  });

  it('does not fire generators that should not fire on the new day', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: new Map([
        ['cash',  { name: 'cash',  balance: 1000 }],
        ['world', { name: 'world', balance: 0    }],
      ]),
      eventGenerators: new Map([['monthly-salary', {
        kind: 'repeat_transfer',
        name: 'monthly-salary',
        startDay: Date.UTC(2024, 0, 1),
        from: 'world',
        to: 'cash',
        amount: 5000,
        frequency: 'first_of_month',
      }]]),
      investments: new Map(),
      inflationIndex: 1,
    };
    // Jan 1 -> Jan 2 (not first of month)
    const next = advanceDay(world);
    expect(next.accounts.get('cash')!.balance).toBe(1000);
  });
});

describe('applyEvents', () => {
  it('applies multiple events in order', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: new Map(),
      eventGenerators: new Map(),
      investments: new Map(),
      inflationIndex: 1,
    };
    const result = applyEvents(world, [
      { kind: 'create_account', name: 'a', balance: 100 },
      { kind: 'create_account', name: 'b', balance: 200 },
    ]);
    expect(result.accounts.size).toBe(2);
    expect(result.accounts.get('a')!.balance).toBe(100);
    expect(result.accounts.get('b')!.balance).toBe(200);
  });

  it('returns unchanged world for empty events', () => {
    const world = createWorld(JAN_1_2024);
    const result = applyEvents(world, []);
    expect(result.currentDay).toBe(world.currentDay);
  });
});
