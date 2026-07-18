import { fmtMoney, fmtAbs } from './money-util';

describe('money-util', () => {
  it('formats positive with +$ and two decimals', () => {
    expect(fmtMoney(4200)).toBe('+$4,200.00');
    expect(fmtMoney(32.4)).toBe('+$32.40');
  });

  it('formats negative with the U+2212 minus sign', () => {
    expect(fmtMoney(-84.5)).toBe('−$84.50');
    expect(fmtMoney(-76.2)).toBe('−$76.20');
  });

  it('fmtAbs drops the sign', () => {
    expect(fmtAbs(-84.5)).toBe('$84.50');
    expect(fmtAbs(650)).toBe('$650.00');
  });
});
