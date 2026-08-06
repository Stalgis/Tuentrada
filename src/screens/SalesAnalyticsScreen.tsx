import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import type { TabScreenNavigationProp } from "../navigation/types";
import { Dropdown } from "react-native-element-dropdown";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { MiniBarChart } from "../components/stitch/Charts";
import { formatCurrencyARS, formatDateLong, formatInteger } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import { fetchHistoryFor } from "../lib/apiClient";
import type { Event, EventFunction } from "../lib/types";
import type { HistoryDay } from "../lib/reportApi";

const allEventsOption = { key: "all", value: "Todos los eventos" };

const getEventRevenue = (event: Event) => event.grossRevenueARS ?? event.ticketsSold * event.ticketPriceARS;

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const toISOKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const buildLastNDays = (rows: HistoryDay[], n: number): HistoryDay[] => {
  const map = new Map<string, HistoryDay>();
  for (const row of rows) {
    const d = parseDayDate(row.day_date);
    if (d) map.set(toISOKey(d), row);
  }
  const result: HistoryDay[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = toISOKey(d);
    result.push(
      map.get(key) ?? {
        day_date: key,
        day_formatted: key,
        sold_tickets: 0,
        sold_guest: 0,
        total_tickets: 0,
        total_net: 0,
      },
    );
  }
  return result;
};

// Handles YYYY-MM-DD and DD/MM/YYYY without relying on Date string parsing
const parseDayDate = (s: string): Date | null => {
  if (!s) return null;
  // Matches YYYY-MM-DD with or without trailing time (e.g. "2026-04-08 00:00:00")
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dmySep = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmySep) return new Date(+dmySep[3], +dmySep[2] - 1, +dmySep[1]);
  return null;
};

const statusLabel = (status: string) => {
  if (status === "sold_out") return "AGOTADO";
  if (status === "finished") return "FINALIZADO";
  return "EN VENTA";
};

const statusColor = (status: string, palette: ReturnType<typeof getPalette>) => {
  if (status === "sold_out") return palette.warning;
  if (status === "finished") return palette.subtext;
  return palette.primary;
};

const SalesAnalyticsScreen = () => {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);
  const statsPending = events.statsPending;

  const [selectedEventId, setSelectedEventId] = useState("all");
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | undefined>(undefined);
  const [showAllFunctions, setShowAllFunctions] = useState(false);
  const [weekHistory, setWeekHistory] = useState<HistoryDay[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (events.status === "idle" && accessToken) loadEvents(accessToken);
  }, [events.status, loadEvents, accessToken]);

  // Fetch last 7 days of history when event selection changes
  useEffect(() => {
    if (!accessToken) return;
    setHistoryLoading(true);
    setSelectedBarIndex(undefined);
    fetchHistoryFor(accessToken, undefined)
      .then((result) => {
        setWeekHistory(buildLastNDays(result.rows, 7));
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [accessToken, selectedEventId]);

  const activeEvents = useMemo(
    () => events.data.filter((event) => event.status !== "finished"),
    [events.data],
  );

  useEffect(() => {
    if (activeEvents.length === 1) {
      setSelectedEventId(activeEvents[0].id);
    } else if (selectedEventId !== "all" && !activeEvents.some((e) => e.id === selectedEventId)) {
      setSelectedEventId("all");
    }
  }, [activeEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => activeEvents.find((e) => e.id === selectedEventId) ?? null,
    [activeEvents, selectedEventId],
  );

  const visibleEvents = useMemo(
    () => (selectedEvent ? [selectedEvent] : activeEvents),
    [activeEvents, selectedEvent],
  );
  const visibleStatsUnavailable =
    statsPending || visibleEvents.some((event) => event.statsStatus === "error");

  const eventOptions = useMemo(
    () => [allEventsOption, ...activeEvents.map((e) => ({ key: e.id, value: e.name }))],
    [activeEvents],
  );

  const totalRevenue = useMemo(
    () => visibleEvents.reduce((sum, e) => sum + getEventRevenue(e), 0),
    [visibleEvents],
  );
  const totalTicketsSold = useMemo(
    () => visibleEvents.reduce((sum, e) => sum + e.ticketsSold, 0),
    [visibleEvents],
  );
  const totalInvitations = useMemo(
    () =>
      visibleEvents.reduce(
        (sum, e) =>
          sum + (e.functions?.reduce((s, f) => s + (f.invitations ?? 0), 0) ?? e.invitations ?? 0),
        0,
      ),
    [visibleEvents],
  );

  // Weekly bar chart data (last 7 days from history)
  const weeklyTrend = useMemo(
    () =>
      weekHistory.map((day) => {
        const d = parseDayDate(day.day_date);
        const label = d ? `${DAY_NAMES[d.getDay()]}\n${d.getDate()}` : day.day_formatted.slice(0, 5);
        return {
          label,
          value: day.total_net,
          valueLabel: formatCurrencyARS(day.total_net),
        };
      }),
    [weekHistory],
  );

  // Functions of the selected event (sorted by date)
  const selectedFunctions: EventFunction[] = useMemo(() => {
    if (!selectedEvent?.functions) return [];
    return [...selectedEvent.functions].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );
  }, [selectedEvent]);

  // Vista inicial: próximas 5 funciones en venta (on_sale y fecha futura).
  const initialFunctions = useMemo(() => {
    const now = Date.now();
    return selectedFunctions
      .filter((f) => f.status === "on_sale" && new Date(f.dateISO).getTime() >= now)
      .slice(0, 5);
  }, [selectedFunctions]);

  const visibleFunctions = showAllFunctions ? selectedFunctions : initialFunctions;
  const hiddenCount = selectedFunctions.length - initialFunctions.length;

  const pillLabel = selectedEvent
    ? `${selectedFunctions.length} función${selectedFunctions.length !== 1 ? "es" : ""}`
    : `${activeEvents.length} evento${activeEvents.length !== 1 ? "s" : ""} incluido${activeEvents.length !== 1 ? "s" : ""}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 34 }}>
        <AppHeader
          title="Ventas"
          subtitle={selectedEvent ? selectedEvent.name : "Rendimiento comercial consolidado"}
          pillLabel={pillLabel}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {/* Hero KPI */}
          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              {selectedEvent ? "Total recaudado — todas las funciones" : "Total recaudado"}
            </Text>
            <Text style={{ color: palette.text, fontSize: 36, fontWeight: "800", marginTop: 8 }}>
              {visibleStatsUnavailable ? "—" : formatCurrencyARS(totalRevenue)}
            </Text>
          </SurfaceCard>

          {/* Dropdown selector — solo si hay más de 1 evento activo */}
          {activeEvents.length > 1 && (
            <SurfaceCard style={{ paddingVertical: 16, borderWidth: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Evento
              </Text>
              <Dropdown
                data={eventOptions}
                value={selectedEventId}
                labelField="value"
                valueField="key"
                onChange={(item) => {
                  setSelectedEventId(String(item.key));
                  setShowAllFunctions(false);
                }}
                style={{
                  marginTop: 14,
                  minHeight: 56,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme === "dark" ? palette.border : palette.primarySoft,
                  backgroundColor: palette.surface,
                  paddingHorizontal: 16,
                }}
                containerStyle={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  overflow: "hidden",
                }}
                placeholderStyle={{ color: palette.subtext, fontSize: 15 }}
                selectedTextStyle={{ color: palette.text, fontSize: 15, fontWeight: "700" }}
                itemTextStyle={{ color: palette.text, fontSize: 15 }}
                activeColor={theme === "dark" ? palette.surfaceMuted : palette.primarySoft}
                iconColor={palette.primary}
                maxHeight={320}
                placeholder="Seleccioná un evento"
              />
            </SurfaceCard>
          )}

          {/* Entradas vendidas e invitaciones */}
          <SurfaceCard>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Entradas vendidas</Text>
                <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                  {visibleStatsUnavailable ? "—" : formatInteger(totalTicketsSold)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Invitaciones</Text>
                <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                  {visibleStatsUnavailable ? "—" : formatInteger(totalInvitations)}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          {/* Weekly sales chart */}
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Ingresos semanales</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
              Últimos 7 días · tocá una barra para ver el monto
            </Text>
            {historyLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 24, marginBottom: 8 }} />
            ) : weeklyTrend.length > 0 ? (
              <>
                <MiniBarChart
                  data={weeklyTrend}
                  selectedIndex={selectedBarIndex}
                  onBarPress={(i) => setSelectedBarIndex((prev) => (prev === i ? undefined : i))}
                  barAreaHeight={120}
                />
                {selectedBarIndex != null && weekHistory[selectedBarIndex] && (() => {
                  const row = weekHistory[selectedBarIndex];
                  const d = parseDayDate(row.day_date);
                  const dateLabel = d
                    ? new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short" }).format(d)
                    : row.day_formatted;
                  return (
                    <View
                      style={{
                        marginTop: 14,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: palette.primarySoft,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
                        {dateLabel}
                      </Text>
                      <Text style={{ color: palette.primary, fontSize: 15, fontWeight: "800" }}>
                        {formatCurrencyARS(row.total_net)}
                      </Text>
                    </View>
                  );
                })()}
              </>
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 16 }}>
                Sin datos para los últimos 7 días.
              </Text>
            )}
          </SurfaceCard>

          {/* When a specific event is selected: list its functions */}
          {selectedEvent ? (
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Funciones</Text>
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                Tocá una función para ver su detalle
              </Text>
              <View style={{ marginTop: 16, gap: 8 }}>
                {visibleFunctions.map((fn) => (
                  <Pressable
                    key={fn.id}
                    onPress={() =>
                      navigation.navigate("Events", {
                        screen: "FunctionDetail",
                        params: { functionId: fn.id },
                      })
                    }
                    style={({ pressed }) => ({
                      backgroundColor: palette.surfaceMuted,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {/* Row 1: date + status badge + chevron */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700", flex: 1 }}>
                        {formatDateLong(fn.dateISO)}
                      </Text>
                      <View
                        style={{
                          backgroundColor: statusColor(fn.status, palette),
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginLeft: 8,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                          {statusLabel(fn.status)}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={palette.subtext} style={{ marginLeft: 6 }} />
                    </View>
                    {/* Row 2: tickets + invitations */}
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>
                      {statsPending || fn.statsStatus === "error"
                        ? "—"
                        : `${formatInteger(fn.ticketsSold)} entradas${fn.invitations > 0 ? ` · ${formatInteger(fn.invitations)} invitaciones` : ""}`}
                    </Text>
                    {/* Row 3: revenue */}
                    <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                      {statsPending || fn.statsStatus === "error" ? "—" : formatCurrencyARS(fn.grossRevenueARS)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Ver todo / Ocultar */}
              {hiddenCount > 0 && (
                <Pressable
                  onPress={() => setShowAllFunctions((v) => !v)}
                  style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}
                >
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
                    {showAllFunctions ? "Ver menos" : `Ver todas (${hiddenCount} más)`}
                  </Text>
                </Pressable>
              )}
            </SurfaceCard>
          ) : (
            /* When all events: ranking by revenue */
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Ranking de eventos</Text>
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                Ordenados por ingresos totales
              </Text>
              <View style={{ marginTop: 16, gap: 8 }}>
                {statsPending ? (
                  <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
                ) : (
                  [...visibleEvents]
                    .filter((event) => event.statsStatus !== "error")
                    .sort((a, b) => getEventRevenue(b) - getEventRevenue(a))
                    .map((event, index) => (
                    <Pressable
                      key={event.id}
                      onPress={() =>
                        navigation.navigate("Events", {
                          screen: "EventDetail",
                          params: { eventId: event.id },
                        })
                      }
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: palette.surfaceMuted,
                        borderRadius: 16,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: "800", width: 24 }}>
                        #{index + 1}
                      </Text>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                          {event.name}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2 }}>
                          {event.functions?.length ?? 1} función{(event.functions?.length ?? 1) !== 1 ? "es" : ""} · {formatInteger(event.ticketsSold)} entradas
                        </Text>
                      </View>
                      <Text style={{ color: palette.text, fontSize: 14, fontWeight: "800" }}>
                        {formatCurrencyARS(getEventRevenue(event))}
                      </Text>
                    </Pressable>
                    ))
                )}
              </View>
            </SurfaceCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SalesAnalyticsScreen;
