// src/screens/DashboardScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StatTile from "../components/StatTile";
import Chip from "../components/UI/Chip";
import Section from "../components/UI/Section";
import { useTranslation } from "../hooks/useTranslation";
import {
  DailySalesRow,
  DailySalesSummary,
  EventGeneralStats,
  mockDailySalesSummaries,
  mockEventGeneralStats,
} from "../data/mockEventAnalytics";
import { RevenueBarChart } from "../components/RevenueBarChart";
import { useAppState } from "../store/appState";
import TopBar from "../components/UI/TopBar";
import RootDrawer from "../components/RootDrawer";
import { useAuth } from "../store/auth";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";

// Helpers
const formatPlainNumber = (amount: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
const sumRevenue = (days: DailySalesRow[]) =>
  days.reduce((sum, day) => sum + day.revenueARS, 0);
const sumTickets = (days: DailySalesRow[]) =>
  days.reduce((sum, day) => sum + day.ticketsSold, 0);
const calcAverageTicket = (totalRevenue: number, totalTickets: number) =>
  totalTickets > 0 ? totalRevenue / totalTickets : 0;
const findBestDay = (days: DailySalesRow[]) =>
  days.reduce(
    (best, current) => (current.revenueARS > best.revenueARS ? current : best),
    days[0]
  );

const DashboardScreen = () => {
  const { language } = useTranslation();
  const [periodNew, setPeriodNew] = useState<"7d" | "30d">("7d");
  const { theme } = useAppState();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isDark = theme === "dark";
  const tileClass = isDark
    ? "bg-white/5 border border-white/10"
    : "bg-card-light border border-border-light";
  const secondaryTileClass = isDark
    ? "bg-white/[0.03] border border-white/8"
    : "bg-slate-50 border border-slate-200";
  const sectionCardClass = isDark
    ? "rounded-3xl border border-white/10 bg-white/5"
    : "rounded-3xl border border-border-light bg-card-light";

  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => mockEventGeneralStats[0]?.eventId ?? ""
  );
  const [period, setPeriod] = useState<"last7Days" | "last30Days">("last7Days");

  const eventStats = useMemo<EventGeneralStats | undefined>(
    () =>
      mockEventGeneralStats.find((event) => event.eventId === selectedEventId),
    [selectedEventId]
  );
  const totalRevenueAll = useMemo(
    () =>
      mockEventGeneralStats.reduce(
        (sum, item) => sum + item.totalRevenueARS,
        0
      ),
    []
  );
  const totalTicketsAll = useMemo(
    () =>
      mockEventGeneralStats.reduce((sum, item) => sum + item.ticketsSold, 0),
    []
  );

  const periodSummary: DailySalesSummary | undefined = useMemo(
    () =>
      mockDailySalesSummaries.find(
        (summary) =>
          summary.eventId === selectedEventId && summary.period === period
      ),
    [selectedEventId, period]
  );

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const daysLength = periodSummary?.days?.length ?? 0;
  useEffect(() => {
    if (daysLength > 0) {
      setSelectedDayIndex(Math.max(daysLength - 1, 0));
    }
  }, [periodSummary?.eventId, periodSummary?.period, daysLength]);

  const totalRevenuePeriod = useMemo(
    () => sumRevenue(periodSummary?.days ?? []),
    [periodSummary]
  );
  const totalTicketsPeriod = useMemo(
    () => sumTickets(periodSummary?.days ?? []),
    [periodSummary]
  );
  const averageTicket = useMemo(
    () => calcAverageTicket(totalRevenuePeriod, totalTicketsPeriod),
    [totalRevenuePeriod, totalTicketsPeriod]
  );
  const bestDay = useMemo(
    () =>
      periodSummary?.days?.length
        ? findBestDay(periodSummary.days)
        : undefined,
    [periodSummary]
  );

  const formatDate = useCallback(
    (dateISO: string, options: Intl.DateTimeFormatOptions) => {
      const locale = language === "es" ? "es-AR" : "en-US";
      return new Intl.DateTimeFormat(locale, options).format(new Date(dateISO));
    },
    [language]
  );

  const handleAvatarPress = useCallback(() => {
    const parentNav = navigation.getParent?.();
    const target = parentNav ?? navigation;
    target.navigate("Profile");
  }, [navigation]);

  if (!eventStats || !periodSummary) {
    return (
      <RootDrawer>
        {(openDrawer) => (
          <SafeAreaView
            className={`flex-1 ${
              isDark ? "bg-background-dark" : "bg-background-light"
            }`}
          >
            <TopBar
              title="Resumen General"
              onLeftPress={openDrawer}
              onRightPress={handleAvatarPress}
              rightInitials={user?.initials}
            />
            <View className="flex-1 items-center justify-center px-6">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                No hay datos para mostrar
              </Text>
              <Text
                className={`mt-2 text-center ${
                  isDark ? "text-subtext-dark" : "text-subtext-light"
                }`}
              >
                Agrega funciones en mockEventAnalytics.ts para ver el dashboard.
              </Text>
            </View>
          </SafeAreaView>
        )}
      </RootDrawer>
    );
  }

  return (
    <RootDrawer>
      {(openDrawer) => (
        <SafeAreaView
          className={`flex-1 ${
            isDark ? "bg-background-dark" : "bg-background-light"
          }`}
        >
          <TopBar
            title="Resumen general"
            onLeftPress={openDrawer}
            onRightPress={handleAvatarPress}
            rightInitials={user?.initials}
          />
          <ScrollView
            className="flex-1 px-5 pt-4"
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {/* Resumen general */}
            <View className="mb-8">
              <View className="mt-4 flex-row flex-wrap gap-4">
                <StatTile
                  className={`flex-1 min-w-[45%] p-5 ${tileClass}`}
                  label="Total recaudado"
                  value={`$ ${formatPlainNumber(totalRevenueAll)}`}
                  accent="#0f5cff"
                />
                <StatTile
                  className={`flex-1 min-w-[45%] p-5 ${tileClass}`}
                  label="Tickets vendidos"
                  value={formatPlainNumber(totalTicketsAll)}
                />
              </View>
            </View>

            {/* Contexto activo */}
            <View className={`mb-8 p-4 ${sectionCardClass}`}>
              <Text
                className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                  isDark ? "text-subtext-dark" : "text-subtext-light"
                }`}
              >
                Contexto activo
              </Text>
              <View className="mt-3">
                <Text
                  className={`mb-2 text-sm font-semibold ${
                    isDark ? "text-text-dark" : "text-text-light"
                  }`}
                >
                  Seleccionar función
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {mockEventGeneralStats.map((item) => (
                    <Chip
                      key={item.eventId}
                      label={`${formatDate(item.sessionDateTime, {
                        month: "short",
                        day: "numeric",
                      })}`}
                      selected={selectedEventId === item.eventId}
                      onPress={() => setSelectedEventId(item.eventId)}
                      accessibilityLabel={`Ver KPIs de ${
                        item.eventName
                      } ${formatDate(item.sessionDateTime, {
                        day: "2-digit",
                        month: "2-digit",
                      })}`}
                    />
                  ))}
                </View>
              </View>
              <View
                className={`mt-4 border-t pt-4 ${
                  isDark ? "border-white/10" : "border-border-light"
                }`}
              >
                <Text
                  className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                    isDark ? "text-subtext-dark" : "text-subtext-light"
                  }`}
                >
                  Evento
                </Text>
                <Text
                  className={`mt-1.5 text-lg font-semibold leading-6 ${
                    isDark ? "text-text-dark" : "text-text-light"
                  }`}
                >
                  {eventStats.eventName}
                </Text>
                <Text
                  className={`mt-1.5 text-sm leading-5 ${
                    isDark ? "text-subtext-dark" : "text-subtext-light"
                  }`}
                >
                  {eventStats.venueName} |{" "}
                  {formatDate(eventStats.sessionDateTime, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  |
                  {" "}
                  {formatDate(eventStats.sessionDateTime, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            {/* KPI Tiles */}
            <View className="mb-8">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Resumen del evento
              </Text>
              {/* <Text
                className={`mt-1 text-sm ${
                  isDark ? "text-subtext-dark" : "text-subtext-light"
                }`}
              >
                KPIs de la función actualmente seleccionada.
              </Text> */}
              <View className="mt-4 flex-row gap-4">
                <StatTile
                  className={`flex-1 min-w-[45%] p-5 ${tileClass}`}
                  label="Tickets vendidos"
                  value={eventStats.ticketsSold.toString()}
                />
                <StatTile
                  className={`flex-1 min-w-[45%] p-5 ${tileClass}`}
                  label="Total recaudado"
                  value={`$ ${formatPlainNumber(eventStats.totalRevenueARS)}`}
                  accent="#0f5cff"
                />
              </View>
              <View className="mt-4 flex-row gap-4">
                <StatTile
                  className={`flex-1 min-w-[45%] p-4 ${secondaryTileClass}`}
                  label="Invitaciones"
                  value={eventStats.invitations.toString()}
                />
                <StatTile
                  className={`flex-1 min-w-[45%] p-4 ${secondaryTileClass}`}
                  label="Contactos"
                  value={eventStats.contactsCount.toString()}
                />
              </View>
            </View>

            {/* Toggle y Bar Chart */}
            <View
              className={`w-full px-4 pt-4 pb-2 ${sectionCardClass}`}
            >
              <Text
                className={`w-full text-lg font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Ingresos diarios
              </Text>
              <View
                className="mt-2"
                style={[
                  styles.toggleContainer,
                  {
                    backgroundColor: isDark ? "#1e293b" : "#e5e7eb",
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    periodNew === "7d" && styles.toggleActive,
                  ]}
                  onPress={() => setPeriodNew("7d")}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      periodNew === "7d"
                        ? styles.toggleTextActive
                        : { color: isDark ? "#94a3b8" : "#333" },
                    ]}
                  >
                    Últimos 7 días
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    periodNew === "30d" && styles.toggleActive,
                  ]}
                  onPress={() => setPeriodNew("30d")}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      periodNew === "30d"
                        ? styles.toggleTextActive
                        : { color: isDark ? "#94a3b8" : "#333" },
                    ]}
                  >
                    Últimos 30 días
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-0.5 w-full">
                <RevenueBarChart period={periodNew} eventId={selectedEventId} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </RootDrawer>
  );
};

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    alignSelf: "center",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: "#0f5cff",
  },
  toggleText: {
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "white",
  },
});

export default DashboardScreen;
