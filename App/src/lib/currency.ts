import { CurrencyCode } from './types';

const formatterCache = new Map<CurrencyCode, Intl.NumberFormat>();

export const formatCurrency = (value: number, currency: CurrencyCode) => {
  if (!formatterCache.has(currency)) {
    formatterCache.set(
      currency,
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
        maximumFractionDigits: 0,
      }),
    );
  }

  return formatterCache.get(currency)!.format(value);
};
