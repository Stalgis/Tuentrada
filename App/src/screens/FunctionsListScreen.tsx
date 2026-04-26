import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { EventsStackParamList } from "../navigation/types";
import { useAppState } from "../store/appState";
import { getPalette } from "../lib/theme";
import { formatDateLong } from "../lib/formatters";
import type { EventFunction } from "../lib/types";

type RouteProps = RouteProp<EventsStackParamList, "FunctionsList">;

const statusLabel = (status: string): string => {
  if (status === "sold_out") return "AGOTADO";
  if (status === "finished") return "FINALIZADO";
  return "EN VENTA";
};

const statusColor = (status: string, palette: ReturnType<typeof getPalette>) => {
  if (status === "sold_out") return palette.warning;
  if (status === "finished") return palette.subtext;
  return palette.primary;
};

const FunctionsListScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const { theme, events } = useAppState();
  const palette = getPalette(theme);

  const event = events.data.find((e) => e.id === route.params.eventId);
  const functions: EventFunction[] = event?.functions ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={functions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 34 }}
        ListHeaderComponent={
          <View>
            <AppHeader
              title={event?.name ?? "Funciones"}
              subtitle={`${functions.length} funciones disponibles`}
              onAvatarPress={() => navigation.navigate("Profile")}
              avatarInitials={event?.name?.slice(0, 2).toUpperCase()}
            />
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}
            >
              <Feather name="arrow-left" size={16} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 14, fontWeight: "700", marginLeft: 6 }}>
                Volver a eventos
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
            style={{ marginBottom: 12, marginHorizontal: 20 }}
          >
            <SurfaceCard padded>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>
                    {formatDateLong(item.dateISO)}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: statusColor(item.status, palette),
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginLeft: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={palette.subtext} style={{ marginLeft: 8 }} />
              </View>
            </SurfaceCard>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
};

export default FunctionsListScreen;
