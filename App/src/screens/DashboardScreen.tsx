import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatTile from '../components/StatTile';
import Section from '../components/UI/Section';
import { useTranslation } from '../hooks/useTranslation';
import {
  DailySalesRow,
  DailySalesSummary,
  EventGeneralStats,
  mockDailySalesSummaries,
  mockEventGeneralStats,
} from '../data/mockEventAnalytics';

// Number helpers keep formatting consistent across the screen.
const formatARS = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);
const formatPlainNumber = (amount: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount);
const sumRevenue = (days: DailySalesRow[]) => days.reduce((sum, day) => sum + day.revenueARS, 0);
const sumTickets = (days: DailySalesRow[]) => days.reduce((sum, day) => sum + day.ticketsSold, 0);
const calcAverageTicket = (totalRevenue: number, totalTickets: number) =>
  totalTickets > 0 ? totalRevenue / totalTickets : 0;
const findBestDay = (days: DailySalesRow[]) =>
  days.reduce((best, current) => (current.revenueARS > best.revenueARS ? current : best), days[0]);

const DashboardScreen = () => {
  const { language } = useTranslation();
  const { width } = useWindowDimensions();

  // Selected mock event/session (only one for now).
  const eventStats: EventGeneralStats = mockEventGeneralStats;

  // Fixed period: ultimos 7 dias.
  const periodSummary: DailySalesSummary = useMemo(
    () => mockDailySalesSummaries.find((summary) => summary.period === 'last7Days') ?? mockDailySalesSummaries[0],
    [],
  );

  // Select the last available day by default, reset when period changes.
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => Math.max(periodSummary.days.length - 1, 0));
  useEffect(() => {
    setSelectedDayIndex(Math.max(periodSummary.days.length - 1, 0));
  }, [periodSummary.days.length]);

  const totalRevenuePeriod = useMemo(() => sumRevenue(periodSummary.days), [periodSummary.days]);
  const totalTicketsPeriod = useMemo(() => sumTickets(periodSummary.days), [periodSummary.days]);
  const averageTicket = useMemo(
    () => calcAverageTicket(totalRevenuePeriod, totalTicketsPeriod),
    [totalRevenuePeriod, totalTicketsPeriod],
  );
  const bestDay = useMemo(() => findBestDay(periodSummary.days), [periodSummary.days]);
  const selectedDay = periodSummary.days[selectedDayIndex];

  const formatDate = useCallback(
    (dateISO: string, options: Intl.DateTimeFormatOptions) => {
      const locale = language === 'es' ? 'es-AR' : 'en-US';
      return new Intl.DateTimeFormat(locale, options).format(new Date(dateISO));
    },
    [language],
  );

  const chartData = useMemo(() => {
    const labels = periodSummary.days.map((item) => formatDate(item.date, { day: 'numeric', month: 'short' }));
    return {
      labels,
      datasets: [
        {
          data: periodSummary.days.map((item) => item.revenueARS),
        },
      ],
    };
  }, [periodSummary.days, formatDate]);

  const chartWidth = Math.min(Math.max(width - 32, 300), 900);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 px-5 pt-4" contentInsetAdjustmentBehavior="automatic">
        {/* Block 0: Header — what event am I looking at? */}
        <View className="mb-5">
          <Text className="text-2xl font-semibold text-text">{eventStats.eventName}</Text>
          <Text className="text-sm text-subtext">
            {eventStats.venueName}{' '}
            {formatDate(eventStats.sessionDateTime, { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
            {formatDate(eventStats.sessionDateTime, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Block 1: Event global KPIs — total tickets and total money for this event */}
        <Section title="Resumen del evento">
          <View className="flex-row flex-wrap gap-4">
            <StatTile className="flex-1 min-w-[45%]" label="Tickets vendidos" value={eventStats.ticketsSold.toString()} />
            <StatTile
              className="flex-1 min-w-[45%]"
              label="Total recaudado (ARS)"
              value={formatARS(eventStats.totalRevenueARS)}
              accent="#0f5cff"
            />
            <StatTile className="flex-1 min-w-[45%]" label="Invitaciones" value={eventStats.invitations.toString()} />
            <StatTile className="flex-1 min-w-[45%]" label="Contactos" value={eventStats.contactsCount.toString()} />
          </View>
        </Section>

        {/* Block 2: Performance in period — ultimos 7 dias */}
        <View className="mt-6">
          <Text className="mb-3 text-lg font-semibold text-text">Rendimiento (ultimos 7 dias)</Text>

          <View className="mb-4 flex-row flex-wrap gap-3">
            <StatTile
              className="flex-1 min-w-[45%]"
              label="Ingresos ultimos 7 dias"
              value={formatARS(totalRevenuePeriod)}
              accent="#0f5cff"
            />
            <StatTile
              className="flex-1 min-w-[45%]"
              label="Entradas vendidas ultimos 7 dias"
              value={totalTicketsPeriod.toLocaleString()}
            />
            <StatTile
              className="flex-1 min-w-[45%]"
              label="Ticket promedio"
              value={formatARS(Math.round(averageTicket))}
              accent="#0f9d58"
            />
          </View>

          {/* Block 3: Daily bar chart — ingresos diarios (ARS) */}
          <Text className="mb-2 text-sm font-semibold text-text">Ingresos diarios (ARS)</Text>
          <BarChart
            data={chartData}
            width={chartWidth}
            height={220}
            fromZero
            withInnerLines={false}
            showValuesOnTopOfBars={false}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              backgroundGradientFrom: '#f8fafc',
              backgroundGradientTo: '#f8fafc',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(15, 92, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
              fillShadowGradient: '#0f5cff',
              fillShadowGradientOpacity: 0.9,
              propsForLabels: { fontSize: 11 },
            }}
            style={{ borderRadius: 16, marginRight: 8 }}
            segments={4}
            formatYLabel={(value) => formatPlainNumber(Number(value))}
            barPercentage={0.42}
            onDataPointClick={({ index }) => setSelectedDayIndex(index)}
          />

          {/* Block 4: Selected day details + best day */}
          {selectedDay && (
            <View className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-subtext">Seleccionar dia</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {periodSummary.days.map((day, index) => (
                  <TouchableOpacity
                    key={day.date}
                    className={`min-w-[28%] rounded-2xl border px-3 py-2 ${
                      selectedDayIndex === index ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white'
                    }`}
                    onPress={() => setSelectedDayIndex(index)}
                  >
                    <Text className="text-sm font-semibold text-text">
                      {formatDate(day.date, { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text className="text-xs text-subtext">{formatARS(day.revenueARS)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="my-3 h-px bg-slate-200" />
              <Text className="text-xs uppercase tracking-wide text-subtext">
                {formatDate(selectedDay.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <Text className="mt-1 text-xl font-semibold text-text">{formatARS(selectedDay.revenueARS)}</Text>
              <Text className="text-xs text-subtext">Ingresos del dia</Text>
              <View className="mt-3 flex-row items-baseline justify-between">
                <View>
                  <Text className="text-lg font-semibold text-primary-700">{selectedDay.ticketsSold}</Text>
                  <Text className="text-xs text-subtext">Entradas vendidas</Text>
                </View>
                <View className="items-end">
                  <Text className="text-base font-semibold text-text">{selectedDay.invitations}</Text>
                  <Text className="text-xs text-subtext">Invitaciones</Text>
                </View>
              </View>
            </View>
          )}

          {bestDay && (
            <View className="mt-3">
              <Text className="text-sm text-subtext">
                Mejor dia del periodo: {formatDate(bestDay.date, { month: 'short', day: 'numeric' })} •{' '}
                {formatARS(bestDay.revenueARS)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
