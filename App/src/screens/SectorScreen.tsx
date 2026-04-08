import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { venueSectors } from "../data/stitchData";
import { formatCurrencyARS, formatDateShort, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";

const sortOptions = [
  { key: "occupancy", label: "Ocupacion" },
  { key: "revenue", label: "Ingresos" },
  { key: "capacity", label: "Capacidad" },
] as const;

const SectorScreen = () => {
  const navigation = useNavigation();
  const { theme, events, loadEvents } = useAppState();
  const { user } = useAuth();
  const palette = getPalette(theme);
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["key"]>("occupancy");

  useEffect(() => {
    if (events.status === "idle") {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const currentEvent = useMemo(
    () =>
      [...events.data]
        .filter((event) => event.status !== "finished")
        .sort((left, right) => new Date(left.dateISO).getTime() - new Date(right.dateISO).getTime())[0],
    [events.data]
  );

  const orderedSectors = useMemo(() => {
    const sorted = [...venueSectors].sort((left, right) => {
      if (sortBy === "revenue") return right.revenue - left.revenue;
      if (sortBy === "capacity") return right.capacity - left.capacity;
      return right.occupancy - left.occupancy;
    });
    return sorted.map((sector, index) => ({ ...sector, rank: index + 1 }));
  }, [sortBy]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader
          title="Sectores"
          subtitle="Performance por sector del venue"
          onAvatarPress={() => navigation.navigate("Profile" as never)}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <SurfaceCard tone="hero">
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Contexto
            </Text>
            <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800", marginTop: 8 }}>
              {currentEvent ? currentEvent.name : "Venue principal"}
            </Text>
            <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
              {currentEvent ? `${currentEvent.venue} • ${formatDateShort(currentEvent.dateISO)}` : "Comparativa por sectores"}
            </Text>
          </SurfaceCard>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {sortOptions.map((option) => {
              const active = sortBy === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSortBy(option.key)}
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
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {orderedSectors.map((sector) => (
            <SurfaceCard key={sector.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>#{sector.rank}</Text>
                  <Text style={{ color: palette.text, fontSize: 21, fontWeight: "800", marginTop: 4 }}>{sector.name}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800" }}>{formatPercent(sector.occupancy)}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>{sector.capacity} lugares</Text>
                </View>
              </View>

              <View style={{ marginTop: 16 }}>
                <View style={{ backgroundColor: palette.surfaceMuted, height: 10, borderRadius: 999, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${sector.occupancy}%`,
                      height: "100%",
                      backgroundColor: palette.primary,
                      borderRadius: 999,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                <View>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>Ingresos</Text>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                    {formatCurrencyARS(sector.revenue)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: palette.subtext, fontSize: 11 }}>Ocupacion</Text>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>
                    {formatPercent(sector.occupancy)}
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          ))}

          <Pressable
            style={{
              marginTop: 6,
              backgroundColor: palette.surface,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: palette.hairline,
              paddingVertical: 18,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Feather name="map" size={18} color={palette.primary} />
            <Text style={{ color: palette.primary, fontSize: 15, fontWeight: "800" }}>Ver mapa del venue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SectorScreen;
