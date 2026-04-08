import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { EventsStackParamList } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { formatCurrencyARS, formatDateLong, formatInteger, formatPercent } from "../lib/formatters";

type EventRoute = RouteProp<EventsStackParamList, "EventDetail">;

const EventDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<EventRoute>();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const event = useMemo(() => events.data.find((item) => item.id === route.params.eventId), [events.data, route.params.eventId]);
  const sellThrough = useMemo(
    () => (event ? (event.ticketsSold / Math.max(event.ticketsAvailable, 1)) * 100 : 0),
    [event]
  );

  if (!event) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.text }}>Evento no encontrado</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader
          title={event.name}
          subtitle="Detalle comercial de un evento"
          onBackPress={() => navigation.goBack()}
          onAvatarPress={() => navigation.navigate("Profile" as never)}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Image source={{ uri: event.imageUrl }} style={{ width: "100%", height: 148, borderRadius: 26 }} contentFit="cover" />

          <Text style={{ color: palette.subtext, fontSize: 13, paddingHorizontal: 2 }}>
            {event.venue} • {event.city} • {formatDateLong(event.dateISO)}
          </Text>

          <SurfaceCard>
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>KPI principal</Text>
            <Text style={{ color: palette.text, fontSize: 28, fontWeight: "800", marginTop: 8 }}>
              {formatCurrencyARS(event.grossRevenueARS ?? event.ticketsSold * event.ticketPriceARS)}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
              Ingreso bruto estimado de este evento segun entradas vendidas por precio actual
            </Text>
          </SurfaceCard>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Ocupacion</Text>
              <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800", marginTop: 8 }}>
                {formatPercent(sellThrough)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                Porcentaje vendido sobre la capacidad total
              </Text>
            </SurfaceCard>
            <SurfaceCard style={{ flex: 1 }}>
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>Check-ins</Text>
              <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800", marginTop: 8 }}>
                {formatPercent(event.checkInProgress ?? 0)}
              </Text>
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 4 }}>
                Porcentaje de asistentes ya ingresados
              </Text>
            </SurfaceCard>
          </View>

          <SurfaceCard>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>Lectura comercial</Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
              Variables base que explican los KPIs de arriba
            </Text>
            <View style={{ marginTop: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Entradas vendidas</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{formatInteger(event.ticketsSold)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Capacidad total</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{formatInteger(event.ticketsAvailable)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Precio por entrada</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{formatCurrencyARS(event.ticketPriceARS)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: palette.subtext, fontSize: 13 }}>Estado</Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                  {event.featuredTag ?? event.status.replace("_", " ")}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <Pressable
            onPress={() => navigation.navigate("EventsList" as never)}
            style={{
              backgroundColor: palette.primary,
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Volver a la lista de eventos</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EventDetailScreen;
