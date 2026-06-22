import { describe, it, expect } from 'vitest';
import { createWorld, advanceDay, applyEvents } from '../world';
import type { World } from '../world';

const DAY_MS = 86_400_000;
const JAN_1_2024 = new Date(Date.UTC(2024, 0, 1));

describe('createWorld', () => {
  it('initializes an empty world', () => {
    const world = createWorld(JAN_1_2024);
    expect(world.accounts).toEqual([]);
    expect(world.eventGenerators).toEqual([]);
    expect(world.eventHistory).toEqual([]);
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
      accounts: [
        { name: 'cash', balance: 1000 },
        { name: 'world', balance: 0 },
      ],
      eventGenerators: [{
        kind: 'repeat_transfer',
        name: 'daily-cost',
        startDay: Date.UTC(2024, 0, 1),
        from: 'cash',
        to: 'world',
        amount: 50,
        frequency: 'daily',
      }],
      eventHistory: [],
      investments: [],
      inflationIndex: 1,
    };
    const next = advanceDay(world);
    expect(next.accounts.find(a => a.name === 'cash')!.balance).toBe(950);
    expect(next.accounts.find(a => a.name === 'world')!.balance).toBe(50);
  });

  it('does not fire generators that should not fire on the new day', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: [
        { name: 'cash', balance: 1000 },
        { name: 'world', balance: 0 },
      ],
      eventGenerators: [{
        kind: 'repeat_transfer',
        name: 'monthly-salary',
        startDay: Date.UTC(2024, 0, 1),
        from: 'world',
        to: 'cash',
        amount: 5000,
        frequency: 'first_of_month',
      }],
      eventHistory: [],
      investments: [],
      inflationIndex: 1,
    };
    // Jan 1 -> Jan 2 (not first of month)
    const next = advanceDay(world);
    expect(next.accounts.find(a => a.name === 'cash')!.balance).toBe(1000);
  });
});

describe('applyEvents', () => {
  it('applies multiple events in order', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: [],
      eventGenerators: [],
      eventHistory: [],
      investments: [],
      inflationIndex: 1,
    };
    const result = applyEvents(world, [
      { kind: 'create_account', name: 'a', balance: 100 },
      { kind: 'create_account', name: 'b', balance: 200 },
    ]);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.find(a => a.name === 'a')!.balance).toBe(100);
    expect(result.accounts.find(a => a.name === 'b')!.balance).toBe(200);
  });

  it('appends events to history', () => {
    const world: World = {
      currentDay: Date.UTC(2024, 0, 1),
      accounts: [],
      eventGenerators: [],
      eventHistory: [{ kind: 'create_account', name: 'existing', balance: 0 }],
      investments: [],
      inflationIndex: 1,
    };
    const result = applyEvents(world, [
      { kind: 'create_account', name: 'new', balance: 50 },
    ]);
    expect(result.eventHistory).toHaveLength(2);
  });

  it('returns unchanged world for empty events', () => {
    const world = createWorld(JAN_1_2024);
    const result = applyEvents(world, []);
    expect(result.currentDay).toBe(world.currentDay);
  });
});
