import { approximateInrPerCurrencyUnit, toInr } from '@utils/currency';

describe('toInr', () => {
  test('rupees stay as they are', () => {
    expect(toInr(1000, 'INR')).toBe(1000);
  });

  test('other currencies are converted with the rate table and rounded', () => {
    expect(toInr(50, 'USD')).toBe(Math.round(50 * approximateInrPerCurrencyUnit.USD));
    expect(toInr(70000, 'IDR')).toBe(Math.round(70000 * approximateInrPerCurrencyUnit.IDR));
  });

  test('unknown currency or missing amount gives no price instead of a wrong one', () => {
    expect(toInr(50, 'XYZ')).toBeUndefined();
    expect(toInr(50, undefined)).toBeUndefined();
    expect(toInr(undefined, 'INR')).toBeUndefined();
  });
});
