import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { executiveSnapshot, executiveTopEvents } from "../data/stitchData";
import { formatCurrencyARS, formatDateShort, formatInteger, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";

const statusCopy = {
  active: "EN FOCO",
  trending: "ALTA DEMANDA",
  private: "CERRADO",
} as const;

const ExecutiveDashboardScreen = () => {
  const navigation = useNavigation();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const executiveEvents = useMemo(
    () =>
      events.data.length > 0
        ? [...events.data]
            .map((event) => ({
              id: event.id,
              title: event.name,
              venue: `${event.venue} • ${formatDateShort(event.dateISO)}`,
              revenue: event.ticketsSold * event.ticketPriceARS,
              sold: Math.round((event.ticketsSold / Math.max(event.ticketsAvailable, 1)) * 100),
              status: (event.status === "sold_out" ? "trending" : event.status === "finished" ? "private" : "active") as keyof typeof statusCopy,
              imageUrl: event.imageUrl ?? executiveTopEvents[0].imageUrl,
            }))
            .sort((left, right) => right.revenue - left.revenue)
            .slice(0, 3)
        : executiveTopEvents,
    [events.data]
  );

  const totalRevenue = useMemo(
    () =>
      events.data.length > 0
        ? events.data.reduce((total, event) => total + event.ticketsSold * event.ticketPriceARS, 0)
        : executiveSnapshot.revenue,
    [events.data]
  );
  const ticketsSold = useMemo(
    () =>
      events.data.length > 0
        ? events.data.reduce((total, event) => total + event.ticketsSold, 0)
        : executiveSnapshot.ticketsSold,
    [events.data]
  );
  const activeEvents = useMemo(
    () => events.data.filter((event) => event.status === "on_sale").length,
    [events.data]
  );
  const goalProgress = useMemo(() => {
    if (events.data.length === 0) return executiveSnapshot.goalProgress;
    const target = 1800000000;
    return Math.min(100, (totalRevenue / target) * 100);
  }, [events.data, totalRevenue]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader
          title="Ejecutivo"
          subtitle="Lectura de negocio para direccion"
          pillLabel={events.data.length > 0 ? `${activeEvents} eventos activos` : "Snapshot ejecutivo"}
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.navigate("Profile" as never)}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {/* <SurfaceCard>
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Que muestra esta pantalla
            </Text>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800", marginTop: 8 }}>
              Prioridades de negocio y ranking de eventos
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              Esta vista resume ingresos, objetivo y eventos top. Sirve para decidir donde enfocar seguimiento comercial.
            </Text>
          </SurfaceCard> */}

          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Ingreso total
            </Text>
            <Text style={{ color: palette.text, fontSize: 34, fontWeight: "800", marginTop: 10 }}>
              {formatCurrencyARS(totalRevenue)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <Text style={{ color: palette.success, fontSize: 13, fontWeight: "700" }}>{executiveSnapshot.growthLabel}</Text>
              <Text style={{ color: palette.subtext, fontSize: 13 }}>
                {formatPercent(goalProgress)} del objetivo
              </Text>
            </View>
            <View
              style={{
                marginTop: 14,
                height: 10,
                borderRadius: 999,
                backgroundColor: palette.surfaceMuted,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${goalProgress}%`,
                  height: "100%",
                  backgroundColor: palette.primary,
                  borderRadius: 999,
                }}
              />
            </View>
          </SurfaceCard>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Entradas vendidas</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(ticketsSold)}
              </Text>
            </SurfaceCard>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Eventos activos</Text>
              <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(events.data.length > 0 ? activeEvents : executiveSnapshot.newMembers)}
              </Text>
            </SurfaceCard>
          </View>

          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Eventos top</Text>
              <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>Ver todo</Text>
            </View>

            <View style={{ gap: 12 }}>
              {executiveEvents.map((item) => (
                <SurfaceCard key={item.id} padded={false} style={{ overflow: "hidden" }}>
                  <View style={{ flexDirection: "row" }}>
                    <Image source={{ uri: item.imageUrl }} style={{ width: 96, height: 108 }} contentFit="cover" />
                    <View style={{ flex: 1, padding: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: palette.text, fontSize: 17, fontWeight: "800", flex: 1 }}>{item.title}</Text>
                        <View style={{ backgroundColor: palette.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "800" }}>{statusCopy[item.status]}</Text>
                        </View>
                      </View>
                      <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>{item.venue}</Text>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                        <View>
                          <Text style={{ color: palette.subtext, fontSize: 11 }}>Ingresos</Text>
                          <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                            {formatCurrencyARS(item.revenue)}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: palette.subtext, fontSize: 11 }}>Ocupacion</Text>
                          <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                            {item.sold}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </SurfaceCard>
              ))}
            </View>
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
