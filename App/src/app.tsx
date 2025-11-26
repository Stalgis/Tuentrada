import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './store/appState';
import { AuthProvider } from './store/auth';
import Navigator from './navigation/RootNavigator';

export const AppContainer = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AuthProvider>
        <AppStateProvider>
          <Navigator />
          <StatusBar style="dark" />
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default AppContainer;
