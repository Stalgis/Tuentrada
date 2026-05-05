import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { fetchPaymentsForEvent, type PaymentRow } from "../lib/apiClient";
import { formatCurrencyARS, formatDateLong, formatInteger } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { TabScreenNavigationProp } from "../navigation/types";
import type { EventFunction } from "../lib/types";

type PeriodKey = "all" | "today" | "this_week" | "this_month" | "last_month";

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "Todo" },
  { key: "this_week", label: "Esta semana" },
  { key: "this_month", label: "Este mes" },
  { key: "last_month", label: "Mes anterior" },
];

const prettyName = (raw: string): string => {
  if (!raw) return "—";
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const allEventsOption = { key: "all", value: "Todos los eventos" };

const PaymentScreen = () => {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showAllFunctions, setShowAllFunctions] = useState(false);

  useEffect(() => {
    if (events.status === "idle" && accessToken) loadEvents(accessToken);
  }, [events.status, loadEvents, accessToken]);

  const activeEvents = useMemo(
    () => events.data.filter((e) => e.status !== "finished"),
    [events.data],
  );

  // Auto-select when only 1 active event
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

  const selectedFunctions: EventFunction[] = useMemo(() => {
    if (!selectedEvent?.functions) return [];
    return [...selectedEvent.functions].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );
  }, [selectedEvent]);

  const eventOptions = useMemo(
    () => [allEventsOption, ...activeEvents.map((e) => ({ key: e.id, value: e.name }))],
    [activeEvents],
  );

  // API id: use selected function when drilling, otherwise global (undefined = all data)
  const apiId = selectedFunctionId ?? undefined;

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setShowAll(false);
    setShowAllFunctions(false);
    fetchPaymentsForEvent(accessToken, apiId ?? "", period)
      .then(setRows)
      .catch((err) => {
        setRows([]);
        setError(err instanceof Error ? err.message : "No se pudieron cargar los medios de pago.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, apiId, period]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.sold_tickets - a.sold_tickets),
    [rows],
  );

  const totals = useMemo(
    () =>
      sorted.reduce(
        (acc, r) => {
          acc.sold_tickets += r.sold_tickets;
          acc.total_revenue += r.total_revenue;
          return acc;
        },
        { sold_tickets: 0, total_revenue: 0 },
      ),
    [sorted],
  );

  const top = sorted[0] ?? null;
  const topPct = top && totals.sold_tickets > 0
    ? (top.sold_tickets / totals.sold_tickets) * 100
    : 0;

  const visibleRows = showAll ? sorted : sorted.slice(0, 5);

  const pillLabel = selectedFunctionId
    ? "Detalle de función"
    : selectedEvent
      ? selectedEvent.name
      : `${activeEvents.length} evento${activeEvents.length !== 1 ? "s" : ""}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 34 }}>
        <AppHeader
          title="Medios de pago"
          subtitle={selectedFunctionId ? "Vista por función" : "Distribución por gateway"}
          pillLabel={pillLabel}
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {/* Event selector — only when multiple events */}
          {activeEvents.length > 1 && (
            <SurfaceCard style={{ paddingVertical: 16, borderWidth: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
                Evento
              </Text>
              {events.status === "loading" && events.data.length === 0 ? (
                <ActivityIndicator color={palette.primary} style={{ marginTop: 16, marginBottom: 8 }} />
              ) : (
                <Dropdown
                  data={eventOptions}
                  value={selectedEventId}
                  labelField="value"
                  valueField="key"
                  onChange={(item) => {
                    setSelectedEventId(String(item.key));
                    setSelectedFunctionId(null);
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
              )}
            </SurfaceCard>
          )}

          {/* Function drill-down header — back to event level */}
          {selectedFunctionId && (
            <Pressable
              onPress={() => setSelectedFunctionId(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Feather name="arrow-left" size={14} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
                Volver al evento completo
              </Text>
            </Pressable>
          )}

          {/* Period filter */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {periodOptions.map((opt) => {
              const active = period === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setPeriod(opt.key)}
                  style={{
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderWidth: 1,
                    borderColor: active ? palette.primary : palette.hairline,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : palette.subtext, fontSize: 12, fontWeight: "700" }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Hero: top method */}
          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Método dominante
            </Text>
            {loading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 16, alignSelf: "flex-start" }} />
            ) : top ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 10, gap: 12 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: palette.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5, flex: 1 }}
                  >
                    {prettyName(top.payment_name)}
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800" }}>
                    {topPct.toFixed(1)}%
                  </Text>
                </View>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
                  {formatCurrencyARS(totals.total_revenue)} en {formatInteger(totals.sold_tickets)} ventas totales
                </Text>
              </>
            ) : (
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 12 }}>
                Sin ventas registradas en el período.
              </Text>
            )}
          </SurfaceCard>

          {error && (
            <SurfaceCard>
              <Text style={{ color: palette.danger, fontSize: 14, fontWeight: "700" }}>{error}</Text>
              <Pressable
                onPress={() => {
                  if (accessToken) {
                    setLoading(true);
                    setError(null);
                    fetchPaymentsForEvent(accessToken, apiId ?? "", period)
                      .then(setRows)
                      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
                      .finally(() => setLoading(false));
                  }
                }}
                style={{ marginTop: 12, alignSelf: "flex-start", backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Reintentar</Text>
              </Pressable>
            </SurfaceCard>
          )}

          {/* Breakdown */}
          {!loading && !error && sorted.length > 0 && (
            <SurfaceCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Desglose</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>{sorted.length} métodos</Text>
              </View>
              <View style={{ marginTop: 16, gap: 14 }}>
                {visibleRows.map((row) => {
                  const pct = totals.sold_tickets > 0
                    ? (row.sold_tickets / totals.sold_tickets) * 100
                    : 0;
                  return (
                    <View key={row.payment_name}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text numberOfLines={1} style={{ color: palette.text, fontSize: 14, fontWeight: "700", flex: 1, marginRight: 12 }}>
                          {prettyName(row.payment_name)}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: "700" }}>
                          {pct.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={{ backgroundColor: palette.surfaceMuted, height: 8, borderRadius: 999, overflow: "hidden" }}>
                        <View
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: "100%",
                            backgroundColor: palette.primary,
                            borderRadius: 999,
                          }}
                        />
                      </View>
                      <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                        {formatInteger(row.sold_tickets)} ventas · {formatCurrencyARS(row.total_revenue)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {sorted.length > 5 && (
                <Pressable onPress={() => setShowAll((s) => !s)} style={{ marginTop: 14, alignSelf: "flex-start" }}>
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
                    {showAll ? "Mostrar menos" : `Mostrar ${sorted.length - 5} más`}
                  </Text>
                </Pressable>
              )}
            </SurfaceCard>
          )}

          {!loading && !error && sorted.length === 0 && (
            <SurfaceCard>
              <Text style={{ color: palette.subtext, fontSize: 14, textAlign: "center" }}>
                Sin datos de medios de pago para el período seleccionado.
              </Text>
            </SurfaceCard>
          )}

          {/* Functions list — drill down into a specific function */}
          {!selectedFunctionId && selectedFunctions.length > 0 && (
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Ver por función</Text>
              <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                Tocá una función para ver su desglose
              </Text>
              <View style={{ marginTop: 14, gap: 10 }}>
                {(showAllFunctions ? selectedFunctions : selectedFunctions.slice(0, 5)).map((fn) => (
                  <Pressable
                    key={fn.id}
                    onPress={() => setSelectedFunctionId(fn.id)}
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
                          {formatDateLong(fn.dateISO)}
                        </Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                          {formatInteger(fn.ticketsSold)} entradas · {formatCurrencyARS(fn.grossRevenueARS)}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={palette.subtext} style={{ marginLeft: 10 }} />
                    </View>
                  </Pressable>
                ))}
              </View>
              {selectedFunctions.length > 5 && (
                <Pressable
                  onPress={() => setShowAllFunctions((s) => !s)}
                  style={{ marginTop: 14, alignSelf: "flex-start" }}
                >
                  <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
                    {showAllFunctions ? "Ver menos" : `Ver todas (${selectedFunctions.length - 5} más)`}
                  </Text>
                </Pressable>
              )}
            </SurfaceCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PaymentScreen;
