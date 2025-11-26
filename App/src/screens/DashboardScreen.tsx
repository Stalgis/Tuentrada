import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatTile from '../components/StatTile';
import EmptyState from '../components/EmptyState';
import Section from '../components/UI/Section';
import Button from '../components/UI/Button';
import Chip from '../components/UI/Chip';
import { formatCurrency } from '../lib/currency';
import { useAppState, useEventMetrics } from '../store/appState';
import { useTranslation } from '../hooks/useTranslation';
import { dailySales } from '../data/salesStats';

const SALES_RANGE_OPTIONS = [
  { value: '7d', labelKey: 'last7Days' },
  { value: '30d', labelKey: 'last30Days' },
] as const;

type SalesRange = (typeof SALES_RANGE_OPTIONS)[number]['value'];

const DashboardScreen = () => {
  const { events, loadEvents, currency } = useAppState();
  const metrics = useEventMetrics();
  const { t, language } = useTranslation();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<SalesRange>('7d');

  const formatDate = useCallback(
    (dateISO: string, options: Intl.DateTimeFormatOptions) => {
      const locale = language === 'es' ? 'es-AR' : 'en-US';
      return new Intl.DateTimeFormat(locale, options).format(new Date(dateISO));
    },
    [language],
  );

  const visibleSales = useMemo(() => {
    const days = range === '7d' ? 7 : 30;
    return dailySales.slice(-days);
  }, [range]);

  const [selectedBar, setSelectedBar] = useState(() => Math.max(visibleSales.length - 1, 0));

  useEffect(() => {
    setSelectedBar(Math.max(visibleSales.length - 1, 0));
  }, [visibleSales.length]);

  const salesSummary = useMemo(() => {
    const totalRevenue = visibleSales.reduce((sum, day) => sum + day.revenueARS, 0);
    const totalTickets = visibleSales.reduce((sum, day) => sum + day.ticketsSold, 0);
    return {
      totalRevenue,
      totalTickets,
      avgTicket: totalTickets > 0 ? totalRevenue / totalTickets : 0,
    };
  }, [visibleSales]);

  const bestDay = useMemo(() => {
    if (visibleSales.length === 0) {
      return undefined;
    }
    return visibleSales.reduce(
      (best, current) => (current.revenueARS > best.revenueARS ? current : best),
      visibleSales[0],
    );
  }, [visibleSales]);

  const chartData = useMemo(() => {
    const labels = visibleSales.map((item, index) => {
      if (range === '30d' && index % 3 !== 0) {
        return '';
      }
      return formatDate(item.dateISO, { month: 'short', day: 'numeric' });
    });
    return {
      labels,
      datasets: [
        {
          data: visibleSales.map((item) => item.revenueARS),
        },
      ],
    };
  }, [visibleSales, range, formatDate]);

  const selectedDay = visibleSales[selectedBar];
  const chartWidth = Math.min(Math.max(width - 48, 280), 720);

  useEffect(() => {
    if (events.status === 'idle') {
      loadEvents();
    }
  }, [events.status, loadEvents]);

  const onRefresh = useCallback(() => {
    loadEvents();
  }, [loadEvents]);

  const isLoading = events.status === 'loading' && events.data.length === 0;
  const hasError = events.status === 'error';
  const isEmpty = events.status === 'success' && events.data.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1 px-5 pt-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={events.status === 'loading'} onRefresh={onRefresh} />}
      >
      <Text className="mb-5 text-2xl font-semibold text-text">{t('overviewTitle')}</Text>

      {isLoading && (
        <View className="mt-20 items-center">
          <ActivityIndicator size="large" color="#0f5cff" />
          <Text className="mt-3 text-subtext">{t('loadingLabel')}...</Text>
        </View>
      )}

      {hasError && (
        <View className="mt-10">
          <EmptyState title="Oops" description={events.error ?? 'Something went wrong'} />
          <Button label={t('retry')} className="mt-4" onPress={loadEvents} />
        </View>
      )}

      {!isLoading && !hasError && (
        <>
          <View className="mb-4 flex-row gap-4">
            <StatTile className="flex-1" label={t('upcomingEvents')} value={metrics.upcoming} />
            <StatTile className="flex-1" label={t('ticketsSold')} value={metrics.ticketsSold.toLocaleString()} />
          </View>
          <StatTile
            className="mb-6"
            label={`${t('revenueLabel')} (${currency})`}
            value={formatCurrency(metrics.totalRevenueARS, currency)}
            accent="#0f5cff"
          />

          <Section
            title={t('recentSalesTitle')}
            action={
              <View className="flex-row gap-2">
                {SALES_RANGE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.labelKey)}
                    size="sm"
                    selected={range === option.value}
                    onPress={() => setRange(option.value)}
                  />
                ))}
              </View>
            }
          >
            <View className="mb-4 flex-row flex-wrap gap-3">
              <StatTile
                className="flex-1 min-w-[45%]"
                label={`${t('rangeRevenueLabel')} · ${range === '7d' ? t('last7Days') : t('last30Days')}`}
                value={formatCurrency(salesSummary.totalRevenue, currency)}
              />
              <StatTile
                className="flex-1 min-w-[45%]"
                label={`${t('rangeTicketsLabel')} · ${range === '7d' ? t('last7Days') : t('last30Days')}`}
                value={salesSummary.totalTickets.toLocaleString()}
                accent="#0f172a"
              />
              <StatTile
                className="flex-1 min-w-[45%]"
                label={t('rangeAvgTicketLabel')}
                value={formatCurrency(Math.round(salesSummary.avgTicket), currency)}
                accent="#0f9d58"
              />
            </View>

            <BarChart
              data={chartData}
              width={chartWidth}
              height={220}
              fromZero
              withInnerLines={false}
              showValuesOnTopOfBars={range === '7d'}
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
              style={{ borderRadius: 16 }}
              segments={4}
              formatYLabel={(value) => formatCurrency(Number(value), currency)}
              barPercentage={range === '7d' ? 0.45 : 0.3}
              onDataPointClick={({ index }) => setSelectedBar(index)}
            />

            {selectedDay && (
              <View className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Text className="text-xs uppercase tracking-wide text-subtext">
                  {formatDate(selectedDay.dateISO, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text className="mt-1 text-xl font-semibold text-text">
                  {formatCurrency(selectedDay.revenueARS, currency)}
                </Text>
                <Text className="text-xs text-subtext">{t('selectedDayRevenue')}</Text>
                <View className="mt-3 flex-row items-baseline justify-between">
                  <View>
                    <Text className="text-lg font-semibold text-primary-700">{selectedDay.ticketsSold}</Text>
                    <Text className="text-xs text-subtext">{t('selectedDayTickets')}</Text>
                  </View>
                  <Text className="text-xs text-subtext">{t('selectedDayHint')}</Text>
                </View>
              </View>
            )}

            {bestDay && (
              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-sm text-subtext">
                  {t('bestDayLabel')} · {formatDate(bestDay.dateISO, { month: 'short', day: 'numeric' })}
                </Text>
                <Text className="text-sm font-semibold text-text">{formatCurrency(bestDay.revenueARS, currency)}</Text>
              </View>
            )}
          </Section>

          {isEmpty && <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />}

          {!isEmpty && (
            <Section title={t('suggestionsTitle')}>
              <Text className="text-base text-subtext">{t('suggestionsBody')}</Text>
            </Section>
          )}
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
