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

export type PeriodKey = "last7Days" | "last30Days";

export type DailySalesSummary = {
  eventId: string;
  sessionDateTime: string;
  period: PeriodKey;
  days: DailySalesRow[];
};

// General stats for the selected event/session.
export const mockEventGeneralStats: EventGeneralStats[] = [
  {
    eventId: "event-1",
    eventName: "Charlie y la Fabrica de Chocolate",
    venueName: "Teatro Gran Rex",
    sessionDateTime: "2026-06-07T18:00:00-03:00",
    ticketsSold: 282,
    invitations: 0,
    contactsCount: 85,
    totalRevenueARS: 19745000,
  },

  {
    eventId: "event-2",
    eventName: "Charlie y la Fabrica de Chocolate",
    venueName: "Teatro Gran Rex",
    sessionDateTime: "2026-06-08T18:00:00-03:00",
    ticketsSold: 160,
    invitations: 0,
    contactsCount: 72,
    totalRevenueARS: 10400000,
  },
];

// Historic performance per day for two periods.
export const mockDailySalesSummaries: DailySalesSummary[] = [
  {
    eventId: "event-1",
    sessionDateTime: "2026-06-07T18:00:00-03:00",
    period: "last7Days",
    days: [
      {
        date: "2025-12-01",
        ticketsSold: 32,
        invitations: 1,
        revenueARS: 2750000,
      },
      {
        date: "2025-12-02",
        ticketsSold: 35,
        invitations: 0,
        revenueARS: 3100000,
      },
      {
        date: "2025-12-03",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1980000,
      },
      {
        date: "2025-12-04",
        ticketsSold: 48,
        invitations: 0,
        revenueARS: 4200000,
      },
      {
        date: "2025-12-05",
        ticketsSold: 58,
        invitations: 0,
        revenueARS: 5100000,
      },
      {
        date: "2025-12-06",
        ticketsSold: 42,
        invitations: 0,
        revenueARS: 3650000,
      },
      {
        date: "2025-12-07",
        ticketsSold: 65,
        invitations: 0,
        revenueARS: 5900000,
      },
    ],
  },
  {
    eventId: "event-1",
    sessionDateTime: "2026-06-07T18:00:00-03:00",
    period: "last30Days",
    days: [
      {
        date: "2025-12-01",
        ticketsSold: 32,
        invitations: 1,
        revenueARS: 2750000,
      },
      {
        date: "2025-12-02",
        ticketsSold: 35,
        invitations: 0,
        revenueARS: 3100000,
      },
      {
        date: "2025-12-03",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1980000,
      },
      {
        date: "2025-12-04",
        ticketsSold: 48,
        invitations: 0,
        revenueARS: 4200000,
      },
      {
        date: "2025-12-05",
        ticketsSold: 58,
        invitations: 0,
        revenueARS: 5100000,
      },
      {
        date: "2025-12-06",
        ticketsSold: 42,
        invitations: 0,
        revenueARS: 3650000,
      },
      {
        date: "2025-12-07",
        ticketsSold: 65,
        invitations: 0,
        revenueARS: 5900000,
      },
      {
        date: "2025-12-08",
        ticketsSold: 18,
        invitations: 0,
        revenueARS: 1530000,
      },
      {
        date: "2025-12-09",
        ticketsSold: 20,
        invitations: 0,
        revenueARS: 1700000,
      },
      {
        date: "2025-12-10",
        ticketsSold: 22,
        invitations: 0,
        revenueARS: 1870000,
      },
      {
        date: "2025-12-11",
        ticketsSold: 19,
        invitations: 0,
        revenueARS: 1615000,
      },
      {
        date: "2025-12-12",
        ticketsSold: 23,
        invitations: 0,
        revenueARS: 1955000,
      },
      {
        date: "2025-12-13",
        ticketsSold: 21,
        invitations: 0,
        revenueARS: 1785000,
      },
      {
        date: "2025-12-14",
        ticketsSold: 20,
        invitations: 0,
        revenueARS: 1700000,
      },
      {
        date: "2025-12-15",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 2040000,
      },
      {
        date: "2025-12-16",
        ticketsSold: 26,
        invitations: 0,
        revenueARS: 2210000,
      },
      {
        date: "2025-12-17",
        ticketsSold: 25,
        invitations: 0,
        revenueARS: 2125000,
      },
      {
        date: "2025-12-18",
        ticketsSold: 27,
        invitations: 0,
        revenueARS: 2295000,
      },
      {
        date: "2025-12-19",
        ticketsSold: 28,
        invitations: 0,
        revenueARS: 2380000,
      },
      {
        date: "2025-12-20",
        ticketsSold: 26,
        invitations: 0,
        revenueARS: 2210000,
      },
      {
        date: "2025-12-21",
        ticketsSold: 29,
        invitations: 0,
        revenueARS: 2465000,
      },
      {
        date: "2025-12-22",
        ticketsSold: 31,
        invitations: 0,
        revenueARS: 2635000,
      },
      {
        date: "2025-12-23",
        ticketsSold: 30,
        invitations: 0,
        revenueARS: 2550000,
      },
      {
        date: "2025-12-24",
        ticketsSold: 32,
        invitations: 0,
        revenueARS: 2720000,
      },
      {
        date: "2025-12-25",
        ticketsSold: 34,
        invitations: 0,
        revenueARS: 2890000,
      },
      {
        date: "2025-12-26",
        ticketsSold: 33,
        invitations: 0,
        revenueARS: 2805000,
      },
      {
        date: "2025-12-27",
        ticketsSold: 35,
        invitations: 0,
        revenueARS: 2975000,
      },
      {
        date: "2025-12-28",
        ticketsSold: 37,
        invitations: 0,
        revenueARS: 3145000,
      },
      {
        date: "2025-12-29",
        ticketsSold: 36,
        invitations: 0,
        revenueARS: 3060000,
      },
      {
        date: "2025-12-30",
        ticketsSold: 38,
        invitations: 0,
        revenueARS: 3230000,
      },
    ],
  },
  {
    eventId: "event-2",
    sessionDateTime: "2026-06-08T18:00:00-03:00",
    period: "last7Days",
    days: [
      {
        date: "2025-12-01",
        ticketsSold: 32,
        invitations: 1,
        revenueARS: 2000000,
      },
      {
        date: "2025-12-02",
        ticketsSold: 35,
        invitations: 0,
        revenueARS: 2000000,
      },
      {
        date: "2025-12-03",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1100000,
      },
      {
        date: "2025-12-04",
        ticketsSold: 48,
        invitations: 0,
        revenueARS: 3200000,
      },
      {
        date: "2025-12-05",
        ticketsSold: 58,
        invitations: 0,
        revenueARS: 4100000,
      },
      {
        date: "2025-12-06",
        ticketsSold: 42,
        invitations: 0,
        revenueARS: 3650000,
      },
      {
        date: "2025-12-07",
        ticketsSold: 65,
        invitations: 0,
        revenueARS: 5900000,
      },
    ],
  },
  {
    eventId: "event-2",
    sessionDateTime: "2026-06-08T18:00:00-03:00",
    period: "last30Days",
    days: [
      {
        date: "2025-12-01",
        ticketsSold: 32,
        invitations: 1,
        revenueARS: 2000000,
      },
      {
        date: "2025-12-02",
        ticketsSold: 35,
        invitations: 0,
        revenueARS: 2000000,
      },
      {
        date: "2025-12-03",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1100000,
      },
      {
        date: "2025-12-04",
        ticketsSold: 48,
        invitations: 0,
        revenueARS: 3200000,
      },
      {
        date: "2025-12-05",
        ticketsSold: 58,
        invitations: 0,
        revenueARS: 4100000,
      },
      {
        date: "2025-12-06",
        ticketsSold: 42,
        invitations: 0,
        revenueARS: 3650000,
      },
      {
        date: "2025-12-07",
        ticketsSold: 65,
        invitations: 0,
        revenueARS: 5900000,
      },
      {
        date: "2025-12-08",
        ticketsSold: 20,
        invitations: 0,
        revenueARS: 1500000,
      },
      {
        date: "2025-12-09",
        ticketsSold: 18,
        invitations: 0,
        revenueARS: 1350000,
      },
      {
        date: "2025-12-10",
        ticketsSold: 19,
        invitations: 0,
        revenueARS: 1425000,
      },
      {
        date: "2025-12-11",
        ticketsSold: 17,
        invitations: 0,
        revenueARS: 1275000,
      },
      {
        date: "2025-12-12",
        ticketsSold: 21,
        invitations: 0,
        revenueARS: 1575000,
      },
      {
        date: "2025-12-13",
        ticketsSold: 19,
        invitations: 0,
        revenueARS: 1425000,
      },
      {
        date: "2025-12-14",
        ticketsSold: 18,
        invitations: 0,
        revenueARS: 1350000,
      },
      {
        date: "2025-12-15",
        ticketsSold: 22,
        invitations: 0,
        revenueARS: 1650000,
      },
      {
        date: "2025-12-16",
        ticketsSold: 23,
        invitations: 0,
        revenueARS: 1725000,
      },
      {
        date: "2025-12-17",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1800000,
      },
      {
        date: "2025-12-18",
        ticketsSold: 22,
        invitations: 0,
        revenueARS: 1650000,
      },
      {
        date: "2025-12-19",
        ticketsSold: 21,
        invitations: 0,
        revenueARS: 1575000,
      },
      {
        date: "2025-12-20",
        ticketsSold: 23,
        invitations: 0,
        revenueARS: 1725000,
      },
      {
        date: "2025-12-21",
        ticketsSold: 25,
        invitations: 0,
        revenueARS: 1875000,
      },
      {
        date: "2025-12-22",
        ticketsSold: 24,
        invitations: 0,
        revenueARS: 1800000,
      },
      {
        date: "2025-12-23",
        ticketsSold: 26,
        invitations: 0,
        revenueARS: 1950000,
      },
      {
        date: "2025-12-24",
        ticketsSold: 27,
        invitations: 0,
        revenueARS: 2025000,
      },
      {
        date: "2025-12-25",
        ticketsSold: 28,
        invitations: 0,
        revenueARS: 2100000,
      },
      {
        date: "2025-12-26",
        ticketsSold: 26,
        invitations: 0,
        revenueARS: 1950000,
      },
      {
        date: "2025-12-27",
        ticketsSold: 27,
        invitations: 0,
        revenueARS: 2025000,
      },
      {
        date: "2025-12-28",
        ticketsSold: 29,
        invitations: 0,
        revenueARS: 2175000,
      },
      {
        date: "2025-12-29",
        ticketsSold: 28,
        invitations: 0,
        revenueARS: 2100000,
      },
      {
        date: "2025-12-30",
        ticketsSold: 30,
        invitations: 0,
        revenueARS: 2250000,
      },
    ],
  },
];
