import React, { type ReactNode } from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Avatar from "../Avatar";
import { useAppState } from "../../store/appState";
import { getPalette } from "../../lib/theme";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  pillLabel?: string;
  onAvatarPress?: () => void;
  avatarInitials?: string;
  onBackPress?: () => void;
  rightAccessory?: ReactNode;
};

const AppHeader = ({
  title,
  subtitle,
  pillLabel,
  onAvatarPress,
  avatarInitials,
  onBackPress,
  rightAccessory,
}: AppHeaderProps) => {
  const { theme } = useAppState();
  const palette = getPalette(theme);
  const logoSource =
    theme === "dark"
      ? require("../../assets/images/logos-tuentrada/tuentrada-blanco.png")
      : require("../../assets/images/logos-tuentrada/tuentrada-negro.png");

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {onBackPress ? (
            <Pressable
              onPress={onBackPress}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.surfaceMuted,
                borderWidth: 1,
                borderColor: palette.hairline,
              }}
            >
              <Feather name="arrow-left" size={18} color={palette.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            {subtitle ? (
              <Text style={{ color: palette.subtext, fontSize: 13, marginBottom: 2 }}>{subtitle}</Text>
            ) : null}
            <Text style={{ color: palette.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 }}>
              {title}
            </Text>
          </View>
        </View>

        {rightAccessory ? rightAccessory : <Avatar initials={avatarInitials ?? "TU"} size="sm" onPress={onAvatarPress} />}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <View
          accessibilityRole="image"
          accessibilityLabel="Logo de Tuentrada"
          style={{
            backgroundColor: palette.surfaceMuted,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: palette.hairline,
          }}
        >
          <Image source={logoSource} resizeMode="contain" style={{ width: 92, height: 20 }} />
        </View>

        {pillLabel ? (
          <View
            style={{
              backgroundColor: palette.surfaceMuted,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: palette.hairline,
            }}
          >
            <Text style={{ color: palette.subtext, fontSize: 12, fontWeight: "700" }}>{pillLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default AppHeader;
