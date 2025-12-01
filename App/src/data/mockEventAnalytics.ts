// Mock backend-shaped analytics for a single event/session.
// Provides typed data so the dashboard matches the expected API contracts.

export type EventGeneralStats = {
  eventId: string;
  eventName: string;
  venueName: string;
  sessionDateTime: string; // ISO string
  ticketsSold: number;
  invitations: number;
  contactsCount: number;
  totalRevenueARS: number;
};

export type DailySalesRow = {
  date: string; // YYYY-MM-DD
  ticketsSold: number;
  invitations: number;
  revenueARS: number;
};

export type PeriodKey = 'last7Days' | 'last30Days';

export type DailySalesSummary = {
  eventId: string;
  sessionDateTime: string;
  period: PeriodKey;
  days: DailySalesRow[];
};

// General stats for the selected event/session.
export const mockEventGeneralStats: EventGeneralStats = {
  eventId: 'event-1',
  eventName: 'Charlie y la Fabrica de Chocolate',
  venueName: 'Teatro Gran Rex',
  sessionDateTime: '2026-06-07T18:00:00-03:00',
  ticketsSold: 282,
  invitations: 0,
  contactsCount: 85,
  totalRevenueARS: 19745000,
};

// Historic performance per day for two periods.
export const mockDailySalesSummaries: DailySalesSummary[] = [
  {
    eventId: 'event-1',
    sessionDateTime: '2026-06-07T18:00:00-03:00',
    period: 'last7Days',
    days: [
      { date: '2026-06-01', ticketsSold: 32, invitations: 1, revenueARS: 2750000 },
      { date: '2026-06-02', ticketsSold: 35, invitations: 0, revenueARS: 3100000 },
      { date: '2026-06-03', ticketsSold: 24, invitations: 0, revenueARS: 1980000 },
      { date: '2026-06-04', ticketsSold: 48, invitations: 0, revenueARS: 4200000 },
      { date: '2026-06-05', ticketsSold: 58, invitations: 0, revenueARS: 5100000 },
      { date: '2026-06-06', ticketsSold: 42, invitations: 0, revenueARS: 3650000 },
      { date: '2026-06-07', ticketsSold: 65, invitations: 0, revenueARS: 5900000 },
    ],
  },
  {
    eventId: 'event-1',
    sessionDateTime: '2026-06-07T18:00:00-03:00',
    period: 'last30Days',
    days: [
      { date: '2026-05-09', ticketsSold: 15, invitations: 0, revenueARS: 1150000 },
      { date: '2026-05-12', ticketsSold: 18, invitations: 0, revenueARS: 1390000 },
      { date: '2026-05-15', ticketsSold: 22, invitations: 0, revenueARS: 1680000 },
      { date: '2026-05-18', ticketsSold: 25, invitations: 0, revenueARS: 1860000 },
      { date: '2026-05-21', ticketsSold: 27, invitations: 0, revenueARS: 1990000 },
      { date: '2026-05-24', ticketsSold: 31, invitations: 0, revenueARS: 2410000 },
      { date: '2026-05-27', ticketsSold: 33, invitations: 0, revenueARS: 2590000 },
      { date: '2026-05-30', ticketsSold: 29, invitations: 0, revenueARS: 2270000 },
      { date: '2026-06-01', ticketsSold: 32, invitations: 1, revenueARS: 2750000 },
      { date: '2026-06-02', ticketsSold: 35, invitations: 0, revenueARS: 3100000 },
      { date: '2026-06-03', ticketsSold: 24, invitations: 0, revenueARS: 1980000 },
      { date: '2026-06-04', ticketsSold: 48, invitations: 0, revenueARS: 4200000 },
      { date: '2026-06-05', ticketsSold: 58, invitations: 0, revenueARS: 5100000 },
      { date: '2026-06-06', ticketsSold: 42, invitations: 0, revenueARS: 3650000 },
      { date: '2026-06-07', ticketsSold: 65, invitations: 0, revenueARS: 5900000 },
    ],
  },
];
