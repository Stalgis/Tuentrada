import React, { useMemo, useState, useEffect } from "react";
import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getMockPaymentMethodsForSession } from "../data/MockPaymentMethod";

import {
  mockEventSectorSales,
  type EventSectorSalesMock,
} from "../data/mockEventSectorSales";
import { useAppState } from "../store/appState";
import PageHeader from "../components/UI/PageHeader";

type AnyEvent = EventSectorSalesMock;

type Option = { label: string; value: string };

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

function SelectField({
  label,
  value,
  options,
  onChange,
  colors,
  isDark,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  colors: {
    background: string;
    card: string;
    border: string;
    text: string;
    subtext: string;
    headBg: string;
    rowBorder: string;
    buttonBg: string;
    buttonText: string;
  };
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);

  const locked = options.length <= 1;
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "—";

  const FIELD_HEIGHT = 46;
  const IOS_WHEEL_HEIGHT = 216;

  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  if (Platform.OS === "ios") {
    return (
      <View style={styles.filterBlock}>
        <Text style={[styles.filterLabel, { color: colors.subtext }]}>
          {label}
        </Text>

        <Pressable
          disabled={locked}
          onPress={() => setOpen(true)}
          style={[
            styles.selectWrap,
            {
              height: FIELD_HEIGHT,
              borderColor: colors.border,
              backgroundColor: inputBg,
              opacity: locked ? 0.7 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.selectText, { color: colors.text }]}
          >
            {selectedLabel}
          </Text>

          {!locked && (
            <Text
              pointerEvents="none"
              style={[styles.chevron, { color: colors.subtext }]}
            >
              ▾
            </Text>
          )}
        </Pressable>

        <Modal visible={open} animationType="slide" transparent>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setOpen(false)}
          >
            <Pressable
              style={[
                styles.sheet,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {}}
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  Seleccionar {label.toLowerCase()}
                </Text>

                <Pressable onPress={() => setOpen(false)}>
                  <Text style={[styles.sheetDone, { color: colors.subtext }]}>
                    Listo
                  </Text>
                </Pressable>
              </View>

              <View style={{ height: IOS_WHEEL_HEIGHT }}>
                <Picker
                  selectedValue={value}
                  onValueChange={(v) => onChange(String(v))}
                  style={{ height: IOS_WHEEL_HEIGHT, color: colors.text }}
                  itemStyle={{ fontSize: 16 }}
                >
                  {options.map((o) => (
                    <Picker.Item
                      key={o.value}
                      label={o.label}
                      value={o.value}
                    />
                  ))}
                </Picker>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, { color: colors.subtext }]}>
        {label}
      </Text>

      <View
        style={[
          styles.selectWrap,
          {
            height: FIELD_HEIGHT,
            borderColor: colors.border,
            backgroundColor: inputBg,
            opacity: locked ? 0.7 : 1,
          },
        ]}
      >
        {locked ? (
          <Text
            numberOfLines={1}
            style={[styles.selectText, { color: colors.text }]}
          >
            {selectedLabel}
          </Text>
        ) : (
          <>
            <Picker
              selectedValue={value}
              onValueChange={(v) => onChange(String(v))}
              mode="dropdown"
              dropdownIconColor="transparent"
              style={[
                styles.picker,
                { height: FIELD_HEIGHT, color: colors.text },
              ]}
              itemStyle={styles.pickerItem}
            >
              {options.map((o) => (
                <Picker.Item
                  key={o.value}
                  label={o.label}
                  value={o.value}
                  color={colors.text}
                />
              ))}
            </Picker>

            <Text
              pointerEvents="none"
              style={[styles.chevron, { color: colors.subtext }]}
            >
              ▾
            </Text>
          </>
        )}
      </View>
    </View>
  );
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

  const eventOptions: Option[] = useMemo(
    () =>
      events.map((e) => ({
        label: e.eventName,
        value: String(e.eventId),
      })),
    [events]
  );

  const functionOptions: Option[] = useMemo(
    () =>
      sessionOptions.map((o) => ({
        label: o.label,
        value: String(o.id),
      })),
    [sessionOptions]
  );

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
            <SelectField
              label="Evento"
              value={selectedEventId}
              options={eventOptions}
              onChange={(v) => setSelectedEventId(v)}
              colors={colors}
              isDark={isDark}
            />

            <SelectField
              label="Función"
              value={selectedSessionId}
              options={functionOptions}
              onChange={(v) => setSelectedSessionId(v)}
              colors={colors}
              isDark={isDark}
            />
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
