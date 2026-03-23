export type MockPaymentMethod = {
  id: string;
  name: string;
  salesCount: number;
  revenueARS: number;
};

const PAYMENT_METHODS_BY_SESSION: Record<string, MockPaymentMethod[]> = {
  ses_001: [
    { id: "card_credit", name: "Tarjeta de crédito", salesCount: 410, revenueARS: 28700000 },
    { id: "card_debit", name: "Tarjeta de débito", salesCount: 145, revenueARS: 8120000 },
    { id: "transfer", name: "Transferencia", salesCount: 122, revenueARS: 7430000 },
    { id: "cash", name: "Efectivo", salesCount: 85, revenueARS: 4450000 },
  ],
  ses_002: [
    { id: "card_credit", name: "Tarjeta de crédito", salesCount: 435, revenueARS: 30450000 },
    { id: "card_debit", name: "Tarjeta de débito", salesCount: 162, revenueARS: 9010000 },
    { id: "transfer", name: "Transferencia", salesCount: 137, revenueARS: 8350000 },
    { id: "cash", name: "Efectivo", salesCount: 86, revenueARS: 5390000 },
  ],
};

export const getMockPaymentMethodsForSession = (
  sessionId: string
): MockPaymentMethod[] => {
  return PAYMENT_METHODS_BY_SESSION[sessionId] ?? [];
};
