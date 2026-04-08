import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { EventsStackParamList } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import { formatDateLong, formatInteger, formatPercent } from "../lib/formatters";

const filterLabels = [
  { key: "all", label: "Todos" },
  { key: "on_sale", label: "En venta" },
  { key: "sold_out", label: "Agotados" },
  { key: "finished", label: "Finalizados" },
] as const;

const statusColor = (status: string, palette: ReturnType<typeof getPalette>) => {
  if (status === "sold_out") return palette.warning;
  if (status === "finished") return palette.subtext;
  return palette.primary;
};

const EventsListScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const rootNavigation = useNavigation();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterLabels)[number]["key"]>("all");

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events.data.filter((event) => {
      const matchesFilter = filter === "all" || event.status === filter;
      const matchesQuery =
        normalized.length === 0 ||
        [event.name, event.venue, event.city].some((entry) => entry.toLowerCase().includes(normalized));
      return matchesFilter && matchesQuery;
    });
  }, [events.data, filter, query]);

  const eventsOnSale = useMemo(
    () => events.data.filter((event) => event.status === "on_sale").length,
    [events.data]
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 34 }}
        ListHeaderComponent={
          <View>
            <AppHeader
              title="Eventos"
              subtitle="Elegi un evento para ver su detalle"
              pillLabel={`${events.data.length} cargados • ${eventsOnSale} en venta`}
              onAvatarPress={() => rootNavigation.navigate("Profile" as never)}
              avatarInitials={user?.initials}
            />

            <View style={{ paddingHorizontal: 20 }}>
              <View
                style={{
                  backgroundColor: palette.surfaceMuted,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: palette.hairline,
                  paddingHorizontal: 16,
                  height: 54,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Feather name="search" size={18} color={palette.subtext} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar evento, venue o ciudad"
                  placeholderTextColor={palette.subtext}
                  style={{ marginLeft: 12, color: palette.text, flex: 1, fontSize: 15 }}
                />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, marginBottom: 16 }}>
                {filterLabels.map((item) => {
                  const active = filter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setFilter(item.key)}
                      style={{
                        backgroundColor: active ? palette.primary : palette.surface,
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: active ? palette.primary : palette.hairline,
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : palette.subtext, fontSize: 12, fontWeight: "700" }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 14 }}>
                {filtered.length} resultados
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
            style={{ marginBottom: 14, marginHorizontal: 20 }}
          >
            <SurfaceCard padded={false} style={{ overflow: "hidden" }}>
              <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160 }} contentFit="cover" />
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800", flex: 1 }}>{item.name}</Text>
                  <View
                    style={{
                      backgroundColor: statusColor(item.status, palette),
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                      {item.featuredTag ?? item.status.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 6 }}>
                  {formatDateLong(item.dateISO)} • {item.venue}
                </Text>

                <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 6 }}>
                  {formatInteger(item.ticketsSold)} vendidas de {formatInteger(item.ticketsAvailable)} disponibles
                </Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Velocidad de venta {formatPercent(item.velocity ?? 0)}
                  </Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    Ocupacion {formatPercent((item.ticketsSold / Math.max(item.ticketsAvailable, 1)) * 100)}
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
};

export default EventsListScreen;
