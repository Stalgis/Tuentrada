import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventsStackParamList } from '../navigation/types';
import { Event } from '../data/mockEvents';
import { fetchEventById } from '../lib/apiClient.mock';
import { useAppState } from '../store/appState';
import { useAuth } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import Chip from '../components/UI/Chip';
import { formatCurrency } from '../lib/currency';
import TopBar from '../components/UI/TopBar';

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
  const statusChipClass = isDark ? 'border-0 bg-slate-700' : 'border-0 bg-muted';
  const statusChipTextClass = isDark ? 'text-white' : '';
  const eyebrowClass = `text-[11px] font-medium ${
    isDark ? 'text-subtext-dark' : 'text-subtext-light'
  }`;
  const sectionValueClass = `mt-1 text-base ${
    isDark ? 'text-text-dark' : 'text-text-light'
  }`;
  const handleAvatarPress = useCallback(() => {
    navigation.getParent?.()?.navigate('Profile');
  }, [navigation]);

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
      <TopBar
        title={event.name}
        onLeftPress={() => navigation.goBack()}
        onRightPress={handleAvatarPress}
        rightInitials={user?.initials}
        leftIcon="back"
        titleNumberOfLines={1}
        titleClassName="text-xl"
      />
      <ScrollView
        className="flex-1 px-5 pt-3"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Image
          source={event.imageUrl ? { uri: event.imageUrl } : placeholder}
          className="h-48 w-full rounded-3xl"
          contentFit="cover"
        />

        <View className={cardClass.replace('mt-5', 'mt-4')}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className={eyebrowClass}>Resumen</Text>
              <Text className={`mt-1 text-lg font-semibold ${textClass}`}>
                {t('detailsTitle')}
              </Text>
            </View>
            <Chip
              label={t(`status_${event.status}` as const)}
              size="sm"
              disabled
              className={`mt-0.5 ${statusChipClass}`}
              textClassName={statusChipTextClass}
            />
          </View>

          <View className={`mt-5 rounded-2xl border px-4 py-4 ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
          }`}>
            <Text className={eyebrowClass}>{t('dateLabel')}</Text>
            <Text className={`mt-1 text-base font-medium leading-6 ${textClass}`}>
              {formattedDate}
            </Text>
          </View>

          <View className="mt-4 flex-row gap-3">
            <View className={`flex-1 rounded-2xl border px-4 py-4 ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
            }`}>
              <Text className={eyebrowClass}>{t('venueLabel')}</Text>
              <Text className={`${sectionValueClass} font-medium`} numberOfLines={2}>
                {event.venue}
              </Text>
              <Text className={`mt-1 text-sm ${subtextClass}`}>{event.city}</Text>
            </View>

            <View className={`w-[42%] rounded-2xl border px-4 py-4 ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
            }`}>
              <Text className={eyebrowClass}>{t('priceLabel')}</Text>
              <Text className="mt-1 text-2xl font-semibold text-primary-600">
                {formatCurrency(event.ticketPriceARS, currency)}
              </Text>
            </View>
          </View>

          <View
            className={`mt-5 rounded-2xl border px-4 py-3 ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
            }`}
          >
            <Text className={eyebrowClass}>Próximamente</Text>
            <Text className={`mt-1 text-sm ${subtextClass}`}>
              Más información disponible próximamente.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EventDetailScreen;
