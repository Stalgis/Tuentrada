import React, { useMemo, useState, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { getMockPaymentMethodsForSession } from "../data/MockPaymentMethod";
import { Dropdown } from "react-native-element-dropdown";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";

import {
  mockEventSectorSales,
  type EventSectorSalesMock,
} from "../data/mockEventSectorSales";
import { useAppState } from "../store/appState";
import TopBar from "../components/UI/TopBar";
import RootDrawer from "../components/RootDrawer";
import { useAuth } from "../store/auth";

type AnyEvent = EventSectorSalesMock;

function SelectorField({
  label,
  colors,
  children,
}: {
  label: string;
  colors: { subtext: string };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, { color: colors.subtext }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

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
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
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
            headBg: "rgba(255,255,255,0.05)",
            rowBorder: "rgba(255,255,255,0.06)",
            buttonBg: "rgba(96,165,250,0.18)",
            buttonText: "#e2e8f0",
          }
        : {
            background: "#f8fafc",
            card: "#ffffff",
            border: "#e2e8f0",
            text: "#0f172a",
            subtext: "#475569",
            headBg: "#f8fafc",
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
  const hasMultipleEvents = eventSelectData.length > 1;
  const singleEventLabel =
    selectedEvent?.eventName ?? eventSelectData[0]?.value ?? "Evento";
  const hasMultipleSessions = sessionSelectData.length > 1;
  const singleSessionLabel = sessionSelectData[0]?.value ?? "Todo";

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
  const handleAvatarPress = () => {
    const parentNav = navigation.getParent?.();
    const target = parentNav ?? navigation;
    target.navigate("Profile");
  };

  return (
    <RootDrawer>
      {(openDrawer) => (
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: colors.background }]}
        >
          <TopBar
            title="Medios de pago"
            onLeftPress={openDrawer}
            onRightPress={handleAvatarPress}
            rightInitials={user?.initials}
          />
          <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.screenContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.contextBlock,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.contextItem}>
                <Text style={[styles.contextLabel, { color: colors.subtext }]}>
                  Evento
                </Text>
                <Text style={[styles.contextValue, { color: colors.text }]}>
                  {singleEventLabel}
                </Text>
              </View>

              <View style={styles.contextItem}>
                <Text style={[styles.contextLabel, { color: colors.subtext }]}>
                  Función
                </Text>
                <Text style={[styles.contextValue, { color: colors.text }]}>
                  {periodLabel}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
                Filtros
              </Text>

              <View style={styles.filtersRow}>
                <SelectorField label="Evento" colors={colors}>
                  {hasMultipleEvents ? (
                    <Dropdown
                      data={eventSelectData}
                      labelField="value"
                      valueField="key"
                      value={selectedEventId}
                      onChange={(item: { key: string; value: string }) =>
                        setSelectedEventId(String(item.key))
                      }
                      placeholder="Selecciona un evento"
                      style={StyleSheet.flatten([
                        styles.selectorField,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ])}
                      selectedTextStyle={StyleSheet.flatten([
                        styles.selectorText,
                        { color: colors.text },
                      ])}
                      placeholderStyle={StyleSheet.flatten([
                        styles.selectorText,
                        { color: colors.subtext },
                      ])}
                      containerStyle={{
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                      itemTextStyle={{
                        color: colors.text,
                      }}
                      renderRightIcon={() => (
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={colors.subtext}
                          style={styles.selectorIcon}
                        />
                      )}
                    />
                  ) : (
                    <View
                      style={[
                        styles.selectorField,
                        styles.selectorFieldStatic,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={2}
                        style={[styles.selectorText, { color: colors.text }]}
                      >
                        {singleEventLabel}
                      </Text>
                    </View>
                  )}
                </SelectorField>

                <SelectorField label="Función" colors={colors}>
                  {hasMultipleSessions ? (
                    <Dropdown
                      key={`session-${selectedEventId}`}
                      data={sessionSelectData}
                      labelField="value"
                      valueField="key"
                      value={selectedSessionId}
                      onChange={(item: { key: string; value: string }) =>
                        setSelectedSessionId(String(item.key))
                      }
                      placeholder="Selecciona una función"
                      style={StyleSheet.flatten([
                        styles.selectorField,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ])}
                      selectedTextStyle={StyleSheet.flatten([
                        styles.selectorText,
                        { color: colors.text },
                      ])}
                      placeholderStyle={StyleSheet.flatten([
                        styles.selectorText,
                        { color: colors.subtext },
                      ])}
                      containerStyle={{
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                      itemTextStyle={{
                        color: colors.text,
                      }}
                      renderRightIcon={() => (
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={colors.subtext}
                          style={styles.selectorIcon}
                        />
                      )}
                    />
                  ) : (
                    <View
                      style={[
                        styles.selectorField,
                        styles.selectorFieldStatic,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={2}
                        style={[styles.selectorText, { color: colors.text }]}
                      >
                        {singleSessionLabel}
                      </Text>
                    </View>
                  )}
                </SelectorField>
              </View>
            </View>

            <View
              style={[
                styles.moduleCard,
                styles.insightContainer,
                { borderColor: colors.border, backgroundColor: colors.headBg },
              ]}
            >
              <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
                Insight principal
              </Text>
              {top ? (
                <>
                  <Text style={[styles.summaryEyebrow, { color: colors.subtext }]}>
                    Método dominante
                  </Text>
                  <View style={styles.summaryHeadlineRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.summaryTitle, styles.summaryTitleStrong, { color: colors.text }]}
                    >
                      {top.methodName}
                    </Text>
                    <Text style={[styles.summaryPct, { color: colors.text }]}>
                      {topPct.toFixed(2)}%
                    </Text>
                  </View>
                  <Text style={[styles.summarySub, { color: colors.subtext }]}>
                    {formatARS(totals.revenueARS)} en {formatInt(totals.salesCount)}{" "}
                    ventas totales
                  </Text>
                </>
              ) : (
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  Sin datos de método de pago
                </Text>
              )}
            </View>

            <View
              style={[
                styles.moduleCard,
                styles.breakdownContainer,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.breakdownHeader}>
                <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
                  Desglose por método
                </Text>
                <Text style={[styles.resultsSubtext, { color: colors.subtext }]}>
                  {sorted.length} métodos
                </Text>
              </View>

              <View style={{ rowGap: 12 }}>
                {visibleList.map((r) => {
                  const pct =
                    totals.salesCount > 0
                      ? (r.salesCount / totals.salesCount) * 100
                      : 0;

                  return (
                    <View key={r.methodId} style={styles.breakdownRow}>
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

                      <Text style={[styles.barMeta, { color: colors.subtext }]}>
                        {formatInt(r.salesCount)} ventas · {formatARS(r.revenueARS)}
                      </Text>
                    </View>
                  );
                })}
              </View>

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
      )}
    </RootDrawer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flex: 1 },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },

  title: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  tableTitle: { paddingLeft: 4 },
  subtitle: { fontSize: 13, marginBottom: 12 },

  contextBlock: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    rowGap: 10,
    marginBottom: 12,
  },
  contextItem: {
    rowGap: 4,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  contextValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionCard: {
    width: "100%",
    borderRadius: 18,
    padding: 13,
    rowGap: 10,
    borderWidth: 1,
  },
  moduleCard: {
    width: "100%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  insightContainer: {
    marginTop: 10,
    rowGap: 4,
  },
  breakdownContainer: {
    marginTop: 12,
    rowGap: 12,
  },
  breakdownRow: {
    rowGap: 7,
    paddingVertical: 2,
  },

  filtersRow: { flexDirection: "row", columnGap: 8 },

  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultsSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  filterBlock: { flex: 1, rowGap: 6, minWidth: 0 },
  filterLabel: { fontSize: 12, fontWeight: "500" },
  selectorField: {
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 40,
  },
  selectorFieldStatic: {
    justifyContent: "center",
  },
  selectorText: {
    width: "100%",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  pickerItem: { fontSize: 14 },
  selectorIcon: {
    marginRight: 1,
  },

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
  summaryEyebrow: { fontSize: 11, fontWeight: "600" },
  summaryHeadlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 10,
  },
  summaryTitle: { fontSize: 14, fontWeight: "800" },
  summaryTitleStrong: { flex: 1, fontSize: 16, lineHeight: 20 },
  summaryPct: { fontSize: 14, fontWeight: "700" },
  summarySub: { fontSize: 12, lineHeight: 16 },

  barRowHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 10,
  },
  barLabel: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  barPct: { fontSize: 12, fontWeight: "600", minWidth: 52, textAlign: "right" },

  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  barMeta: { fontSize: 12, lineHeight: 17 },

  showMoreBtn: {
    paddingVertical: 10,
    alignItems: "flex-start",
  },
  showMoreText: { fontSize: 13, fontWeight: "600" },
});
