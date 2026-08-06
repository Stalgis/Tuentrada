import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { invalidateEventsCache } from "../lib/apiClient";
import { formatCurrencyARS, formatDateTimeShort, formatInteger, formatPercent, formatTimeShort } from "../lib/formatters";
import { useGlobalStats } from "../hooks/useGlobalStats";
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
  const { theme, events, loadEvents, retryFailedStats } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const {
    thisMonth: thisMonthStats,
    lastMonth: lastMonthStats,
    thisMonthLoading,
    lastMonthLoading,
    thisMonthError,
    lastMonthError,
    lastUpdated,
    retry: retryGlobalStats,
  } = useGlobalStats(accessToken);

  useEffect(() => {
    if (events.status === "idle" && accessToken) {
      loadEvents(accessToken);
    }
  }, [events.status, loadEvents, accessToken]);

  // Refresca datos en vivo (stats + eventos) sin cerrar sesión.
  const handleRefresh = useCallback(async () => {
    if (!accessToken || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    // Limpiamos la caché para forzar una lectura fresca del backend.
    invalidateEventsCache();
    try {
      await Promise.all([
        retryGlobalStats(),
        loadEvents(accessToken, true),
      ]);
    } catch {
      // Silencioso: los estados de error de eventos ya se muestran en la UI.
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [accessToken, loadEvents, retryGlobalStats]);

  const upcomingEvents = useMemo(
    () =>
      [...events.data]
        .filter((event) => new Date(event.dateISO).getTime() >= Date.now())
        .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()),
    [events.data],
  );

  const primaryEvent = upcomingEvents[0];

  // La próxima función concreta del próximo evento (no el agregado de todas).
  const primaryFunction = useMemo(() => {
    const fns = primaryEvent?.functions;
    if (!fns?.length) return undefined;
    const now = Date.now();
    const upcoming = fns
      .filter((f) => new Date(f.dateISO).getTime() >= now)
      .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
    return upcoming[0] ?? fns[0];
  }, [primaryEvent]);

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
  const availableAttentionFunctions = useMemo(
    () => attentionFunctions.filter((fn) => fn.statsStatus !== "error"),
    [attentionFunctions],
  );

  const thisMonth = thisMonthStats?.total ?? 0;
  const lastMonth = lastMonthStats?.total ?? 0;
  const monthDeltaPercent = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
  const thisMonthTickets = thisMonthStats?.tickets ?? 0;
  const thisMonthInvitations = thisMonthStats?.invitations ?? 0;
  const ticketMedio = thisMonthStats?.ticket_medio ?? 0;
  const primaryEventRevenue = primaryFunction?.grossRevenueARS ?? 0;
  // Los eventos ya son listables pero sus importes valen 0 hasta que termina el
  // fan-out de stats: mostramos un marcador en lugar de cifras engañosas.
  const statsPending = events.statsPending;
  const primaryStatsUnavailable = statsPending || primaryFunction?.statsStatus === "error";

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
          {events.error && events.data.length > 0 ? (
            <View
              style={{
                backgroundColor: palette.surfaceMuted,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: palette.warning,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: "700" }}>
                No se pudo actualizar. Mostrando los datos anteriores.
              </Text>
            </View>
          ) : null}

          {events.failedStatsIds.length > 0 ? (
            <View
              style={{
                backgroundColor: palette.surfaceMuted,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: palette.warning,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: "700", flex: 1 }}>
                Faltan estadísticas de {events.failedStatsIds.length} funciones.
              </Text>
              <Pressable
                disabled={events.statsRetrying || !accessToken}
                onPress={() => accessToken && retryFailedStats(accessToken)}
              >
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: "800" }}>
                  {events.statsRetrying ? "Reintentando…" : "Reintentar"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <SurfaceCard tone="hero">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                  Ingresos del mes
                </Text>
                {thisMonthLoading && !thisMonthStats ? (
                  <ActivityIndicator color={palette.primary} style={{ marginTop: 16, alignSelf: "flex-start" }} />
                ) : !thisMonthStats ? (
                  <View style={{ marginTop: 12, alignItems: "flex-start", gap: 8 }}>
                    <Text style={{ color: palette.danger, fontSize: 13 }}>
                      No se pudieron cargar los ingresos del mes.
                    </Text>
                    <Pressable onPress={retryGlobalStats}>
                      <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Reintentar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                      style={{ color: palette.text, fontSize: 32, fontWeight: "800", marginTop: 8, letterSpacing: -1 }}
                    >
                      {formatCurrencyARS(thisMonth)}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                      {lastMonthLoading
                        ? "Cargando comparación…"
                        : lastMonthError || !lastMonthStats
                          ? "Mes anterior no disponible"
                          : lastMonth > 0
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
                {
                  label: "Mes anterior",
                  value: lastMonthLoading || lastMonthError || !lastMonthStats ? "—" : formatCurrencyARS(lastMonth),
                },
                { label: "Ticket promedio", value: formatCurrencyARS(ticketMedio) },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
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

              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
                {[
                  { label: "Entradas", value: formatInteger(thisMonthTickets) },
                  { label: "Invitaciones", value: formatInteger(thisMonthInvitations) },
                ].map((item) => (
                  <View key={item.label} style={{ flex: 1 }}>
                    <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>
                      {item.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 2 }}
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {(thisMonthError || lastMonthError) && thisMonthStats ? (
              <Pressable onPress={retryGlobalStats} style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: "700" }}>
                  Reintentar estadísticas
                </Text>
              </Pressable>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
              }}
            >
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "600" }}>
                {lastUpdated
                  ? `Actualizado ${formatTimeShort(lastUpdated)}`
                  : "Actualizando…"}
              </Text>
              <Pressable
                onPress={handleRefresh}
                disabled={refreshing}
                accessibilityRole="button"
                accessibilityLabel="Actualizar datos"
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: palette.surfaceMuted,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: palette.hairline,
                  opacity: refreshing ? 0.6 : 1,
                }}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Feather name="refresh-cw" size={13} color={palette.primary} />
                )}
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: "700" }}>
                  {refreshing ? "Actualizando" : "Actualizar"}
                </Text>
              </Pressable>
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
              <Pressable
                disabled={!primaryFunction}
                onPress={() =>
                  primaryFunction &&
                  navigation.navigate("Events", {
                    screen: "FunctionDetail",
                    params: { functionId: primaryFunction.id },
                  })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ marginTop: 16, backgroundColor: palette.surfaceMuted, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{primaryEvent.name}</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                  {formatDateTimeShort(primaryFunction?.dateISO ?? primaryEvent.dateISO)} · {statusLabel[primaryFunction?.status ?? primaryEvent.status]}
                </Text>
                <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Ingresos</Text>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 3 }}>
                      {primaryStatsUnavailable ? "—" : formatCurrencyARS(primaryEventRevenue)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Vendidas</Text>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800", marginTop: 3 }}>
                      {primaryStatsUnavailable ? "—" : formatInteger(primaryFunction?.ticketsSold ?? 0)}
                    </Text>
                  </View>
                </View>
                </View>
                <Feather name="chevron-right" size={20} color={palette.subtext} style={{ marginLeft: 12 }} />
                </View>
              </Pressable>
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
              {/* El ranking es por menor venta: sin importes el orden sería
                  arbitrario, así que esperamos a tenerlos. */}
              {events.status === "loading" || statsPending ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 8 }} />
              ) : events.status === "error" ? (
                <Text style={{ color: palette.danger, fontSize: 13 }}>No se pudieron cargar los eventos.</Text>
              ) : null}
              {events.status === "success" && !statsPending && availableAttentionFunctions.map((fn) => (
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
                        {formatDateTimeShort(fn.dateISO)} · {formatInteger(fn.ticketsSold)} entradas
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={palette.subtext} style={{ marginLeft: 10 }} />
                  </View>
                </Pressable>
              ))}
              {events.status === "success" && !statsPending && availableAttentionFunctions.length === 0 && (
                <Text style={{ color: palette.subtext, fontSize: 13 }}>
                  {events.failedStatsIds.length > 0
                    ? "No hay suficientes estadísticas para armar este ranking."
                    : "No hay funciones activas próximamente."}
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
