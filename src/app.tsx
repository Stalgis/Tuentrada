import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { AppStateProvider, useAppState } from "./store/appState";
import { AuthProvider } from "./store/auth";
import { PushProvider } from "./store/push";
import { useNotificationResponses } from "./hooks/useNotificationResponses";
import Navigator from "./navigation/RootNavigator";

const ThemedContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    // Sync NativeWind's color scheme with our app theme so `dark:` classes work
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return (
    <View className={`flex-1 ${isDark ? "bg-background-dark" : "bg-background-light"}`}>
      {children}
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
};

/**
 * Los avisos tocados se escuchan por encima del gate de autenticación: el
 * arranque en frío ocurre antes de que exista sesión.
 */
const NotificationListeners = ({ children }: { children: React.ReactNode }) => {
  useNotificationResponses();
  return <>{children}</>;
};

export const AppContainer = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AuthProvider>
        <AppStateProvider>
          <PushProvider>
            <NotificationListeners>
              <ThemedContainer>
                <Navigator />
              </ThemedContainer>
            </NotificationListeners>
          </PushProvider>
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default AppContainer;
