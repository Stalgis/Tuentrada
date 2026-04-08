import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Dropdown } from "react-native-element-dropdown";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { MiniBarChart, ProgressRing } from "../components/stitch/Charts";
import { forecastSeries } from "../data/stitchData";
import { eventSalesTrends } from "../data/eventSalesTrends";
import { formatCurrencyARS, formatInteger, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import type { Event } from "../lib/types";

const allEventsOption = { key: "all", value: "Todos los eventos activos" };

const formatEventDate = (dateISO: string) => {
  const date = new Date(dateISO);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const formatTrendLabel = (dateISO: string) => {
  const date = new Date(dateISO);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const getEventRevenue = (event: Event) => event.grossRevenueARS ?? event.ticketsSold * event.ticketPriceARS;

const SalesAnalyticsScreen = () => {
  const navigation = useNavigation();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);
  const [selectedEventId, setSelectedEventId] = useState("all");

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const activeEvents = useMemo(
    () => events.data.filter((event) => event.status !== "finished"),
    [events.data]
  );

  useEffect(() => {
    if (selectedEventId !== "all" && !activeEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId("all");
    }
  }, [activeEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => activeEvents.find((event) => event.id === selectedEventId) ?? null,
    [activeEvents, selectedEventId]
  );

  const visibleEvents = useMemo(
    () => (selectedEvent ? [selectedEvent] : activeEvents),
    [activeEvents, selectedEvent]
  );

  const eventOptions = useMemo(
    () => [
      allEventsOption,
      ...activeEvents.map((event) => ({
        key: event.id,
        value: event.name,
      })),
    ],
    [activeEvents]
  );

  const totalRevenue = useMemo(
    () => visibleEvents.reduce((total, event) => total + getEventRevenue(event), 0),
    [visibleEvents]
  );
  const totalTicketsSold = useMemo(
    () => visibleEvents.reduce((total, event) => total + event.ticketsSold, 0),
    [visibleEvents]
  );
  const totalCapacity = useMemo(
    () => visibleEvents.reduce((total, event) => total + event.ticketsAvailable, 0),
    [visibleEvents]
  );
  const occupancy = totalCapacity === 0 ? 0 : (totalTicketsSold / totalCapacity) * 100;
  const averageVelocity =
    visibleEvents.length === 0
      ? 0
      : visibleEvents.reduce((total, event) => total + (event.velocity ?? 0), 0) / visibleEvents.length;
  const averageCheckIn =
    visibleEvents.length === 0
      ? 0
      : visibleEvents.reduce((total, event) => total + (event.checkInProgress ?? 0), 0) / visibleEvents.length;
  const revenueTrend = useMemo(() => {
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));
    const filteredTrend = eventSalesTrends.filter((point) => visibleEventIds.has(point.eventId));

    const groupedByDate = filteredTrend.reduce<Record<string, number>>((acc, point) => {
      acc[point.dateISO] = (acc[point.dateISO] ?? 0) + point.revenueARS;
      return acc;
    }, {});

    return Object.entries(groupedByDate)
      .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
      .slice(-6)
      .map(([dateISO, revenueARS]) => ({
        label: formatTrendLabel(dateISO),
        value: Math.max(1, Math.round(revenueARS / 1000000)),
      }));
  }, [visibleEvents]);
  const availability = Math.max(0, 100 - occupancy);
  const ticketMix = useMemo(
    () => [
      { label: "Vendido", value: Math.round(occupancy) },
      { label: "Disponible", value: Math.round(availability) },
      { label: "Check-in", value: Math.round(averageCheckIn) },
      { label: "Velocidad", value: Math.round(averageVelocity) },
    ],
    [availability, averageCheckIn, averageVelocity, occupancy]
  );
  const analyticsSubtitle = selectedEvent
    ? `${selectedEvent.venue} · ${selectedEvent.city} · ${formatEventDate(selectedEvent.dateISO)}`
    : "Rendimiento comercial consolidado";
  const pillLabel = selectedEvent ? "Vista por evento" : `${activeEvents.length} eventos incluidos`;
  const trendTitle = "Tendencia real";
  const trendDescription = selectedEvent
    ? "Ingresos reales por fecha del evento seleccionado"
    : "Ingresos reales por fecha del consolidado activo";
  const mixDescription = selectedEvent
    ? "Estado comercial del evento seleccionado"
    : "Distribucion del inventario comercial activo";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 34 }}>
        <AppHeader
          title="Ventas"
          subtitle={analyticsSubtitle}
          pillLabel={pillLabel}
          onAvatarPress={() => navigation.navigate("Profile" as never)}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard
            style={{
              paddingVertical: 16,
              backgroundColor: theme === "dark" ? palette.surface : "#f3f7ff",
              borderColor: theme === "dark" ? palette.border : "#cdddff",
              borderWidth: 1,
            }}
          >
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Evento
            </Text>
            <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800", marginTop: 6 }}>
              {selectedEvent?.name ?? "Todos los eventos activos"}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
              Cambia el foco del panel para revisar la data especifica de cada evento activo.
            </Text>
            <Dropdown
              data={eventOptions}
              value={selectedEventId}
              labelField="value"
              valueField="key"
              onChange={(item) => setSelectedEventId(String(item.key))}
              style={{
                marginTop: 14,
                minHeight: 56,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme === "dark" ? palette.border : "#b8cbff",
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
              placeholder="Selecciona un evento"
            />
          </SurfaceCard>

          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>Ingresos</Text>
            <Text style={{ color: palette.text, fontSize: 36, fontWeight: "800", marginTop: 8 }}>
              {formatCurrencyARS(totalRevenue)}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
              {selectedEvent ? "Revenue total del evento seleccionado" : "Consolidado comercial de los eventos activos"}
            </Text>
          </SurfaceCard>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Entradas vendidas</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(totalTicketsSold)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                {selectedEvent ? "Total vendido del evento" : "Total acumulado del panel visible"}
              </Text>
            </SurfaceCard>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Ocupacion total</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatPercent(occupancy)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                {selectedEvent ? "Venta sobre capacidad del evento" : "Porcentaje vendido sobre capacidad activa"}
              </Text>
            </SurfaceCard>
          </View>

          <SurfaceCard>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{trendTitle}</Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                  {trendDescription}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: selectedEvent ? palette.primarySoft : palette.surfaceMuted,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: selectedEvent ? palette.primary : palette.subtext, fontSize: 12, fontWeight: "700" }}>
                  {selectedEvent ? "Ultimos 6 dias" : "Vista consolidada"}
                </Text>
              </View>
            </View>
            <MiniBarChart data={revenueTrend.length > 0 ? revenueTrend : forecastSeries} highlightIndex={revenueTrend.length - 1} />
          </SurfaceCard>

          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Mix de tickets</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
              {mixDescription}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18 }}>
              <ProgressRing value={occupancy} size={92} />
              <View style={{ marginLeft: 18, flex: 1, gap: 10 }}>
                {ticketMix.map((item) => (
                  <View key={item.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: palette.subtext, fontSize: 13 }}>{item.label}</Text>
                    <Text style={{ color: palette.text, fontWeight: "700" }}>{item.value}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SalesAnalyticsScreen;
