import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Event } from "../data/mockEvents";
import Chip from "./UI/Chip";
import { formatCurrency } from "../lib/currency";
import type { CurrencyCode, Language } from "../lib/types";
import { useAppState } from "../store/appState";

const placeholder = require("../assets/images/placeholder-event.jpg");

type EventCardProps = {
  event: Event;
  language: Language;
  currency: CurrencyCode;
  statusLabel: string;
  onPress?: () => void;
};

const formatDate = (dateISO: string, language: Language) => {
  const locale = language === "es" ? "es-AR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateISO));
};

const statusAccentLight: Record<Event["status"], string> = {
  on_sale: "bg-green-100 text-green-700",
  sold_out: "bg-orange-100 text-orange-700",
  finished: "bg-slate-200 text-slate-700",
};

const EventCard: React.FC<EventCardProps> = ({
  event,
  currency,
  language,
  statusLabel,
  onPress,
}) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";

  const cardClass = `mb-4 flex-row rounded-3xl p-4 shadow-card border ${
    isDark
      ? "bg-card-dark border-border-dark"
      : "bg-card-light border-border-light"
  }`;
  const titleClass = `flex-1 text-lg font-semibold leading-6 ${
    isDark ? "text-text-dark" : "text-text-light"
  }`;
  const locationClass = `mt-1 text-sm ${
    isDark ? "text-subtext-dark" : "text-subtext-light"
  }`;
  const dateClass = `mt-2 text-sm font-medium ${
    isDark ? "text-slate-200" : "text-slate-700"
  }`;
  const priceClass = "text-base font-semibold text-primary-600";
  const statusAccent: Record<Event["status"], string> = isDark
    ? {
        on_sale: "text-emerald-50 bg-emerald-500/90",
        sold_out: "bg-orange-600/90 text-orange-50",
        finished: "bg-slate-600 text-slate-100",
      }
    : statusAccentLight;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cardClass}
    >
      <Image
        source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
        accessibilityLabel={`${event.name} poster`}
        contentFit="cover"
        className="h-24 w-24 rounded-2xl"
      />
      <View className="ml-4 flex-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text className={titleClass} numberOfLines={2}>
            {event.name}
          </Text>
          <Chip
            label={statusLabel}
            size="sm"
            className={`mt-1 border-0 ${statusAccent[event.status]}`}
            textClassName={isDark ? "text-white" : ""}
            disabled
          />
        </View>
        <Text className={locationClass} numberOfLines={1}>
          {event.venue} - {event.city}
        </Text>
        <Text className={dateClass}>{formatDate(event.dateISO, language)}</Text>
        <View className="mt-4 flex-row items-end justify-between">
          <View>
            <Text
              className={`text-[11px] font-medium ${
                isDark ? "text-subtext-dark" : "text-subtext-light"
              }`}
            >
              Precio desde
            </Text>
            <Text className={`${priceClass} mt-0.5`}>
              {formatCurrency(event.ticketPriceARS, currency)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default EventCard;
