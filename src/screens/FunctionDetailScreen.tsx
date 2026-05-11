import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { EventsStackParamList, EventsScreenNavigationProp } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { MiniBarChart, ProgressRing } from "../components/stitch/Charts";
import { fetchSectors, fetchHistoryFor, type Sector } from "../lib/apiClient";
import { formatCurrencyARS, formatDateLong, formatInteger, formatPercent } from "../lib/formatters";
import type { HistoryDay } from "../lib/reportApi";

type FunctionRoute = RouteProp<EventsStackParamList, "FunctionDetail">;

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const parseDayDate = (s: string): Date | null => {
  if (!s) return null;
  // Matches YYYY-MM-DD with or without trailing time (e.g. "2026-04-08 00:00:00")
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dmySep = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmySep) return new Date(+dmySep[3], +dmySep[2] - 1, +dmySep[1]);
  return null;
};

const toISOKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Generates the last N calendar days and fills with API data where available.
// Gaps are impossible because we drive from today backwards, not from the API range.
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

const FunctionDetailScreen = () => {
  const navigation = useNavigation<EventsScreenNavigationProp>();
  const route = useRoute<FunctionRoute>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [weekHistory, setWeekHistory] = useState<HistoryDay[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | undefined>(undefined);

  const functionId = route.params.functionId;

  useEffect(() => {
    if (events.status === "idle" && accessToken) loadEvents(accessToken);
  }, [events.status, loadEvents, accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    setSectorsLoading(true);
    fetchSectors(accessToken, functionId)
      .then(setSectors)
      .catch(() => {})
      .finally(() => setSectorsLoading(false));
  }, [accessToken, functionId]);

  useEffect(() => {
    if (!accessToken) return;
    setHistoryLoading(true);
    setSelectedBarIndex(undefined);
    fetchHistoryFor(accessToken, functionId)
      .then((result) => {
        setWeekHistory(buildLastNDays(result.rows, 14));
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [accessToken, functionId]);

  const event = useMemo(
    () => events.data.find(
      (e) => e.id === functionId || e.functions?.some((f) => f.id === functionId),
    ),
    [events.data, functionId],
  );

  const fn = useMemo(
    () => event?.functions?.find((f) => f.id === functionId),
    [event, functionId],
  );

  const totalGeneral = useMemo(() => sectors.find((s) => s.is_total_general) ?? null, [sectors]);
  const totalCapacity = totalGeneral?.total ?? 0;
  const availableSeats = totalGeneral?.available ?? 0;
  const sellThrough = totalCapacity > 0 ? ((totalCapacity - availableSeats) / totalCapacity) * 100 : 0;

  const dailyTrend = useMemo(
    () =>
      weekHistory.map((day) => {
        const d = parseDayDate(day.day_date);
        const label = d ? String(d.getDate()) : day.day_formatted.slice(0, 2);
        return {
          label,
          value: day.total_net,
          valueLabel: formatCurrencyARS(day.total_net),
        };
      }),
    [weekHistory],
  );

  const grossRevenue = fn?.grossRevenueARS ?? 0;

  if (!event || !fn) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: palette.text }}>Función no encontrada</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <AppHeader
          title={event.name}
          subtitle="Detalle de función"
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Text style={{ color: palette.subtext, fontSize: 13, paddingHorizontal: 2 }}>
            {formatDateLong(fn.dateISO)}
          </Text>

          {/* Hero KPI */}
          <SurfaceCard>
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Ingreso total acumulado
            </Text>
            <Text style={{ color: palette.text, fontSize: 32, fontWeight: "800", marginTop: 8 }}>
              {formatCurrencyARS(grossRevenue)}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
              {formatInteger(fn.ticketsSold)} entradas · precio promedio {formatCurrencyARS(event.ticketPriceARS)}
            </Text>
          </SurfaceCard>

          {/* Occupancy */}
          {(sectorsLoading || totalCapacity > 0) && (
            <View style={{ flexDirection: "row", gap: 14 }}>
              <SurfaceCard style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                  Ocupación
                </Text>
                {sectorsLoading ? (
                  <ActivityIndicator color={palette.primary} style={{ marginTop: 20, marginBottom: 20 }} />
                ) : (
                  <>
                    <View style={{ marginTop: 12, marginBottom: 4 }}>
                      <ProgressRing
                        value={sellThrough}
                        size={72}
                        tone={sellThrough >= 80 ? "success" : sellThrough >= 50 ? "primary" : "warning"}
                      />
                    </View>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4, textAlign: "center" }}>
                      {formatInteger(availableSeats)} disponibles
                    </Text>
                  </>
                )}
              </SurfaceCard>
              <SurfaceCard style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                  Capacidad
                </Text>
                {sectorsLoading ? (
                  <ActivityIndicator color={palette.primary} style={{ marginTop: 20, marginBottom: 20 }} />
                ) : (
                  <>
                    <Text style={{ color: palette.text, fontSize: 32, fontWeight: "800", marginTop: 12 }}>
                      {formatInteger(totalCapacity)}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4, textAlign: "center" }}>
                      localidades totales
                    </Text>
                  </>
                )}
              </SurfaceCard>
            </View>
          )}

          {/* Daily sales trend */}
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Ventas diarias</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
              Últimos 14 días · tocá una barra para ver el monto
            </Text>
            {historyLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 24, marginBottom: 8 }} />
            ) : dailyTrend.length > 0 ? (
              <>
                <MiniBarChart
                  data={dailyTrend}
                  selectedIndex={selectedBarIndex}
                  onBarPress={(i) => setSelectedBarIndex((prev) => (prev === i ? undefined : i))}
                  barAreaHeight={100}
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
                Sin datos de ventas recientes.
              </Text>
            )}
          </SurfaceCard>

          {/* Function data */}
          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Datos de la función</Text>
            <View style={{ marginTop: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Entradas vendidas</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                  {formatInteger(fn.ticketsSold)}
                </Text>
              </View>
              {totalCapacity > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: palette.subtext, fontSize: 13 }}>Capacidad total</Text>
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                    {formatInteger(totalCapacity)}
                  </Text>
                </View>
              )}
              {availableSeats > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: palette.subtext, fontSize: 13 }}>Disponibles</Text>
                  <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                    {formatInteger(availableSeats)}
                  </Text>
                </View>
              )}
              <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 4 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Ticket promedio</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                  {formatCurrencyARS(event.ticketPriceARS)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Estado</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                  {fn.status === "on_sale" ? "En venta" : fn.status === "sold_out" ? "Agotado" : "Finalizado"}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          {/* Sectors */}
          {!sectorsLoading && sectors.filter((s) => !s.is_total_general).length > 0 && (
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Sectores</Text>
              <View style={{ marginTop: 16, gap: 10 }}>
                {sectors
                  .filter((s) => !s.is_total_general)
                  .map((sector) => {
                    const occ = sector.total > 0 ? ((sector.total - sector.available) / sector.total) * 100 : 0;
                    return (
                      <View key={sector.price_type}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                          <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                            {sector.price_type}
                          </Text>
                          <Text style={{ color: palette.subtext, fontSize: 13 }}>
                            {formatInteger(sector.available)} disp. · {formatPercent(occ)}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: palette.surfaceMuted, height: 6, borderRadius: 999, overflow: "hidden" }}>
                          <View
                            style={{
                              width: `${Math.min(occ, 100)}%`,
                              height: "100%",
                              backgroundColor: occ >= 80 ? palette.success : palette.primary,
                              borderRadius: 999,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
              </View>
            </SurfaceCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default FunctionDetailScreen;
