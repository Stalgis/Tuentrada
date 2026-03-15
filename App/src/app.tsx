import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { AppStateProvider } from "./store/appState";
import { AuthProvider } from "./store/auth";
import Navigator from "./navigation/RootNavigator";
import { useAppState } from "./store/appState";

const ThemedContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useAppState();
  const isDark = theme === "dark";
  const { setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    // Sync NativeWind's color scheme with our app theme so `dark:` classes work
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return (
    <View
      className={`flex-1 ${
        isDark ? "dark bg-background-dark" : "bg-background-light"
      }`}
    >
      {children}
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
};

export const AppContainer = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AuthProvider>
        <AppStateProvider>
          <ThemedContainer>
            <Navigator />
          </ThemedContainer>
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

export default AppContainer;
