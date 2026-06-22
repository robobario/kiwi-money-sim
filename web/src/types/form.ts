export interface GlobalConfig {
  readonly startingCash: number;
  readonly simulationYears: number;
  readonly inflationRatePercent: number;
}

export const DEFAULT_CONFIG: GlobalConfig = {
  startingCash: 0,
  simulationYears: 30,
  inflationRatePercent: 2.6,
};
