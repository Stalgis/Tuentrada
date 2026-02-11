// ../data/MockPaymentMethod.ts
import {
  mockEventSectorSales,
  type EventSectorSalesMock,
} from "./mockEventSectorSales";

export type PaymentMethodBreakdown = {
  id: string;
  name: string;
  salesCount: number; // cantidad de ventas
  revenueARS: number; // recaudado en ARS
};

type Session = EventSectorSalesMock["sessions"][number];

function sumTicketsSold(session: Session): number {
  return (session?.sectors ?? []).reduce(
    (acc, s) => acc + (s.ticketsSold ?? 0),
    0
  );
}

function allocateIntegers(total: number, weights: number[]): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sumW);
  const base = raw.map((x) => Math.floor(x));
  let remainder = total - base.reduce((a, b) => a + b, 0);

  // Distribuye el resto según mayor parte fraccional
  const fracIdx = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remainder; k++) {
    base[fracIdx[k % fracIdx.length].i] += 1;
  }
  return base;
}

function allocateMoney(totalARS: number, weights: number[]): number[] {
  const totalCents = Math.round(totalARS * 100);
  const cents = allocateIntegers(totalCents, weights);
  return cents.map((c) => c / 100);
}

/**
 * Totales inspirados en el ejemplo de tu captura:
 * - Total ventas: 6153
 * - Dinero en cuenta: 4278 (69.53%)
 * - Tarjeta crédito: 1328 (21.58%)
 * - Débito: 246 (4.00%)
 * - Prepaga: 197 (3.20%)
 * - Cuotas sin tarjeta: 104 (1.69%)
 *
 * Recaudación total aprox: 541,210,791.74
 * Dinero en cuenta: 376,303,863.50
 */
const EVENT_TOTALS = {
  totalSales: 6153,
  totalRevenueARS: 541_210_791.74,
  methods: [
    {
      id: "account_money",
      name: "Dinero en cuenta",
      salesCount: 4278,
      revenueARS: 376_303_863.5,
    },
    {
      id: "credit_card",
      name: "Tarjeta de crédito",
      salesCount: 1328,
      revenueARS: 116_793_288.86,
    },
    {
      id: "debit_card",
      name: "Tarjeta de débito",
      salesCount: 246,
      revenueARS: 21_648_431.67,
    },
    {
      id: "prepaid_card",
      name: "Tarjeta prepaga",
      salesCount: 197,
      revenueARS: 17_318_745.34,
    },
    {
      id: "installments_no_card",
      name: "Cuotas sin tarjeta",
      salesCount: 104,
      revenueARS: 9_146_462.37,
    },
  ] as const,
};

function buildSessionMap(
  event: EventSectorSalesMock
): Record<string, PaymentMethodBreakdown[]> {
  const sessions = event?.sessions ?? [];
  if (!sessions.length) return {};

  // Pesos por sesión según tickets vendidos (si no hay, reparte parejo)
  const soldPerSession = sessions.map(sumTicketsSold);
  const totalSold = soldPerSession.reduce((a, b) => a + b, 0);
  const weights = totalSold > 0 ? soldPerSession : sessions.map(() => 1);

  // Para cada método, distribuimos ventas y revenue por pesos
  const perMethodAlloc = EVENT_TOTALS.methods.map((m) => {
    const salesAlloc = allocateIntegers(m.salesCount, weights);
    const revenueAlloc = allocateMoney(m.revenueARS, weights);
    return { ...m, salesAlloc, revenueAlloc };
  });

  const map: Record<string, PaymentMethodBreakdown[]> = {};

  sessions.forEach((s, idx) => {
    const sessionId = String(s.sessionId);
    map[sessionId] = perMethodAlloc.map((m) => ({
      id: m.id,
      name: m.name,
      salesCount: m.salesAlloc[idx] ?? 0,
      revenueARS: m.revenueAlloc[idx] ?? 0,
    }));
  });

  return map;
}

// Mapa listo para usar en pantalla (sin tocar tu mock de sectores)
export const mockPaymentMethodsBySessionId: Record<
  string,
  PaymentMethodBreakdown[]
> = buildSessionMap(mockEventSectorSales);

export function getMockPaymentMethodsForSession(
  sessionId: string
): PaymentMethodBreakdown[] {
  return mockPaymentMethodsBySessionId[String(sessionId)] ?? [];
}
