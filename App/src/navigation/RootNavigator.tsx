import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import EventsListScreen from '../screens/EventsListScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import { getNavigationTheme } from '../lib/theme';
import { EventsStackParamList, RootTabParamList, AuthStackParamList } from './types';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../store/auth';
import { useAppState } from '../store/appState';
import type { AuthStatus } from '../store/auth';

const Tab = createBottomTabNavigator<RootTabParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const EventsNavigator = () => (
  <EventsStack.Navigator screenOptions={{ headerShown: false }}>
    <EventsStack.Screen name="EventsList" component={EventsListScreen} />
    <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
  </EventsStack.Navigator>
);

const AuthNavigator = ({ status }: { status: AuthStatus }) => (
  <AuthStack.Navigator key={status} screenOptions={{ headerShown: false }}>
    {status === 'needsPasswordChange' ? (
      <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    ) : (
      <AuthStack.Screen name="Login" component={LoginScreen} />
    )}
  </AuthStack.Navigator>
);

const RootNavigator = () => {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { theme } = useAppState();

  const tabBarStyle = {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    height: 74,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
  } as const;

  const renderTabs = () => (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0f5cff',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle,
        tabBarItemStyle: { paddingBottom: 2 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 6 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('overviewTitle'),
          tabBarIcon: ({ color, size }) => <Feather name="pie-chart" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsNavigator}
        options={{
          tabBarLabel: t('eventsTitle'),
          tabBarIcon: ({ color, size }) => <Feather name="calendar" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('profileTitle'),
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );

  const renderAuth = () => <AuthNavigator status={status} />;

  const renderSplash = () => (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color="#0f5cff" />
    </View>
  );

  return (
    <NavigationContainer theme={getNavigationTheme(theme)}>
      {status === 'checking'
        ? renderSplash()
        : status === 'authenticated'
          ? renderTabs()
          : renderAuth()}
    </NavigationContainer>
  );
};

export default RootNavigator;
