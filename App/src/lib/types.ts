export type Language = 'en' | 'es';
export type CurrencyCode = 'ARS' | 'USD' | 'EUR';

export type EventStatus = 'on_sale' | 'sold_out' | 'finished';

export type EventFunction = {
  id: string;
  dateISO: string;
  status: EventStatus;
  ticketsSold: number;
  grossRevenueARS: number;
};

export type Event = {
  id: string;
  name: string;
  venue: string;
  city: string;
  dateISO: string;
  status: EventStatus;
  ticketsSold: number;
  ticketsAvailable: number;
  ticketPriceARS: number;
  imageUrl?: string;
  velocity?: number;
  featuredTag?: string;
  checkInProgress?: number;
  grossRevenueARS?: number;
  /** Multiple showtimes/performances under the same event name */
  functions?: EventFunction[];
};

export type User = {
  id: string;
  name: string;
  initials: string;
  email?: string;
};

export type EventMetrics = {
  upcoming: number;
  ticketsSold: number;
  totalRevenueARS: number;
};
