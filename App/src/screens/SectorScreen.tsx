import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { TabScreenNavigationProp } from "../navigation/types";
import { Feather } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import { fetchSectors, type Sector } from "../lib/apiClient";
import { formatCurrencyARS, formatDateShort, formatInteger, formatPercent } from "../lib/formatters";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { getPalette } from "../lib/theme";

const SectorScreen = () => {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const { theme, events, loadEvents } = useAppState();
  const { user, accessToken } = useAuth();
  const palette = getPalette(theme);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [sectorsError, setSectorsError] = useState(false);

  useEffect(() => {
    if (events.status === "idle" && accessToken) {
      loadEvents(accessToken);
    }
  }, [events.status, loadEvents, accessToken]);

  // Default to first active upcoming event
  const activeEvents = useMemo(
    () =>
      [...events.data]
        .filter((e) => e.status !== "finished")
        .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()),
    [events.data],
  );

  useEffect(() => {
    if (selectedEventId === null && activeEvents.length > 0) {
      setSelectedEventId(activeEvents[0].id);
    }
  }, [activeEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.data.find((e) => e.id === selectedEventId) ?? null,
    [events.data, selectedEventId],
  );

  const eventOptions = useMemo(
    () => activeEvents.map((e) => ({ key: e.id, value: e.name })),
    [activeEvents],
  );

  // Load sectors when selected event changes
  useEffect(() => {
    if (!accessToken || !selectedEventId) return;
    setSectorsLoading(true);
    setSectorsError(false);
    fetchSectors(accessToken, selectedEventId)
      .then(setSectors)
      .catch(() => setSectorsError(true))
      .finally(() => setSectorsLoading(false));
  }, [accessToken, selectedEventId]);

  const totalGeneral = useMemo(() => sectors.find((s) => s.is_total_general) ?? null, [sectors]);
  const sectorRows = useMemo(() => sectors.filter((s) => !s.is_total_general), [sectors]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader
          title="Sectores"
          subtitle="Disponibilidad por sector"
          onAvatarPress={() => navigation.navigate("Profile")}
          avatarInitials={user?.initials}
        />

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {/* Event selector */}
          <SurfaceCard style={{ paddingVertical: 16, borderWidth: 1 }}>
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Función
            </Text>
            {events.status === "loading" ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: 16, marginBottom: 8 }} />
            ) : (
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
                placeholder="Seleccioná una función"
              />
            )}
            {selectedEvent && (
              <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 10 }}>
                {formatDateShort(selectedEvent.dateISO)}
              </Text>
            )}
          </SurfaceCard>

          {/* Total general summary */}
          {totalGeneral && (
            <SurfaceCard tone="hero">
              <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                Capacidad total
              </Text>
              <Text style={{ color: palette.text, fontSize: 34, fontWeight: "800", marginTop: 8 }}>
                {formatInteger(totalGeneral.total)}
              </Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 16, padding: 12 }}>
                  <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    Disponibles
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 4 }}>
                    {formatInteger(totalGeneral.available)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 16, padding: 12 }}>
                  <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    Vendidas
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 4 }}>
                    {formatInteger(totalGeneral.purchase + totalGeneral.invitation)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: palette.surfaceMuted, borderRadius: 16, padding: 12 }}>
                  <Text style={{ color: palette.subtext, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    Ocupación
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800", marginTop: 4 }}>
                    {totalGeneral.total > 0
                      ? formatPercent(((totalGeneral.total - totalGeneral.available) / totalGeneral.total) * 100)
                      : "—"}
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          )}

          {/* Loading / error state */}
          {sectorsLoading && (
            <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
          )}
          {sectorsError && (
            <Text style={{ color: palette.danger, fontSize: 14, textAlign: "center" }}>
              No se pudieron cargar los sectores.
            </Text>
          )}

          {/* Sector rows */}
          {!sectorsLoading && sectorRows.map((sector) => {
            const occupied = sector.total - sector.available;
            const occupancy = sector.total > 0 ? (occupied / sector.total) * 100 : 0;
            const tone = occupancy >= 80 ? palette.success : occupancy >= 50 ? palette.primary : palette.warning;

            return (
              <SurfaceCard key={sector.price_type}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>
                      {sector.price_type}
                    </Text>
                    <Text style={{ color: palette.subtext, fontSize: 13, marginTop: 4 }}>
                      {formatInteger(sector.total)} localidades · {formatInteger(sector.available)} disponibles
                    </Text>
                  </View>
                  <Text style={{ color: tone, fontSize: 18, fontWeight: "800" }}>
                    {formatPercent(occupancy)}
                  </Text>
                </View>

                <View style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: palette.surfaceMuted, height: 8, borderRadius: 999, overflow: "hidden" }}>
                    <View
                      style={{
                        width: `${Math.min(occupancy, 100)}%`,
                        height: "100%",
                        backgroundColor: tone,
                        borderRadius: 999,
                      }}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Vendidas</Text>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
                      {formatInteger(sector.purchase)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Invitaciones</Text>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
                      {formatInteger(sector.invitation)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: palette.subtext, fontSize: 11 }}>Bloqueadas</Text>
                    <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
                      {formatInteger(sector.kill + sector.promoter_blocked)}
                    </Text>
                  </View>
                </View>
              </SurfaceCard>
            );
          })}

          <View
            style={{
              marginTop: 6,
              backgroundColor: palette.surfaceMuted,
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
            <Feather name="map" size={18} color={palette.subtext} />
            <Text style={{ color: palette.subtext, fontSize: 15, fontWeight: "700" }}>Mapa del venue · próximamente</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SectorScreen;
