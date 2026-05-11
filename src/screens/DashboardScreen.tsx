import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { fetchGlobalStats, type StatsData } from "../lib/apiClient";
import { formatCurrencyARS, formatDateShort, formatInteger, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { Event, EventFunction } from "../lib/types";
import type { TabScreenNavigationProp } from "../navigation/types";

const statusLabel: Record<Event["status"], string> = {
  on_sale: "En venta",
  sold_out: "Agotado",
  finished: "Finalizado",
};

type AttentionFunction = EventFunction & { eventName: string };

const DashboardScreen = () => {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const [thisMonthStats, setThisMonthStats] = useState<StatsData | null>(null);
  const [lastMonthStats, setLastMonthStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (events.status === "idle" && accessToken) {
      loadEvents(accessToken);
    }
  }, [events.status, loadEvents, accessToken]);

  useEffect(() => {
    if (!accessToken || statsLoading || thisMonthStats) return;
    setStatsLoading(true);
    Promise.all([
      fetchGlobalStats(accessToken, "this_month"),
      fetchGlobalStats(accessToken, "last_month"),
    ])
      .then(([cur, prev]) => {
        setThisMonthStats(cur);
        setLastMonthStats(prev);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [accessToken, statsLoading, thisMonthStats]);

  const upcomingEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => new Date(event.dateISO).getTime() >= Date.now())
        .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()),
    [events.data],
  );

  const primaryEvent = upcomingEvents[0];

  // Flatten all upcoming, on-sale functions across all events and rank by lowest sales
  const attentionFunctions = useMemo<AttentionFunction[]>(() => {
    const now = Date.now();
    const all: AttentionFunction[] = [];
    for (const event of events.data) {
      if (!event.functions) continue;
      for (const fn of event.functions) {
        if (fn.status !== "on_sale") continue;
        const t = new Date(fn.dateISO).getTime();
        if (isNaN(t) || t < now) continue;
        all.push({ ...fn, eventName: event.name });
      }
    }
    return all.sort((a, b) => a.ticketsSold - b.ticketsSold).slice(0, 3);
  }, [events.data]);

  const thisMonth = thisMonthStats?.total ?? 0;
  const lastMonth = lastMonthStats?.total ?? 0;
  const monthDeltaPercent = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  const thisMonthTickets = thisMonthStats?.tickets ?? 0;
  const ticketMedio = thisMonthStats?.ticket_medio ?? 0;
  const primaryEventRevenue = primaryEvent?.grossRevenueARS ?? 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 34 }}>
        <AppHeader
          title="Ingresos"
          pillLabel={`${upcomingEvents.length} eventos activos`}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard tone="hero">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                  Ingresos del mes
                </Text>
                {statsLoading ? (
                  <ActivityIndicator color={palette.primary} style={{ marginTop: 16, alignSelf: "flex-start" }} />
                ) : (
                  <>
                    <Text style={{ color: palette.text, fontSize: 32, fontWeight: "800", marginTop: 8, letterSpacing: -1 }}>
                      {formatCurrencyARS(thisMonth)}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                      {lastMonth > 0
                        ? `${monthDeltaPercent >= 0 ? "+" : ""}${formatPercent(monthDeltaPercent)} vs mes anterior`
                        : "Sin datos del mes anterior"}
                    </Text>
                  </>
                )}
              </View>
              <Pressable onPress={() => navigation.navigate("Analytics")}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Ver ventas</Text>
              </Pressable>
            </View>

            <View
              style={{
                marginTop: 16,
                backgroundColor: palette.surfaceMuted,
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 4,
              }}
            >
              {[
                { label: "Mes anterior", value: formatCurrencyARS(lastMonth) },
                { label: "Ticket promedio", value: formatCurrencyARS(ticketMedio) },
                { label: "Entradas", value: formatInteger(thisMonthTickets) },
              ].map((item, index, arr) => (
                <View
                  key={item.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: index < arr.length - 1 ? 1 : 0,
                    borderBottomColor: palette.hairline,
                  }}
                >
                  <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginLeft: 12 }}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Próximo evento</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                  El siguiente evento en calendario
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate("Events")}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Abrir catálogo</Text>
              </Pressable>
            </View>
            {events.status === "loading" ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 20, marginBottom: 8 }} />
            ) : events.status === "error" ? (
              <Text style={{ color: palette.danger, fontSize: 13, marginTop: 12 }}>
                No se pudieron cargar los eventos.
              </Text>
            ) : primaryEvent ? (
              <View style={{ marginTop: 16, backgroundColor: palette.surfaceMuted, borderRadius: 22, padding: 16 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{primaryEvent.name}</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                  {formatDateShort(primaryEvent.dateISO)} · {statusLabel[primaryEvent.status]}
                </Text>
                <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Ingresos</Text>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 3 }}>
                      {formatCurrencyARS(primaryEventRevenue)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Vendidas</Text>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 3 }}>
                      {formatInteger(primaryEvent.ticketsSold)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Requieren atención</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                  Funciones próximas con menor venta
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate("ExecutiveDashboard")}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Vista ejecutiva</Text>
              </Pressable>
            </View>
            <View style={{ gap: 10, marginTop: 16 }}>
              {events.status === "loading" ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
              ) : events.status === "error" ? (
                <Text style={{ color: palette.danger, fontSize: 13 }}>No se pudieron cargar los eventos.</Text>
              ) : null}
              {events.status === "success" && attentionFunctions.map((fn) => (
                <Pressable
                  key={fn.id}
                  onPress={() =>
                    navigation.navigate("Events", {
                      screen: "FunctionDetail",
                      params: { functionId: fn.id },
                    })
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: palette.surfaceMuted,
                      borderRadius: 18,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>
                        {fn.eventName}
                      </Text>
                      <Text numberOfLines={1} style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                        {formatDateShort(fn.dateISO)} · {formatInteger(fn.ticketsSold)} entradas
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={palette.subtext} style={{ marginLeft: 10 }} />
                  </View>
                </Pressable>
              ))}
              {events.status === "success" && attentionFunctions.length === 0 && (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  No hay funciones activas próximamente.
                </Text>
              )}
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
