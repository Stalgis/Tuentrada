import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Event } from "../data/mockEvents";
import EventCard from "../components/EventCard";
import EmptyState from "../components/EmptyState";
import Button from "../components/UI/Button";
import { useAppState } from "../store/appState";
import { useTranslation } from "../hooks/useTranslation";
import { EventsStackParamList } from "../navigation/types";
import TopBar from "../components/UI/TopBar";
import RootDrawer from "../components/RootDrawer";
import { useAuth } from "../store/auth";
import FilterChip from "../components/UI/FilterChip";

const statusFilters = ["all", "on_sale", "sold_out", "finished"] as const;

const EventsListScreen = () => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { user } = useAuth();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<EventsStackParamList, "EventsList">
    >();
  const rootNavigation = useNavigation<NavigationProp<ParamListBase>>();
  const {
    events: { data, status, error },
    loadEvents,
    currency,
  } = useAppState();
  const { t, language } = useTranslation();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilters)[number]>("all");

  useEffect(() => {
    if (status === "idle") {
      loadEvents();
    }
  }, [status, loadEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.filter((event) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [event.name, event.venue, event.city].some((field) =>
          field.toLowerCase().includes(normalizedQuery)
        );
      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, query, statusFilter]);

  const handlePress = useCallback(
    (event: Event) => {
      navigation.navigate("EventDetail", { eventId: event.id });
    },
    [navigation]
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
    [currency, handlePress, language, t]
  );

  const isLoading = status === "loading" && data.length === 0;
  const showEmpty = status === "success" && filteredEvents.length === 0;
  const backgroundClass = isDark ? "bg-background-dark" : "bg-background-light";
  const searchWrapperClass = `mb-4 flex-row items-center rounded-2xl border px-4 ${
    isDark
      ? "border-border-dark bg-card-dark text-text-dark"
      : "border-border-light bg-card-light text-text-light"
  }`;
  const searchIconColor = isDark ? "#94a3b8" : "#64748b";
  const placeholderColor = isDark ? "#94a3b8" : "#475569";
  const subtextClass = isDark ? "text-subtext-dark" : "text-subtext-light";
  const handleAvatarPress = useCallback(() => {
    const parentNav = rootNavigation.getParent?.();
    const target = parentNav ?? rootNavigation;
    target.navigate("Profile");
  }, [rootNavigation]);

  return (
    <RootDrawer>
      {(openDrawer) => (
        <SafeAreaView className={`flex-1 ${backgroundClass}`}>
          <TopBar
            title="Eventos"
            onLeftPress={openDrawer}
            onRightPress={handleAvatarPress}
            rightInitials={user?.initials}
          />
          <View className="flex-1 px-5 pt-4">
            <View className={searchWrapperClass}>
              <Feather name="search" size={16} color={searchIconColor} />
              <TextInput
                placeholder={t("searchPlaceholder")}
                placeholderTextColor={placeholderColor}
                value={query}
                onChangeText={setQuery}
                accessibilityLabel="Search events"
                className={`ml-3 flex-1 text-base ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
                style={{
                  height: 44,
                  minHeight: 44,
                  paddingVertical: 0,
                  lineHeight: Platform.OS === "ios" ? 20 : undefined,
                  textAlignVertical: "center",
                }}
              />
            </View>

            <View className="mb-4 flex-row flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <FilterChip
                  key={filter}
                  label={t(`status_${filter}` as const)}
                  active={statusFilter === filter}
                  onPress={() => setStatusFilter(filter)}
                />
              ))}
            </View>

            {isLoading && (
              <View className="mt-10 items-center">
                <ActivityIndicator size="large" color="#007bff" />
                <Text className={`mt-3 ${subtextClass}`}>
                  {t("loadingLabel")}...
                </Text>
              </View>
            )}

            {status === "error" && (
              <View className="mt-6">
                <EmptyState
                  title="Error"
                  description={error ?? "Something went wrong"}
                />
                <Button
                  label={t("retry")}
                  className="mt-4"
                  onPress={loadEvents}
                />
              </View>
            )}

            {!isLoading && status !== "error" && (
              <>
                {showEmpty ? (
                  <EmptyState
                    title={t("emptyTitle")}
                    description={t("emptyBody")}
                  />
                ) : (
                  <FlatList
                    data={filteredEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                    refreshing={status === "loading"}
                    onRefresh={loadEvents}
                  />
                )}
              </>
            )}
          </View>
        </SafeAreaView>
      )}
    </RootDrawer>
  );
};

export default EventsListScreen;
