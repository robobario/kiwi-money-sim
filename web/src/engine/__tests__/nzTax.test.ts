import { describe, it, expect } from 'vitest';
import { calculateAnnualTax, calculateAnnualACC, DEFAULT_NZ_TAX_BRACKETS, ACC_CAP } from '../nzTax';

describe('calculateAnnualTax', () => {
  it('applies 10.5% on income within first bracket', () => {
    expect(calculateAnnualTax(14000, DEFAULT_NZ_TAX_BRACKETS)).toBeCloseTo(1470, 2);
  });

  it('applies progressive brackets correctly at $50k', () => {
    // 14000 × 10.5% = 1470
    // 34000 × 17.5% = 5950
    // 2000  × 30%   = 600
    expect(calculateAnnualTax(50000, DEFAULT_NZ_TAX_BRACKETS)).toBeCloseTo(8020, 2);
  });
  // 14000+34000=48000; 50000-48000=2000 in 30% bracket → 1470+5950+600=8020 ✓

  it('applies 33% bracket correctly at $100k', () => {
    // 14000 × 10.5% = 1470
    // 34000 × 17.5% = 5950
    // 22000 × 30%   = 6600
    // 30000 × 33%   = 9900
    expect(calculateAnnualTax(100000, DEFAULT_NZ_TAX_BRACKETS)).toBeCloseTo(23920, 2);
  });

  it('returns 0 for zero income', () => {
    expect(calculateAnnualTax(0, DEFAULT_NZ_TAX_BRACKETS)).toBe(0);
  });
});

describe('calculateAnnualACC', () => {
  it('applies 1.75% on income below cap', () => {
    expect(calculateAnnualACC(100000)).toBeCloseTo(1750, 2);
  });

  it('caps at ACC_CAP', () => {
    expect(calculateAnnualACC(300000)).toBeCloseTo(ACC_CAP * 0.0175, 2);
  });

  it('applies exactly at cap', () => {
    expect(calculateAnnualACC(ACC_CAP)).toBeCloseTo(ACC_CAP * 0.0175, 2);
  });
});
