export const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);

export const formatInteger = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);

export const formatCurrencyARS = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number) => `${Math.round(value)}%`;

export const formatDateShort = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export const formatDateLong = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
