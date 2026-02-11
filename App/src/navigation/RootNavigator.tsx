import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import DashboardScreen from "../screens/DashboardScreen";
import EventsListScreen from "../screens/EventsListScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import { getNavigationTheme } from "../lib/theme";
import {
  EventsStackParamList,
  RootTabParamList,
  AuthStackParamList,
  AppStackParamList,
} from "./types";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../store/auth";
import { useAppState } from "../store/appState";
import type { AuthStatus } from "../store/auth";
import SectorScreen from "@/screens/SectorScreen";
import PaymentScreen from "@/screens/PaymentScreen";

const Tab = createBottomTabNavigator<RootTabParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const EventsNavigator = () => (
  <EventsStack.Navigator screenOptions={{ headerShown: false }}>
    <EventsStack.Screen name="EventsList" component={EventsListScreen} />
    <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
    <EventsStack.Screen name="Ventas" component={SectorScreen} />
  </EventsStack.Navigator>
);

const AuthNavigator = ({ status }: { status: AuthStatus }) => (
  <AuthStack.Navigator key={status} screenOptions={{ headerShown: false }}>
    {status === "needsPasswordChange" ? (
      <AuthStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
      />
    ) : (
      <AuthStack.Screen name="Login" component={LoginScreen} />
    )}
  </AuthStack.Navigator>
);

const RootNavigator = () => {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { theme } = useAppState();
  const isDark = theme === "dark";

  const tabBarStyle = {
    backgroundColor: isDark ? "#011a34" : "#ffffff",
    borderTopColor: isDark ? "#0b2a52" : "#d9e3f0",
    borderTopWidth: 1,
    height: 74,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 10,
    shadowColor: "#011a34",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
  } as const;

  const TabsNavigator = () => (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#5aa2ff" : "#007bff",
        tabBarInactiveTintColor: isDark ? "#94a3b8" : "#94a3b8",
        tabBarStyle,
        tabBarItemStyle: { paddingBottom: 2 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 6 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: t("overviewTitle"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="pie-chart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsNavigator}
        options={{
          tabBarLabel: t("eventsTitle"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Ventas"
        component={SectorScreen}
        options={{
          tabBarLabel: t("ventasTitle"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MedioDePago"
        component={PaymentScreen}
        options={{
          tabBarLabel: t("paymentMethodsTitle"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );

  const AppNavigator = () => (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={TabsNavigator} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen name="Settings" component={SettingsScreen} />
    </AppStack.Navigator>
  );

  const renderAuth = () => <AuthNavigator status={status} />;

  const renderSplash = () => (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );

  return (
    <NavigationContainer theme={getNavigationTheme(theme)}>
      {status === "checking" ? (
        renderSplash()
      ) : status === "authenticated" ? (
        <AppNavigator />
      ) : (
        renderAuth()
      )}
    </NavigationContainer>
  );
};

export default RootNavigator;
