import React, { useMemo, useState, useEffect } from "react";
import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";

import {
  mockEventSectorSales,
  type EventSectorSalesMock,
  type SectorSales,
} from "../data/mockEventSectorSales";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import TopBar from "../components/UI/TopBar";
import RootDrawer from "../components/RootDrawer";
import FilterChip from "../components/UI/FilterChip";

type AnyEvent = EventSectorSalesMock;

type MetricKey = "sold" | "invites" | "revenue";

const METRICS: {
  key: MetricKey;
  label: string;
  short: string;
}[] = [
  { key: "sold", label: "Vendidos", short: "Vendidas" },
  { key: "invites", label: "Invitaciones", short: "Invitaciones" },
  { key: "revenue", label: "Recaudado", short: "$ Total" },
];

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

export default function SectorScreen() {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const events: AnyEvent[] = useMemo(() => [mockEventSectorSales], []);

  const [selectedEventId, setSelectedEventId] = useState<string>(
    String(events[0]?.eventId ?? "")
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>("ALL"); // "Todo" por defecto

  // Chips multi-select (vacío = "Todo")
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(
    new Set()
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.eventId === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  // Si cambio de evento, vuelvo a "Todo" automáticamente.
  useEffect(() => {
    setSelectedSessionId("ALL");
  }, [selectedEventId]);

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
        id: s.sessionId,
        label: formatSessionLabel(s.sessionDateTime),
      })) ?? [];
    return base.concat(extra);
  }, [selectedEvent]);

  const eventSelectData = events.map((e) => ({
    key: String(e.eventId),
    value: e.eventName, // completo
  }));

  const sessionSelectData = sessionOptions.map((o) => ({
    key: String(o.id),
    value: o.label,
  }));

  //Mira si hay mas de un evento o funcion para verificar si hay o no dropdown
  const hasMultipleEvents = eventSelectData.length > 1;
  const singleEventLabel = eventSelectData[0]?.value ?? "";
  const hasMultipleSessions = sessionSelectData.length > 1; // ALL + al menos 1 sesión real
  const singleSessionLabel = sessionSelectData[0]?.value ?? "Todo";

  // Data visible: o una función específica, o "Todo" (agregado por sector)
  const visibleSectors: SectorSales[] = useMemo(() => {
    if (!selectedEvent) return [];

    if (selectedSessionId === "ALL") {
      const map = new Map<string, SectorSales>();
      const order: string[] = [];

      for (const session of selectedEvent.sessions) {
        for (const sec of session.sectors) {
          const prev = map.get(sec.sectorId);

          if (!prev) {
            map.set(sec.sectorId, { ...sec });
            order.push(sec.sectorId); // preserva el orden de aparición
          } else {
            map.set(sec.sectorId, {
              sectorId: sec.sectorId,
              sectorName: sec.sectorName,
              ticketsSold: prev.ticketsSold + sec.ticketsSold,
              invitations: prev.invitations + sec.invitations,
              totalRevenueARS: prev.totalRevenueARS + sec.totalRevenueARS,
            });
          }
        }
      }

      return order.map((id) => map.get(id)!).filter(Boolean);
    }

    const ses = selectedEvent.sessions.find(
      (s) => s.sessionId === selectedSessionId
    );
    return ses?.sectors ?? [];
  }, [selectedEvent, selectedSessionId]);

  // Mantener orden: NO sort
  const orderedVisibleSectors = useMemo(() => visibleSectors, [visibleSectors]);

  const totals = useMemo(() => {
    return orderedVisibleSectors.reduce(
      (acc, s) => {
        acc.ticketsSold += s.ticketsSold;
        acc.invitations += s.invitations;
        acc.totalRevenueARS += s.totalRevenueARS;
        return acc;
      },
      { ticketsSold: 0, invitations: 0, totalRevenueARS: 0 }
    );
  }, [orderedVisibleSectors]);

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
            buttonText: "#dbeafe",
          }
        : {
            background: "#f8fafc",
            card: "#ffffff",
            border: "#e2e8f0",
            text: "#0f172a",
            subtext: "#475569",
            headBg: "#f8fafc",
            rowBorder: "#e2e8f0",
            buttonBg: "#dbeafe",
            buttonText: "#1d4ed8",
          },
    [isDark]
  );

  const periodLabel =
    selectedSessionId === "ALL"
      ? "Todas las funciones"
      : formatSessionSubtitle(
          selectedEvent?.sessions.find((s) => s.sessionId === selectedSessionId)
            ?.sessionDateTime ?? ""
        );

  const activeMetricKeys = useMemo(
    () => METRICS.filter((m) => selectedMetrics.has(m.key)).map((m) => m.key),
    [selectedMetrics]
  );
  const visibleMetricKeys = useMemo<MetricKey[]>(
    () =>
      activeMetricKeys.length === 0
        ? METRICS.map((metric) => metric.key)
        : activeMetricKeys,
    [activeMetricKeys]
  );

  const toggleMetric = (k: MetricKey) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const clearMetrics = () => setSelectedMetrics(new Set()); // vuelve a "Todo"

  const metricSummary = (sec: SectorSales, metric: MetricKey) => {
    if (metric === "sold") {
      return {
        label: "Vendidas",
        value: formatInt(sec.ticketsSold),
      };
    }
    if (metric === "invites") {
      return {
        label: "Invitaciones",
        value: formatInt(sec.invitations),
      };
    }
    return {
      label: "Recaudado",
      value: formatARS(sec.totalRevenueARS),
    };
  };

  const topSectorByMetric = (metric: MetricKey) => {
    if (!orderedVisibleSectors.length) return null;

    return orderedVisibleSectors.reduce((best, current) => {
      const bestValue =
        metric === "sold"
          ? best.ticketsSold
          : metric === "invites"
            ? best.invitations
            : best.totalRevenueARS;
      const currentValue =
        metric === "sold"
          ? current.ticketsSold
          : metric === "invites"
            ? current.invitations
            : current.totalRevenueARS;

      return currentValue > bestValue ? current : best;
    }, orderedVisibleSectors[0]);
  };

  const formatShare = (value: number, total: number) =>
    total > 0 ? `${Math.round((value / total) * 100)}% del total` : "0% del total";

  const insightItems = useMemo(() => {
    const preferredMetrics: MetricKey[] =
      visibleMetricKeys.length === 3
        ? ["revenue", "sold"]
        : visibleMetricKeys;

    return preferredMetrics.slice(0, 2).map((metric) => {
      const topSector = topSectorByMetric(metric);
      if (!topSector) return null;

      if (metric === "sold") {
        return {
          key: metric,
          eyebrow: "Más vendidas",
          sector: topSector.sectorName,
          detail: formatShare(topSector.ticketsSold, totals.ticketsSold),
        };
      }

      if (metric === "invites") {
        return {
          key: metric,
          eyebrow: "Más invitaciones",
          sector: topSector.sectorName,
          detail: formatShare(topSector.invitations, totals.invitations),
        };
      }

      return {
        key: metric,
        eyebrow: "Mayor recaudación",
        sector: topSector.sectorName,
        detail: formatShare(topSector.totalRevenueARS, totals.totalRevenueARS),
      };
    }).filter(Boolean) as Array<{
      key: MetricKey;
      eyebrow: string;
      sector: string;
      detail: string;
    }>;
  }, [orderedVisibleSectors, totals, visibleMetricKeys]);

  const renderSectorRow = (sec: SectorSales, isTotal?: boolean) => {
    const hasRevenue = visibleMetricKeys.includes("revenue");
    const primaryMetricKey = hasRevenue ? "revenue" : visibleMetricKeys[0];
    const primaryMetric = metricSummary(sec, primaryMetricKey);
    const secondaryMetrics = visibleMetricKeys
      .filter((metricKey) => metricKey !== primaryMetricKey)
      .map((metricKey) => metricSummary(sec, metricKey));
    const showPrimaryLabel = visibleMetricKeys.length !== 3;

    return (
      <View
        key={isTotal ? "TOTAL" : sec.sectorId}
        style={[
          styles.resultRow,
          isTotal && styles.resultRowTotal,
          {
            borderBottomColor: colors.rowBorder,
            backgroundColor: isTotal ? colors.headBg : "transparent",
          },
        ]}
      >
        <View style={styles.resultTopRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.resultSector,
              { color: colors.text },
              isTotal && styles.totalText,
            ]}
          >
            {isTotal ? "TOTAL" : sec.sectorName}
          </Text>
          <View style={styles.resultPrimaryMetric}>
            {showPrimaryLabel ? (
              <Text
                style={[styles.resultPrimaryLabel, { color: colors.subtext }]}
                numberOfLines={1}
              >
                {primaryMetric.label}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.resultTotalValue,
                { color: colors.text },
                isTotal && styles.totalText,
              ]}
            >
              {primaryMetric.value}
            </Text>
          </View>
        </View>

        {secondaryMetrics.length ? (
          <View
            style={[
              styles.resultMetaRow,
              secondaryMetrics.length > 1 && styles.resultMetaRowWrapped,
            ]}
          >
            {secondaryMetrics.map((metric) => (
              <View key={metric.label} style={styles.resultMetaItem}>
                <Text style={[styles.resultMetaLabel, { color: colors.subtext }]}>
                  {metric.label}
                </Text>
                <Text
                  style={[
                    styles.resultMetaValue,
                    { color: colors.text },
                    isTotal && styles.totalText,
                  ]}
                  numberOfLines={1}
                >
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const totalsAsSector: SectorSales = {
    sectorId: "TOTAL",
    sectorName: "TOTAL",
    ticketsSold: totals.ticketsSold,
    invitations: totals.invitations,
    totalRevenueARS: totals.totalRevenueARS,
  };

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
            title="Ventas por sector"
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
              {selectedEvent?.eventName ?? singleEventLabel}
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
                  itemTextStyle={{ color: colors.text }}
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
                  key={`session-${selectedEventId}`} // mantiene tu refresh al cambiar evento
                  data={sessionSelectData}
                  labelField="value"
                  valueField="key"
                  value={selectedSessionId}
                  onChange={(item: { key: string; value: string }) =>
                    setSelectedSessionId(String(item.key))
                  }
                  placeholder="Seleccioná una función"
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
                  itemTextStyle={{ color: colors.text }}
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

          {/* Chips */}
          <View style={styles.chipsRow}>
            <FilterChip
              label="Todo"
              active={selectedMetrics.size === 0}
              onPress={clearMetrics}
              className="w-[48.5%]"
            />
            {METRICS.map((m) => (
              <FilterChip
                key={m.key}
                label={m.label}
                active={selectedMetrics.has(m.key)}
                onPress={() => toggleMetric(m.key)}
                className="w-[48.5%]"
              />
            ))}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.resultsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.resultsHeader}>
            <Text style={[styles.sectionLabel, { color: colors.subtext }]}>
              Resultados
            </Text>
            <Text style={[styles.resultsSubtext, { color: colors.subtext }]}>
              {orderedVisibleSectors.length} sectores
            </Text>
          </View>

          {insightItems.length ? (
            <View style={styles.insightsRow}>
              {insightItems.map((insight) => (
                <View
                  key={insight.key}
                  style={[
                    styles.insightCard,
                    {
                      backgroundColor: colors.headBg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.insightEyebrow, { color: colors.subtext }]}>
                    {insight.eyebrow}
                  </Text>
                  <Text style={[styles.insightSector, { color: colors.text }]}>
                    {insight.sector}
                  </Text>
                  <Text style={[styles.insightDetail, { color: colors.subtext }]}>
                    {insight.detail}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.stackTable}>
            {orderedVisibleSectors.map((sec) => renderSectorRow(sec))}
            {renderSectorRow(totalsAsSector, true)}
          </View>
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
    paddingBottom: 32,
  },

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
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  sectionCard: {
    width: "100%",
    borderRadius: 18,
    padding: 13,
    rowGap: 10,
    borderWidth: 1,
  },
  resultsCard: {
    marginTop: 14,
  },

  filtersRow: { flexDirection: "row", columnGap: 8 },
  filterBlock: { flex: 1, rowGap: 6 },
  filterLabel: { fontSize: 12, fontWeight: "500" },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultsSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  insightsRow: {
    flexDirection: "row",
    columnGap: 10,
    marginBottom: 2,
  },
  insightCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  insightEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  insightSector: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  insightDetail: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },

  selectorField: {
    borderRadius: 14,
    minHeight: 50,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  selectorFieldStatic: {
    paddingRight: 12,
  },
  selectorText: {
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: "center", // Android
    includeFontPadding: false as any, // Android (evita padding extra)
    flex: 1,
  },
  selectorIcon: {
    marginLeft: 8,
  },

  // Chips
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 4,
  },
  stackTable: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  resultRowTotal: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderBottomWidth: 0,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 14,
  },
  resultSector: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
    paddingTop: 1,
  },
  resultPrimaryMetric: {
    flexShrink: 0,
    alignItems: "flex-end",
    maxWidth: "48%",
  },
  resultPrimaryLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  resultTotalValue: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  resultMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    columnGap: 16,
  },
  resultMetaRowWrapped: {
    flexWrap: "wrap",
    rowGap: 4,
  },
  resultMetaItem: {
    flexDirection: "row",
    alignItems: "baseline",
    columnGap: 6,
  },
  resultMetaLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  resultMetaValue: {
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },

  totalText: {
    fontWeight: "900",
  },
});
