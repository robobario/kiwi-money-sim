import { describe, it, expect } from 'vitest';
import { roundCents } from '../money';

describe('roundCents', () => {
  it('rounds to two decimal places', () => {
    expect(roundCents(1.006)).toBe(1.01);
    expect(roundCents(1.004)).toBe(1.0);
    expect(roundCents(99.999)).toBe(100.0);
  });

  it('preserves values already at two decimal places', () => {
    expect(roundCents(1.23)).toBe(1.23);
    expect(roundCents(0.01)).toBe(0.01);
  });

  it('handles zero', () => {
    expect(roundCents(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(roundCents(-1.005)).toBe(-1.0);
    expect(roundCents(-99.999)).toBe(-100.0);
    expect(roundCents(-1.23)).toBe(-1.23);
  });

  it('handles large values', () => {
    expect(roundCents(1000000.456)).toBe(1000000.46);
  });
});
