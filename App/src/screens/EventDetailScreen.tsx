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
    theme,
  } = useAppState();
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | undefined>(() => data.find((item) => item.id === eventId));
  const [loading, setLoading] = useState(!event);

  const isDark = theme === 'dark';
  const backgroundClass = isDark ? 'bg-background-dark' : 'bg-background-light';
  const textClass = isDark ? 'text-text-dark' : 'text-text-light';
  const subtextClass = isDark ? 'text-subtext-dark' : 'text-subtext-light';
  const cardClass = `mt-5 rounded-3xl p-5 shadow-card border ${
    isDark ? 'bg-card-dark border-border-dark' : 'bg-card-light border-border-light'
  }`;
  const iconButtonClass = `rounded-full p-2 shadow-card ${
    isDark ? 'bg-card-dark border border-border-dark' : 'bg-card-light border border-border-light'
  }`;
  const iconColor = isDark ? '#e2e8f0' : '#0f172a';
  const statusChipClass = isDark ? 'border-0 bg-slate-700' : 'border-0 bg-muted';
  const statusChipTextClass = isDark ? 'text-white' : '';

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
      <View className={`flex-1 items-center justify-center ${backgroundClass}`}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text className={`mt-3 ${subtextClass}`}>{t('loadingLabel')}...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${backgroundClass}`}>
      <ScrollView className="flex-1 px-5 pt-4" contentInsetAdjustmentBehavior="automatic">
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" className={iconButtonClass}>
            <Feather name="arrow-left" size={20} color={iconColor} />
          </Pressable>
          <Text className={`flex-1 px-4 text-center text-lg font-semibold ${textClass}`}>{event.name}</Text>
          <Avatar initials={user?.initials ?? 'TU'} size="sm" />
        </View>

        <Image
          source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
          className="h-48 w-full rounded-3xl"
          contentFit="cover"
        />

        <View className={cardClass}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className={`text-base font-semibold ${textClass}`}>{t('detailsTitle')}</Text>
            <Chip
              label={t(`status_${event.status}` as const)}
              size="sm"
              disabled
              className={statusChipClass}
              textClassName={statusChipTextClass}
            />
          </View>

          <View className="mb-4">
            <Text className={`text-xs uppercase ${subtextClass}`}>{t('dateLabel')}</Text>
            <Text className={`mt-1 text-base ${textClass}`}>{formattedDate}</Text>
          </View>

          <View className="mb-4">
            <Text className={`text-xs uppercase ${subtextClass}`}>{t('venueLabel')}</Text>
            <Text className={`mt-1 text-base ${textClass}`}>
              {event.venue} - {event.city}
            </Text>
          </View>

          <View className="mb-4">
            <Text className={`text-xs uppercase ${subtextClass}`}>{t('priceLabel')}</Text>
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
