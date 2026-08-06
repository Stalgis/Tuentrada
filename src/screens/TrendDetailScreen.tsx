import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { MiniBarChart } from "../components/stitch/Charts";
import { formatCurrencyARS, formatInteger } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { AppStackParamList } from "../navigation/types";
import type { Event } from "../lib/types";

type TrendDetailRoute = RouteProp<AppStackParamList, "TrendDetail">;

const formatDate = (dateISO: string) => {
  const d = new Date(dateISO);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${min}`;
};

const shortLabel = (name: string) => name.split(" ")[0].slice(0, 7);

const getRevenue = (event: Event) => event.grossRevenueARS ?? event.ticketsSold * event.ticketPriceARS;

const TrendDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<TrendDetailRoute>();
  const { eventId, selectedIndex } = route.params;
  const { theme, events } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);
  const statsPending = events.statsPending;

  // Visible events based on eventId param
  const visibleEvents = useMemo(() => {
    if (eventId === "all") return events.data;
    return events.data.filter((e) => e.id === eventId);
  }, [eventId, events.data]);

  const headerTitle = useMemo(() => {
    if (eventId === "all") return "Vista consolidada";
    return events.data.find((e) => e.id === eventId)?.name ?? "Detalle de función";
  }, [eventId, events.data]);

  const [selectedIdx, setSelectedIdx] = useState(() => {
    const initial = selectedIndex ?? 0;
    return Math.min(initial, Math.max(0, visibleEvents.length - 1));
  });

  const selectedEvent = visibleEvents[selectedIdx] ?? null;
  const visibleStatsUnavailable =
    statsPending || visibleEvents.some((event) => event.statsStatus === "error");

  // Bar chart data
  const chartData = useMemo(
    () =>
      visibleEvents.slice(0, 6).map((e) => ({
        label: shortLabel(e.name),
        value: Math.max(1, Math.round(getRevenue(e) / 1_000_000)),
      })),
    [visibleEvents],
  );

  // Summary stats
  const totalRevenue = useMemo(
    () => visibleEvents.reduce((sum, e) => sum + getRevenue(e), 0),
    [visibleEvents],
  );
  const totalTickets = useMemo(
    () => visibleEvents.reduce((sum, e) => sum + e.ticketsSold, 0),
    [visibleEvents],
  );
  const bestEvent = useMemo(
    () =>
      visibleEvents.length
        ? visibleEvents.reduce((best, e) => (getRevenue(e) > getRevenue(best) ? e : best))
        : null,
    [visibleEvents],
  );
  const avgRevenue = visibleEvents.length ? totalRevenue / visibleEvents.length : 0;

  // Sorted list: highest revenue first
  const rankedEvents = useMemo(
    () =>
      visibleEvents
        .map((e, originalIdx) => ({ event: e, originalIdx }))
        .sort((a, b) => getRevenue(b.event) - getRevenue(a.event)),
    [visibleEvents],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <AppHeader
          title={headerTitle}
          subtitle={eventId === "all" ? "Todas las funciones activas" : "Detalle de función"}
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>

          {/* Hero de la función seleccionada */}
          {selectedEvent ? (
            <SurfaceCard tone="hero">
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {formatDate(selectedEvent.dateISO)}
              </Text>
              <Text style={{ color: palette.text, fontSize: 34, fontWeight: "800", marginTop: 8, letterSpacing: -1 }}>
                {visibleStatsUnavailable ? "—" : formatCurrencyARS(getRevenue(selectedEvent))}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 14, marginTop: 6 }}>
                {visibleStatsUnavailable ? "Estadísticas no disponibles" : `${formatInteger(selectedEvent.ticketsSold)} entradas vendidas`}
              </Text>
            </SurfaceCard>
          ) : null}

          {/* Gráfico comparativo por función */}
          {chartData.length > 0 && (
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Ingresos por función</Text>
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                Tocá una barra para ver el detalle
              </Text>
              {visibleStatsUnavailable ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 28 }} />
              ) : (
                <MiniBarChart
                  data={chartData}
                  highlightIndex={selectedIdx < chartData.length ? selectedIdx : undefined}
                />
              )}
            </SurfaceCard>
          )}

          {/* Resumen del período */}
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Resumen del período</Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 14 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                  Total ingresos
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 17, fontWeight: "800", marginTop: 6 }}
                >
                  {visibleStatsUnavailable ? "—" : formatCurrencyARS(totalRevenue)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }}>
                  {visibleStatsUnavailable ? "—" : `${formatInteger(totalTickets)} entradas`}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 14 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                  Mejor función
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 17, fontWeight: "800", marginTop: 6 }}
                >
                  {!visibleStatsUnavailable && bestEvent ? formatCurrencyARS(getRevenue(bestEvent)) : "—"}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }} numberOfLines={1}>
                  {!visibleStatsUnavailable && bestEvent ? bestEvent.name.split(" ")[0] : ""}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 14 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                  Promedio
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 17, fontWeight: "800", marginTop: 6 }}
                >
                  {visibleStatsUnavailable ? "—" : formatCurrencyARS(avgRevenue)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }}>
                  por función
                </Text>
              </View>
            </View>
          </SurfaceCard>

          {/* Lista de funciones */}
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Detalle por función</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
              Mayor ingreso primero
            </Text>
            <View style={{ marginTop: 16, gap: 8 }}>
              {visibleStatsUnavailable ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
              ) : rankedEvents.map(({ event, originalIdx }) => {
                const isSelected = originalIdx === selectedIdx;
                return (
                  <Pressable
                    key={event.id}
                    onPress={() => setSelectedIdx(originalIdx)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: isSelected
                        ? theme === "dark"
                          ? palette.surfaceEmphasis
                          : palette.primarySoft
                        : palette.surfaceMuted,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: isSelected ? palette.primary : palette.text, fontSize: 13, fontWeight: "700" }}
                        numberOfLines={1}
                      >
                        {event.name}
                      </Text>
                      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                        {formatDate(event.dateISO)} · {formatInteger(event.ticketsSold)} entradas
                      </Text>
                    </View>
                    <Text style={{ color: isSelected ? palette.primary : palette.text, fontSize: 14, fontWeight: "800" }}>
                      {formatCurrencyARS(getRevenue(event))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SurfaceCard>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrendDetailScreen;
