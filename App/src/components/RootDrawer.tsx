import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { DrawerLayout } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { useAuth } from "../store/auth";
import { useAppState } from "../store/appState";

type RootDrawerProps = {
  children: (openDrawer: () => void) => React.ReactNode;
};

const menuItems = [
  { label: "Dashboard", icon: "pie-chart" as const },
  { label: "Eventos", icon: "calendar" as const },
  { label: "Ventas", icon: "tag" as const },
  { label: "Perfil", icon: "user" as const },
  { label: "Settings", icon: "settings" as const },
];

const RootDrawer: React.FC<RootDrawerProps> = ({ children }) => {
  const drawerRef = useRef<DrawerLayout>(null);
  const { user } = useAuth();
  const { theme } = useAppState();
  const isDark = theme === "dark";

  const openDrawer = useCallback(() => drawerRef.current?.openDrawer(), []);
  const closeDrawer = useCallback(() => drawerRef.current?.closeDrawer(), []);

  const navigationView = useMemo(
    () => (
      <View
        className={`flex-1 ${
          isDark ? "bg-background-dark" : "bg-background-light"
        } px-4 pt-20`}
      >
        <View className="mb-6 flex-row items-center">
          <Avatar initials={user?.initials ?? "TU"} size="lg" />
          <View className="ml-3">
            <Text
              className={`text-lg font-semibold ${
                isDark ? "text-text-dark" : "text-text-light"
              }`}
            >
              {user?.name ?? "Usuario"}
            </Text>
            {user?.email ? (
              <Text
                className={`text-sm ${
                  isDark ? "text-subtext-dark" : "text-subtext-light"
                }`}
              >
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View>
          {menuItems.map((item) => (
            <Pressable
              key={item.label}
              onPress={closeDrawer}
              className="mb-3 flex-row items-center rounded-xl px-3 py-3"
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Feather
                name={item.icon}
                size={20}
                color={isDark ? "#e2e8f0" : "#0f172a"}
              />
              <Text
                className={`ml-3 text-base ${
                  isDark ? "text-text-dark" : "text-text-light"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [closeDrawer, isDark, user?.email, user?.initials, user?.name]
  );

  return (
    <DrawerLayout
      ref={drawerRef}
      drawerWidth={280}
      drawerPosition="left"
      drawerType="front"
      renderNavigationView={() => navigationView}
      overlayColor={isDark ? "rgba(0,0,0,0.4)" : "rgba(15,23,42,0.25)"}
    >
      {children(openDrawer)}
    </DrawerLayout>
  );
};

export default RootDrawer;
