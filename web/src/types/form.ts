export interface Person {
  readonly name: string;
  readonly currentAge: number;
}

export interface GlobalConfig {
  readonly startingCash: number;
  readonly persons: Person[];
  readonly targetAge: number;
  readonly inflationRatePercent: number;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  startingCash: 0,
  persons: [{ name: 'Me', currentAge: 30 }],
  targetAge: 90,
  inflationRatePercent: 2.6,
};

export function simulationYears(config: GlobalConfig): number {
  const minAge = Math.min(...config.persons.map(p => p.currentAge));
  return Math.max(1, config.targetAge - minAge);
}
