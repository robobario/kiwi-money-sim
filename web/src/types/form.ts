export interface GlobalConfig {
  readonly startingCash: number;
  readonly currentAge: number;
  readonly targetAge: number;
  readonly inflationRatePercent: number;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  startingCash: 0,
  currentAge: 30,
  targetAge: 90,
  inflationRatePercent: 2.6,
};

export function simulationYears(config: GlobalConfig): number {
  return Math.max(1, config.targetAge - config.currentAge);
}
