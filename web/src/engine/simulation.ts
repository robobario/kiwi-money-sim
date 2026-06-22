import type { World } from './world';
import { createWorld, advanceDay, applyEvents } from './world';
import type { Gesture } from './gestures';
import { gestureEvents } from './gestures';

export const WORLD_ACCOUNT = 'world';
export const CASH_ACCOUNT = 'cash';
export const INCOME_ACCOUNT = 'income';

export interface Snapshot {
  readonly day: number;
  readonly balances: Record<string, number>;
  readonly investmentValues: Record<string, number>;
}

export interface SimulationResult {
  readonly finalWorld: World;
  readonly snapshots: Snapshot[];
}

export function runSimulation(
  startDay: Date,
  gestures: Gesture[],
  durationYears: number,
  snapshotIntervalDays: number = 7,
): SimulationResult {
  let world = createWorld(startDay);
  world = triggerGestures(world, gestures);

  const endTime = new Date(startDay);
  endTime.setUTCFullYear(endTime.getUTCFullYear() + durationYears);
  const endMs = endTime.getTime();

  const snapshots: Snapshot[] = [captureSnapshot(world)];
  let daysSinceSnapshot = 0;

  while (world.currentDay < endMs) {
    world = advanceDay(world);
    world = triggerGestures(world, gestures);
    daysSinceSnapshot++;

    if (daysSinceSnapshot >= snapshotIntervalDays) {
      snapshots.push(captureSnapshot(world));
      daysSinceSnapshot = 0;
    }
  }

  if (daysSinceSnapshot > 0) {
    snapshots.push(captureSnapshot(world));
  }

  return { finalWorld: world, snapshots };
}

function triggerGestures(world: World, gestures: Gesture[]): World {
  const matching = gestures.filter(g => g.day === world.currentDay);
  if (matching.length === 0) return world;
  const events = matching.flatMap(g => gestureEvents(g, world));
  return applyEvents(world, events);
}

function captureSnapshot(world: World): Snapshot {
  const balances: Record<string, number> = {};
  for (const account of world.accounts) {
    balances[account.name] = account.balance;
  }
  const investmentValues: Record<string, number> = {};
  for (const investment of world.investments) {
    investmentValues[investment.name] = investment.unitsHeld * investment.indexPrice;
  }
  return { day: world.currentDay, balances, investmentValues };
}
