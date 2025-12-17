import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import Chip from "../components/UI/Chip";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/UI/PageHeader";
import { useTranslation } from "../hooks/useTranslation";
import { formatCurrency } from "../lib/currency";
import type { Language } from "../lib/types";
import { useAppState } from "../store/appState";

type Sale = {
  id: string;
  eventId: string;
  eventName: string;
  functionLabel: string;
  saleDateISO: string;
  tickets: number;
  totalARS: number;
};

type DateFilter = "all" | "today" | "yesterday" | "last_week" | "last_month";

type DropdownOption = {
  label: string;
  value: string;
};

const dateOptions: DropdownOption[] = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
];

const baseDate = new Date();
const makeSaleDate = (daysAgo: number, hour: number, minute: number) => {
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const salesData: Sale[] = [
  {
    id: "sale-010",
    eventId: "evt-001",
    eventName: "Sunset Electronic Fest",
    functionLabel: "Main stage",
    saleDateISO: makeSaleDate(0, 10, 30),
    tickets: 4,
    totalARS: 140000,
  },
  {
    id: "sale-009",
    eventId: "evt-002",
    eventName: "Indie Nights Vol. 2",
    functionLabel: "Late show",
    saleDateISO: makeSaleDate(0, 9, 45),
    tickets: 2,
    totalARS: 36000,
  },
  {
    id: "sale-008",
    eventId: "evt-008",
    eventName: "Mendoza Sunset Sessions",
    functionLabel: "Sunset session",
    saleDateISO: makeSaleDate(1, 18, 20),
    tickets: 3,
    totalARS: 114000,
  },
  {
    id: "sale-007",
    eventId: "evt-005",
    eventName: "Patagonia Food Experience",
    functionLabel: "Tasting pass",
    saleDateISO: makeSaleDate(1, 12, 10),
    tickets: 5,
    totalARS: 125000,
  },
  {
    id: "sale-006",
    eventId: "evt-001",
    eventName: "Sunset Electronic Fest",
    functionLabel: "After party",
    saleDateISO: makeSaleDate(3, 22, 0),
    tickets: 6,
    totalARS: 210000,
  },
  {
    id: "sale-005",
    eventId: "evt-007",
    eventName: "Litoral Folk Weekend",
    functionLabel: "Folk gala",
    saleDateISO: makeSaleDate(6, 19, 30),
    tickets: 4,
    totalARS: 60000,
  },
  {
    id: "sale-004",
    eventId: "evt-006",
    eventName: "Cordoba Tech Summit",
    functionLabel: "Tech keynote",
    saleDateISO: makeSaleDate(9, 9, 0),
    tickets: 8,
    totalARS: 328000,
  },
  {
    id: "sale-003",
    eventId: "evt-003",
    eventName: "Jazz & Wine Terrace",
    functionLabel: "Acoustic night",
    saleDateISO: makeSaleDate(14, 20, 0),
    tickets: 3,
    totalARS: 66000,
  },
  {
    id: "sale-002",
    eventId: "evt-006",
    eventName: "Cordoba Tech Summit",
    functionLabel: "Workshops",
    saleDateISO: makeSaleDate(22, 10, 15),
    tickets: 10,
    totalARS: 410000,
  },
  {
    id: "sale-001",
    eventId: "evt-004",
    eventName: "Andes Mountain Run",
    functionLabel: "Race day",
    saleDateISO: makeSaleDate(29, 7, 0),
    tickets: 12,
    totalARS: 144000,
  },
];

const formatSaleDate = (iso: string, language: Language) =>
  new Intl.DateTimeFormat(language === "es" ? "es-AR" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const matchesDateFilter = (value: Date, filter: DateFilter) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfToday.getDate() - 7);

  const startOfLastMonth = new Date(startOfToday);
  startOfLastMonth.setDate(startOfToday.getDate() - 30);

  switch (filter) {
    case "today":
      return value >= startOfToday;
    case "yesterday":
      return value >= startOfYesterday && value < startOfToday;
    case "last_week":
      return value >= startOfLastWeek;
    case "last_month":
      return value >= startOfLastMonth;
    default:
      return true;
  }
};

const SaleCard = ({
  sale,
  currency,
  language,
  cardClass,
  titleClass,
  subtextClass,
  chipTextClass,
}: {
  sale: Sale;
  currency: string;
  language: Language;
  cardClass: string;
  titleClass: string;
  subtextClass: string;
  chipTextClass: string;
}) => (
  <View className={`mb-4 ${cardClass}`}>
    <View className="flex-row items-center justify-between">
      <Text className={titleClass}>{sale.eventName}</Text>
      <Chip
        label={sale.functionLabel}
        size="sm"
        disabled
        className="border-0 bg-slate-200 dark:bg-slate-700"
        textClassName={chipTextClass}
      />
    </View>
    <Text className={`mt-1 text-sm ${subtextClass}`}>
      {formatSaleDate(sale.saleDateISO, language)}
    </Text>
    <View className="mt-3 flex-row items-center justify-between">
      <Text className={`text-sm ${subtextClass}`}>Tickets: {sale.tickets}</Text>
      <Text className="text-lg font-semibold text-primary-600">
        {formatCurrency(sale.totalARS, currency)}
      </Text>
    </View>
  </View>
);

const VentasScreen = () => {
  const { currency, theme } = useAppState();
  const { language, t } = useTranslation();
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [functionFilter, setFunctionFilter] = useState<string>("all");

  const isDark = theme === "dark";
  const backgroundClass = isDark ? "bg-background-dark" : "bg-background-light";
  const cardClass = isDark
    ? "rounded-3xl p-4 shadow-card border border-border-dark bg-card-dark"
    : "rounded-3xl p-4 shadow-card border border-border-light bg-card-light";
  const titleClass = `flex-1 text-base font-semibold ${
    isDark ? "text-text-dark" : "text-text-light"
  }`;
  const subtextClass = isDark ? "text-subtext-dark" : "text-subtext-light";
  const chipTextClass = isDark ? "text-white" : "";

  const sortedSales = useMemo(
    () =>
      [...salesData].sort(
        (a, b) =>
          new Date(b.saleDateISO).getTime() - new Date(a.saleDateISO).getTime()
      ),
    []
  );

  const eventOptions = useMemo<DropdownOption[]>(() => {
    const unique = Array.from(new Set(salesData.map((sale) => sale.eventName)));
    return [
      { value: "all", label: "All events" },
      ...unique.map((name) => ({ value: name, label: name })),
    ];
  }, []);

  const functionOptions = useMemo<DropdownOption[]>(() => {
    const unique = Array.from(
      new Set(salesData.map((sale) => sale.functionLabel))
    );
    return [
      { value: "all", label: "All functions" },
      ...unique.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, []);

  const filteredSales = useMemo(() => {
    return sortedSales.filter((sale) => {
      const saleDate = new Date(sale.saleDateISO);
      const matchesDate = matchesDateFilter(saleDate, dateFilter);
      const matchesEvent =
        eventFilter === "all" || sale.eventName === eventFilter;
      const matchesFunction =
        functionFilter === "all" || sale.functionLabel === functionFilter;
      return matchesDate && matchesEvent && matchesFunction;
    });
  }, [sortedSales, dateFilter, eventFilter, functionFilter]);

  return (
    <SafeAreaView className={`flex-1 ${backgroundClass}`}>
      <PageHeader title="Ventas" />
      <View className="flex-1 px-5 pt-4">
        <View className="mb-4 flex-row gap-3">
          <View style={styles.dropdownWrapper}>
            <Dropdown
              data={dateOptions}
              labelField="label"
              valueField="value"
              value={dateFilter}
              placeholder="Date range"
              onChange={(item) => setDateFilter(item.value as DateFilter)}
              style={[styles.dropdown, isDark && styles.dropdownDark]}
              placeholderStyle={[
                styles.placeholder,
                isDark && styles.placeholderDark,
              ]}
              selectedTextStyle={[styles.selected, isDark && styles.selectedDark]}
              itemTextStyle={[styles.itemText, isDark && styles.itemTextDark]}
            />
          </View>
          <View style={styles.dropdownWrapper}>
            <Dropdown
              data={eventOptions}
              labelField="label"
              valueField="value"
              value={eventFilter}
              placeholder="Event"
              onChange={(item) => setEventFilter(item.value)}
              style={[styles.dropdown, isDark && styles.dropdownDark]}
              placeholderStyle={[
                styles.placeholder,
                isDark && styles.placeholderDark,
              ]}
              selectedTextStyle={[styles.selected, isDark && styles.selectedDark]}
              itemTextStyle={[styles.itemText, isDark && styles.itemTextDark]}
            />
          </View>
          <View style={styles.dropdownWrapper}>
            <Dropdown
              data={functionOptions}
              labelField="label"
              valueField="value"
              value={functionFilter}
              placeholder="Function"
              onChange={(item) => setFunctionFilter(item.value)}
              style={[styles.dropdown, isDark && styles.dropdownDark]}
              placeholderStyle={[
                styles.placeholder,
                isDark && styles.placeholderDark,
              ]}
              selectedTextStyle={[styles.selected, isDark && styles.selectedDark]}
              itemTextStyle={[styles.itemText, isDark && styles.itemTextDark]}
            />
          </View>
        </View>

        {filteredSales.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SaleCard
                sale={item}
                currency={currency}
                language={language}
                cardClass={cardClass}
                titleClass={titleClass}
                subtextClass={subtextClass}
                chipTextClass={chipTextClass}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 64 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  dropdownWrapper: {
    flex: 1,
    minWidth: 0,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  dropdownDark: {
    borderColor: "#1e293b",
    backgroundColor: "#0b1220",
  },
  placeholder: {
    color: "#94a3b8",
    fontSize: 14,
  },
  placeholderDark: {
    color: "#cbd5e1",
  },
  selected: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "600",
  },
  selectedDark: {
    color: "#e2e8f0",
  },
  itemText: {
    color: "#0f172a",
  },
  itemTextDark: {
    color: "#e2e8f0",
  },
});

export default VentasScreen;
