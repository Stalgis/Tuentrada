import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import DashboardScreen from "../screens/DashboardScreen";
import EventsListScreen from "../screens/EventsListScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SectorScreen from "@/screens/SectorScreen";
import PaymentScreen from "@/screens/PaymentScreen";
import { getNavigationTheme } from "../lib/theme";
import {
  EventsStackParamList,
  RootTabParamList,
  AuthStackParamList,
  AppStackParamList,
} from "./types";
import { useAuth } from "../store/auth";
import { useAppState } from "../store/appState";

const Tab = createBottomTabNavigator<RootTabParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const EventsNavigator = () => (
  <EventsStack.Navigator screenOptions={{ headerShown: false }}>
    <EventsStack.Screen name="EventsList" component={EventsListScreen} />
    <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
  </EventsStack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

const RootNavigator = () => {
  const { status } = useAuth();
  const { theme } = useAppState();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";

  const tabBarStyle = {
    backgroundColor: isDark ? "#020617" : "#ffffff",
    borderTopColor: isDark ? "#1e293b" : "#e2e8f0",
    borderTopWidth: 1,
    height: 58 + insets.bottom,
    paddingTop: 4,
    paddingBottom: Math.max(insets.bottom, 8),
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
  } as const;

  const TabsNavigator = () => (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#60a5fa" : "#0f5cff",
        tabBarInactiveTintColor: isDark ? "#94a3b8" : "#94a3b8",
        tabBarStyle,
        tabBarItemStyle: { paddingBottom: 0, paddingTop: 0 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 2 },
        tabBarIconStyle: { marginTop: 0 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Resumen",
          tabBarIcon: ({ color, size }) => (
            <Feather name="pie-chart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsNavigator}
        options={{
          tabBarLabel: "Eventos",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Ventas"
        component={SectorScreen}
        options={{
          tabBarLabel: "Ventas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Pago"
        component={PaymentScreen}
        options={{
          tabBarLabel: "Pago",
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
    </AppStack.Navigator>
  );

  const renderAuth = () => <AuthNavigator />;

  const renderSplash = () => (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <ActivityIndicator size="large" color="#0f5cff" />
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
