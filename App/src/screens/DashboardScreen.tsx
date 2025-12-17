// src/screens/DashboardScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import StatTile from "../components/StatTile";
import Chip from "../components/UI/Chip";
import Section from "../components/UI/Section";
import SalesCalendar from "../components/SalesCalendar";
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
import PageHeader from "../components/UI/PageHeader";
import RootDrawer from "../components/RootDrawer";

// Helpers
const formatARS = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
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
  const { width } = useWindowDimensions();
  const [periodNew, setPeriodNew] = useState<"7d" | "30d">("7d");
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const tileClass = isDark
    ? "bg-white/5 border border-white/10"
    : "bg-card-light border border-border-light";

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

  useEffect(() => {
    if (periodSummary) {
      setSelectedDayIndex(Math.max(periodSummary.days.length - 1, 0));
    }
  }, [
    periodSummary?.eventId,
    periodSummary?.period,
    periodSummary?.days.length,
  ]);

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
      periodSummary && periodSummary.days.length > 0
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

  if (!eventStats || !periodSummary) {
    return (
      <RootDrawer>
        {(openDrawer) => (
          <SafeAreaView
            className={`flex-1 ${
              isDark ? "bg-background-dark" : "bg-background-light"
            }`}
          >
            <PageHeader
              title="General"
              leftAccessory={
                <Pressable
                  onPress={openDrawer}
                  accessibilityRole="button"
                  className="rounded-full bg-card-light p-2 dark:bg-card-dark"
                >
                  <Feather
                    name="menu"
                    size={20}
                    color={isDark ? "#e2e8f0" : "#0f172a"}
                  />
                </Pressable>
              }
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
          <PageHeader
            title="General"
            leftAccessory={
              <Pressable
                onPress={openDrawer}
                accessibilityRole="button"
                className={`rounded-full p-2 ${
                  isDark ? "bg-card-dark" : "bg-card-light"
                }`}
              >
                <Feather
                  name="menu"
                  size={20}
                  color={isDark ? "#e2e8f0" : "#0f172a"}
                />
              </Pressable>
            }
          />
          <ScrollView
            className="flex-1 px-5 pt-4"
            contentInsetAdjustmentBehavior="automatic"
          >
            {/* Resumen general */}
            <View className="mb-6">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Resumen general
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-4">
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Total recaudado (ARS)"
                  value={formatARS(totalRevenueAll)}
                  accent="#0f5cff"
                />
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Tickets vendidos"
                  value={formatPlainNumber(totalTicketsAll)}
                />
              </View>
            </View>

            {/* Selector de función */}
            <View className="mb-6">
              <Text
                className={`mb-2 text-sm font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Seleccionar funcion
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
              <View className="mt-4">
                <Text
                  className={`text-2xl font-semibold ${
                    isDark ? "text-text-dark" : "text-text-light"
                  }`}
                >
                  {eventStats.eventName}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-subtext-dark" : "text-subtext-light"
                  }`}
                >
                  {eventStats.venueName}{" "}
                  {formatDate(eventStats.sessionDateTime, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  {formatDate(eventStats.sessionDateTime, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            {/* KPI Tiles */}
            <View className="mb-4">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Resumen del evento
              </Text>
              <View className="flex-row flex-wrap gap-4">
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Tickets vendidos"
                  value={eventStats.ticketsSold.toString()}
                />
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Total recaudado (ARS)"
                  value={formatARS(eventStats.totalRevenueARS)}
                  accent="#0f5cff"
                />
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Invitaciones"
                  value={eventStats.invitations.toString()}
                />
                <StatTile
                  className={`flex-1 min-w-[45%] ${tileClass}`}
                  label="Contactos"
                  value={eventStats.contactsCount.toString()}
                />
              </View>
            </View>

            {/* Toggle y Bar Chart */}
            <View
              className={`mb-4 ${
                periodNew === "7d" ? "items-center" : "w-full"
              }`}
            >
              <Text
                className={`text-lg mb-4 text-left w-full font-semibold ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Ingresos diarios (ARS)
              </Text>
              <View
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

              <RevenueBarChart period={periodNew} eventId={selectedEventId} />
            </View>

            {/* Calendario */}
            <View className="mb-4">
              <Text
                className={`text-lg font-semibold my-4 ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                Calendario de ventas
              </Text>
              <SalesCalendar summary={periodSummary} />
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
