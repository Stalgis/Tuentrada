import React, { useMemo, useState, useEffect } from "react";
import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { getMockPaymentMethodsForSession } from "../data/MockPaymentMethod";
import { SelectList } from "react-native-dropdown-select-list";
import { Ionicons } from "@expo/vector-icons";

import {
  mockEventSectorSales,
  type EventSectorSalesMock,
} from "../data/mockEventSectorSales";
import { useAppState } from "../store/appState";
import PageHeader from "../components/UI/PageHeader";

type AnyEvent = EventSectorSalesMock;


// Ajustá este type a tu data real si cambia el nombre de campos
type PaymentRow = {
  methodId: string;
  methodName: string;
  salesCount: number; // cantidad de ventas
  revenueARS: number; // recaudado
};

/**
 * Adaptador de data:
 * - Si tu session ya viene con breakdown, mapealo aquí.
 * - Si tu breakdown sale de ventas individuales, agregalo aquí.
 */
function getPaymentRowsForSession(session: any) {
  const sessionId = String(session?.sessionId ?? "");
  const rows = getMockPaymentMethodsForSession(sessionId);

  return rows.map((p) => ({
    methodId: p.id,
    methodName: p.name,
    salesCount: p.salesCount,
    revenueARS: p.revenueARS,
  }));
}

export default function PaymentMethodScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useAppState();
  const isDark = theme === "dark";

  const contentWidth = Math.max(width - 40, 320);

  const events: AnyEvent[] = useMemo(() => [mockEventSectorSales], []);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    String(events[0]?.eventId ?? "")
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>("ALL");

  const selectedEvent = useMemo(
    () =>
      events.find((e) => String(e.eventId) === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  useEffect(() => {
    setSelectedSessionId("ALL");
  }, [selectedEventId]);

  const colors = useMemo(
    () =>
      isDark
        ? {
            background: "#0b1220",
            card: "rgba(255,255,255,0.02)",
            border: "rgba(255,255,255,0.06)",
            text: "#e2e8f0",
            subtext: "#cbd5e1",
            headBg: "rgba(255,255,255,0.08)",
            rowBorder: "rgba(255,255,255,0.06)",
            buttonBg: "rgba(255,255,255,0.18)", // un poco más visible en dark
            buttonText: "#e2e8f0",
          }
        : {
            background: "#f8fafc",
            card: "#ffffff",
            border: "#e2e8f0",
            text: "#0f172a",
            subtext: "#475569",
            headBg: "#f1f5f9",
            rowBorder: "#e2e8f0",
            buttonBg: "#007bff",
            buttonText: "#ffffff",
          },
    [isDark]
  );

  const formatInt = (n: number) => new Intl.NumberFormat("es-AR").format(n);

  const formatARS = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  const formatSessionLabel = (iso: string) => {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const suffix = hours24 >= 12 ? "pm" : "am";
    return `${day}/${month} ${hours12}:${minutes} ${suffix}`;
  };

  const formatSessionSubtitle = (iso: string) => {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const suffix = hours24 >= 12 ? "pm" : "am";
    return `${day}/${month}/${year} ${hours12}:${minutes} ${suffix}`;
  };

  const truncateLabel = (label: string, maxLength: number) => {
    if (label.length <= maxLength) return label;
    return `${label.slice(0, Math.max(0, maxLength - 3))}...`;
  };

  const sessionOptions = useMemo(() => {
    const base = [{ id: "ALL", label: "Todo" }];
    const extra =
      selectedEvent?.sessions?.map((s) => ({
        id: String(s.sessionId),
        label: formatSessionLabel(s.sessionDateTime),
      })) ?? [];
    return base.concat(extra);
  }, [selectedEvent]);

  const periodLabel =
    selectedSessionId === "ALL"
      ? "Todas las funciones"
      : formatSessionSubtitle(
          selectedEvent?.sessions.find(
            (s) => String(s.sessionId) === selectedSessionId
          )?.sessionDateTime ?? ""
        );

  const eventSelectData = useMemo(
    () =>
      events.map((e) => ({
        key: String(e.eventId),
        value: truncateLabel(e.eventName, 30),
      })),
    [events]
  );

  const sessionSelectData = useMemo(
    () =>
      sessionOptions.map((o) => ({
        key: String(o.id),
        value: o.label,
      })),
    [sessionOptions]
  );

  const defaultEventOption =
    eventSelectData.find((d) => d.key === String(selectedEventId)) ?? undefined;
  const defaultSessionOption =
    sessionSelectData.find((d) => d.key === String(selectedSessionId)) ??
    undefined;

  // Agregación: Todo (todas las funciones) o una sola función
  const paymentRows: PaymentRow[] = useMemo(() => {
    if (!selectedEvent) return [];

    if (selectedSessionId === "ALL") {
      const map = new Map<string, PaymentRow>();

      for (const session of selectedEvent.sessions) {
        const rows = getPaymentRowsForSession(session);

        for (const r of rows) {
          const prev = map.get(r.methodId);
          if (!prev) {
            map.set(r.methodId, { ...r });
          } else {
            map.set(r.methodId, {
              methodId: r.methodId,
              methodName: r.methodName,
              salesCount: prev.salesCount + r.salesCount,
              revenueARS: prev.revenueARS + r.revenueARS,
            });
          }
        }
      }

      return Array.from(map.values());
    }

    const session = selectedEvent.sessions.find(
      (s) => String(s.sessionId) === selectedSessionId
    );
    return session ? getPaymentRowsForSession(session) : [];
  }, [selectedEvent, selectedSessionId]);

  const totals = useMemo(() => {
    return paymentRows.reduce(
      (acc, r) => {
        acc.salesCount += r.salesCount;
        acc.revenueARS += r.revenueARS;
        return acc;
      },
      { salesCount: 0, revenueARS: 0 }
    );
  }, [paymentRows]);

  // Orden principal por cantidad de ventas (como en tu ejemplo)
  const sorted = useMemo(() => {
    return [...paymentRows].sort((a, b) => b.salesCount - a.salesCount);
  }, [paymentRows]);

  const top = sorted[0];
  const topPct =
    totals.salesCount > 0 && top
      ? (top.salesCount / totals.salesCount) * 100
      : 0;

  const [showAll, setShowAll] = useState(false);

  // reset show more cuando cambia filtro
  useEffect(() => {
    setShowAll(false);
  }, [selectedEventId, selectedSessionId]);

  const visibleList = showAll ? sorted : sorted.slice(0, 5);

  // Estilo de barras
  const trackBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.06)";
  const fillBg = isDark ? "rgba(255,255,255,0.28)" : colors.buttonBg;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <PageHeader title="Medio de pago" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.tableContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.title, styles.tableTitle, { color: colors.text }]}
          >
            Método de pago
          </Text>

          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            {periodLabel}
          </Text>

          <View style={styles.filtersRow}>
            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.subtext }]}>
                Evento
              </Text>
              <SelectList
                setSelected={(key: string) => setSelectedEventId(String(key))}
                data={eventSelectData}
                save="key"
                defaultOption={
                  defaultEventOption
                    ? {
                        key: defaultEventOption.key,
                        value: defaultEventOption.value,
                      }
                    : undefined
                }
                placeholder="Selecciona un evento"
                search={false}
                arrowicon={
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.subtext}
                    style={{ marginTop: 5 }}
                  />
                }
                boxStyles={StyleSheet.flatten([
                  styles.selectWrap,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    height: 50,
                  },
                ])}
                inputStyles={StyleSheet.flatten([
                  styles.picker,
                  {
                    color: colors.text,
                    height: 50,
                    marginTop: 5,
                  },
                ])}
                dropdownStyles={{
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
                dropdownTextStyles={{
                  color: colors.text,
                }}
              />
            </View>

            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.subtext }]}>
                FunciA3n
              </Text>
              <SelectList
                setSelected={(key: string) => setSelectedSessionId(String(key))}
                data={sessionSelectData}
                save="key"
                defaultOption={
                  defaultSessionOption
                    ? {
                        key: defaultSessionOption.key,
                        value: defaultSessionOption.value,
                      }
                    : undefined
                }
                placeholder="Selecciona una funciA3n"
                search={false}
                arrowicon={
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.subtext}
                    style={{ marginTop: 5 }}
                  />
                }
                boxStyles={StyleSheet.flatten([
                  styles.selectWrap,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    height: 50,
                  },
                ])}
                inputStyles={StyleSheet.flatten([
                  styles.picker,
                  {
                    color: colors.text,
                    height: 50,
                    marginTop: 5,
                  },
                ])}
                dropdownStyles={{
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
                dropdownTextStyles={{
                  color: colors.text,
                }}
              />
            </View>
          </View>

          {/* Resumen claro para el organizador */}
          <View
            style={[
              styles.summaryCard,
              { borderColor: colors.border, backgroundColor: trackBg },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {top
                ? `Mayoría: ${top.methodName} (${topPct.toFixed(2)}%)`
                : "Sin datos de método de pago"}
            </Text>

            <Text style={[styles.summarySub, { color: colors.subtext }]}>
              Generaste {formatARS(totals.revenueARS)} en{" "}
              {formatInt(totals.salesCount)} ventas
            </Text>
          </View>

          {/* Lista de barras */}
          <View style={{ rowGap: 12 }}>
            {visibleList.map((r) => {
              const pct =
                totals.salesCount > 0
                  ? (r.salesCount / totals.salesCount) * 100
                  : 0;

              return (
                <View key={r.methodId} style={{ rowGap: 6 }}>
                  <View style={styles.barRowHeader}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.barLabel,
                        { color: colors.text, maxWidth: contentWidth * 0.7 },
                      ]}
                    >
                      {r.methodName}
                    </Text>

                    <Text style={[styles.barPct, { color: colors.subtext }]}>
                      {pct.toFixed(2)}%
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.barTrack,
                      { backgroundColor: trackBg, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: fillBg },
                      ]}
                    />
                  </View>

                  {/* Línea secundaria (opcional pero muy útil): ventas + recaudado */}
                  <Text style={[styles.barMeta, { color: colors.subtext }]}>
                    {formatInt(r.salesCount)} ventas · {formatARS(r.revenueARS)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Mostrar más/menos */}
          {sorted.length > 5 && (
            <Pressable
              onPress={() => setShowAll((s) => !s)}
              style={styles.showMoreBtn}
            >
              <Text style={[styles.showMoreText, { color: colors.subtext }]}>
                {showAll ? "Mostrar menos" : "Mostrar más"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  title: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  tableTitle: { paddingLeft: 4 },
  subtitle: { fontSize: 13, marginBottom: 12 },

  tableContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 14,
    rowGap: 12,
    borderWidth: 1,
  },

  filtersRow: { flexDirection: "row", columnGap: 10 },

  filterBlock: { flex: 1, rowGap: 6, minWidth: 0 },
  filterLabel: { fontSize: 12 },

  selectWrap: {
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    overflow: "hidden",
    paddingLeft: 12,
    paddingRight: 34,
  },
  selectText: { fontSize: 14 },

  picker: { width: "100%", fontSize: 14 },
  pickerItem: { fontSize: 14 },

  chevron: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    textAlignVertical: "center",
    fontSize: 16,
    includeFontPadding: false,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 14, fontWeight: "700" },
  sheetDone: { fontSize: 14, fontWeight: "600" },

  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    rowGap: 4,
  },
  summaryTitle: { fontSize: 14, fontWeight: "800" },
  summarySub: { fontSize: 12 },

  barRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 10,
  },
  barLabel: { fontSize: 13, fontWeight: "700" },
  barPct: { fontSize: 12 },

  barTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  barMeta: { fontSize: 12 },

  showMoreBtn: {
    paddingVertical: 10,
    alignItems: "flex-start",
  },
  showMoreText: { fontSize: 13, fontWeight: "600" },
});
