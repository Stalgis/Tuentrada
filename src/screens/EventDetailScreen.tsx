import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { EventsStackParamList, EventsScreenNavigationProp } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { formatCurrencyARS, formatDateLong, formatInteger } from "../lib/formatters";
import type { EventFunction } from "../lib/types";

type EventRoute = RouteProp<EventsStackParamList, "EventDetail">;

const statusLabel = (status: string) => {
  if (status === "sold_out") return "AGOTADO";
  if (status === "finished") return "FINALIZADO";
  return "EN VENTA";
};

const statusColor = (status: string, palette: ReturnType<typeof getPalette>) => {
  if (status === "sold_out") return palette.warning;
  if (status === "finished") return palette.subtext;
  return palette.primary;
};

const EventDetailScreen = () => {
  const navigation = useNavigation<EventsScreenNavigationProp>();
  const route = useRoute<EventRoute>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const eventId = route.params.eventId;

  useEffect(() => {
    if (events.status === "idle" && accessToken) loadEvents(accessToken);
  }, [events.status, loadEvents, accessToken]);

  const event = useMemo(
    () => events.data.find((e) => e.id === eventId),
    [events.data, eventId],
  );

  const functions: EventFunction[] = useMemo(
    () => event?.functions ?? [],
    [event],
  );

  const onSaleCount = functions.filter((f) => f.status === "on_sale").length;
  const finishedCount = functions.filter((f) => f.status === "finished").length;
  const [showAllFunctions, setShowAllFunctions] = useState(false);

  // Vista inicial: próximas 5 funciones en venta (on_sale y fecha futura).
  const initialFunctions = useMemo(() => {
    const now = Date.now();
    return functions
      .filter((f) => f.status === "on_sale" && new Date(f.dateISO).getTime() >= now)
      .slice(0, 5);
  }, [functions]);

  const visibleFunctions = showAllFunctions ? functions : initialFunctions;
  const hiddenCount = functions.length - initialFunctions.length;

  if (!event) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: palette.text }}>Evento no encontrado</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={visibleFunctions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingBottom: 4 }}>
            <AppHeader
              title={event.name}
              subtitle="Resumen del evento"
              pillLabel={`${functions.length} funciones · ${onSaleCount} en venta`}
              onBackPress={() => navigation.goBack()}
              onAvatarPress={() => navigation.navigate("Profile")}
              avatarInitials={user?.initials}
            />

            <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 8 }}>
              {/* Total revenue — hero tone distinguishes from FunctionDetail */}
              <SurfaceCard tone="hero">
                <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Total recaudado · todas las funciones
                </Text>
                <Text style={{ color: palette.text, fontSize: 34, fontWeight: "800", marginTop: 8 }}>
                  {formatCurrencyARS(event.grossRevenueARS ?? 0)}
                </Text>
                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                  {formatInteger(event.ticketsSold)} entradas · ticket promedio {formatCurrencyARS(event.ticketPriceARS)}
                </Text>
              </SurfaceCard>

              {/* Summary row */}
              <View style={{ flexDirection: "row", gap: 14 }}>
                <SurfaceCard style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                    Funciones
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 28, fontWeight: "800", marginTop: 6 }}>
                    {functions.length}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2, textAlign: "center" }}>
                    {finishedCount} finalizada{finishedCount !== 1 ? "s" : ""}
                  </Text>
                </SurfaceCard>
                <SurfaceCard style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: palette.subtext, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                    En venta
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 28, fontWeight: "800", marginTop: 6 }}>
                    {onSaleCount}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 11, marginTop: 2, textAlign: "center" }}>
                    función{onSaleCount !== 1 ? "es" : ""} activa{onSaleCount !== 1 ? "s" : ""}
                  </Text>
                </SurfaceCard>
              </View>

              <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 4, paddingHorizontal: 2 }}>
                Funciones
              </Text>
            </View>
          </View>
        }
        ListFooterComponent={hiddenCount > 0 ? (
          <Pressable
            onPress={() => setShowAllFunctions((s) => !s)}
            style={{ marginHorizontal: 20, marginTop: 4 }}
          >
            <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "700" }}>
              {showAllFunctions ? "Ver menos" : `Ver todas (${hiddenCount} más)`}
            </Text>
          </Pressable>
        ) : null}
        renderItem={({ item }) => {
          const isAllInvitations = item.ticketsSold === 0 && item.invitations > 0;
          return (
            <Pressable
              onPress={() => navigation.navigate("FunctionDetail", { functionId: item.id })}
              style={{ marginHorizontal: 20, marginBottom: 10 }}
            >
              <SurfaceCard>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>
                      {formatDateLong(item.dateISO)}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                      {formatInteger(item.ticketsSold)} entradas
                      {item.invitations > 0 ? ` · ${formatInteger(item.invitations)} invitaciones` : ""}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 2 }}>
                      {formatCurrencyARS(item.grossRevenueARS)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 }}>
                    {isAllInvitations && (
                      <View
                        style={{
                          backgroundColor: palette.primarySoft,
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                        }}
                      >
                        <Text style={{ color: palette.primary, fontSize: 10, fontWeight: "800" }}>
                          INVITACIÓN
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        backgroundColor: statusColor(item.status, palette),
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={palette.subtext} />
                  </View>
                </View>
              </SurfaceCard>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
};

export default EventDetailScreen;
