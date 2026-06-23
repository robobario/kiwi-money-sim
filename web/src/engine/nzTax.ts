export interface TaxBracket {
  readonly limit: number;
  readonly rate: number;
}

export const DEFAULT_NZ_TAX_BRACKETS: readonly TaxBracket[] = [
  { limit: 14000,   rate: 0.105 },
  { limit: 48000,   rate: 0.175 },
  { limit: 70000,   rate: 0.30  },
  { limit: 180000,  rate: 0.33  },
  { limit: Infinity, rate: 0.39 },
];

export const ACC_RATE = 0.0175;
export const ACC_CAP  = 156641;

export function calculateAnnualTax(annualIncome: number, brackets: readonly TaxBracket[]): number {
  let tax = 0, prev = 0;
  for (const { limit, rate } of brackets) {
    const taxable = Math.min(annualIncome, limit) - prev;
    if (taxable <= 0) break;
    tax += taxable * rate;
    prev = limit;
  }
  return tax;
}

export function calculateAnnualACC(annualIncome: number): number {
  return Math.min(annualIncome, ACC_CAP) * ACC_RATE;
}
