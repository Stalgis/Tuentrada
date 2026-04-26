import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import DashboardScreen from "../screens/DashboardScreen";
import EventsListScreen from "../screens/EventsListScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import FunctionDetailScreen from "../screens/FunctionDetailScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SectorScreen from "@/screens/SectorScreen";
import SalesAnalyticsScreen from "@/screens/SalesAnalyticsScreen";
import ExecutiveDashboardScreen from "@/screens/ExecutiveDashboardScreen";
import TrendDetailScreen from "@/screens/TrendDetailScreen";
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
    <EventsStack.Screen name="FunctionDetail" component={FunctionDetailScreen} />
  </EventsStack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

const RootNavigator = () => {
  const {
    status,
    shouldPromptBiometricEnrollment,
    enableBiometric,
    dismissBiometricEnrollmentPrompt,
  } = useAuth();
  const { theme } = useAppState();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const biometricPromptOpenRef = useRef(false);

  useEffect(() => {
    if (!shouldPromptBiometricEnrollment || biometricPromptOpenRef.current) {
      return;
    }

    biometricPromptOpenRef.current = true;

    Alert.alert(
      "Activar biometría",
      "¿Querés usar biometría para ingresar más rápido la próxima vez?",
      [
        {
          text: "Ahora no",
          style: "cancel",
          onPress: () => {
            biometricPromptOpenRef.current = false;
            dismissBiometricEnrollmentPrompt();
          },
        },
        {
          text: "Activar",
          onPress: async () => {
            await enableBiometric();
            biometricPromptOpenRef.current = false;
          },
        },
      ],
      { cancelable: false },
    );
  }, [dismissBiometricEnrollmentPrompt, enableBiometric, shouldPromptBiometricEnrollment]);

  const tabBarStyle = {
    backgroundColor: isDark ? "#171717" : "#ffffff",
    borderTopColor: isDark ? "#2a2a2a" : "#d9dee7",
    borderTopWidth: 0,
    height: 68 + insets.bottom,
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 10),
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 24,
  } as const;

  const TabsNavigator = () => (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#aac7ff" : "#0058bc",
        tabBarInactiveTintColor: isDark ? "#8b91a0" : "#7b8494",
        tabBarStyle,
        tabBarItemStyle: { paddingBottom: 0, paddingTop: 0 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 2, fontWeight: "700" },
        tabBarIconStyle: { marginTop: 0 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Operación",
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
        name="Analytics"
        component={SalesAnalyticsScreen}
        options={{
          tabBarLabel: "Ventas",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Venue"
        component={PaymentScreen}
        options={{
          tabBarLabel: "Pagos",
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );

  const AppNavigator = () => (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs" component={TabsNavigator} />
      <AppStack.Screen name="ExecutiveDashboard" component={ExecutiveDashboardScreen} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
      <AppStack.Screen name="TrendDetail" component={TrendDetailScreen} />
    </AppStack.Navigator>
  );

  const renderAuth = () => <AuthNavigator />;

  const renderSplash = () => (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <ActivityIndicator size="large" color="#0058bc" />
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
