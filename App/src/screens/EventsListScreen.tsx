import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Event } from '../data/mockEvents';
import EventCard from '../components/EventCard';
import Chip from '../components/UI/Chip';
import EmptyState from '../components/EmptyState';
import Button from '../components/UI/Button';
import { useAppState } from '../store/appState';
import { useTranslation } from '../hooks/useTranslation';
import { EventsStackParamList } from '../navigation/types';

const statusFilters = ['all', 'on_sale', 'sold_out', 'finished'] as const;

const EventsListScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList, 'EventsList'>>();
  const {
    events: { data, status, error },
    loadEvents,
    currency,
  } = useAppState();
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>('all');

  useEffect(() => {
    if (status === 'idle') {
      loadEvents();
    }
  }, [status, loadEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.filter((event) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [event.name, event.venue, event.city].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, query, statusFilter]);

  const handlePress = useCallback(
    (event: Event) => {
      navigation.navigate('EventDetail', { eventId: event.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Event }) => (
      <EventCard
        event={item}
        currency={currency}
        language={language}
        statusLabel={t(`status_${item.status}` as const)}
        onPress={() => handlePress(item)}
      />
    ),
    [currency, handlePress, language, t],
  );

  const isLoading = status === 'loading' && data.length === 0;
  const showEmpty = status === 'success' && filteredEvents.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-5 pt-4">
      <Text className="mb-4 text-2xl font-semibold text-text">{t('eventsTitle')}</Text>

      <TextInput
        placeholder={t('searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        className="mb-4 rounded-2xl border border-border bg-white px-4 py-3 text-base text-text"
        accessibilityLabel="Search events"
      />

      <View className="mb-4 flex-row flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Chip
            key={filter}
            label={t(`status_${filter}` as const)}
            selected={statusFilter === filter}
            onPress={() => setStatusFilter(filter)}
          />
        ))}
      </View>

      {isLoading && (
        <View className="mt-10 items-center">
          <ActivityIndicator size="large" color="#0f5cff" />
          <Text className="mt-3 text-subtext">{t('loadingLabel')}...</Text>
        </View>
      )}

      {status === 'error' && (
        <View className="mt-6">
          <EmptyState title="Error" description={error ?? 'Something went wrong'} />
          <Button label={t('retry')} className="mt-4" onPress={loadEvents} />
        </View>
      )}

      {!isLoading && status !== 'error' && (
        <>
          {showEmpty ? (
            <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
          ) : (
            <FlatList
              data={filteredEvents}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 64 }}
              showsVerticalScrollIndicator={false}
              refreshing={status === 'loading'}
              onRefresh={loadEvents}
            />
          )}
        </>
      )}
      </View>
    </SafeAreaView>
  );
};

export default EventsListScreen;
