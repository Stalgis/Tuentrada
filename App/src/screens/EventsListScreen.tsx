import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { EventsScreenNavigationProp } from "../navigation/types";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";
import { formatCurrencyARS, formatInteger } from "../lib/formatters";

const filterLabels = [
  { key: "all", label: "Todos" },
  { key: "on_sale", label: "En venta" },
  { key: "sold_out", label: "Agotados" },
  { key: "finished", label: "Finalizados" },
] as const;

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

const EventsListScreen = () => {
  const navigation = useNavigation<EventsScreenNavigationProp>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filterLabels)[number]["key"]>("all");

  useEffect(() => {
    if (events.status === "idle" && accessToken) {
      loadEvents(accessToken);
    }
  }, [events.status, loadEvents, accessToken]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events.data.filter((event) => {
      const matchesFilter = filter === "all" || event.status === filter;
      const matchesQuery =
        normalized.length === 0 ||
        event.name.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [events.data, filter, query]);

  const eventsOnSale = useMemo(
    () => events.data.filter((e) => e.status === "on_sale").length,
    [events.data],
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
              subtitle="Seleccioná un evento"
              pillLabel={`${events.data.length} eventos · ${eventsOnSale} en venta`}
              onAvatarPress={() => navigation.navigate("Profile")}
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
                  height: 48,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Feather name="search" size={16} color={palette.subtext} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar evento"
                  placeholderTextColor={palette.subtext}
                  style={{ marginLeft: 10, color: palette.text, flex: 1, fontSize: 14 }}
                />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 14 }}>
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
                        paddingVertical: 8,
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

              <Text style={{ color: palette.subtext, fontSize: 12, marginBottom: 12 }}>
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          events.status === "loading" ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 40 }} />
          ) : events.status === "error" ? (
            <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 20 }}>
              <Text style={{ color: palette.danger, fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                No se pudieron cargar los eventos.
              </Text>
              <Pressable
                onPress={() => accessToken && loadEvents(accessToken)}
                style={{ marginTop: 14, backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: palette.subtext, fontSize: 13, textAlign: "center", marginTop: 40 }}>
              Sin resultados.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const fnCount = item.functions?.length ?? 1;
          const revenue = item.grossRevenueARS ?? item.ticketsSold * item.ticketPriceARS;
          return (
            <Pressable
              onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
              style={{ marginBottom: 8, marginHorizontal: 20 }}
            >
              <SurfaceCard>
                {/* Row 1: name + status */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: statusColor(item.status, palette),
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      marginLeft: 10,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                {/* Row 2: meta info */}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="calendar" size={12} color={palette.subtext} />
                    <Text style={{ color: palette.subtext, fontSize: 12 }}>
                      {fnCount} función{fnCount !== 1 ? "es" : ""}
                    </Text>
                  </View>
                  <Text style={{ color: palette.hairline }}>·</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>
                    {formatInteger(item.ticketsSold)} entradas
                  </Text>
                  <Text style={{ color: palette.hairline }}>·</Text>
                  <Text style={{ color: palette.text, fontSize: 12, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                    {formatCurrencyARS(revenue)}
                  </Text>
                  <Feather name="chevron-right" size={16} color={palette.subtext} />
                </View>
              </SurfaceCard>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
};

export default EventsListScreen;
