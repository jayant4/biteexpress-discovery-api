export const currencyByCountryCode: Record<number, string> = {
  1: 'INR',
  14: 'AUD',
  30: 'BRL',
  37: 'CAD',
  94: 'IDR',
  148: 'NZD',
  162: 'PHP',
  166: 'QAR',
  184: 'SGD',
  189: 'ZAR',
  191: 'LKR',
  208: 'TRY',
  214: 'AED',
  215: 'GBP',
  216: 'USD',
};

export const approximateInrPerCurrencyUnit: Record<string, number> = {
  INR: 1,
  AED: 23.1,
  AUD: 56,
  BRL: 15.5,
  CAD: 61,
  GBP: 108,
  IDR: 0.0052,
  LKR: 0.28,
  NZD: 50,
  PHP: 1.5,
  QAR: 23.3,
  SGD: 64,
  TRY: 2.2,
  USD: 85,
  ZAR: 4.7,
};

export const supportedCurrencies = Object.keys(approximateInrPerCurrencyUnit);

export const toInr = (amount: number | undefined, currency: string | undefined): number | undefined => {
  if (amount === undefined || currency === undefined) return undefined;
  const inrPerUnit = approximateInrPerCurrencyUnit[currency];
  return inrPerUnit === undefined ? undefined : Math.round(amount * inrPerUnit);
};
