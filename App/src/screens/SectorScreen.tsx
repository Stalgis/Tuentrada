import React, { useMemo, useState, useEffect } from "react";
import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Platform,
  Pressable,
} from "react-native";
import { SelectList } from "react-native-dropdown-select-list";
import { Ionicons } from "@expo/vector-icons";
import PageHeader from "../components/UI/PageHeader";

import {
  mockEventSectorSales,
  type EventSectorSalesMock,
  type SectorSales,
} from "../data/mockEventSectorSales";
import { useAppState } from "../store/appState";

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

function Chip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: active ? colors.buttonBg : colors.card,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.buttonText : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SectorScreen() {
  const { theme } = useAppState();
  const isDark = theme === "dark";

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

  const defaultEventOption =
    eventSelectData.find((d) => d.key === String(selectedEventId)) ?? undefined;

  const defaultSessionOption =
    sessionSelectData.find((d) => d.key === String(selectedSessionId)) ??
    undefined;

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
            headBg: "rgba(255,255,255,0.08)",
            rowBorder: "rgba(255,255,255,0.06)",
            buttonBg: "rgba(255,255,255,0.10)",
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

  const periodLabel =
    selectedSessionId === "ALL"
      ? "Todas las funciones"
      : formatSessionSubtitle(
          selectedEvent?.sessions.find((s) => s.sessionId === selectedSessionId)
            ?.sessionDateTime ?? ""
        );

  // Chips: visible metrics (si no hay seleccionadas => "Todo" => las 3)
  const visibleMetricKeys = useMemo<MetricKey[]>(() => {
    const picked = METRICS.filter((m) => selectedMetrics.has(m.key)).map(
      (m) => m.key
    );
    return picked.length === 0 ? METRICS.map((m) => m.key) : picked;
  }, [selectedMetrics]);

  const toggleMetric = (k: MetricKey) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const clearMetrics = () => setSelectedMetrics(new Set()); // vuelve a "Todo"

  const metricLabelFor = (k: MetricKey) => {
    const m = METRICS.find((x) => x.key === k)!;
    // si hay 3 visibles, usar corto para no cargar; si hay 1-2, usar completo
    return visibleMetricKeys.length === 3 ? m.short : m.label;
  };

  const metricValueFor = (sec: SectorSales, k: MetricKey) => {
    if (k === "sold") return formatInt(sec.ticketsSold);
    if (k === "invites") return formatInt(sec.invitations);
    return formatARS(sec.totalRevenueARS);
  };

  const renderSectorRow = (sec: SectorSales, isTotal?: boolean) => {
    return (
      <View
        key={isTotal ? "TOTAL" : sec.sectorId}
        style={[
          styles.stackRow,
          {
            borderBottomColor: colors.rowBorder,
            backgroundColor: isTotal ? colors.headBg : "transparent",
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.stackSector,
            { color: colors.text },
            isTotal && styles.totalText,
          ]}
        >
          {isTotal ? "TOTAL" : sec.sectorName}
        </Text>

        <View style={styles.metricsRow}>
          {visibleMetricKeys.map((k) => (
            <View key={k} style={styles.metricCell}>
              <Text style={[styles.metricLabel, { color: colors.subtext }]}>
                {metricLabelFor(k)}
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: colors.text },
                  isTotal && styles.totalText,
                ]}
              >
                {metricValueFor(sec, k)}
              </Text>
            </View>
          ))}
        </View>
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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <PageHeader title="Sector" />

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
            Sector
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            {periodLabel}
          </Text>

          <View style={styles.filtersRow}>
            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.subtext }]}>
                Evento
              </Text>

              {hasMultipleEvents ? (
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
                    />
                  }
                  closeicon={
                    <Ionicons
                      name="chevron-up"
                      size={18}
                      color={colors.subtext}
                    />
                  }
                  boxStyles={StyleSheet.flatten([
                    styles.pickerWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      height: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                      alignItems: "center",
                    },
                  ])}
                  inputStyles={StyleSheet.flatten([
                    styles.pickerInput,
                    { color: colors.text },
                  ])}
                  dropdownStyles={{
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                  dropdownTextStyles={{ color: colors.text }}
                />
              ) : (
                <View
                  style={[
                    styles.pickerWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10, // permite 2 líneas si el nombre es largo
                      justifyContent: "center",
                      borderWidth: 1, // si querés igualar el “box” del SelectList
                    },
                  ]}
                >
                  <Text style={[styles.pickerInput, { color: colors.text }]}>
                    {singleEventLabel}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.subtext }]}>
                Función
              </Text>
              // dentro del JSX, en el bloque "Función"
              {hasMultipleSessions ? (
                <SelectList
                  key={`session-${selectedEventId}`} // mantiene tu refresh al cambiar evento
                  setSelected={(key: string) =>
                    setSelectedSessionId(String(key))
                  }
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
                  placeholder="Seleccioná una función"
                  search={false}
                  arrowicon={
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={colors.subtext}
                    />
                  }
                  closeicon={
                    <Ionicons
                      name="chevron-up"
                      size={18}
                      color={colors.subtext}
                    />
                  }
                  boxStyles={StyleSheet.flatten([
                    styles.pickerWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      height: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                      alignItems: "center",
                    },
                  ])}
                  inputStyles={StyleSheet.flatten([
                    styles.pickerInput,
                    { color: colors.text },
                  ])}
                  dropdownStyles={{
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                  dropdownTextStyles={{ color: colors.text }}
                />
              ) : (
                <View
                  style={[
                    styles.pickerWrap,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      justifyContent: "center",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.pickerInput, { color: colors.text }]}>
                    {singleSessionLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Chips */}
          <View style={styles.chipsRow}>
            <Chip
              label="Todo"
              active={selectedMetrics.size === 0}
              onPress={clearMetrics}
              colors={colors}
            />
            {METRICS.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                active={selectedMetrics.has(m.key)}
                onPress={() => toggleMetric(m.key)}
                colors={colors}
              />
            ))}
          </View>

          {/* Tabla apilada (sin scroll horizontal) */}
          <View style={styles.stackTable}>
            {orderedVisibleSectors.map((sec) => renderSectorRow(sec))}
            {renderSectorRow(totalsAsSector, true)}
          </View>
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
  filterBlock: { flex: 1, rowGap: 6 },
  filterLabel: { fontSize: 12 },

  pickerWrap: {
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
  },
  pickerInput: {
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: "center", // Android
    includeFontPadding: false as any, // Android (evita padding extra)
    flex: 1,
  },

  // Chips
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Stacked table
  stackTable: {
    marginTop: 6,
    borderRadius: 12,
    overflow: "hidden",
  },
  stackRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  stackSector: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCell: {
    flex: 1,
    alignItems: "flex-start", // clave para comparar números
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"], // mejora alineación visual (si está disponible)
  },

  totalText: {
    fontWeight: "900",
  },
});
