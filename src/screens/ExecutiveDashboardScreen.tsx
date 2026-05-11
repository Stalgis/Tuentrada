import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { fetchGlobalStats, type StatsData } from "../lib/apiClient";
import { formatCurrencyARS, formatDateShort, formatInteger, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { AppStackParamList } from "../navigation/types";
import type { EventFunction } from "../lib/types";

type RankedFunction = EventFunction & { eventName: string };

const ExecutiveDashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
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

  const totalRevenue = thisMonthStats?.total ?? 0;
  const lastMonthRevenue = lastMonthStats?.total ?? 0;
  const ticketsSold = thisMonthStats?.tickets ?? 0;
  const uniqueBuyers = thisMonthStats?.unique_buyers ?? 0;
  const growthPercent = lastMonthRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  // Flatten all functions across all events
  const allFunctions = useMemo<RankedFunction[]>(() => {
    const result: RankedFunction[] = [];
    for (const event of events.data) {
      if (!event.functions) continue;
      for (const fn of event.functions) {
        result.push({ ...fn, eventName: event.name });
      }
    }
    return result;
  }, [events.data]);

  const activeEvents = useMemo(
    () => allFunctions.filter((f) => f.status === "on_sale").length,
    [allFunctions],
  );

  // Goal: 50% above last month's revenue
  const goal = lastMonthRevenue > 0 ? lastMonthRevenue * 1.5 : totalRevenue * 1.5;
  const goalProgress = goal > 0 ? Math.min(100, (totalRevenue / goal) * 100) : 0;

  // Top functions by grossRevenueARS
  const topFunctions = useMemo(
    () =>
      [...allFunctions]
        .filter((f) => (f.grossRevenueARS ?? 0) > 0)
        .sort((a, b) => (b.grossRevenueARS ?? 0) - (a.grossRevenueARS ?? 0))
        .slice(0, 5),
    [allFunctions],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader
          title="Ejecutivo"
          subtitle="Lectura de negocio para dirección"
          pillLabel={events.data.length > 0 ? `${activeEvents} funciones activas` : "Snapshot ejecutivo"}
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Ingresos del mes
            </Text>
            {statsLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 16, alignSelf: "flex-start" }} />
            ) : (
              <>
                <Text style={{ color: palette.text, fontSize: 34, fontWeight: "800", marginTop: 10 }}>
                  {formatCurrencyARS(totalRevenue)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
                  <Text style={{ color: growthPercent >= 0 ? palette.success : palette.danger, fontSize: 13, fontWeight: "700" }}>
                    {growthPercent >= 0 ? "+" : ""}{formatPercent(growthPercent)} vs mes anterior
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 13 }}>
                    {formatPercent(goalProgress)} del objetivo
                  </Text>
                </View>
                <View style={{ marginTop: 14, height: 10, borderRadius: 999, backgroundColor: palette.surfaceMuted, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${goalProgress}%`,
                      height: "100%",
                      backgroundColor: palette.primary,
                      borderRadius: 999,
                    }}
                  />
                </View>
              </>
            )}
          </SurfaceCard>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Entradas vendidas</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(ticketsSold)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>este mes</Text>
            </SurfaceCard>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Compradores únicos</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(uniqueBuyers)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 4 }}>este mes</Text>
            </SurfaceCard>
          </View>

          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Funciones top</Text>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>Por ingreso acumulado</Text>
            </View>

            {events.status === "loading" ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <View style={{ gap: 10 }}>
                {topFunctions.map((fn, index) => (
                  <Pressable
                    key={fn.id}
                    onPress={() =>
                      navigation.navigate("Tabs", {
                        screen: "Events",
                        params: { screen: "FunctionDetail", params: { functionId: fn.id } },
                      })
                    }
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                  >
                    <SurfaceCard>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: palette.primarySoft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: palette.primary, fontSize: 14, fontWeight: "800" }}>
                            #{index + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                            {fn.eventName}
                          </Text>
                          <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                            {formatDateShort(fn.dateISO)} · {formatInteger(fn.ticketsSold)} entradas
                          </Text>
                        </View>
                        <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800" }}>
                          {formatCurrencyARS(fn.grossRevenueARS ?? 0)}
                        </Text>
                      </View>
                    </SurfaceCard>
                  </Pressable>
                ))}
                {topFunctions.length === 0 && (
                  <Text style={{ color: palette.subtext, fontSize: 13 }}>
                    No hay datos de funciones disponibles.
                  </Text>
                )}
              </View>
            )}
          </View>

          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 8,
              backgroundColor: palette.primary,
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Volver al resumen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ExecutiveDashboardScreen;
