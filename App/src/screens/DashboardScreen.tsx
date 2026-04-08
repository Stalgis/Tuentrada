import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { dailySales } from "../data/salesStats";
import {
  formatCurrencyARS,
  formatDateShort,
  formatInteger,
  formatPercent,
} from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { Event } from "../lib/types";

const statusLabel: Record<Event["status"], string> = {
  on_sale: "En venta",
  sold_out: "Agotado",
  finished: "Finalizado",
};

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const upcomingEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => new Date(event.dateISO).getTime() >= Date.now())
        .sort((left, right) => new Date(left.dateISO).getTime() - new Date(right.dateISO).getTime()),
    [events.data]
  );

  const primaryEvent = upcomingEvents[0];
  const requiresAttention = useMemo(
    () =>
      [...upcomingEvents]
        .filter((event) => (event.velocity ?? 0) < 70 || (event.checkInProgress ?? 100) < 50)
        .sort((left, right) => (left.velocity ?? 0) - (right.velocity ?? 0))
        .slice(0, 3),
    [upcomingEvents]
  );
  const recentDailySales = useMemo(() => dailySales.slice(-7), []);
  const todayRevenue = recentDailySales.at(-1)?.revenueARS ?? 0;
  const yesterdayRevenue = recentDailySales.at(-2)?.revenueARS ?? 0;
  const weeklyRevenue = useMemo(
    () => recentDailySales.reduce((total, day) => total + day.revenueARS, 0),
    [recentDailySales]
  );
  const previousDailySales = useMemo(() => dailySales.slice(-14, -7), []);
  const previousWeekRevenue = useMemo(
    () => previousDailySales.reduce((total, day) => total + day.revenueARS, 0),
    [previousDailySales]
  );
  const averageDailyRevenue = recentDailySales.length > 0 ? weeklyRevenue / recentDailySales.length : 0;
  const bestRevenueDay = useMemo(
    () =>
      recentDailySales.reduce(
        (best, day) => (day.revenueARS > best.revenueARS ? day : best),
        recentDailySales[0] ?? { dateISO: "", ticketsSold: 0, revenueARS: 0 }
      ),
    [recentDailySales]
  );
  const revenueDeltaPercent =
    yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
  const projectedMonthlyRevenue = averageDailyRevenue * 30;
  const weeklyGrowthPercent =
    previousWeekRevenue > 0 ? ((weeklyRevenue - previousWeekRevenue) / previousWeekRevenue) * 100 : 0;
  const primaryEventRevenue = primaryEvent ? primaryEvent.ticketsSold * primaryEvent.ticketPriceARS : 0;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 34 }}>
        <AppHeader
          title="Ingresos"
          pillLabel={`${upcomingEvents.length || 0} eventos activos`}
          onAvatarPress={() => navigation.navigate("Profile" as never)}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard tone="hero">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                  Ingresos del dia
                </Text>
                <Text style={{ color: palette.text, fontSize: 32, fontWeight: "800", marginTop: 8, letterSpacing: -1 }}>
                  {formatCurrencyARS(todayRevenue)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                  {yesterdayRevenue > 0
                    ? `${revenueDeltaPercent >= 0 ? "+" : ""}${formatPercent(revenueDeltaPercent)} vs ayer`
                    : "Todavia no hay comparativa diaria disponible"}
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate("Analytics" as never)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Ver ventas</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700" }}>Ultimos 7 dias</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 6 }}
                >
                  {formatCurrencyARS(weeklyRevenue)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700" }}>Promedio</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 6 }}
                >
                  {formatCurrencyARS(averageDailyRevenue)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 18, padding: 12 }}>
                <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700" }}>Mejor dia</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 6 }}
                >
                  {formatCurrencyARS(bestRevenueDay.revenueARS)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 10, marginTop: 4 }}>
                  {bestRevenueDay.dateISO ? formatDateShort(bestRevenueDay.dateISO) : "Sin datos"}
                </Text>
              </View>
            </View>
            <View
              style={{
                marginTop: 16,
                backgroundColor: palette.surfaceMuted,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderWidth: 1,
                borderColor: palette.hairline,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                Proyeccion a 30 dias
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{ color: palette.text, fontSize: 24, fontWeight: "800", flex: 1, marginRight: 12 }}
                >
                  {formatCurrencyARS(projectedMonthlyRevenue)}
                </Text>
                <View
                  style={{
                    backgroundColor: weeklyGrowthPercent >= 0 ? `${palette.success}22` : `${palette.danger}22`,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      color: weeklyGrowthPercent >= 0 ? palette.success : palette.danger,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {weeklyGrowthPercent >= 0 ? "+" : ""}
                    {formatPercent(weeklyGrowthPercent)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                Manteniendo el promedio diario actual. Comparado contra la semana anterior.
              </Text>
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
              <Pressable onPress={() => navigation.navigate("Events" as never)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Abrir catalogo</Text>
              </Pressable>
            </View>
            {primaryEvent ? (
              <View
                style={{
                  marginTop: 16,
                  backgroundColor: palette.surfaceMuted,
                  borderRadius: 22,
                  padding: 16,
                }}
              >
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{primaryEvent.name}</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                  {formatDateShort(primaryEvent.dateISO)} • {primaryEvent.venue} • {statusLabel[primaryEvent.status]}
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
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Ocupacion</Text>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 3 }}>
                      {formatPercent((primaryEvent.ticketsSold / Math.max(primaryEvent.ticketsAvailable, 1)) * 100)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Requiere atencion</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                  Eventos con menor traccion o check-in
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate("ExecutiveDashboard" as never)}>
                <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Vista ejecutiva</Text>
              </Pressable>
            </View>
            <View style={{ gap: 12, marginTop: 16 }}>
              {requiresAttention.map((event) => (
                <View
                  key={event.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: palette.surfaceMuted,
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: palette.warning,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="alert-circle" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>{event.name}</Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                      {event.venue} • velocidad {formatPercent(event.velocity ?? 0)}
                    </Text>
                  </View>
                  <Text style={{ color: palette.text, fontSize: 12, fontWeight: "700" }}>
                    {formatPercent(event.checkInProgress ?? 0)}
                  </Text>
                </View>
              ))}
              {requiresAttention.length === 0 ? (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  No hay alertas operativas para los eventos activos.
                </Text>
              ) : null}
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
