import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Event } from '../data/mockEvents';
import Chip from './UI/Chip';
import { formatCurrency } from '../lib/currency';
import type { CurrencyCode, Language } from '../lib/types';

const placeholder = require('../assets/images/placeholder-event.jpg');

type EventCardProps = {
  event: Event;
  language: Language;
  currency: CurrencyCode;
  statusLabel: string;
  onPress?: () => void;
};

const formatDate = (dateISO: string, language: Language) => {
  const locale = language === 'es' ? 'es-AR' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateISO));
};

const statusAccent: Record<Event['status'], string> = {
  on_sale: 'bg-green-100 text-green-700',
  sold_out: 'bg-orange-100 text-orange-700',
  finished: 'bg-slate-200 text-slate-700',
};

const EventCard: React.FC<EventCardProps> = ({ event, currency, language, statusLabel, onPress }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    className="mb-4 flex-row rounded-3xl bg-white p-4 shadow-card"
  >
    <Image
      source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
      accessibilityLabel={`${event.name} poster`}
      contentFit="cover"
      className="h-20 w-20 rounded-2xl"
    />
    <View className="ml-4 flex-1">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-semibold text-text">{event.name}</Text>
        <Chip label={statusLabel} size="sm" className={`border-0 ${statusAccent[event.status]}`} disabled />
      </View>
      <Text className="mt-1 text-sm text-subtext">
        {event.venue} • {event.city}
      </Text>
      <Text className="mt-1 text-sm font-medium text-text">{formatDate(event.dateISO, language)}</Text>
      <Text className="mt-2 text-base font-semibold text-primary-600">
        {formatCurrency(event.ticketPriceARS, currency)}
      </Text>
    </View>
  </Pressable>
);

export default EventCard;
