import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventsStackParamList } from '../navigation/types';
import { Event } from '../data/mockEvents';
import { fetchEventById } from '../lib/apiClient.mock';
import { useAppState } from '../store/appState';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import Avatar from '../components/Avatar';
import Chip from '../components/UI/Chip';
import Button from '../components/UI/Button';
import { formatCurrency } from '../lib/currency';

const placeholder = require('../assets/images/placeholder-event.jpg');

type NavigationProp = NativeStackNavigationProp<EventsStackParamList, 'EventDetail'>;
type RouteProps = RouteProp<EventsStackParamList, 'EventDetail'>;

const dateFormatter = (language: string) =>
  new Intl.DateTimeFormat(language === 'es' ? 'es-AR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const EventDetailScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { eventId } = route.params;
  const {
    events: { data },
    currency,
  } = useAppState();
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | undefined>(() => data.find((item) => item.id === eventId));
  const [loading, setLoading] = useState(!event);

  useEffect(() => {
    if (!event) {
      fetchEventById(eventId)
        .then((response) => setEvent(response))
        .catch(() => setEvent(undefined))
        .finally(() => setLoading(false));
    }
  }, [event, eventId]);

  useEffect(() => {
    if (!event && !loading) {
      navigation.goBack();
    }
  }, [event, loading, navigation]);

  const formattedDate = useMemo(() => (event ? dateFormatter(language).format(new Date(event.dateISO)) : ''), [
    event,
    language,
  ]);

  if (loading || !event) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0f5cff" />
        <Text className="mt-3 text-subtext">{t('loadingLabel')}...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 px-5 pt-4" contentInsetAdjustmentBehavior="automatic">
      <View className="mb-6 flex-row items-center justify-between">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          className="rounded-full bg-white p-2 shadow-card"
        >
          <Feather name="arrow-left" size={20} color="#0f172a" />
        </Pressable>
        <Text className="flex-1 px-4 text-center text-lg font-semibold text-text">{event.name}</Text>
        <Avatar initials={user?.initials ?? 'TU'} size="sm" />
      </View>

      <Image
        source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
        className="h-48 w-full rounded-3xl"
        contentFit="cover"
      />

      <View className="mt-5 rounded-3xl bg-white p-5 shadow-card">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-text">{t('detailsTitle')}</Text>
          <Chip label={t(`status_${event.status}` as const)} size="sm" disabled className="border-0 bg-muted" />
        </View>

        <View className="mb-4">
          <Text className="text-xs uppercase text-subtext">{t('dateLabel')}</Text>
          <Text className="mt-1 text-base text-text">{formattedDate}</Text>
        </View>

        <View className="mb-4">
          <Text className="text-xs uppercase text-subtext">{t('venueLabel')}</Text>
          <Text className="mt-1 text-base text-text">
            {event.venue} • {event.city}
          </Text>
        </View>

        <View className="mb-4">
          <Text className="text-xs uppercase text-subtext">{t('priceLabel')}</Text>
          <Text className="mt-1 text-2xl font-semibold text-primary-600">
            {formatCurrency(event.ticketPriceARS, currency)}
          </Text>
        </View>

        <Button label={t('seeMoreDisabled')} disabled className="mt-2" />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EventDetailScreen;
