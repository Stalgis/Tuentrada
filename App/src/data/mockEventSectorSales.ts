// Mock data: ventas por sector y por función (Charlie y la fábrica de chocolate)
// Pensado para renderizar una table de 4 columnas: Sector | Entradas | Invitaciones | Recaudación

export type SectorSales = {
  sectorId: string;
  sectorName: string;
  ticketsSold: number;
  invitations: number;
  totalRevenueARS: number;
};

export type SessionSectorSales = {
  sessionId: string;
  sessionDateTime: string; // ISO (America/Argentina/Buenos_Aires)
  sectors: SectorSales[];
};

export type EventSectorSalesMock = {
  eventId: string;
  eventName: string;
  currency: "ARS";
  sessions: SessionSectorSales[];
};

export const mockEventSectorSales: EventSectorSalesMock = {
  eventId: "evt_charlie_001",
  eventName: "Charlie y la fábrica de chocolate",
  currency: "ARS",
  sessions: [
    {
      sessionId: "ses_2026_06_04_2000",
      sessionDateTime: "2026-06-04T20:00:00-03:00",
      sectors: [
        {
          sectorId: "sec_platea_1",
          sectorName: "Platea 1",
          ticketsSold: 180,
          invitations: 12,
          totalRevenueARS: 8100000,
        },
        {
          sectorId: "sec_platea_2",
          sectorName: "Platea 2",
          ticketsSold: 210,
          invitations: 20,
          totalRevenueARS: 8400000,
        },
        {
          sectorId: "sec_platea_3",
          sectorName: "Platea 3",
          ticketsSold: 190,
          invitations: 18,
          totalRevenueARS: 6650000,
        },
        {
          sectorId: "sec_platea_5",
          sectorName: "Platea 5",
          ticketsSold: 260,
          invitations: 35,
          totalRevenueARS: 7800000,
        },
        {
          sectorId: "sec_super_pullman_1",
          sectorName: "Super pullman 1",
          ticketsSold: 320,
          invitations: 40,
          totalRevenueARS: 8000000,
        },
        {
          sectorId: "sec_super_pullman_2",
          sectorName: "Super pullman 2",
          ticketsSold: 280,
          invitations: 38,
          totalRevenueARS: 6160000,
        },
        {
          sectorId: "sec_pullman_1",
          sectorName: "Pullman 1",
          ticketsSold: 350,
          invitations: 55,
          totalRevenueARS: 6300000,
        },
        {
          sectorId: "sec_pullman_3",
          sectorName: "Pullman 3",
          ticketsSold: 300,
          invitations: 60,
          totalRevenueARS: 4500000,
        },
      ],
    },
    {
      sessionId: "ses_2025_06_05_2000",
      sessionDateTime: "2025-06-05T20:00:00-03:00",
      sectors: [
        {
          sectorId: "sec_platea_1",
          sectorName: "Platea 1",
          ticketsSold: 165,
          invitations: 10,
          totalRevenueARS: 7425000,
        },
        {
          sectorId: "sec_platea_2",
          sectorName: "Platea 2",
          ticketsSold: 195,
          invitations: 18,
          totalRevenueARS: 7800000,
        },
        {
          sectorId: "sec_platea_3",
          sectorName: "Platea 3",
          ticketsSold: 175,
          invitations: 15,
          totalRevenueARS: 6125000,
        },
        {
          sectorId: "sec_platea_5",
          sectorName: "Platea 5",
          ticketsSold: 240,
          invitations: 28,
          totalRevenueARS: 7200000,
        },
        {
          sectorId: "sec_super_pullman_1",
          sectorName: "Super pullman 1",
          ticketsSold: 300,
          invitations: 34,
          totalRevenueARS: 7500000,
        },
        {
          sectorId: "sec_super_pullman_2",
          sectorName: "Super pullman 2",
          ticketsSold: 260,
          invitations: 30,
          totalRevenueARS: 5720000,
        },
        {
          sectorId: "sec_pullman_1",
          sectorName: "Pullman 1",
          ticketsSold: 330,
          invitations: 45,
          totalRevenueARS: 5940000,
        },
        {
          sectorId: "sec_pullman_3",
          sectorName: "Pullman 3",
          ticketsSold: 280,
          invitations: 50,
          totalRevenueARS: 4200000,
        },
      ],
    },
    {
      sessionId: "ses_2025_06_06_1730",
      sessionDateTime: "2025-06-06T17:30:00-03:00",
      sectors: [
        {
          sectorId: "sec_platea_1",
          sectorName: "Platea 1",
          ticketsSold: 120,
          invitations: 8,
          totalRevenueARS: 5400000,
        },
        {
          sectorId: "sec_platea_2",
          sectorName: "Platea 2",
          ticketsSold: 150,
          invitations: 12,
          totalRevenueARS: 6000000,
        },
        {
          sectorId: "sec_platea_3",
          sectorName: "Platea 3",
          ticketsSold: 135,
          invitations: 10,
          totalRevenueARS: 4725000,
        },
        {
          sectorId: "sec_platea_5",
          sectorName: "Platea 5",
          ticketsSold: 190,
          invitations: 20,
          totalRevenueARS: 5700000,
        },
        {
          sectorId: "sec_super_pullman_1",
          sectorName: "Super pullman 1",
          ticketsSold: 230,
          invitations: 26,
          totalRevenueARS: 5750000,
        },
        {
          sectorId: "sec_super_pullman_2",
          sectorName: "Super pullman 2",
          ticketsSold: 210,
          invitations: 24,
          totalRevenueARS: 4620000,
        },
        {
          sectorId: "sec_pullman_1",
          sectorName: "Pullman 1",
          ticketsSold: 260,
          invitations: 32,
          totalRevenueARS: 4680000,
        },
        {
          sectorId: "sec_pullman_3",
          sectorName: "Pullman 3",
          ticketsSold: 220,
          invitations: 35,
          totalRevenueARS: 3300000,
        },
      ],
    },
    {
      sessionId: "ses_2025_06_06_2030",
      sessionDateTime: "2025-06-06T20:30:00-03:00",
      sectors: [
        {
          sectorId: "sec_platea_1",
          sectorName: "Platea 1",
          ticketsSold: 175,
          invitations: 11,
          totalRevenueARS: 7875000,
        },
        {
          sectorId: "sec_platea_2",
          sectorName: "Platea 2",
          ticketsSold: 205,
          invitations: 19,
          totalRevenueARS: 8200000,
        },
        {
          sectorId: "sec_platea_3",
          sectorName: "Platea 3",
          ticketsSold: 185,
          invitations: 16,
          totalRevenueARS: 6475000,
        },
        {
          sectorId: "sec_platea_5",
          sectorName: "Platea 5",
          ticketsSold: 250,
          invitations: 30,
          totalRevenueARS: 7500000,
        },
        {
          sectorId: "sec_super_pullman_1",
          sectorName: "Super pullman 1",
          ticketsSold: 315,
          invitations: 38,
          totalRevenueARS: 7875000,
        },
        {
          sectorId: "sec_super_pullman_2",
          sectorName: "Super pullman 2",
          ticketsSold: 275,
          invitations: 34,
          totalRevenueARS: 6050000,
        },
        {
          sectorId: "sec_pullman_1",
          sectorName: "Pullman 1",
          ticketsSold: 345,
          invitations: 50,
          totalRevenueARS: 6210000,
        },
        {
          sectorId: "sec_pullman_3",
          sectorName: "Pullman 3",
          ticketsSold: 295,
          invitations: 55,
          totalRevenueARS: 4425000,
        },
      ],
    },
  ],
};

// Opcional: si tu tabla consume un array plano (filas), podés usar este helper.
export type SectorSalesRow = {
  eventId: string;
  eventName: string;
  currency: "ARS";
  sessionId: string;
  sessionDateTime: string;
  sectorId: string;
  sectorName: string;
  ticketsSold: number;
  invitations: number;
  totalRevenueARS: number;
};

export const flattenSectorSalesRows = (
  mock: EventSectorSalesMock
): SectorSalesRow[] =>
  mock.sessions.flatMap((s) =>
    s.sectors.map((sec) => ({
      eventId: mock.eventId,
      eventName: mock.eventName,
      currency: mock.currency,
      sessionId: s.sessionId,
      sessionDateTime: s.sessionDateTime,
      ...sec,
    }))
  );
