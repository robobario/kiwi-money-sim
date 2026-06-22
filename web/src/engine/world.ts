import type { Account } from './account';
import type { Event } from './events';
import { applyEvent } from './events';
import type { EventGenerator } from './generators';
import { generate } from './generators';

export interface Investment {
  readonly name: string;
  readonly indexPrice: number;
  readonly unitsHeld: number;
}

export interface World {
  readonly currentDay: number;
  readonly accounts: readonly Account[];
  readonly eventGenerators: readonly EventGenerator[];
  readonly eventHistory: readonly Event[];
  readonly investments: readonly Investment[];
  readonly inflationIndex: number;
}

const DAY_MS = 86_400_000;

export function createWorld(startDay: Date): World {
  return {
    currentDay: truncateToDay(startDay).getTime(),
    accounts: [],
    eventGenerators: [],
    eventHistory: [],
    investments: [],
    inflationIndex: 1,
  };
}

export function advanceDay(world: World): World {
  const nextDay: World = { ...world, currentDay: world.currentDay + DAY_MS };
  const events = generateEvents(nextDay);
  return applyEvents(nextDay, events);
}

export function applyEvents(world: World, events: Event[]): World {
  let current = world;
  for (const event of events) {
    current = applyEvent(current, event);
  }
  return { ...current, eventHistory: [...current.eventHistory, ...events] };
}

function generateEvents(world: World): Event[] {
  return world.eventGenerators.flatMap(gen => generate(gen, world));
}

function truncateToDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
