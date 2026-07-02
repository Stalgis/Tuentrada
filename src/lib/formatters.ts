// Todos los eventos operan en hora de Argentina (-03:00). Forzamos esta zona en
// el formateo de fechas para que se vean igual sin importar la zona del dispositivo.
const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

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
    timeZone: AR_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export const formatDateTimeShort = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

// Hora en formato 12h con AM/PM en mayúsculas (ej. "3:43 AM"), en hora de
// Argentina. Usamos locale en-US para obtener "AM"/"PM" en vez del "a. m." de es-AR.
export const formatTimeShort = (value: string | number | Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: AR_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));

export const formatDateLong = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
