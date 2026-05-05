import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppStackParamList } from "../navigation/types";
import AppHeader from "../components/stitch/AppHeader";
import SurfaceCard from "../components/stitch/SurfaceCard";
import Chip from "../components/stitch/Chip";
import { useAppState } from "../store/appState";
import { useAuth } from "../store/auth";
import { useTranslation } from "../hooks/useTranslation";
import { getPalette } from "../lib/theme";
import { radius, spacing, typography } from "../lib/design";

const themeOptions: { key: "light" | "dark" | "system"; label: string }[] = [
  { key: "light", label: "Claro" },
  { key: "dark", label: "Oscuro" },
  { key: "system", label: "Sistema" },
];

const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, biometricEnabled, disableBiometric, logout } = useAuth();
  const { themePreference, setTheme, theme } = useAppState();
  const { t } = useTranslation();
  const palette = getPalette(theme);

  const handleSignOut = () => {
    Alert.alert(
      t("signOutConfirmTitle"),
      t("signOutConfirmMessage"),
      [
        { text: t("signOutConfirmCancel"), style: "cancel" },
        { text: t("signOut"), style: "destructive", onPress: () => { logout(); } },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["2xl"] }}>
        <AppHeader title="Perfil" subtitle="Preferencias" avatarInitials={user?.initials} onBackPress={() => navigation.goBack()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md + 2 }}>
          <SurfaceCard>
            <Text style={{ ...typography.heading, color: palette.text }}>
              {user?.name ?? "Dashboard Preview"}
            </Text>
            <Text style={{ fontSize: 14, color: palette.subtext, marginTop: spacing.xs + 2 }}>
              {user?.email ?? "preview@tuentrada.com"}
            </Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={{ ...typography.title, color: palette.text }}>Apariencia</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              Cambiá entre modo claro, oscuro o sistema.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm + 2, marginTop: spacing.base }}>
              {themeOptions.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={themePreference === option.key}
                  onPress={() => setTheme(option.key)}
                />
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text style={{ ...typography.title, color: palette.text }}>{t("securityTitle")}</Text>
            <Text style={{ ...typography.body, color: palette.subtext, marginTop: spacing.xs }}>
              {t("securityBody")}
            </Text>
            {biometricEnabled ? (
              <Pressable
                onPress={disableBiometric}
                style={({ pressed }) => ({
                  marginTop: spacing.base,
                  backgroundColor: palette.surfaceMuted,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.md + 2,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: palette.text, fontWeight: "700", fontSize: 14 }}>
                  {t("faceIdDisable")}
                </Text>
              </Pressable>
            ) : null}
          </SurfaceCard>

          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: palette.danger,
              borderRadius: radius.pill,
              paddingVertical: spacing.base,
              alignItems: "center",
              marginTop: spacing.xs + 2,
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15 }}>{t("signOut")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
