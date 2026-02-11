import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Event } from "../data/mockEvents";
import type { CurrencyCode, Language } from "../lib/types";
import { formatCurrency } from "../lib/currency";
import Button from "./UI/Button";

const placeholder = require("../assets/images/placeholder-event.jpg");

type EventCardVerticalProps = {
  event: Event;
  language: Language;
  currency: CurrencyCode;
  statusLabel: string;
  onPress?: () => void;
};

const formatDate = (dateISO: string, language: Language) => {
  const locale = language === "es" ? "es-AR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateISO));
};

const statusColorMap: Record<Event["status"], string> = {
  on_sale: "#4CAF50",
  sold_out: "#ff7043",
  finished: "#e53935",
};

const EventCardVertical: React.FC<EventCardVerticalProps> = ({
  event,
  currency,
  language,
  statusLabel,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    className="rounded-3xl bg-white shadow-card"
  >
    <View className="relative">
      <Image
        source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
        accessibilityLabel={`${event.name} poster`}
        contentFit="cover"
        className="h-40 w-full rounded-t-3xl"
      />
      <View
        style={[
          styles.ribbon,
          { backgroundColor: statusColorMap[event.status] },
        ]}
      >
        <Text className="text-[10px] font-bold uppercase text-white">
          {statusLabel}
        </Text>
      </View>
    </View>
    <View className="p-4">
      <Text className="text-base font-bold text-slate-900">
        {event.name}
      </Text>
      <Text className="mt-1 text-sm text-slate-500">
        {event.venue} - {event.city}
      </Text>
      <Text className="mt-2 text-sm font-medium text-slate-700">
        {formatDate(event.dateISO, language)}
      </Text>
      <Text className="mt-2 text-lg font-bold text-primary-600">
        {formatCurrency(event.ticketPriceARS, currency)}
      </Text>
      <Button label="Comprar" className="mt-4 w-full" onPress={onPress} />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  ribbon: {
    position: "absolute",
    top: 16,
    left: -42,
    width: 140,
    paddingVertical: 4,
    alignItems: "center",
    transform: [{ rotate: "-45deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
});

export default EventCardVertical;
