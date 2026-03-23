export type SectorSales = {
  sectorId: string;
  sectorName: string;
  ticketsSold: number;
  invitations: number;
  totalRevenueARS: number;
};

export type EventSessionSales = {
  sessionId: string;
  sessionDateTime: string;
  sectors: SectorSales[];
};

export type EventSectorSalesMock = {
  eventId: string;
  eventName: string;
  sessions: EventSessionSales[];
};

export const mockEventSectorSales: EventSectorSalesMock = {
  eventId: "evt_001",
  eventName: "Festival Primavera 2026",
  sessions: [
    {
      sessionId: "ses_001",
      sessionDateTime: "2026-03-20T21:00:00-03:00",
      sectors: [
        {
          sectorId: "sec_campo",
          sectorName: "Campo",
          ticketsSold: 480,
          invitations: 24,
          totalRevenueARS: 24000000,
        },
        {
          sectorId: "sec_platea",
          sectorName: "Platea",
          ticketsSold: 210,
          invitations: 10,
          totalRevenueARS: 18900000,
        },
        {
          sectorId: "sec_vip",
          sectorName: "VIP",
          ticketsSold: 72,
          invitations: 6,
          totalRevenueARS: 10800000,
        },
      ],
    },
    {
      sessionId: "ses_002",
      sessionDateTime: "2026-03-21T21:00:00-03:00",
      sectors: [
        {
          sectorId: "sec_campo",
          sectorName: "Campo",
          ticketsSold: 510,
          invitations: 20,
          totalRevenueARS: 25500000,
        },
        {
          sectorId: "sec_platea",
          sectorName: "Platea",
          ticketsSold: 230,
          invitations: 9,
          totalRevenueARS: 20700000,
        },
        {
          sectorId: "sec_vip",
          sectorName: "VIP",
          ticketsSold: 80,
          invitations: 5,
          totalRevenueARS: 12000000,
        },
      ],
    },
  ],
};
